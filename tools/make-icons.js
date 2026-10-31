#!/usr/bin/env node
// 用 icons/icon.svg 生成 PNG 图标（需要 playwright + chromium）。用法：node tools/make-icons.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(ROOT, 'icons/icon.svg'), 'utf8');

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon-180.png', size: 180, pad: 0 },
  // maskable：四周留 10% 安全区，背景填满
  { file: 'icon-512-maskable.png', size: 512, pad: 0.1 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const t of targets) {
    const inner = Math.round(t.size * (1 - 2 * t.pad));
    const html = `<html><body style="margin:0;width:${t.size}px;height:${t.size}px;background:#FFD56B;display:flex;align-items:center;justify-content:center;">
      <div style="width:${inner}px;height:${inner}px">${svg.replace(/width="512" height="512"/, `width="${inner}" height="${inner}"`)}</div></body></html>`;
    await page.setViewportSize({ width: t.size, height: t.size });
    await page.setContent(html);
    await page.screenshot({ path: path.join(ROOT, 'icons', t.file), clip: { x: 0, y: 0, width: t.size, height: t.size }, omitBackground: false });
    console.log('生成', t.file);
  }
  await browser.close();
})();
