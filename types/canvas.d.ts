// This declaration file is used to satisfy the TypeScript compiler during the Vercel build.
// It provides minimal type information for the 'canvas' module to prevent build errors.

declare module 'canvas' {
  // Provide minimal, placeholder types.
  export interface Canvas {}
  export interface Image {}

  // Declare the functions that are dynamically required in the code.
  export function createCanvas(width: number, height: number): Canvas;
  export function loadImage(src: Buffer | string): Promise<Image>;
  export function registerFont(fontPath: string, options: { family: string }): void;
}