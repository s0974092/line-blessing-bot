import { join } from 'path';
import type { Canvas, Image, CanvasRenderingContext2D } from 'canvas';
import { config } from './config';
import fetch from 'node-fetch'; // Import fetch for downloading images
import { protos } from '@google-cloud/vision'; // Import Vision API types
import { logger } from './utils/logger';

type ObjectLocalizationAnnotation = protos.google.cloud.vision.v1.ILocalizedObjectAnnotation;

// --- Hybrid Module Loading ---
// This section dynamically selects the canvas library based on the environment.
// It uses the robust 'node-canvas' for local development (requires system dependencies)
// and the zero-dependency '@napi-rs/canvas' for production environments like Vercel.

let createCanvas: (width: number, height: number) => Canvas;
let loadImage: (src: Buffer | string) => Promise<Image>;

// A wrapper function to abstract the different font registration APIs.
let registerFont: (fontPath: string, alias: string) => void;

if (process.env.NODE_ENV === 'development') {
  logger.info("Using 'node-canvas' for local development.");
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  registerFont = (fontPath, alias) => {
    canvas.registerFont(fontPath, { family: alias });
  };
} else {
  logger.info("Using '@napi-rs/canvas' for production.");
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

interface TextPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  padding: number;
  bgColor: string;
  textColor: string;
}

/**
 * Calculates the optimal text placement on an image, avoiding detected objects.
 * @param imageWidth The width of the image.
 * @param imageHeight The height of the image.
 * @param text The text to be placed.
 * @param objectAnnotations Vision API object localization results.
 * @returns A TextPlacement object with calculated coordinates and styles.
 */
function calculateTextPlacement(
  imageWidth: number,
  imageHeight: number,
  text: string,
  objectAnnotations: ObjectLocalizationAnnotation[],
  ctx: CanvasRenderingContext2D // Pass context to measure text
): TextPlacement {
  const baseFontSize = imageWidth / config.image.fontSizeRatioDivisor;
  let fontSize = baseFontSize;
  let lineHeight = fontSize * 1.2;
  const padding = fontSize / 4;

  // Define potential text placement regions (e.g., corners, top/bottom center)
  // For simplicity, let's consider 4 corners and bottom center initially.
  // Each region is defined by its top-left (x,y) and its width/height
  const regions = [
    // Bottom-center (current default)
    { name: 'bottom-center', x: imageWidth * 0.1, y: imageHeight * 0.7, width: imageWidth * 0.8, height: imageHeight * 0.25 },
    // Top-left
    { name: 'top-left', x: imageWidth * 0.05, y: imageHeight * 0.05, width: imageWidth * 0.4, height: imageHeight * 0.2 },
    // Top-right
    { name: 'top-right', x: imageWidth * 0.55, y: imageHeight * 0.05, width: imageWidth * 0.4, height: imageHeight * 0.2 },
    // Bottom-left
    { name: 'bottom-left', x: imageWidth * 0.05, y: imageHeight * 0.75, width: imageWidth * 0.4, height: imageHeight * 0.2 },
    // Bottom-right
    { name: 'bottom-right', x: imageWidth * 0.55, y: imageHeight * 0.75, width: imageWidth * 0.4, height: imageHeight * 0.2 },
  ];

  let bestRegion = regions[0]; // Default to bottom-center
  let minOverlap = Infinity;

  // Helper to calculate overlap area between two rectangles
  const calculateOverlap = (rect1: any, rect2: any) => {
    const xOverlap = Math.max(0, Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x));
    const yOverlap = Math.max(0, Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y));
    return xOverlap * yOverlap;
  };

  for (const region of regions) {
    let currentOverlap = 0;
    for (const obj of objectAnnotations) {
      const boundingPoly = obj.boundingPoly;
      if (boundingPoly && boundingPoly.normalizedVertices) {
        // Convert normalized vertices to absolute pixels
        const objRect = {
          x: boundingPoly.normalizedVertices[0].x! * imageWidth,
          y: boundingPoly.normalizedVertices[0].y! * imageHeight,
          width: (boundingPoly.normalizedVertices[1].x! - boundingPoly.normalizedVertices[0].x!) * imageWidth,
          height: (boundingPoly.normalizedVertices[2].y! - boundingPoly.normalizedVertices[0].y!) * imageHeight,
        };
        currentOverlap += calculateOverlap(region, objRect);
      }
    }

    if (currentOverlap < minOverlap) {
      minOverlap = currentOverlap;
      bestRegion = region;
    }
  }

  logger.info(`[ImageService] Best text placement region: ${bestRegion.name} with overlap: ${minOverlap}`);

  // --- Text Wrapping and Font Sizing within the best region ---
  let wrappedText: string[] = [];
  let textFits = false;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  while (!textFits && attempts < maxAttempts) {
    ctx.font = `${fontSize}px 'LXGW WenKai Mono TC', 'Noto Color Emoji', 'sans-serif'`; // Add Noto Color Emoji for better emoji rendering
    wrappedText = [];
    let currentLine = '';
    const characters = text.split(''); // Split by characters for CJK languages

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > bestRegion.width && currentLine !== '') {
        // If adding the character exceeds width, and currentLine is not empty,
        // push currentLine and start a new one with the current character.
        wrappedText.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    // Push the last line if it's not empty
    if (currentLine !== '') {
      wrappedText.push(currentLine);
    }

    const totalTextHeight = wrappedText.length * lineHeight + (padding * 2);

    if (totalTextHeight <= bestRegion.height) {
      textFits = true;
    } else {
      fontSize *= 0.9; // Reduce font size if text doesn't fit
      lineHeight = fontSize * 1.2;
      attempts++;
    }
  }

  if (!textFits) {
    logger.warn('[ImageService] Text still does not fit after multiple attempts. Using smallest font size.');
  }

  // Final text dimensions
  let maxLineWidth = 0;
  for (const line of wrappedText) {
    const metrics = ctx.measureText(line);
    if (metrics.width > maxLineWidth) {
      maxLineWidth = metrics.width;
    }
  }

  const finalBgWidth = maxLineWidth + (padding * 2);
  const finalBgHeight = wrappedText.length * lineHeight + (padding * 2);

  // Calculate final x, y for text background (centered within bestRegion)
  const bgX = bestRegion.x + (bestRegion.width - finalBgWidth) / 2;
  const bgY = bestRegion.y + (bestRegion.height - finalBgHeight) / 2;

  // Determine text color based on background (simple heuristic)
  // For now, use config colors. Advanced would involve analyzing image pixels in the region.
  const bgColor = config.image.bgColorRgba;
  const textColor = config.image.textColorHex;

  return {
    x: bgX + padding, // Text starts after padding
    y: bgY + padding + lineHeight / 2, // Text baseline for middle alignment
    width: finalBgWidth,
    height: finalBgHeight,
    fontSize,
    lineHeight,
    padding,
    bgColor,
    textColor,
  };
}

