// [檔案核心意義]
// 本檔案的核心目的，是為了解決在 Vercel 生產環境中，因缺少 `canvas` 套件而導致的 TypeScript 編譯失敗問題。
//
// [問題說明]
// 我們的程式碼只在本地開發時載入 `canvas` 套件，但在 Vercel 建置時，TypeScript 編譯器依然會檢查到這段程式碼，並因找不到 `canvas` 套件的型別定義而報錯。
//
// [解決方案]
// 這個檔案提供了一個「假的」模組藍圖 (Module Blueprint)，向編譯器「承諾」`canvas` 模組及其內部型別的存在。
// 這使得 TypeScript 編譯能順利通過，而在實際執行階段 (Runtime)，此檔案會被完全忽略，程式會根據環境載入正確的 `node-canvas` 或 `@napi-rs/canvas` 套件。

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