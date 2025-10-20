import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { Theme, Style } from './types';
import { uploadImage, overlayTextOnImage } from './image';

// --- 1. Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

/**
 * Composes a prompt for image generation based on a theme and a style.
 * @param {Theme} theme - The theme object.
 * @param {Style} style - The style object.
 * @returns {string} The composed prompt.
 */
export function composePrompt(theme: Theme, style: Style): string {
  if (!theme || !style) {
    throw new Error('Theme and style objects are required.');
  }
  return theme.prompt.replace('{stylePrompt}', style.prompt);
}

/**
 * Generates an image, overlays text, and uploads it.
 * @param {Theme} theme - The selected theme.
 * @param {Style} style - The selected style.
 * @param {string} text - The text to overlay on the image.
 * @returns {Promise<string>} A promise that resolves to the public URL of the final image.
 */
export async function generateImage(theme: Theme, style: Style, text: string): Promise<string> {
  try {
    const prompt = composePrompt(theme, style);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData?.data);

    if (!imagePart || !imagePart.inlineData) {
      throw new Error('No image data found in Gemini API response.');
    }

    const originalImageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

    // Overlay the text on the image
    const imageWithTextBuffer = await overlayTextOnImage(originalImageBuffer, text);

    const imageUrl = await uploadImage(imageWithTextBuffer);
    return imageUrl;

  } catch (error: any) {
    console.error('Error generating image:', error);

    if (error.message.includes('quota') || error.message.includes('429')) {
      return '今日免費額度已用完，請明天再試喔！';
    }
    return '圖片生成失敗，請稍後再試。'
  }
}
