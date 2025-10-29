import { Theme, Style } from './types';
import { overlayTextOnImage } from './image';
import { generateBlessingText } from './gemini';
import { visionService } from './vision'; // Import visionService
import fetch from 'node-fetch'; // Ensure fetch is imported

/**
 * Composes a prompt for image generation based on a theme and a style.
 * @param {Theme} theme - The theme object.
 * @param {Style} style - The style object.
 * @returns {string} The composed prompt.
 */
export function composePrompt(theme: Theme, style: Style, blessingText: string): string {
  if (!theme || !style) {
    throw new Error('Theme and style objects are required.');
  }
  let basePrompt = theme.prompt.replace('{stylePrompt}', style.prompt);

  // If it's a festival theme and a custom blessing text is provided, add it to the prompt to influence the scene
  if (theme.id === 'festival' && blessingText && blessingText !== '用主題預設文字') {
    basePrompt = `${blessingText}, ${basePrompt}`;
  }

  return basePrompt;
}

/**
 * Generates an image, overlays text, and uploads it.
 * @param {Theme} theme - The selected theme.
 * @param {Style} style - The selected style.
 * @param {string} text - The text to overlay on the image.
 * @returns {Promise<string>} A promise that resolves to the public URL of the final image.
 */
export async function generateImage(theme: Theme, style: Style, text: string): Promise<Buffer> {
  console.log("Entering generateImage function...");

  try {
    let blessingTextToOverlay = text;
    if (!text) { // If text is empty, generate it using AI
      console.log('No text provided, generating blessing text with AI...');
      blessingTextToOverlay = await generateBlessingText(theme, style);
    }

    const prompt = composePrompt(theme, style, blessingTextToOverlay);

    // Pollinations.ai Image Generation
    const width = 1024;
    const height = 1024;
    const seed = Math.floor(Math.random() * 1000000); // Use a random seed for variety
    const model = 'flux'; // Using 'flux' as default as per example
    const nologo = true;

    let imageUrl: string | undefined;
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    for (let i = 0; i < maxRetries; i++) {
      try {
        const currentImageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=${nologo}`;

        console.log(`Attempt ${i + 1}: Fetching image from Pollinations.ai:`, currentImageUrl);

        const response = await fetch(currentImageUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch image from Pollinations.ai: ${response.statusText}`);
        }

        imageUrl = response.url; // Get the final URL after redirects
        break; // Success, break out of retry loop
      } catch (retryError: any) {
        console.error(`Attempt ${i + 1} failed:`, retryError.message);
        if (i < maxRetries - 1) {
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw retryError; // All retries failed
        }
      }
    }

    if (!imageUrl) {
      throw new Error('Failed to generate image URL after multiple retries.');
    }

    // --- NEW: Analyze image with Vision API ---
    const objectAnnotations = await visionService.detectObjectLocalization(imageUrl);

    // Overlay the text on the image
    // Pass imageUrl and objectAnnotations to overlayTextOnImage
    const imageWithTextBuffer = await overlayTextOnImage(imageUrl, blessingTextToOverlay, objectAnnotations);

    return imageWithTextBuffer;

  } catch (error: any) {
    console.error('Error generating image:', error);
    throw new Error(`圖片生成失敗，請稍後再試。錯誤：${error.message || error}`);
  }
}
