// This declaration file is used to satisfy the TypeScript compiler during the Vercel build.
// It provides a more complete (but still placeholder) definition of the 'canvas' module's types.

declare module 'canvas' {
  // Define the types with the properties and methods our application actually uses.
  export interface Image {
    width: number;
    height: number;
  }

  export interface CanvasRenderingContext2D {
    // Add all required overloads for drawImage
    drawImage(image: Image, dx: number, dy: number): void;
    drawImage(image: Image, dx: number, dy: number, dWidth: number, dHeight: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    measureText(text: string): { width: number };
    font: string;
    fillStyle: string;
    textAlign: string;
    textBaseline: string;
  }

  export interface Canvas {
    width: number;
    height: number;
    getContext(contextId: '2d'): CanvasRenderingContext2D;
    toBuffer(mimeType: 'image/png' | 'image/jpeg'): Buffer;
  }

  // Declare the functions that are dynamically required in the code.
  export function createCanvas(width: number, height: number): Canvas;
  export function loadImage(src: Buffer | string): Promise<Image>;
  export function registerFont(fontPath: string, options: { family: string }): void;
}