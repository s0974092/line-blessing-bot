import { jest } from '@jest/globals';
const mockLineClient = {
  replyMessage: jest.fn(),
  pushMessage: jest.fn(),
};

jest.mock('ioredis', () => require('ioredis-mock'));
jest.mock('../src/ai');
jest.mock('../src/state');
jest.mock('../src/cloudinary');
jest.mock('@line/bot-sdk', () => ({
  Client: jest.fn(() => mockLineClient),
  middleware: jest.fn(() => (req: any, res: any, next: any) => {
    next();
  }),
}));

import request from 'supertest';
import * as line from '@line/bot-sdk';
import { Theme, Style } from '../src/types';
import { generateImage } from '../src/ai';
import { uploadImage } from '../src/cloudinary';
import { setUserState, getUserState, clearUserState } from '../src/state';
import app from '../api/index';

describe('LINE Bot Webhook', () => {
  let mockedGenerateImage: jest.MockedFunction<typeof generateImage>;
  let mockedSetUserState: jest.MockedFunction<typeof setUserState>;
  let mockedGetUserState: jest.MockedFunction<typeof getUserState>;
  let mockedClearUserState: jest.MockedFunction<typeof clearUserState>;
  let mockedUploadImage: jest.MockedFunction<typeof uploadImage>;

  const mockTheme: Theme = { id: 'good_morning', name: '🌅 早安問候', defaultText: 'Good Morning!', prompt: '...', thumbnail: 'http://example.com/t1.png' };
  const mockStyle: Style = { id: 'illustration', name: '🎨 插畫風', prompt: '...', thumbnail: 'http://example.com/s1.png' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGenerateImage = require('../src/ai').generateImage;
    mockedSetUserState = require('../src/state').setUserState;
    mockedGetUserState = require('../src/state').getUserState;
    mockedClearUserState = require('../src/state').clearUserState;
    mockedUploadImage = require('../src/cloudinary').uploadImage;
  });

  describe('handlePostback', () => {
    it('should set user state and ask for text', async () => {
      await request(app).post('/api/webhook').send({ events: [{
        type: 'postback', replyToken: 't1', source: { userId: 'u1', type: 'user' },
        postback: { data: `themeId=${mockTheme.id}&styleId=${mockStyle.id}` },
      } as line.PostbackEvent] });

      expect(mockedSetUserState).toHaveBeenCalledWith('u1', expect.objectContaining({ theme: mockTheme, style: mockStyle }));
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('t1', expect.objectContaining({ text: expect.stringContaining('要加上祝福語嗎？') }));
    });
  });

  describe('handleTextMessage', () => {
    it('should trigger image generation when user state exists', async () => {
      mockedGetUserState.mockResolvedValue({ theme: mockTheme, style: mockStyle, timestamp: Date.now() });
      mockedGenerateImage.mockResolvedValue(Buffer.from('mock-image-buffer'));
      mockedUploadImage.mockResolvedValue('http://mock.cloudinary.com/image.png');

      await request(app).post('/api/webhook').send({ events: [{
        type: 'message', replyToken: 't2', source: { userId: 'u1', type: 'user' },
        message: { type: 'text', text: 'My custom text' },
      } as line.MessageEvent] });

      expect(mockedGetUserState).toHaveBeenCalledWith('u1');
      expect(mockedGenerateImage).toHaveBeenCalledWith(mockTheme, mockStyle, 'My custom text');
      expect(mockedClearUserState).toHaveBeenCalledWith('u1');
    });

    it('should use default text when user chooses that option', async () => {
        mockedGetUserState.mockResolvedValue({ theme: mockTheme, style: mockStyle, timestamp: Date.now() });
        mockedGenerateImage.mockResolvedValue(Buffer.from('mock-image-buffer'));
        mockedUploadImage.mockResolvedValue('http://mock.cloudinary.com/image.png');
  
        await request(app).post('/api/webhook').send({ events: [{
          type: 'message', replyToken: 't3', source: { userId: 'u1', type: 'user' },
          message: { type: 'text', text: '用主題預設文字' },
        } as line.MessageEvent] });
  
        expect(mockedGenerateImage).toHaveBeenCalledWith(mockTheme, mockStyle, mockTheme.defaultText);
      });
  
      it('should show theme selection when no state exists and text is a trigger phrase', async () => {
        mockedGetUserState.mockResolvedValue(undefined);
  
        await request(app).post('/api/webhook').send({ events: [{
          type: 'message', replyToken: 't4', source: { userId: 'u1', type: 'user' },
          message: { type: 'text', text: '開始' },
        } as line.MessageEvent] });
  
        expect(mockLineClient.replyMessage).toHaveBeenCalledWith('t4', expect.any(Object));
      });
  });
});
