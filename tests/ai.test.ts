
import { composePrompt, generateImage } from '../src/ai';
import { generateBlessingText } from '../src/gemini';
import { overlayTextOnImage } from '../src/image';
import { Theme, Style } from '../src/types';

// Mock dependencies
jest.mock('../src/gemini');
jest.mock('../src/image');

// Mock global fetch
global.fetch = jest.fn();

const mockGenerateBlessingText = generateBlessingText as jest.Mock;
const mockOverlayTextOnImage = overlayTextOnImage as jest.Mock;
const mockFetch = fetch as jest.Mock;

const theme: Theme = { id: 't1', name: 'TestTheme', prompt: 'ThemePrompt {stylePrompt}', defaultText: '', thumbnail: '' };
const style: Style = { id: 's1', name: 'TestStyle', prompt: 'StylePrompt', thumbnail: '' };

describe('ai service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('composePrompt', () => {
    it('should compose a prompt from theme and style', () => {
      const prompt = composePrompt(theme, style, 'Hello');
      expect(prompt).toBe('ThemePrompt StylePrompt');
    });

    it('should prepend blessing text for festival theme', () => {
      const festivalTheme: Theme = { ...theme, id: 'festival' };
      const prompt = composePrompt(festivalTheme, style, 'Custom Blessing');
      expect(prompt).toBe('Custom Blessing, ThemePrompt StylePrompt');
    });

    it('should not prepend blessing text for festival theme if text is default', () => {
      const festivalTheme: Theme = { ...theme, id: 'festival' };
      const prompt = composePrompt(festivalTheme, style, '用主題預設文字');
      expect(prompt).toBe('ThemePrompt StylePrompt');
    });

    it('should throw an error if theme or style is missing', () => {
      expect(() => composePrompt(null as any, style, 'text')).toThrow('Theme and style objects are required.');
      expect(() => composePrompt(theme, null as any, 'text')).toThrow('Theme and style objects are required.');
    });
  });

  describe('generateImage', () => {
    it('should generate an image with provided text', async () => {
      const fakeImageBuffer = Buffer.from('fake-image');
      const finalImageBuffer = Buffer.from('final-image');
      mockFetch.mockResolvedValue({ ok: true, arrayBuffer: async () => fakeImageBuffer });
      mockOverlayTextOnImage.mockResolvedValue(finalImageBuffer);

      const result = await generateImage(theme, style, 'Provided Text');

      expect(mockGenerateBlessingText).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockOverlayTextOnImage).toHaveBeenCalledWith(expect.any(Buffer), 'Provided Text');
      expect(result).toBe(finalImageBuffer);
    });

    it('should generate an image with AI-generated text if none is provided', async () => {
      const fakeImageBuffer = Buffer.from('fake-image');
      const finalImageBuffer = Buffer.from('final-image');
      mockGenerateBlessingText.mockResolvedValue('AI Text');
      mockFetch.mockResolvedValue({ ok: true, arrayBuffer: async () => fakeImageBuffer });
      mockOverlayTextOnImage.mockResolvedValue(finalImageBuffer);

      const result = await generateImage(theme, style, '');

      expect(mockGenerateBlessingText).toHaveBeenCalledWith(theme, style);
      expect(mockOverlayTextOnImage).toHaveBeenCalledWith(expect.any(Buffer), 'AI Text');
      expect(result).toBe(finalImageBuffer);
    });

    it('should retry fetching the image on failure', async () => {
        const fakeImageBuffer = Buffer.from('fake-image');
        const finalImageBuffer = Buffer.from('final-image');
        mockFetch
            .mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway' })
            .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => fakeImageBuffer });
        mockOverlayTextOnImage.mockResolvedValue(finalImageBuffer);

        // Mock setTimeout to resolve immediately
        jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
            if (typeof callback === 'function') {
                callback();
            }
            return {} as NodeJS.Timeout;
        });

        const result = await generateImage(theme, style, 'Test');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result).toBe(finalImageBuffer);
    });

    it('should throw an error after all fetch retries fail', async () => {
        mockFetch.mockResolvedValue({ ok: false, statusText: 'Server Error' });
        jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
            if (typeof callback === 'function') {
                callback();
            }
            return {} as NodeJS.Timeout;
        });

        await expect(generateImage(theme, style, 'Test')).rejects.toThrow('Failed to fetch image from Pollinations.ai: Server Error');
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw a custom error if any step fails', async () => {
      const error = new Error('Overlay failed');
      mockFetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('fake') });
      mockOverlayTextOnImage.mockRejectedValue(error);

      await expect(generateImage(theme, style, 'Test')).rejects.toThrow('圖片生成失敗，請稍後再試。錯誤：Overlay failed');
    });
  });
});
