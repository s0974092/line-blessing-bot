import { v2 as cloudinary } from 'cloudinary';
import { config } from './config';

// Function to configure Cloudinary
export function configureCloudinary() {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
}

/**
 * Uploads an image buffer to Cloudinary.
 * @param imageBuffer The image buffer to upload.
 * @returns The public URL of the uploaded image.
 */
export async function uploadImage(imageBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary upload failed: No secure_url returned.'));
        }
        resolve(result.secure_url);
      }
    ).end(imageBuffer);
  });
}

/**
 * Deletes an image from Cloudinary using its public ID.
 * @param publicId The public ID of the image to delete.
 */
export async function deleteImage(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        return reject(error);
      }
      if (result && result.result !== 'ok') {
        return reject(new Error(`Cloudinary deletion failed: ${result.result}`));
      }
      resolve();
    });
  });
}
