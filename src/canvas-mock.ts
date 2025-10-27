
// src/canvas-mock.ts

// This is a mock implementation of @napi-rs/canvas to be used in local development
// environments where the native module may fail to load.
// It provides the minimum necessary APIs to prevent the application from crashing.

export const GlobalFonts = {
  registerFromPath: (path: string, alias: string) => {
    console.log(`[Canvas Mock] Skipping font registration for: ${alias} at ${path}`);
  },
};

export const loadImage = async (src: string | Buffer) => {
  console.log('[Canvas Mock] loadImage called. Returning a dummy image.');
  return {
    width: 1024,
    height: 1024,
  };
};

export const createCanvas = (width: number, height: number) => {
  console.log(`[Canvas Mock] createCanvas called with ${width}x${height}`);
  const mockContext = {
    drawImage: () => {},
    fillRect: () => {},
    fillText: () => {},
    measureText: (text: string) => ({ width: text.length * 12 }),
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
  };

  return {
    getContext: (contextId: '2d') => {
      console.log("[Canvas Mock] getContext('2d') called.");
      return mockContext;
    },
    toBuffer: (mimeType: 'image/png' | 'image/jpeg') => {
      console.log(`[Canvas Mock] toBuffer called with ${mimeType}. Returning empty buffer.`);
      return Buffer.from('');
    },
  };
};
