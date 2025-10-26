import 'dotenv/config';
import fs from 'fs';
import { join } from 'path';
import express, { Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { Theme, Style } from '../src/types';
import { generateImage } from '../src/ai';
import { setUserState, getUserState, clearUserState } from '../src/state';
import { WebhookEvent } from '@line/bot-sdk';
import { uploadImage, deleteImage } from '../src/cloudinary';

// --- 1. Load Data ---
const themesPath = join(__dirname, '../themes.json');
const stylesPath = join(__dirname, '../styles.json');

const themes: Theme[] = JSON.parse(fs.readFileSync(themesPath, 'utf8')).themes;
const styles: Style[] = JSON.parse(fs.readFileSync(stylesPath, 'utf8')).styles;

const MAX_TEXT_LENGTH = 20; // Recommended maximum length for single-line blessing text

const TRIGGER_PHRASES = ['開始', '生成圖片', '長輩圖', '我想做圖', 'start', 'generate image'];

// --- 2. Setup LINE SDK and Express ---
const config: line.MiddlewareConfig & line.ClientConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const client = new line.Client(config);
const app = express();
// app.get('/', (req: Request, res: Response) => res.send('LINE Gemini Calendar Bot is running!'));
// --- 3. Webhook Handler ---
app.post('/api/webhook', line.middleware(config), async (req: Request, res: Response) => {
  console.log('Webhook received!');
  // Handle LINE webhook verification requests gracefully
  try {
    const events: WebhookEvent[] = req.body.events;
    console.log('events', events);
    
    const results = await Promise.all(events.map(handleEvent));
    res.status(200).json(results);
  } catch (err: unknown) {
    console.error("!!!!!!!!!! TOP LEVEL ERROR START !!!!!!!!!!");
    console.error(JSON.stringify(err, null, 2));
    console.error("!!!!!!!!!! TOP LEVEL ERROR END !!!!!!!!!!");
    res.status(500).send('Error processing webhook');
  }
});

// --- 4. Event-handling functions ---
async function handleEvent(event: line.WebhookEvent): Promise<any> {
  console.log("Received LINE event.");
  let sourceId: string | undefined;
  if (event.source.type === 'user') {
    sourceId = event.source.userId;
  } else if (event.source.type === 'group') {
    sourceId = event.source.groupId;
  } else if (event.source.type === 'room') {
    sourceId = event.source.roomId;
  }

  if (!sourceId) {
    console.error("Could not determine sourceId for event:", event);
    return Promise.resolve(null);
  }

  if (event.type === 'postback') {
    return handlePostback(event, sourceId);
  }
  if (event.type === 'message' && event.message.type === 'text') {
    return handleTextMessage(event, sourceId);
  }
  if (event.type === 'follow') {
    return sendWelcomeMessage(event.replyToken);
  }
  return Promise.resolve(null);
}

async function sendWelcomeMessage(replyToken: string) {
  const triggerKeywords = TRIGGER_PHRASES.map(phrase => `「${phrase}」`).join('、');
  const welcomeText = `哈囉！我是您的專屬長輩圖生成器！🌸\n\n您可以透過我輕鬆生成帶有祝福語的圖片，並分享給親朋好友。\n\n請輸入 ${triggerKeywords} 來製作您的第一張長輩圖吧！`;
  await client.replyMessage(replyToken, {
    type: 'text',
    text: welcomeText,
  });
  // After sending welcome message, also present the theme selection
  return replyThemeSelection(replyToken);
}

async function handleTextMessage(event: line.MessageEvent, sourceId: string) {
      const userText = (event.message as line.TextMessage).text;
      console.log('User text:', userText);
      const userState = await getUserState(sourceId);
  const normalizedUserText = userText.toLowerCase().trim();
  if (TRIGGER_PHRASES.some(phrase => normalizedUserText.includes(phrase))) {
    await clearUserState(sourceId);
    return replyThemeSelection(event.replyToken);
  }

  if (userState) {
    // User is in the middle of a conversation - this message is the blessing text
    let { theme, style } = userState;
    let styleInfo: string; // Declare styleInfo here
    let text = userText;

    if (text === '用主題預設文字') {
      text = theme.defaultText;
    } else if (text === '請 AI 生成祝福語') {
      text = ''; // Pass an empty string to signal AI generation in generateImage
    }

    // --- Text length validation ---
    console.log(`Validating text: "${text}" (length: ${text.length}), MAX_TEXT_LENGTH: ${MAX_TEXT_LENGTH}`);
    if (text.length > MAX_TEXT_LENGTH) {
      return client.replyMessage(event.replyToken, { type: 'text', text: `祝福語長度超過 ${MAX_TEXT_LENGTH} 字，請重新輸入。` });
    }

    // If style is empty (meaning user selected theme but not style yet), default to the first style
    if (Object.keys(style).length === 0) {
      style = styles[0];
      styleInfo = `（預設風格：${style.name}）`;
    } else {
      styleInfo = `（風格：${style.name}）`;
    }

    let replyText: string;
    if (text === '') {
      replyText = `好的，為您生成圖片 ${styleInfo}，並由 AI 為您生成專屬祝福語，請稍候...`;
    } else {
      replyText = `好的，為您生成圖片 ${styleInfo}，並加上祝福語：「${text}」，請稍候...`;
    }

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText,
    });

    let cloudinaryPublicId: string | undefined;
    try {
      const imageBuffer = await generateImage(userState.theme, userState.style, text);
      const imageUrl = await uploadImage(imageBuffer);

      // Extract publicId from Cloudinary URL for deletion
      const urlParts = imageUrl.split('/');
      cloudinaryPublicId = urlParts[urlParts.length - 1].split('.')[0];

      const message = { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl } as line.ImageMessage;

      // Use sourceId for pushMessage as replyToken might expire
      await client.pushMessage(sourceId, message);

      // Add a 10-second delay to ensure LINE has time to process the image
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Clear user state ONLY after successful image generation and message sending
      await clearUserState(sourceId);

      // Delete image from Cloudinary after successful LINE message sending
      if (cloudinaryPublicId) {
        await deleteImage(cloudinaryPublicId);
        console.log(`Deleted image ${cloudinaryPublicId} from Cloudinary.`);
      }

    } catch (error: any) {
      console.error('Error in image generation or upload process:', error);
      await client.pushMessage(sourceId, {
        type: 'text',
        text: `圖片生成或上傳失敗，請稍後再試。錯誤：${error.message || '未知錯誤'}`,
      });
    }

  } else {
    // This is a new conversation or state has expired
    const normalizedUserText = userText.toLowerCase().trim();

    const selectedTheme = themes.find((t: Theme) => t.name === userText);

    if (selectedTheme) {
      // User selected a theme from the quick reply menu
      // Set the theme in user state, but without a style yet
      await setUserState(sourceId, { theme: selectedTheme, style: {} as Style, timestamp: Date.now() });
      // Then prompt for style selection
      return replyStyleSelection(event.replyToken, selectedTheme.id);
    } else if (TRIGGER_PHRASES.some(phrase => normalizedUserText.includes(phrase))) {
      // User used a trigger phrase, start theme selection
      // The replyThemeSelection will be called, which presents the quick reply menu.
      return replyThemeSelection(event.replyToken);
    } else {
      // Not a trigger phrase or theme selection
      if (event.source.type === 'user') {
        // Only send polite message in 1:1 chat
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '您好！若要開始生成長輩圖，請輸入「開始」、「生成圖片」或「長輩圖」等關鍵字。'
        });
      } else {
        // In group/room, do nothing if not a trigger phrase
        return Promise.resolve(null);
      }
    }
  }
}

