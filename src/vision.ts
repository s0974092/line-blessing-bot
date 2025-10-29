import { ImageAnnotatorClient } from '@google-cloud/vision';
import { logger } from './utils/logger';

/**
 * A service class for interacting with the Google Cloud Vision API.
 */
export class VisionService {
  private client: ImageAnnotatorClient;

  constructor() {
    this.client = new ImageAnnotatorClient();
  }

  /**
   * Detects object localization in an image from a given URL.
   * @param imageUrl The public URL of the image to analyze.
   * @returns A promise that resolves with an array of localized object annotations.
   * @throws An error if the API request fails.
   */
  async detectObjectLocalization(imageUrl: string) {
    try {
      logger.info(`[VisionService] Analyzing image for object localization: ${imageUrl}`);
      const [result] = await this.client.objectLocalization!(imageUrl);
      if (!result) {
        logger.warn(`[VisionService] objectLocalization returned no result for ${imageUrl}`);
        return [];
      }
      const objects = result.localizedObjectAnnotations;

      if (objects) {
        logger.info(`[VisionService] Found ${objects.length} objects.`);
        objects.forEach(object => {
          logger.debug(`[VisionService] Object: ${object.name}, Score: ${object.score}`);
        });
      } else {
        logger.info('[VisionService] No objects found.');
      }

      return objects || [];
    } catch (error) {
      logger.error('[VisionService] Error during object localization:', error);
      throw new Error('Failed to analyze image with Vision API.');
    }
  }
}

export const visionService = new VisionService();
