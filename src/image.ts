import { join } from 'path';
import type { Canvas, Image } from 'canvas';
import { config } from './config';

// --- Hybrid Module Loading ---
// This section dynamically selects the canvas library based on the environment.
// It uses the robust 'node-canvas' for local development (requires system dependencies)
// and the zero-dependency '@napi-rs/canvas' for production environments like Vercel.

let createCanvas: (width: number, height: number) => Canvas;
let loadImage: (src: Buffer | string) => Promise<Image>;

// A wrapper function to abstract the different font registration APIs.
let registerFont: (fontPath: string, alias: string) => void;

if (process.env.NODE_ENV === 'development') {
  console.log("Using 'node-canvas' for local development.");
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  registerFont = (fontPath, alias) => {
    canvas.registerFont(fontPath, { family: alias });
  };
} else {
  console.log("Using '@napi-rs/canvas' for production.");
  const napiCanvas = require('@napi-rs/canvas');
  createCanvas = napiCanvas.createCanvas;
  loadImage = napiCanvas.loadImage;
  registerFont = (fontPath, alias) => {
    napiCanvas.GlobalFonts.registerFromPath(fontPath, alias);
  };
}

// --- Font Registration ---
// Register the custom fonts using the abstracted function.
const fontPath = join(__dirname, '../assets/fonts/LXGWWenKaiMonoTC-Regular.ttf');
registerFont(fontPath, 'LXGW WenKai Mono TC');
registerFont(join(__dirname, '../assets/fonts/NotoColorEmoji-Regular.ttf'), 'Noto Color Emoji');


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

  const emojiMap: { [key: string]: string } = {
    '(hands together)': '1F64F', // Unicode for 🙏
    // Add more LINE emoji text descriptions and their corresponding Unicode emojis here
  };

  let processedText = text;
  const emojisToRender: { unicode: string; originalIndex: number; }[] = [];

  for (const key in emojiMap) {
    const unicode = emojiMap[key];
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\\]/g, '\\$&'), 'g'); // Escape special characters for regex
    let match;
    while ((match = regex.exec(text)) !== null) {
      emojisToRender.push({ unicode, originalIndex: match.index });
    }
    processedText = processedText.replace(regex, ' '); // Replace emoji text with a space for layout
  }

  // Sort emojis by their original index to maintain order
  emojisToRender.sort((a, b) => a.originalIndex - b.originalIndex);

  console.log('Original text:', text);
  console.log('Processed text (with empty strings for emojis):', processedText);
  console.log('Emojis to render:', emojisToRender);

  // Draw the original image
  ctx.drawImage(image, 0, 0);

  // --- Text Styling ---
  const fontSize = image.width / config.image.fontSizeRatioDivisor; // Dynamic font size from config
  ctx.font = `${fontSize}px 'LXGW WenKai Mono TC', 'sans-serif'`; // Use the registered font, Noto Color Emoji will be loaded as image
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle'; // Set text baseline to middle for vertical centering

  // Create a unified content array for layout calculation
  const contentElements: { type: 'text' | 'emoji'; value: string; originalIndex: number; }[] = [];
  let lastIndex = 0;
  for (const emoji of emojisToRender) {
    if (emoji.originalIndex > lastIndex) {
      contentElements.push({ type: 'text', value: text.substring(lastIndex, emoji.originalIndex), originalIndex: lastIndex });
    }
    // Calculate the length of the original emoji text description
    const emojiTextDescriptionLength = Object.keys(emojiMap).find(key => emojiMap[key] === emoji.unicode)?.length || 1; // Default to 1 if not found
    contentElements.push({ type: 'emoji', value: emoji.unicode, originalIndex: emoji.originalIndex });
    lastIndex = emoji.originalIndex + emojiTextDescriptionLength;
  }
  if (lastIndex < text.length) {
    contentElements.push({ type: 'text', value: text.substring(lastIndex), originalIndex: lastIndex });
  }

  // Calculate text metrics for layout
  const lines: { elements: typeof contentElements; width: number; }[] = [];
  let currentLineElements: typeof contentElements = [];
  let currentLineWidth = 0;
  const emojiSize = fontSize; // Emoji size consistent with font size

  for (const element of contentElements) {
    let elementWidth = 0;
    if (element.type === 'text') {
      elementWidth = ctx.measureText(element.value).width;
    } else { // type === 'emoji'
      elementWidth = emojiSize;
    }

    // Simple line breaking for now (no word wrap)
    // If adding this element exceeds image width, start a new line
    // This logic needs to be more robust for actual word wrapping
    if (currentLineWidth + elementWidth > image.width && currentLineElements.length > 0) {
      lines.push({ elements: currentLineElements, width: currentLineWidth });
      currentLineElements = [];
      currentLineWidth = 0;
    }

    currentLineElements.push(element);
    currentLineWidth += elementWidth;
  }
  if (currentLineElements.length > 0) {
    lines.push({ elements: currentLineElements, width: currentLineWidth });
  }

  if (lines.length > 0) {
    const lineHeight = fontSize * 1.2; // 1.2 times font size for line height

    // Position text at the bottom center
    const x = canvas.width / 2;

    let maxContentWidth = 0;
    for (const line of lines) {
      if (line.width > maxContentWidth) {
        maxContentWidth = line.width;
      }
    }

    const padding = fontSize / 4;
    const bgWidth = maxContentWidth + (padding * 2);
    const bgHeight = (lines.length * lineHeight) + (padding * 2);

    const bgX = x - (bgWidth / 2);
    const bgY = canvas.height - (fontSize * 1.5) - bgHeight; // Position background from bottom with margin

    ctx.fillStyle = config.image.bgColorRgba; // Use background color from config
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

    // --- Text Styling (after background) ---
    ctx.fillStyle = config.image.textColorHex; // Use text color from config

    // Render each line and overlay emojis
    const startY = bgY + padding + lineHeight / 2; // Start Y for the middle of the first line

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const currentY = startY + i * lineHeight;

      let currentLineX = x - line.width / 2; // Start X for the current line, based on its calculated width

      for (const element of line.elements) {
        if (element.type === 'text') {
          ctx.fillText(element.value, currentLineX, currentY);
          currentLineX += ctx.measureText(element.value).width;
        } else { // type === 'emoji'
          const emojiUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${element.value.toLowerCase()}.png`;
          console.log(`Attempting to load emoji from: ${emojiUrl}`);
          try {
            const emojiImage = await loadImage(emojiUrl);
            console.log(`Successfully loaded emoji image for ${element.value}`);
            ctx.drawImage(emojiImage, currentLineX, currentY - emojiSize / 2, emojiSize, emojiSize); // Adjust y for middle baseline
          } catch (error: any) {
            console.error(`Failed to load emoji image ${element.value} from ${emojiUrl}:`, error.message);
            // Fallback to text if image fails to load
            ctx.fillText('□', currentLineX, currentY);
          }
          currentLineX += emojiSize;
        }
      }
    }
  }

  return canvas.toBuffer('image/png');
}
