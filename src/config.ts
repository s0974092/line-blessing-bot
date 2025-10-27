import dotenv from 'dotenv';

// 在非生產環境中，載入 .env 檔案的設定
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * 中心化的應用程式組態
 * 從環境變數讀取設定，並提供預設值
 */
export const config = {
  /**
   * Node.js 環境設定
   */
  env: process.env.NODE_ENV || 'development',

  /**
   * LINE Bot 相關設定
   */
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  },

  /**
   * Google Gemini API 相關設定
   */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    promptTemplate: process.env.GEMINI_BLESSING_PROMPT_TEMPLATE || '請根據主題「{theme}」和風格「{style}」，生成一句長度介於{minLength}到{maxLength}個字之間的繁體中文祝福語。請直接提供祝福語文字，不要包含任何其他說明或引號。',
    textMinLength: parseInt(process.env.GEMINI_TEXT_MIN_LENGTH || '5', 10),
    textMaxLength: parseInt(process.env.GEMINI_TEXT_MAX_LENGTH || '15', 10),
    maxAttempts: parseInt(process.env.GEMINI_GENERATION_MAX_ATTEMPTS || '3', 10),
    fallbackPromptTemplate: process.env.GEMINI_FALLBACK_PROMPT_TEMPLATE || '請生成一句長度介於{minLength}到{maxLength}個字之間的通用中文祝福語。請直接提供祝福語文字，不要包含任何其他說明或引號。',
    finalFallbackText: process.env.GEMINI_FINAL_FALLBACK_TEXT || '平安喜樂，萬事如意',
  },

  /**
   * Cloudinary 相關設定
   */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  /**
   * Redis 狀態管理相關設定
   */
  redis: {
    url: process.env.REDIS_URL || '',
  },

  /**
   * 機器人核心行為設定
   */
  bot: {
    imageDeletionDelayMs: parseInt(process.env.IMAGE_DELETION_DELAY_MS || '10000', 10),
    triggerKeywords: (process.env.BOT_TRIGGER_KEYWORDS || '開始,生成圖片,長輩圖')
      .split(',')
      .map((k) => k.trim()),
    
    maxTextLength: parseInt(process.env.BOT_MAX_TEXT_LENGTH || '20', 10),

    welcomeMessage: process.env.WELCOME_MESSAGE?.replace(/\\n/g, '\n') || '哈囉！我是您的專屬祝福圖片生成器！🌸\n您可以透過我輕鬆生成帶有祝福語的圖片，並分享給親朋好友。\n請輸入 {keywords} 來製作您的第一張長輩圖吧！',
    generationErrorMessage: process.env.GENERATION_ERROR_MESSAGE || '圖片生成失敗，系統有點忙，請稍後再試一次。',
  },

  /**
   * 使用者對話狀態設定
   */
  userState: {
    ttlSeconds: parseInt(process.env.USER_STATE_TTL_SECONDS || '300', 10),
  },

  /**
   * 圖片生成設定
   */
  image: {
    fontSizeRatioDivisor: parseFloat(process.env.IMAGE_FONT_SIZE_RATIO_DIVISOR || '20'),
    bgColorRgba: process.env.IMAGE_BG_COLOR_RGBA || 'rgba(0, 0, 0, 0.5)',
    textColorHex: process.env.IMAGE_TEXT_COLOR_HEX || '#FFFFFF',
  }
};
