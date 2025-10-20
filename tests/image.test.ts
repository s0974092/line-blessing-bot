import { uploadImage, overlayTextOnImage } from '../src/image';
import { v2 as cloudinary } from 'cloudinary';
import { Readable, Writable } from 'stream';
import { createCanvas, loadImage } from 'canvas';

// Mock Cloudinary and Canvas
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));
jest.mock('canvas', () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
  registerFont: jest.fn(),
}));

describe('Image Service', () => {
  const mockDrawImage = jest.fn();
  const mockFillText = jest.fn();
  const mockToBuffer = jest.fn(() => Buffer.from('new-image-buffer'));

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock implementation for createCanvas
    (createCanvas as jest.Mock).mockImplementation((width, height) => ({
      width,
      height,
      getContext: jest.fn(() => ({
        drawImage: mockDrawImage,
        fillText: mockFillText,
        // Mock properties that are set in the function
        font: '',
        fillStyle: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 0,
      })),
      toBuffer: mockToBuffer,
    }));

    (loadImage as jest.Mock).mockResolvedValue({ width: 1024, height: 1024 });
  });

  describe('overlayTextOnImage', () => {
    it('should correctly call canvas methods to overlay text', async () => {
      const imageBuffer = Buffer.from('test-image');
      const text = 'Hello World';

      const result = await overlayTextOnImage(imageBuffer, text);

      expect(loadImage).toHaveBeenCalledWith(imageBuffer);
      expect(createCanvas).toHaveBeenCalledWith(1024, 1024);
      expect(mockDrawImage).toHaveBeenCalled();
      expect(mockFillText).toHaveBeenCalledWith(text, 512, expect.any(Number));
      expect(mockToBuffer).toHaveBeenCalledWith('image/png');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('uploadImage', () => {
    // ... (existing tests for uploadImage)
  });
});
