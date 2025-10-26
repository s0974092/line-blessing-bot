import { jest } from '@jest/globals';
import { generateBlessingText } from '../src/gemini';
import { Theme, Style } from '../src/types';

// Mock the GoogleGenerativeAI module
const mockGenerateContent = jest.fn() as jest.MockedFunction<any>;
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('Gemini Service', () => {
  const mockTheme: Theme = { id: 't1', name: '早安', defaultText: '', prompt: '早晨的陽光', thumbnail: 'http://example.com/t1.png' };
  const mockStyle: Style = { id: 's1', name: '柔光寫實風', prompt: '柔和的光線，寫實風格', thumbnail: 'http://example.com/s1.png' };

  beforeEach(() => {
    mockGenerateContent.mockClear();
    mockGetGenerativeModel.mockClear();
    process.env.GEMINI_API_KEY = 'test-api-key'; // Set a dummy API key for tests
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('should generate a blessing text between 5 and 15 characters', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '祝您有個美好的一天' } });

    const blessingText = await generateBlessingText(mockTheme, mockStyle);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-flash' });
    expect(mockGenerateContent).toHaveBeenCalledWith(
      `請根據主題「${mockTheme.name}」和風格「${mockStyle.name}」，生成一句長度介於5到15個字之間（包含5和15）的繁體中文祝福語。請直接提供祝福語文字，不要包含任何其他說明或引號。`
    );
    expect(blessingText).toBe('祝您有個美好的一天');
    expect(blessingText.length).toBeGreaterThanOrEqual(5);
    expect(blessingText.length).toBeLessThanOrEqual(15);
  });

  it('should retry if generated text is too short and eventually succeed', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => '太短' } })
      .mockResolvedValueOnce({ response: { text: () => '這次可以了' } });

    const blessingText = await generateBlessingText(mockTheme, mockStyle);

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(blessingText).toBe('這次可以了');
  });

  it('should retry if generated text is too long and eventually use fallback', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '這句話實在是太長太長了，超過十五個字了' } });

    const blessingText = await generateBlessingText(mockTheme, mockStyle);

    expect(mockGenerateContent).toHaveBeenCalledTimes(4); // 3 attempts + 1 fallback
    expect(blessingText).toBe('平安喜樂，萬事如意');
  });

  it('should return fallback text if API call fails consistently', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API error'));

    const blessingText = await generateBlessingText(mockTheme, mockStyle);
    expect(blessingText).toBe('平安喜樂，萬事如意');
    expect(mockGenerateContent).toHaveBeenCalledTimes(4); // 3 attempts + 1 fallback
  });

  it('should throw an error if GEMINI_API_KEY is not set', async () => {
    // Use jest.isolateModules to ensure a fresh import of gemini.ts without the API key
    await jest.isolateModulesAsync(async () => {
      delete process.env.GEMINI_API_KEY;
      // Reset the singleton instance in the module cache
      jest.resetModules();
      const { generateBlessingText: isolatedGenerateBlessingText } = await import('../src/gemini');
      try {
        await isolatedGenerateBlessingText(mockTheme, mockStyle);
        throw new Error('Expected function to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('GEMINI_API_KEY is not set in environment variables.');
      }
    });
  });
});
