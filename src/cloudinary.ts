import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
