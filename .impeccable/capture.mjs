import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { SignJWT } from 'jose';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const secret = new TextEncoder().encode(env.JWT_SECRET);
const token = await new SignJWT({ username: 'design-review', role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('design-review')
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(secret);
const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: ['--no-sandbox', '--disable-extensions', '--disable-background-networking'],
});
for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setCookie({ name: 'upersona_session', value: token, url: 'http://localhost:3000' });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 2500));
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  if (name === 'desktop') {
    const buttons = await page.$$('button');
    for (const button of buttons) {
      if ((await button.evaluate(element => element.textContent))?.includes('打开数据中心')) {
        await button.click();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await page.screenshot({ path: '.impeccable/review/data-center.png', fullPage: true });
        break;
      }
    }
  }
  await page.close();
}
await browser.close();
