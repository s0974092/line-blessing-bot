import { jest } from '@jest/globals';
import { overlayTextOnImage } from '../src/image';
import { v2 as cloudinary } from 'cloudinary';
import { Readable, Writable } from 'stream';
import { createCanvas, loadImage } from '@napi-rs/canvas';

// Mock Cloudinary and Canvas
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));


describe('Image Service', () => {
  const mockDrawImage = jest.fn();
  const mockFillText = jest.fn();
  const mockToBuffer = jest.fn(() => Buffer.from('new-image-buffer'));

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock implementation for createCanvas
    (createCanvas as jest.MockedFunction<any>).mockImplementation((width: number, height: number) => ({
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
        measureText: jest.fn(() => ({ width: 100 })), // Mock measureText
        fillRect: jest.fn(), // Mock fillRect
      })),
      toBuffer: mockToBuffer,
    }));

    (loadImage as jest.MockedFunction<any>).mockResolvedValue({ width: 1024, height: 1024 });
  });

  describe('overlayTextOnImage', () => {
    it('should correctly call canvas methods to overlay text', async () => {
      const imageBuffer = Buffer.from('test-image');
      const text = 'Hello World';

      const result = await overlayTextOnImage(imageBuffer, text);

      expect(loadImage).toHaveBeenCalledWith(imageBuffer);
      expect(createCanvas).toHaveBeenCalledWith(1024, 1024);
      expect(mockDrawImage).toHaveBeenCalled();
      expect(mockFillText).toHaveBeenCalledWith(text, expect.any(Number), expect.any(Number));
      expect(mockToBuffer).toHaveBeenCalledWith('image/png');
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
