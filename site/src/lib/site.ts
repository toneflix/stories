export const repoUrl = 'https://github.com/toneflix/stories';

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// Always the production address, so previews never present themselves as the real site.
export const siteUrl = productionHost ? `https://${productionHost}` : 'http://localhost:3000';

export const isProduction = process.env.VERCEL_ENV === 'production';

export const siteDescription = 'A collection of short interactive films made with Three.js and WebGL.';
