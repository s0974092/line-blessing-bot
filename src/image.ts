import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { createCanvas, loadImage, registerFont } from 'canvas';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Register the custom font
registerFont('./assets/fonts/LXGWWenKaiMonoTC-Regular.ttf', { family: 'LXGW WenKai Mono TC' });

/**
 * Overlays text on an image.
 * @param {Buffer} imageBuffer The buffer of the image to overlay text on.
 * @param {string} text The text to overlay.
 * @returns {Promise<Buffer>} A promise that resolves to the buffer of the new image.
 */
export async function overlayTextOnImage(imageBuffer: Buffer, text: string): Promise<Buffer> {
  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // Draw the original image
  ctx.drawImage(image, 0, 0);

  // --- Text Styling ---
  const fontSize = image.width / 20; // Dynamic font size
  ctx.font = `${fontSize}px 'LXGW WenKai Mono TC'`; // Use the registered font
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // --- Text Shadow for better readability ---
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 5;

  // Position text at the bottom center
  const x = canvas.width / 2;
  const y = canvas.height - (fontSize * 1.5); // Margin from bottom

  ctx.fillText(text, x, y);

  return canvas.toBuffer('image/png');
}

/**
 * Uploads an image buffer to Cloudinary.
 * @param {Buffer} buffer The image buffer to upload.
 * @returns {Promise<string>} A promise that resolves to the public URL of the uploaded image.
 */
export async function uploadImage(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result) {
          return reject(new Error('Cloudinary upload failed to return a result.'));
        }
        resolve(result.secure_url);
      }
    );

    const readable = new Readable();
    readable._read = () => {}; // _read is required but you can noop it
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}
