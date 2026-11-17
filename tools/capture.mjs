// Takes the screenshots: serves game/ with serve.ts, opens each ?shot= scene from shots.json in
// headless Chrome at 1280x720, waits for the scene to report ready, and saves a JPEG under 250 KiB.
// usage: node tools/capture.mjs [name-filter] [--out dir]
import { spawn } from 'node:child_process';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('D:/Claude/alloy/node_modules/');
const puppeteer = require('puppeteer-core');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : join(root, 'screenshots');
const filter = args.find((a, i) => !a.startsWith('--') && (outIndex < 0 || i !== outIndex + 1) && args[i - 1] !== '--query');
const queryArgs = args.flatMap((a, i) => (a === '--query' ? [args[i + 1]] : []));
const shots = queryArgs.length
  ? queryArgs.map((q, i) => ({ name: `q${i + 1}.jpg`, query: q }))
  : JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8')).filter((s) => !filter || s.name.includes(filter) || s.query.includes(filter));
const PORT = 8091;
const LIMIT = 250 * 1024;

mkdirSync(outDir, { recursive: true });
const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1280,720'],
});
try {
  for (const shot of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const logs = [];
    page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
    page.on('pageerror', (e) => logs.push('pageerror: ' + (e.stack || e.message)));
    await page.goto(`http://localhost:${PORT}/${shot.query}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction('window.__shotReady === true', { timeout: Number(process.env.SHOT_TIMEOUT || 90000), polling: 200 });
    } catch {
      console.log('timeout waiting for', shot.name);
    }
    const file = join(outDir, shot.name);
    let quality = 88;
    for (;;) {
      await page.screenshot({ path: file, type: 'jpeg', quality });
      if (statSync(file).size <= LIMIT || quality <= 40) break;
      quality -= 6;
    }
    console.log(shot.name, 'q' + quality, Math.round(statSync(file).size / 1024) + 'KiB');
    for (const l of logs.filter((x) => !x.startsWith('log: [shot]')).slice(0, 12)) console.log('  ', l);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
