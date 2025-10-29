import fs from 'fs';
import { join } from 'path';
import express, { Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { Theme, Style } from '../src/types';
import { generateImage } from '../src/ai';
import { setUserState, getUserState, clearUserState } from '../src/state';
import { WebhookEvent } from '@line/bot-sdk';
import { uploadImage, deleteImage, configureCloudinary } from '../src/cloudinary';

// Configure Cloudinary
configureCloudinary();
import { config } from '../src/config';

// --- 1. Load Data ---
const themesPath = join(__dirname, '../themes.json');
const stylesPath = join(__dirname, '../styles.json');

const themes: Theme[] = JSON.parse(fs.readFileSync(themesPath, 'utf8')).themes;
const styles: Style[] = JSON.parse(fs.readFileSync(stylesPath, 'utf8')).styles;

// --- 2. Setup LINE SDK and Express ---
const lineConfig: line.MiddlewareConfig & line.ClientConfig = {
  channelAccessToken: config.line.channelAccessToken,
  channelSecret: config.line.channelSecret,
};

const client = new line.Client(lineConfig);
const app = express();

app.get('/api/themes', (req: Request, res: Response) => {
  res.json(themes);
});

app.get('/api/styles', (req: Request, res: Response) => {
  res.json(styles);
});

// --- 3. Webhook Handler ---
app.post('/api/webhook', line.middleware(lineConfig), async (req: Request, res: Response) => {
  console.log('Webhook received!');
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

// --- 4. Helper Functions ---

/**
 * Generates a dynamic welcome message using the template from config.
 * @returns The fully constructed welcome message string.
 */
function getDynamicWelcomeMessage(): string {
  const triggerKeywords = config.bot.triggerKeywords.map(phrase => `「${phrase}」`).join('、');
  return config.bot.welcomeMessage.replace('{keywords}', triggerKeywords);
}

// --- 5. Event-handling functions ---
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
  const welcomeText = getDynamicWelcomeMessage();
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

  if (config.bot.triggerKeywords.some(phrase => normalizedUserText.includes(phrase.toLowerCase()))) {
    await clearUserState(sourceId);
    return replyThemeSelection(event.replyToken);
  }

  if (userState) {
    // User is in the middle of a conversation - this message is the blessing text
    let { theme, style } = userState;
    let styleInfo: string; // Declare styleInfo here

    // If style is not yet selected, use the first available style as default
    if (!style || Object.keys(style).length === 0) {
      style = styles[0]; // Assuming styles array is never empty
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

    // Add an immediate processing message
    await client.pushMessage(sourceId, {
      type: 'text',
      text: '正在處理中，請稍候...',
    });

    let cloudinaryPublicId: string | undefined;
    try {
      const imageBuffer = await generateImage(userState.theme, userState.style, text);
      const imageUrl = await uploadImage(imageBuffer);

      const urlParts = imageUrl.split('/');
      cloudinaryPublicId = urlParts[urlParts.length - 1].split('.')[0];

      const message = { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl } as line.ImageMessage;

      await client.pushMessage(sourceId, message);
      await new Promise(resolve => setTimeout(resolve, config.bot.imageDeletionDelayMs));
      await clearUserState(sourceId);

      if (cloudinaryPublicId) {
        await deleteImage(cloudinaryPublicId);
        console.log(`Deleted image ${cloudinaryPublicId} from Cloudinary.`);
      }

    } catch (error: any) {
      console.error('Error in image generation or upload process:', error);
      let errorMessage = config.bot.generationErrorMessage;
      if (error.message === 'GEMINI_QUOTA_EXCEEDED') {
        errorMessage = '今日免費額度已用完，請明天再試喔！';
      }
      await client.pushMessage(sourceId, {
        type: 'text',
        text: errorMessage,
      });
    }

  } else {
    // This is a new conversation or state has expired
    const selectedTheme = themes.find((t: Theme) => t.name === userText);

    if (selectedTheme) {
      await setUserState(sourceId, { theme: selectedTheme, style: {} as Style, timestamp: Date.now() });
      return replyStyleSelection(event.replyToken, selectedTheme.id);
    } else {
      if (event.source.type === 'user') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: getDynamicWelcomeMessage(), // Use centralized, dynamic welcome message
        });
      } else {
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

  if (!theme) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，找不到對應的主題。請重新選擇。' });
  }
  if (!style) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，找不到對應的風格。請重新選擇。' });
  }

  await setUserState(sourceId, { theme, style, timestamp: Date.now() });
  return replyTextPrompt(event.replyToken, theme.defaultText);
}

// --- 6. Message-sending functions ---
function replyThemeSelection(replyToken: string) {
  const columns: line.TemplateColumn[] = themes.map((theme: Theme) => ({
    thumbnailImageUrl: theme.thumbnail,
    title: theme.name,
    text: '點擊選擇此主題',
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
    text: `要加上祝福語嗎？可以直接輸入，或使用預設文字。✍️ (建議字數不超過 ${config.bot.maxTextLength} 字，以確保圖片美觀)`,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'message', label: '用主題預設文字', text: '用主題預設文字' } },
        { type: 'action', action: { type: 'message', label: '請 AI 生成祝福語', text: '請 AI 生成祝福語' } },
        { type: 'action', action: { type: 'message', label: '重新開始', text: config.bot.triggerKeywords[0] } }, // Add Restart option
      ],
    },
  };
  return client.replyMessage(replyToken, message);
}

export default app;

// Only listen on a port if in a local development environment
if (config.env === 'development') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Local server listening on port ${port}`);
  });
}
