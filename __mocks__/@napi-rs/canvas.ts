import { jest } from '@jest/globals';

const mockCanvas = {
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
  GlobalFonts: {
    registerFromPath: jest.fn(),
  },
};

export = mockCanvas;
