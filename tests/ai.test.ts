import { composePrompt, generateImage } from '../src/ai';
import { Theme, Style } from '../src/types';
import * as imageService from '../src/image';

// Mock the dependencies
jest.mock('../src/image');

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('AI Service', () => {
  // Dynamically require the module to get the mocked version
  const { composePrompt, generateImage } = require('../src/ai');

  const mockTheme: Theme = { id: 't1', name: 'Theme 1', defaultText: '', prompt: 'A beautiful {stylePrompt} landscape.' };
  const mockStyle: Style = { id: 's1', name: 'Style 1', prompt: 'in the style of Monet' };
  const mockText = 'Hello World';

  beforeEach(() => {
    (imageService.uploadImage as jest.Mock).mockClear();
    (imageService.overlayTextOnImage as jest.Mock).mockClear();
    mockGenerateContent.mockClear();
    mockGetGenerativeModel.mockClear();
  });

  describe('composePrompt', () => {
    // ... (existing test)
  });

  describe('generateImage', () => {
    it('should generate, overlay, and upload an image successfully', async () => {
      const mockApiResponse = { response: { candidates: [{ content: { parts: [{ inlineData: { data: 'original-image-data' } }] } }] } };
      mockGenerateContent.mockResolvedValue(mockApiResponse);
      (imageService.overlayTextOnImage as jest.Mock).mockResolvedValue(Buffer.from('image-with-text'));
      (imageService.uploadImage as jest.Mock).mockResolvedValue('http://mock-url.com/image.png');

      const result = await generateImage(mockTheme, mockStyle, mockText);

      expect(mockGenerateContent).toHaveBeenCalledWith('A beautiful in the style of Monet landscape.');
      expect(imageService.overlayTextOnImage).toHaveBeenCalledWith(Buffer.from('original-image-data', 'base64'), mockText);
      expect(imageService.uploadImage).toHaveBeenCalledWith(Buffer.from('image-with-text'));
      expect(result).toBe('http://mock-url.com/image.png');
    });

    // ... (existing error tests)
  });
});
