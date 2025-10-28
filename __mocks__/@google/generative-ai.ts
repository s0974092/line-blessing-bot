// __mocks__/@google/generative-ai.ts

// This is the mock for the GenerativeModel class
export class MockGenerativeModel {
  private generateContentResult: any;

  constructor() {
    this.generateContentResult = {
      response: {
        text: () => 'Mock blessing text within length',
      },
    };
  }

  setGenerateContentResult(result: any) {
    this.generateContentResult = result;
  }

  async generateContent(prompt: string) {
    if (this.generateContentResult instanceof Error) {
      throw this.generateContentResult;
    }
    return this.generateContentResult;
  }
}

// This is the mock for the GoogleGenerativeAI class
export class GoogleGenerativeAI {
  private mockGenerativeModel: MockGenerativeModel;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Mock: API key is missing');
    }
    this.mockGenerativeModel = new MockGenerativeModel();
  }

  getGenerativeModel(params: { model: string }) {
    return this.mockGenerativeModel;
  }

  // Expose the internal mock for testing purposes
  _getMockGenerativeModel(): MockGenerativeModel {
    return this.mockGenerativeModel;
  }
}

// Export GenerativeModel as well, as it's used in src/gemini.ts
export const GenerativeModel = MockGenerativeModel;