async function handlePostback(event: line.PostbackEvent, sourceId: string) {
  const postbackData = new URLSearchParams(event.postback.data);
  const themeId = postbackData.get('themeId');
  const styleId = postbackData.get('styleId');

  const theme = themes.find((t: Theme) => t.id === themeId);
  const style = styles.find((s: Style) => s.id === styleId);

  if (!theme || !style) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，找不到對應的主題或風格。' });
  }

  // Save user's state
  await setUserState(sourceId, { theme, style, timestamp: Date.now() });

  // Ask for blessing text
  return replyTextPrompt(event.replyToken, theme.defaultText);
}

// --- 5. Message-sending functions ---
function replyThemeSelection(replyToken: string) {
  const columns: line.TemplateColumn[] = themes.map((theme: Theme) => ({
    thumbnailImageUrl: theme.thumbnail, // Use theme.thumbnail
    title: theme.name,
    text: '點擊選擇此主題', // Concise text
    actions: [
      { type: 'message', label: '選擇', text: theme.name } as line.Action,
    ],
  }));

  const message: line.TemplateMessage = {
    type: 'template',
    altText: '請選擇今天想傳的祝福主題 🌸',
    template: {
      type: 'carousel',
      columns: columns,
      imageAspectRatio: 'square',
      imageSize: 'cover',
    },
  };
  return client.replyMessage(replyToken, message);
}

function replyStyleSelection(replyToken: string, themeId: string) {
  const columns: line.TemplateColumn[] = styles.map((style: Style) => ({
    thumbnailImageUrl: style.thumbnail,
    title: style.name,
    text: '點我選擇此風格',
    actions: [{ type: 'postback', label: '選擇', data: `themeId=${themeId}&styleId=${style.id}` }],
  }));

  const message: line.TemplateMessage = {
    type: 'template',
    altText: '請選擇風格',
    template: { type: 'carousel', columns, imageAspectRatio: 'square', imageSize: 'contain' },
  };
  return client.replyMessage(replyToken, message);
}

function replyTextPrompt(replyToken: string, defaultText: string) {
  const message: line.TextMessage = {
    type: 'text',
    text: `要加上祝福語嗎？可以直接輸入，或使用預設文字。✍️ (建議字數不超過 ${MAX_TEXT_LENGTH} 字，以確保圖片美觀)`,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'message', label: '用主題預設文字', text: '用主題預設文字' } },
        { type: 'action', action: { type: 'message', label: '請 AI 生成祝福語', text: '請 AI 生成祝福語' } },
      ],
    },
  };
  return client.replyMessage(replyToken, message);
}

export default app;

// Only listen on a port if not running in a serverless environment (e.g., Vercel)
if (process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.VERCEL_ENV)) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Local server listening on port ${port}`);
  });
}