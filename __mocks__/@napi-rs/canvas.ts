import { jest } from '@jest/globals';

// A more comprehensive mock for the canvas context
const mockContext = {
  // --- State properties ---
  fillStyle: '',
  font: '',
  textAlign: '',
  textBaseline: '',
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,

  // --- Mocked methods ---
  drawImage: jest.fn(),
  fillText: jest.fn(),
  fillRect: jest.fn(),
  measureText: jest.fn((text: string) => ({
    // A more realistic measureText
    width: text.length * 10, 
  })),

  // --- Utility to reset state ---
  _reset: () => {
    mockContext.fillStyle = '';
    mockContext.font = '';
    mockContext.textAlign = '';
    mockContext.textBaseline = '';
    mockContext.shadowColor = '';
    mockContext.shadowBlur = 0;
    mockContext.shadowOffsetX = 0;
    mockContext.shadowOffsetY = 0;
    mockContext.drawImage.mockClear();
    mockContext.fillText.mockClear();
    mockContext.fillRect.mockClear();
    mockContext.measureText.mockClear();
  },
};

const mockCanvas = {
  getContext: jest.fn(() => mockContext),
  toBuffer: jest.fn((type: string) => Buffer.from(`mock-buffer:${type}`)),
  _reset: () => {
    mockCanvas.getContext.mockClear();
    mockCanvas.toBuffer.mockClear();
    mockContext._reset();
  },
};

const createCanvas = jest.fn(() => mockCanvas);
const loadImage = jest.fn();
const registerFont = jest.fn();
const GlobalFonts = {
  registerFromPath: jest.fn(),
  _reset: () => GlobalFonts.registerFromPath.mockClear(),
};

// Export the mocks
module.exports = {
  createCanvas,
  loadImage,
  registerFont, // For node-canvas path
  GlobalFonts,  // For @napi-rs/canvas path
  _mockCanvas: mockCanvas, // Exported for detailed assertions
  _mockContext: mockContext, // Exported for detailed assertions
  _reset: () => {
    createCanvas.mockClear();
    loadImage.mockClear();
    registerFont.mockClear();
    GlobalFonts._reset();
    mockCanvas._reset();
  },
};