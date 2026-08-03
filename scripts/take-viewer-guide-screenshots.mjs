import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const output = path.resolve('docs/screenshots/viewer-guide');
fs.mkdirSync(output, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  const token = await new SignJWT({ sub: 'viewer-guide', username: 'viewer', role: 'viewer' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  await page.setCookie({
    name: 'upersona_session', value: token, url: baseUrl,
    httpOnly: true, sameSite: 'Strict', secure: false,
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle2' });
  await pause(4000);

  const datasets = await page.evaluate(async () => {
    const response = await fetch('/api/datasets');
    if (!response.ok) throw new Error('只读账号无法读取数据集');
    return response.json();
  });
  const target = datasets.find(item => /华境S.*3644/.test(item.name));
  if (!target) throw new Error('未找到华境S首批用户调研3644');
  const opened = await page.evaluate(names => {
    const button = [...document.querySelectorAll('button')]
      .find(item => names.some(name => item.textContent?.includes(name)) || item.textContent?.includes('选择云端数据集'));
    button?.click();
    return Boolean(button);
  }, datasets.map(item => item.name));
  if (!opened) {
    const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map(item => item.textContent?.trim()).filter(Boolean));
    throw new Error(`未找到数据集选择按钮：${buttons.join(' | ')}`);
  }
  await page.waitForFunction(
    name => [...document.querySelectorAll('button')].some(item => item.textContent?.includes(name)),
    { timeout: 15000 },
    target.name,
  );
  await page.evaluate(name => {
    const button = [...document.querySelectorAll('button')]
      .find(item => item.textContent?.includes(name));
    button?.click();
  }, target.name);
  await page.waitForFunction(() => document.body.textContent?.includes('3,644 条数据'), { timeout: 30000 });
  await pause(2500);

  for (const [view, label, filename] of [
    ['persona', '用户画像', '01-persona.png'],
    ['status', '状态对比', '02-status.png'],
    ['insight', '核心洞察', '03-insight.png'],
    ['rfeature', '区域特征', '04-regional-feature.png'],
  ]) {
    await page.evaluate(text => {
      const button = [...document.querySelectorAll('aside button')]
        .find(item => item.textContent?.includes(text));
      button?.click();
    }, label);
    await page.waitForFunction(expected => new URL(location.href).searchParams.get('view') === expected, {}, view);
    await pause(3000);
    await page.screenshot({ path: path.join(output, filename), fullPage: false });
    console.log(filename);
  }
} finally {
  await browser.close();
}
