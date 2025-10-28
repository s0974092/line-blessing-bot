import { jest } from '@jest/globals';
import type { Theme, Style } from '../src/types';
import { config as appConfig } from '../src/config';

// Define a local type for our mock GenerativeModel to avoid import issues
interface LocalMockGenerativeModel {
  setGenerateContentResult(result: any): void;
  generateContent: jest.Mock<(...args: any[]) => Promise<any>>; // Explicitly type as Jest mock
}

// Define a local type for our mock GoogleGenerativeAI to avoid import issues
interface LocalMockGoogleGenerativeAI {
  _getMockGenerativeModel(): LocalMockGenerativeModel;
}

const theme: Theme = { id: 't1', name: 'TestTheme', defaultText: '', prompt: 'TestThemePrompt', thumbnail: '' };
const style: Style = { id: 's1', name: 'TestStyle', prompt: 'TestStylePrompt', thumbnail: '' };

describe('gemini service', () => {
  let geminiModule: typeof import('../src/gemini');
  let mockGenerativeModel: LocalMockGenerativeModel;
  let MockedGoogleGenerativeAI: jest.MockedClass<any>; // To hold the mocked GoogleGenerativeAI class
  let MockedGenerativeModel: jest.MockedClass<any>; // To hold the mocked GenerativeModel class

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set environment variables for the config module
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: 'test-api-key',
      GEMINI_MODEL: 'gemini-pro',
      GEMINI_BLESSING_PROMPT_TEMPLATE: 'Generate a blessing for {theme} in {style} style, min {minLength} chars, max {maxLength} chars.',
      GEMINI_FALLBACK_PROMPT_TEMPLATE: 'Generate a generic blessing, min {minLength} chars, max {maxLength} chars.',
      GEMINI_FINAL_FALLBACK_TEXT: '平安喜樂，萬事如意',
      GEMINI_TEXT_MIN_LENGTH: '10',
      GEMINI_TEXT_MAX_LENGTH: '20',
      GEMINI_GENERATION_MAX_ATTEMPTS: '3',
    };

    // Mock the @google/generative-ai module
    jest.doMock('@google/generative-ai', () => {
      const mockGenerateContent = jest.fn(() => ({
        response: {
          text: jest.fn(() => 'Mock blessing text within length'),
        },
      }));

      const MockGenerativeModelClass = jest.fn(function (this: any) {
        this.generateContent = mockGenerateContent;
      });

      const actualMockGoogleGenerativeAI = jest.fn((apiKey: string) => {
        if (!apiKey) {
          throw new Error('Mock: API key is missing');
        }
        return {
          getGenerativeModel: jest.fn(() => new MockGenerativeModelClass()),
          _getMockGenerativeModel: jest.fn(() => new MockGenerativeModelClass()), // Expose for testing
        };
      });

      MockedGoogleGenerativeAI = actualMockGoogleGenerativeAI; // Assign to top-level variable
      MockedGenerativeModel = MockGenerativeModelClass; // Assign to top-level variable

      return {
        GoogleGenerativeAI: actualMockGoogleGenerativeAI,
        GenerativeModel: MockGenerativeModelClass,
      };
    }, { virtual: true });

    geminiModule = await import('../src/gemini');

    // Call getGenerativeModel once to ensure GoogleGenerativeAI is instantiated
    // and assign the returned mocked GenerativeModel instance to mockGenerativeModel
    mockGenerativeModel = geminiModule.getGenerativeModel() as any as LocalMockGenerativeModel;
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original environment variables
  });

  describe('getGenerativeModel', () => {
    it('should initialize GenerativeModel with API key and model name', async () => {
      const model = geminiModule.getGenerativeModel();
      expect(MockedGoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(model).toBeInstanceOf(MockedGenerativeModel); // Use the mocked GenerativeModel type
    });

    it('should fallback to generic prompt if all attempts fail and eventually succeed', async () => {
      const shortText = '短文'; // Length 2, min 10
      const fallbackText = '這是一句通用的祝福語。'; // Length 12

      // Simulate all initial attempts failing due to out-of-bounds length
      mockGenerativeModel.generateContent
        .mockResolvedValueOnce({ response: { text: () => shortText } })
        .mockResolvedValueOnce({ response: { text: () => shortText } })
        .mockResolvedValueOnce({ response: { text: () => shortText } })
        .mockResolvedValueOnce({ response: { text: () => fallbackText } }); // Fallback succeeds

      const blessing = await geminiModule.generateBlessingText(theme, style);

      expect(blessing).toBe(fallbackText);
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledTimes(4); // 3 initial + 1 fallback
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(
        'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.'
      );
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(
        'Generate a generic blessing, min 10 chars, max 20 chars.'
      );
    });

    it('should return the same GenerativeModel instance on subsequent calls (singleton)', () => {
      const model1 = geminiModule.getGenerativeModel();
      const model2 = geminiModule.getGenerativeModel();
      expect(model1).toBe(model2);
    });
  });

  describe('generateBlessingText', () => {
    it('should generate a blessing text within specified length constraints', async () => {
      const expectedText = '這是一句測試祝福語，長度符合要求。';
      mockGenerativeModel.generateContent.mockResolvedValueOnce({
        response: {
          text: () => expectedText,
        },
      });

      const blessing = await geminiModule.generateBlessingText(theme, style);
      expect(blessing).toBe(expectedText);
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(
        'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.'
      );
    });

    it('should retry if generateContent throws an API error and eventually succeed', async () => {
      const errorMessage = 'API rate limit exceeded';
      const validText = '這是一句符合長度要求的祝福語。';

      mockGenerativeModel.generateContent
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValueOnce({ response: { text: () => validText } });

      const blessing = await geminiModule.generateBlessingText(theme, style);

      expect(blessing).toBe(validText);
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledTimes(3);
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(
        'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.'
      );
    });

    it('should return final fallback text if all attempts and fallback prompt fail', async () => {
      const shortText = '短文'; // Length 2, min 10
      const errorMessage = 'Fallback API error';

      // Simulate all initial attempts failing due to out-of-bounds length
      mockGenerativeModel.generateContent
        .mockResolvedValueOnce({ response: { text: () => shortText } }) // Attempt 1
        .mockResolvedValueOnce({ response: { text: () => shortText } }) // Attempt 2
        .mockResolvedValueOnce({ response: { text: () => shortText } }) // Attempt 3
        .mockRejectedValueOnce(new Error(errorMessage)); // Fallback attempt fails

      const blessing = await geminiModule.generateBlessingText(theme, style);

      expect(blessing).toBe('平安喜樂，萬事如意');
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledTimes(4); // 3 initial + 1 fallback
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(
        'Generate a blessing for TestTheme in TestStyle style, min 10 chars, max 20 chars.'
      );
      expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(
        'Generate a generic blessing, min 10 chars, max 20 chars.'
      );
    });
  });
});