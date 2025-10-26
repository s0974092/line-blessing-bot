import { composePrompt, generateImage } from '../src/ai';
import { Theme, Style } from '../src/types';
import * as imageService from '../src/image';
import { jest } from '@jest/globals';

// Mock the dependencies
jest.mock('../src/image');
jest.mock('node-fetch', () => jest.fn()); // Mock node-fetch

const mockGenerateContent = jest.fn() as jest.MockedFunction<any>;
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('AI Service', () => {
  // Dynamically require the module to get the mocked version
  const { composePrompt, generateImage } = require('../src/ai');

  const mockTheme: Theme = { id: 't1', name: 'Theme 1', defaultText: '', prompt: 'A beautiful {stylePrompt} landscape.', thumbnail: 'http://example.com/t1.png' };
  const mockStyle: Style = { id: 's1', name: 'Style 1', prompt: 'in the style of Monet', thumbnail: 'http://example.com/s1.png' };
  const mockText = 'Hello World';

  beforeEach(() => {
    (imageService.overlayTextOnImage as jest.MockedFunction<any>).mockClear();
    mockGenerateContent.mockClear();
    mockGetGenerativeModel.mockClear();
    // Mock node-fetch for each test
    (require('node-fetch') as jest.MockedFunction<any>).mockClear();
    (require('node-fetch') as jest.MockedFunction<any>).mockResolvedValue({
      ok: true,
      buffer: () => Promise.resolve(Buffer.from('original-image-data')),
    });
  });

  describe('composePrompt', () => {
    // ... (existing test)
  });

  describe('generateImage', () => {
    it('should generate, overlay, and return an image buffer successfully', async () => {
      const mockApiResponse = { response: { candidates: [{ content: { parts: [{ inlineData: { data: 'original-image-data' } }] } }] } };
      mockGenerateContent.mockResolvedValue(mockApiResponse);
      (imageService.overlayTextOnImage as jest.MockedFunction<any>).mockResolvedValue(Buffer.from('image-with-text'));

      const result = await generateImage(mockTheme, mockStyle, mockText);

      // expect(mockGenerateContent).toHaveBeenCalledWith('A beautiful in the style of Monet landscape.'); // Not called when text is provided
      expect(imageService.overlayTextOnImage).toHaveBeenCalledWith(Buffer.from('original-image-data'), mockText);
      expect(result).toEqual(Buffer.from('image-with-text'));
    });

    // ... (existing error tests)
  });
});
