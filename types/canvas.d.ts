// This declaration file is used to satisfy the TypeScript compiler during the Vercel build.
// It tells TypeScript that a module named 'canvas' exists, even though it is not installed in the production environment.
// This prevents build errors related to the conditional import in src/image.ts.
declare module 'canvas';
