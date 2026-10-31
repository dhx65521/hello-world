#!/usr/bin/env node
// 生成 sw-assets.js：扫描所有要缓存的文件，并用内容哈希作为版本号。
// 用法：node tools/build.js   （每次改完内容、提交前运行一次）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = new Set(['.git', '.github', 'tools', 'node_modules']);
const EXCLUDE_FILES = new Set(['README.md', 'sw.js', 'sw-assets.js', '.gitignore', '.nojekyll', 'LICENSE']);
const EXCLUDE_EXT = new Set(['.md', '.txt']);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(name)) walk(full, out);
    } else {
      if (EXCLUDE_FILES.has(name) || EXCLUDE_EXT.has(path.extname(name))) continue;
      if (name.startsWith('.')) continue;
      out.push(rel);
    }
  }
}

const files = [];
walk(ROOT, files);
files.sort();

const hash = crypto.createHash('sha1');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
hash.update(fs.readFileSync(path.join(ROOT, 'sw.js')));
const version = hash.digest('hex').slice(0, 10);

const list = ['./', ...files.map((f) => './' + f)];
const out = `/* 自动生成，请勿手改：node tools/build.js */\nself.__VERSION = '${version}';\nself.__ASSETS = ${JSON.stringify(list, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'sw-assets.js'), out);
console.log(`sw-assets.js 已生成：${files.length} 个文件，版本 ${version}`);