/**
 * Overlays text on an image.
 * @param {string} imageUrl The URL of the image to overlay text on.
 * @param {string} text The text to overlay.
 * @param {ObjectLocalizationAnnotation[]} objectAnnotations Vision API object localization results.
 * @returns {Promise<Buffer>} A promise that resolves to the buffer of the new image.
 */
export async function overlayTextOnImage(imageUrl: string, text: string, objectAnnotations: ObjectLocalizationAnnotation[]): Promise<Buffer> {
  logger.info(`[ImageService] Overlaying text on image from URL: ${imageUrl}`);
  // Download the image from the URL
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${imageUrl}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // Draw the original image
  ctx.drawImage(image, 0, 0);

  // --- Calculate Text Placement ---
  const placement = calculateTextPlacement(image.width, image.height, text, objectAnnotations, ctx);

  // --- Text Styling ---
  ctx.font = `${placement.fontSize}px 'LXGW WenKai Mono TC', 'Noto Color Emoji', 'sans-serif'`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Create a unified content array for layout calculation (emoji handling)
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

  emojisToRender.sort((a, b) => a.originalIndex - b.originalIndex);

  const contentElements: { type: 'text' | 'emoji'; value: string; originalIndex: number; }[] = [];
  let lastIndex = 0;
  for (const emoji of emojisToRender) {
    if (emoji.originalIndex > lastIndex) {
      contentElements.push({ type: 'text', value: text.substring(lastIndex, emoji.originalIndex), originalIndex: lastIndex });
    }
    const emojiTextDescriptionLength = Object.keys(emojiMap).find(key => emojiMap[key] === emoji.unicode)?.length || 1;
    contentElements.push({ type: 'emoji', value: emoji.unicode, originalIndex: emoji.originalIndex });
    lastIndex = emoji.originalIndex + emojiTextDescriptionLength;
  }
  if (lastIndex < text.length) {
    contentElements.push({ type: 'text', value: text.substring(lastIndex), originalIndex: lastIndex });
  }

  // --- Text Wrapping within the calculated placement region ---
  const lines: { elements: typeof contentElements; width: number; }[] = [];
  let currentLineElements: typeof contentElements = [];
  let currentLineWidth = 0;
  const emojiSize = placement.fontSize; // Emoji size consistent with font size

  for (const element of contentElements) {
    let elementWidth = 0;
    if (element.type === 'text') {
      elementWidth = ctx.measureText(element.value).width;
    } else { // type === 'emoji'
      elementWidth = emojiSize;
    }

    if (currentLineWidth + elementWidth > placement.width && currentLineElements.length > 0) {
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

  // Draw background rectangle
  ctx.fillStyle = placement.bgColor;
  ctx.fillRect(placement.x - placement.padding, placement.y - placement.lineHeight / 2 - placement.padding, placement.width, placement.height);

  // --- Text Styling (after background) ---
  ctx.fillStyle = placement.textColor;

  // Render each line and overlay emojis
  const startY = placement.y; // Already adjusted for middle baseline

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const currentY = startY + i * placement.lineHeight;

    let currentLineX = placement.x; // Start X for the current line

    for (const element of line.elements) {
      if (element.type === 'text') {
        ctx.fillText(element.value, currentLineX, currentY);
        currentLineX += ctx.measureText(element.value).width;
      } else { // type === 'emoji'
        const emojiUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${element.value.toLowerCase()}.png`;
        try {
          const emojiImage = await loadImage(emojiUrl);
          ctx.drawImage(emojiImage, currentLineX, currentY - emojiSize / 2, emojiSize, emojiSize); // Adjust y for middle baseline
        } catch (error: any) {
          logger.error(`[ImageService] Failed to load emoji image ${element.value} from ${emojiUrl}:`, error.message);
          ctx.fillText('□', currentLineX, currentY);
        }
        currentLineX += emojiSize;
      }
    }
  }

  return canvas.toBuffer('image/png');
}
