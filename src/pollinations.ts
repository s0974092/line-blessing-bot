import fetch from 'node-fetch';
import { Theme, Style } from './types';
import { logger } from './utils/logger';

const POLLINATIONS_API_BASE_URL = 'https://image.pollinations.ai/prompt/';

/**
 * Generates an image using Pollinations.ai based on the provided theme and style.
 * @param theme The selected theme object.
 * @param style The selected style object.
 * @returns A promise that resolves with the URL of the generated image.
 * @throws An error if the API request fails or returns an invalid response.
 */
export async function generateImageWithPollinations(theme: Theme, style: Style): Promise<string> {
  try {
    // Construct the prompt for Pollinations.ai
    // Pollinations.ai directly uses the prompt in the URL path
    const fullPrompt = `${theme.prompt}, ${style.prompt}`;
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const requestUrl = `${POLLINATIONS_API_BASE_URL}${encodedPrompt}`;

    logger.info(`[PollinationsService] Requesting image from Pollinations.ai with prompt: ${fullPrompt}`);
    logger.debug(`[PollinationsService] Full request URL: ${requestUrl}`);

    // Pollinations.ai directly returns the image, so we just need the URL
    // In a real scenario, you might need to make a HEAD request or check content-type
    // For simplicity, we assume the URL itself is the image source.
    // If Pollinations.ai returns a redirect, node-fetch will follow it.
    const response = await fetch(requestUrl);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[PollinationsService] Pollinations.ai API error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to generate image from Pollinations.ai: ${response.statusText}`);
    }

    // Pollinations.ai directly serves the image at the request URL
    // So the final URL after redirects is the image URL
    const imageUrl = response.url; 
    logger.info(`[PollinationsService] Successfully generated image URL: ${imageUrl}`);
    return imageUrl;

  } catch (error) {
    logger.error('[PollinationsService] Error generating image with Pollinations.ai:', error);
    throw new Error('Failed to generate image from Pollinations.ai.');
  }
}
