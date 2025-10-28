import { jest } from '@jest/globals';
import { config } from '../src/config';

// We will dynamically import the module under test, so no top-level import here.

describe('overlayTextOnImage', () => {
  const imageBuffer = Buffer.from('fake-image-data');
  const mockImage = { width: 800, height: 600 };
  const mockEmojiImage = { width: 72, height: 72 };

  afterEach(() => {
    // Restore all mocks after each test to avoid side effects
    jest.restoreAllMocks();
  });

  // A helper to setup mocks for a given test run
  const setupMocks = (loadImageImplementation?: any) => {
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockCtx = {
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn((text: string) => ({ width: text.length * 10 })),
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
    };

    const defaultLoadImage = async (source: Buffer | string) => {
      if (typeof source === 'string' && source.includes('twemoji')) {
        return Promise.resolve(mockEmojiImage);
      }
      return Promise.resolve(mockImage);
    };

    const mockLoadImage = jest.fn(loadImageImplementation || defaultLoadImage);

    const mockCreateCanvas = jest.fn((width: number, height: number) => ({
      getContext: jest.fn(() => mockCtx),
      toBuffer: jest.fn((mimeType: string) => Buffer.from(`fake-png-buffer-for-${mimeType}`)),
      width: width,
      height: height,
    }));

    const mockRegisterFont = jest.fn();

    // Mock both canvas libraries since the module dynamically requires one of them
    jest.doMock('canvas', () => ({
      createCanvas: mockCreateCanvas,
      loadImage: mockLoadImage,
      registerFont: mockRegisterFont,
    }));

    jest.doMock('@napi-rs/canvas', () => ({
      createCanvas: mockCreateCanvas,
      loadImage: mockLoadImage,
      GlobalFonts: {
        registerFromPath: mockRegisterFont,
      },
    }));

    // Return the low-level mocks to assert against them
    return { mockCtx, mockLoadImage, mockCreateCanvas };
  };

  // P0 Test Case 1: Basic Text Overlay
  it('should overlay simple text on an image', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mockCtx } = setupMocks();
      const { overlayTextOnImage } = await import('../src/image');

      const text = 'Hello World';
      await overlayTextOnImage(imageBuffer, text);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImage, 0, 0);
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith(text, expect.any(Number), expect.any(Number));
      expect(mockCtx.font).toContain('LXGW WenKai Mono TC');
      expect(mockCtx.fillStyle).toBe(config.image.textColorHex);
    });
  });

  // P0 Test Case 2: Emoji Handling
  it('should attempt to load an emoji image when emoji text is present', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mockCtx, mockLoadImage } = setupMocks();
      const { overlayTextOnImage } = await import('../src/image');

      const text = 'Pray for peace (hands together)';
      await overlayTextOnImage(imageBuffer, text);

      const emojiUnicode = '1f64f'; // Unicode for 🙏
      const expectedEmojiUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${emojiUnicode}.png`;

      expect(mockLoadImage).toHaveBeenCalledWith(expectedEmojiUrl);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImage, 0, 0);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockEmojiImage, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('Pray for peace ', expect.any(Number), expect.any(Number));
    });
  });

  // P0 Test Case 3: Emoji Loading Failure Fallback
  it('should render a fallback character if an emoji image fails to load', async () => {
    await jest.isolateModulesAsync(async () => {
      const loadImageWithError = async (source: Buffer | string) => {
        if (typeof source === 'string' && source.includes('twemoji')) {
          return Promise.reject(new Error('Failed to load resource'));
        }
        return Promise.resolve(mockImage);
      };

      const { mockCtx } = setupMocks(loadImageWithError);
      const { overlayTextOnImage } = await import('../src/image');

      const text = 'This will fail (hands together)';
      await overlayTextOnImage(imageBuffer, text);

      expect(mockCtx.fillText).toHaveBeenCalledWith('□', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('This will fail ', expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).not.toHaveBeenCalledWith(mockEmojiImage, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });
  });

  // P1 Test Case: Empty Input
  it('should not draw text or background for an empty string input', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mockCtx } = setupMocks();
      const { overlayTextOnImage } = await import('../src/image');

      await overlayTextOnImage(imageBuffer, '');

      // Assert that no text or background is drawn
      expect(mockCtx.fillText).not.toHaveBeenCalled();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();

      // Assert that only the base image is drawn
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImage, 0, 0);
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    });
  });

  // P1 Test Case: Mixed Content - Emoji at start
  it('should correctly render content with an emoji at the start', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mockCtx, mockLoadImage } = setupMocks();
      const { overlayTextOnImage } = await import('../src/image');

      await overlayTextOnImage(imageBuffer, '(hands together)Hello');

      expect(mockLoadImage).toHaveBeenCalledWith(expect.stringContaining('1f64f'));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockEmojiImage, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('Hello', expect.any(Number), expect.any(Number));
    });
  });

  // P1 Test Case: Mixed Content - Consecutive emojis
  it('should correctly render multiple consecutive emojis', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mockCtx, mockLoadImage } = setupMocks();
      const { overlayTextOnImage } = await import('../src/image');

      await overlayTextOnImage(imageBuffer, '(hands together)(hands together)');

      // Called for base image + 2 emojis
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(3);
      expect(mockLoadImage).toHaveBeenCalledWith(expect.stringContaining('1f64f'));
      // fillText might be called with empty strings, so we check it's not called with visible text
      expect(mockCtx.fillText).not.toHaveBeenCalledWith(expect.stringMatching(/\S/));
    });
  });

  // P1 Test Case: Mixed Content - Text surrounded by emojis
  it('should correctly render text surrounded by emojis', async () => {
    await jest.isolateModulesAsync(async () => {
      const { mockCtx, mockLoadImage } = setupMocks();
      const { overlayTextOnImage } = await import('../src/image');

      await overlayTextOnImage(imageBuffer, '(hands together)Hello(hands together)');

      // Called for base image + 2 emojis
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(3);
      expect(mockLoadImage).toHaveBeenCalledWith(expect.stringContaining('1f64f'));
      expect(mockCtx.fillText).toHaveBeenCalledWith('Hello', expect.any(Number), expect.any(Number));
    });
  });

  // P1 Test Case: Line Breaking
  it('should break content into multiple lines when it exceeds image width', async () => {
    await jest.isolateModulesAsync(async () => {
      // Use a smaller image width and a custom loader to trigger wrapping
      const smallMockImage = { width: 400, height: 600 };
      const loadImageForWrapping = async (source: Buffer | string) => {
        if (typeof source === 'string' && source.includes('twemoji')) {
          return Promise.resolve(mockEmojiImage);
        }
        return Promise.resolve(smallMockImage); // Return smaller image for base
      };

      const { mockCtx } = setupMocks(loadImageForWrapping);
      const { overlayTextOnImage } = await import('../src/image');

      const text = 'This is twenty chars (hands together) and this part should wrap';
      await overlayTextOnImage(imageBuffer, text);

      // Check that text is split into two calls for the two lines
      expect(mockCtx.fillText).toHaveBeenCalledTimes(2);

      // Verify the content of the calls
      expect(mockCtx.fillText).toHaveBeenCalledWith('This is twenty chars ', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith(' and this part should wrap', expect.any(Number), expect.any(Number));

      // Check that the two text calls are on different Y coordinates
      const firstCallY = mockCtx.fillText.mock.calls[0][2];
      const secondCallY = mockCtx.fillText.mock.calls[1][2];
      expect(firstCallY).not.toEqual(secondCallY);
    });
  });
});