// Builds the live film player (the Vite app at the repo root) into public/play,
// so the site and every preview serve "Play it live" themselves.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = fileURLToPath(new URL('../public/play', import.meta.url));
if (!existsSync(`${root}package.json`)) {
  console.warn('build-player: repo root not found, skipping the live player');
  process.exit(0);
}
const env = { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' };
// the player's own home page just sends people to the site
const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
if (prod) env.VITE_SITE_URL = `https://${prod}/`;
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit', env });
if (!existsSync(`${root}node_modules`)) run('npm ci --include=dev --no-audit --no-fund');
run('npx vite build');
rmSync(out, { recursive: true, force: true });
cpSync(`${root}dist`, out, { recursive: true });
console.log('build-player: copied the live player to public/play');
