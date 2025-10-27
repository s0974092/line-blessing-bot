/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\.tsx?$': 'ts-jest',
    'node_modules/(node-fetch|@google/generative-ai|data-uri-to-buffer|fetch-blob|formdata-polyfill)/.+\.(j|t)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!node-fetch|@google/generative-ai|data-uri-to-buffer|fetch-blob|formdata-polyfill)/'
  ],
};