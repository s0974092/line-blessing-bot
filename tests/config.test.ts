
jest.mock('dotenv'); // Mock dotenv to prevent it from loading .env files

describe('config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    process.env = {}; // Create a fresh, empty environment for each test
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  it('should load default configuration when no environment variables are set', () => {
    const { config } = require('../src/config');

    expect(config.env).toBe('development');
    expect(config.line.channelAccessToken).toBe('');
    expect(config.gemini.apiKey).toBe('');
    expect(config.gemini.model).toBe('gemini-2.5-flash');
    expect(config.gemini.textMinLength).toBe(5);
    expect(config.gemini.textMaxLength).toBe(15);
    expect(config.bot.triggerKeywords).toEqual(['開始', '生成圖片', '長輩圖']);
    expect(config.userState.ttlSeconds).toBe(300);
  });

  it('should load configuration from environment variables', () => {
    // Set custom values for environment variables
    process.env.NODE_ENV = 'production';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test_access_token';
    process.env.GEMINI_API_KEY = 'test_gemini_key';
    process.env.GEMINI_MODEL = 'gemini-pro';
    process.env.GEMINI_TEXT_MIN_LENGTH = '10';
    process.env.GEMINI_TEXT_MAX_LENGTH = '25';
    process.env.BOT_TRIGGER_KEYWORDS = 'go,generate';
    process.env.USER_STATE_TTL_SECONDS = '600';

    const { config } = require('../src/config');

    expect(config.env).toBe('production');
    expect(config.line.channelAccessToken).toBe('test_access_token');
    expect(config.gemini.apiKey).toBe('test_gemini_key');
    expect(config.gemini.model).toBe('gemini-pro');
    expect(config.gemini.textMinLength).toBe(10);
    expect(config.gemini.textMaxLength).toBe(25);
    expect(config.bot.triggerKeywords).toEqual(['go', 'generate']);
    expect(config.userState.ttlSeconds).toBe(600);
  });

  it('should load a mix of default and custom environment variables', () => {
    process.env.NODE_ENV = 'development';
    process.env.LINE_CHANNEL_SECRET = 'my-secret';
    process.env.GEMINI_TEXT_MAX_LENGTH = '20';

    const { config } = require('../src/config');

    // Custom values
    expect(config.line.channelSecret).toBe('my-secret');
    expect(config.gemini.textMaxLength).toBe(20);

    // Default values
    expect(config.line.channelAccessToken).toBe('');
    expect(config.gemini.model).toBe('gemini-2.5-flash');
    expect(config.gemini.textMinLength).toBe(5);
  });

  it('should not call dotenv.config in production', () => {
    const dotenv = require('dotenv');
    const configSpy = jest.spyOn(dotenv, 'config');

    process.env.NODE_ENV = 'production';
    require('../src/config');
    expect(configSpy).not.toHaveBeenCalled();
  });
});
