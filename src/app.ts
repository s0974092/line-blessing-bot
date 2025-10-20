import 'dotenv/config';
import fs from 'fs';
import { join } from 'path';
import express, { Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { Theme, Style } from './types';
import { generateImage } from './ai';
import { setUserState, getUserState, clearUserState } from './state';

// --- 1. Load Data ---
const themesPath = process.env.NODE_ENV === 'production' 
  ? join(__dirname, './themes.json')
  : join(__dirname, '../themes.json');
const stylesPath = process.env.NODE_ENV === 'production'
  ? join(__dirname, './styles.json')
  : join(__dirname, '../styles.json');

const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));
const styles = JSON.parse(fs.readFileSync(stylesPath, 'utf8'));

// --- 2. Setup LINE SDK and Express ---
const config: line.MiddlewareConfig & line.ClientConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

const client = new line.Client(config);
const app = express();
app.use(express.json());

// --- 3. Webhook Handler ---
app.post('/webhook', line.middleware(config), (req: Request, res: Response) => {
  Promise
    .all(req.body.events.map((event: line.WebhookEvent) => handleEvent(event)))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// --- 4. Event-handling functions ---
async function handleEvent(event: line.WebhookEvent): Promise<any> {
  if (event.type === 'postback') {
    return handlePostback(event);
  }
  if (event.type === 'message' && event.message.type === 'text') {
    return handleTextMessage(event);
  }
  if (event.type === 'follow') {
    return replyThemeSelection(event.replyToken);
  }
  return Promise.resolve(null);
}

async function handleTextMessage(event: line.MessageEvent) {
  const userId = event.source.userId;
  if (!userId) return Promise.resolve(null);

  const userText = (event.message as line.TextMessage).text;
  const userState = getUserState(userId);

  if (userState) {
    // User is in the middle of a conversation - this message is the blessing text
    const text = userText === '用主題預設文字' ? userState.theme.defaultText : userText;
    clearUserState(userId);

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `好的，為您生成圖片，並加上祝福語：「${text}」，請稍候...`,
    });

    const result = await generateImage(userState.theme, userState.style, text);
    const message = result.startsWith('http')
      ? { type: 'image', originalContentUrl: result, previewImageUrl: result } as line.ImageMessage
      : { type: 'text', text: result } as line.TextMessage;

    return client.pushMessage(userId, message);

  } else {
    // This is a new conversation
    const selectedTheme = themes.find((t: Theme) => t.name === userText);
    if (selectedTheme) {
      return replyStyleSelection(event.replyToken, selectedTheme.id);
    } else {
      return replyThemeSelection(event.replyToken);
    }
  }
}

async function handlePostback(event: line.PostbackEvent) {
  const userId = event.source.userId;
  if (!userId) return Promise.resolve(null);

  const postbackData = new URLSearchParams(event.postback.data);
  const themeId = postbackData.get('themeId');
  const styleId = postbackData.get('styleId');

  const theme = themes.find((t: Theme) => t.id === themeId);
  const style = styles.find((s: Style) => s.id === styleId);

  if (!theme || !style) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，找不到對應的主題或風格。' });
  }

  // Save user's state
  setUserState(userId, { theme, style, timestamp: Date.now() });

  // Ask for blessing text
  return replyTextPrompt(event.replyToken, theme.defaultText);
}

// --- 5. Message-sending functions ---
function replyThemeSelection(replyToken: string) {
  const quickReplyItems: line.QuickReplyItem[] = themes.map((theme: Theme) => ({
    type: 'action',
    action: { type: 'message', label: theme.name, text: theme.name },
  }));

  const message: line.TextMessage = {
    type: 'text',
    text: '請選擇今天想傳的祝福主題 🌸',
    quickReply: { items: quickReplyItems },
  };
  return client.replyMessage(replyToken, message);
}

function replyStyleSelection(replyToken: string, themeId: string) {
  const columns: line.TemplateColumn[] = styles.map((style: Style) => ({
    thumbnailImageUrl: 'https://via.placeholder.com/240x240.png/f2f2f2/333333?text=' + encodeURIComponent(style.name.substring(2)),
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
    text: '要加上祝福語嗎？可以直接輸入，或使用預設文字。✍️',
    quickReply: {
      items: [
        { type: 'action', action: { type: 'message', label: '用主題預設文字', text: '用主題預設文字' } },
      ],
    },
  };
  return client.replyMessage(replyToken, message);
}

export default app;
