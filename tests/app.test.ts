const mockLineClient = {
  replyMessage: jest.fn(),
  pushMessage: jest.fn(),
};

jest.mock('../src/ai');
jest.mock('../src/state');
jest.mock('@line/bot-sdk', () => ({
  Client: jest.fn(() => mockLineClient),
  middleware: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

import request from 'supertest';
import app from '../src/app';
import * as line from '@line/bot-sdk';
import * as aiService from '../src/ai';
import * as stateService from '../src/state';
import { Theme, Style } from '../src/types';

describe('LINE Bot Webhook', () => {
  let mockedGenerateImage: jest.SpyInstance;
  let mockedSetUserState: jest.SpyInstance;
  let mockedGetUserState: jest.SpyInstance;
  let mockedClearUserState: jest.SpyInstance;

  const mockTheme: Theme = { id: 'good_morning', name: '🌅 早安問候', defaultText: 'Good Morning!', prompt: '...' };
  const mockStyle: Style = { id: 'illustration', name: '🎨 插畫風', prompt: '...' };

  beforeEach(() => {
    mockedGenerateImage = jest.spyOn(aiService, 'generateImage');
    mockedSetUserState = jest.spyOn(stateService, 'setUserState');
    mockedGetUserState = jest.spyOn(stateService, 'getUserState');
    mockedClearUserState = jest.spyOn(stateService, 'clearUserState');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePostback', () => {
    it('should set user state and ask for text', async () => {
      await request(app).post('/webhook').send({ events: [{
        type: 'postback', replyToken: 't1', source: { userId: 'u1', type: 'user' },
        postback: { data: `themeId=${mockTheme.id}&styleId=${mockStyle.id}` },
      } as line.PostbackEvent] });

      expect(mockedSetUserState).toHaveBeenCalledWith('u1', expect.objectContaining({ theme: expect.any(Object), style: expect.any(Object) }));
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('t1', expect.objectContaining({ text: expect.stringContaining('要加上祝福語嗎？') }));
    });
  });

  describe('handleTextMessage', () => {
    it('should trigger image generation when user state exists', async () => {
      mockedGetUserState.mockReturnValue({ theme: mockTheme, style: mockStyle, timestamp: Date.now() });
      mockedGenerateImage.mockResolvedValue('http://image.url/img.png');

      await request(app).post('/webhook').send({ events: [{
        type: 'message', replyToken: 't2', source: { userId: 'u1', type: 'user' },
        message: { type: 'text', text: 'My custom text' },
      } as line.MessageEvent] });

      expect(mockedGetUserState).toHaveBeenCalledWith('u1');
      expect(mockedGenerateImage).toHaveBeenCalledWith(mockTheme, mockStyle, 'My custom text');
      expect(mockedClearUserState).toHaveBeenCalledWith('u1');
      expect(mockLineClient.pushMessage).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'image' }));
    });

    it('should use default text when user chooses that option', async () => {
      mockedGetUserState.mockReturnValue({ theme: mockTheme, style: mockStyle, timestamp: Date.now() });
      mockedGenerateImage.mockResolvedValue('http://image.url/img.png');

      await request(app).post('/webhook').send({ events: [{
        type: 'message', replyToken: 't3', source: { userId: 'u1', type: 'user' },
        message: { type: 'text', text: '用主題預設文字' },
      } as line.MessageEvent] });

      expect(mockedGenerateImage).toHaveBeenCalledWith(mockTheme, mockStyle, mockTheme.defaultText);
    });

    it('should show theme selection when no state exists', async () => {
      mockedGetUserState.mockReturnValue(undefined);

      await request(app).post('/webhook').send({ events: [{
        type: 'message', replyToken: 't4', source: { userId: 'u1', type: 'user' },
        message: { type: 'text', text: 'random text' },
      } as line.MessageEvent] });

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('t4', expect.objectContaining({ text: expect.stringContaining('請選擇今天想傳的祝福主題') }));
    });
  });
});
