import { jest } from '@jest/globals';
import type { Theme, Style } from '../src/types';
import { config as appConfig } from '../src/config';

let geminiModule: typeof import('../src/gemini');

// Define a local type for our mock GenerativeModel to avoid import issues
interface LocalMockGoogleGenAI {
  models: {
    generateContent: jest.Mock<(...args: any[]) => Promise<any>>; // Explicitly type as Jest mock
  };
  _getMockModelsGenerateContent(): jest.Mock<(...args: any[]) => Promise<any>>; // Expose for testing
}

const theme: Theme = { id: 't1', name: 'TestTheme', defaultText: '', prompt: 'TestThemePrompt', thumbnail: '' };
const style: Style = { id: 's1', name: 'TestStyle', prompt: 'TestStylePrompt', thumbnail: '' };

describe('gemini service', () => {
    let mockGenerativeModel: jest.Mock<(...args: [{ model: string; contents: string }]) => Promise<{ text: string }>>; // Declare here
    let MockedGoogleGenerativeAI: jest.MockedClass<any>; // To hold the mocked GoogleGenerativeAI class

  const originalEnv = process.env;

  beforeAll(() => {
    // Mock the @google/genai module once for all tests
    jest.doMock('@google/genai', () => {
      const actualMockGoogleGenAI = jest.fn((options: { apiKey: string }) => {
        if (!options.apiKey) {
          throw new Error('Mock: API key is missing');
        }
        return {
          models: {
            generateContent: mockGenerativeModel, // Use the mock declared outside
          },
          _getMockModelsGenerateContent: jest.fn(() => mockGenerativeModel), // Expose for testing
        };
      });
      MockedGoogleGenerativeAI = actualMockGoogleGenAI; // Assign to top-level variable
      return {
        GoogleGenAI: actualMockGoogleGenAI,
      };
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks(); // Clears mock calls, but not mock implementations
    jest.resetModules(); // Clears module cache, but not global variables

    // Re-initialize mockGenerativeModel for each test
    mockGenerativeModel = jest.fn((params: { model: string; contents: string }) => Promise.resolve({
      text: 'Mock blessing text within length',
    }));

    // Set environment variables for the config module
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: 'test-api-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_BLESSING_PROMPT_TEMPLATE: 'Generate a blessing for {theme} in {style} style, min {minLength} chars, max {maxLength} chars.',
      GEMINI_FALLBACK_PROMPT_TEMPLATE: 'Generate a generic blessing, min {minLength} chars, max {maxLength} chars.',
      GEMINI_FINAL_FALLBACK_TEXT: '平安喜樂，萬事如意',
      GEMINI_TEXT_MIN_LENGTH: '10',
      GEMINI_TEXT_MAX_LENGTH: '20',
      GEMINI_GENERATION_MAX_ATTEMPTS: '3',
    };

    geminiModule = await import('../src/gemini');
    const genAIInstance: any = geminiModule.getGoogleGenAIInstance();
    // The mockGenerativeModel is already the jest.fn() that the mock uses.
    // We just need to ensure its implementation is set for each test.
    // The _getMockModelsGenerateContent is no longer strictly needed if mockGenerativeModel is directly used.
    // For simplicity, let's keep it for now, but ensure mockGenerativeModel is the actual mock.
    // The mock is already set up in beforeEach, so this line might be redundant or incorrect now.
    // Let's remove this line for now and see if it simplifies things.
    // mockGenerativeModel = genAIInstance._getMockModelsGenerateContent();
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original environment variables
  });

  describe('getGoogleGenAIInstance', () => {
    it('should initialize GoogleGenAI with API key', async () => {
      const genAI = geminiModule.getGoogleGenAIInstance();
      expect(MockedGoogleGenerativeAI).toHaveBeenCalledWith({apiKey: 'test-api-key'});
    });

    it('should return the same GoogleGenAI instance on subsequent calls (singleton)', () => {
      const genAI1 = geminiModule.getGoogleGenAIInstance();
      const genAI2 = geminiModule.getGoogleGenAIInstance();
      expect(genAI1).toBe(genAI2);
    });
  });

  describe('generateBlessingText', () => {
    it('should generate a blessing text within specified length constraints', async () => {
      const expectedText = '這是一句測試祝福語，長度符合要求。';
      mockGenerativeModel.mockResolvedValueOnce({
        text: expectedText,
      });

      const blessing = await geminiModule.generateBlessingText(theme, style);
      expect(blessing).toBe(expectedText);
      expect(mockGenerativeModel).toHaveBeenCalledTimes(1);
      expect(mockGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.gemini.model,
        contents: 'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.',
      });
    });

    it('should retry if generateContent throws an API error and eventually succeed', async () => {
      const errorMessage = 'API rate limit exceeded';
      const validText = '這是一句符合長度要求的祝福語。';

      mockGenerativeModel
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValueOnce({ text: validText });

      const blessing = await geminiModule.generateBlessingText(theme, style);

      expect(blessing).toBe(validText);
      expect(mockGenerativeModel).toHaveBeenCalledTimes(3);
      expect(mockGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.gemini.model,
        contents: 'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.',
      });
    });

    it('should return final fallback text if all attempts and fallback prompt fail', async () => {
      const shortText = '短文'; // Length 2, min 10
      const errorMessage = 'Fallback API error';

      // Simulate all initial attempts failing due to out-of-bounds length
      mockGenerativeModel
        .mockResolvedValueOnce({ text: shortText }) // Attempt 1
        .mockResolvedValueOnce({ text: shortText }) // Attempt 2
        .mockResolvedValueOnce({ text: shortText }) // Attempt 3
        .mockRejectedValueOnce(new Error(errorMessage)); // Fallback attempt fails

      const blessing = await geminiModule.generateBlessingText(theme, style);

      expect(blessing).toBe('平安喜樂，萬事如意');
      expect(mockGenerativeModel).toHaveBeenCalledTimes(4); // 3 initial + 1 fallback
      expect(mockGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.gemini.model,
        contents: 'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.',
      });
      expect(mockGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.gemini.model,
        contents: 'Generate a generic blessing, min 10 chars, max 20 chars.',
      });
    });

    // Re-adding the test case that was removed from the getGoogleGenAIInstance block
    it('should fallback to generic prompt if all attempts fail and eventually succeed', async () => {
      const shortText = '短文'; // Length 2, min 10
      const fallbackText = '這是一句通用的祝福語。聲。'; // Length 12

      // Simulate all initial attempts failing due to out-of-bounds length
      mockGenerativeModel
        .mockResolvedValueOnce({ text: shortText })
        .mockResolvedValueOnce({ text: shortText })
        .mockResolvedValueOnce({ text: shortText })
        .mockResolvedValueOnce({ text: fallbackText }); // Fallback succeeds

      const blessing = await geminiModule.generateBlessingText(theme, style);

      expect(blessing).toBe(fallbackText);
      expect(mockGenerativeModel).toHaveBeenCalledTimes(4); // 3 initial + 1 fallback
      expect(mockGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.gemini.model,
        contents: 'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.',
      });
      expect(mockGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.gemini.model,
        contents: 'Generate a generic blessing, min 10 chars, max 20 chars.',
      });
    });
  });
});