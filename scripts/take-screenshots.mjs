/**
 * 自动截图脚本 — 用于生成用户手册配图
 * 运行：node scripts/take-screenshots.mjs
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL  = 'http://localhost:3002';
const CREDS     = { username: 'admin', password: 'huajing666' };
const VIEWPORT  = { width: 1440, height: 860 };

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, filename) {
  const p = path.join(OUT_DIR, filename);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  ✓ ${filename}`);
}

async function clickSidebar(page, label) {
  return page.evaluate((label) => {
    const btns = document.querySelectorAll('aside button');
    for (const btn of btns) {
      if (btn.textContent?.includes(label)) {
        btn.removeAttribute('disabled');
        btn.click();
        return true;
      }
    }
    return false;
  }, label);
}

(async () => {
  console.log('启动浏览器…');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: VIEWPORT,
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // ── 1. 登录 ───────────────────────────────────────────────
  console.log('登录中…');
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
  await wait(500);
  await shot(page, '01-login.png');

  await page.type('input[autocomplete="username"]', CREDS.username, { delay: 40 });
  await page.type('input[autocomplete="current-password"]', CREDS.password, { delay: 40 });
  await wait(200);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await wait(5000); // 等云端同步

  // ── 2. 用户画像主页 ─────────────────────────────────────
  console.log('用户画像…');
  await clickSidebar(page, '用户画像');
  await wait(3000);
  await shot(page, '02-home.png');
  await shot(page, '03-persona.png');

  // 截一张图表卡片局部（年龄段图表）
  const ageCard = await page.evaluate(() => {
    const cards = document.querySelectorAll('div');
    for (const c of cards) {
      if (c.textContent?.includes('年龄段') && c.querySelector('.recharts-wrapper')) {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return null;
  });
  if (ageCard && ageCard.width > 100) {
    await page.screenshot({
      path: path.join(OUT_DIR, '03-persona-chart-card.png'),
      clip: { x: ageCard.x - 8, y: ageCard.y - 8, width: Math.min(620, ageCard.width + 16), height: Math.min(420, ageCard.height + 16) },
    });
    console.log('  ✓ 03-persona-chart-card.png');
  }

  // ── 3. 地域对比（初始 + 选择地区后）─────────────────────
  console.log('地域对比…');
  await clickSidebar(page, '地域对比');
  await wait(2500);
  await shot(page, '04-regional-empty.png');

  // 尝试点击"添加地区"并选择几个大区
  const added = await page.evaluate(() => {
    // 找添加地区按钮
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent?.includes('添加地区'));
    if (addBtn) { addBtn.click(); return true; }
    return false;
  });

  if (added) {
    await wait(800);
    // 选择前3个大区选项
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="option"], .option-item, button'))
        .filter(el => el.closest('[class*="dropdown"], [class*="menu"], [class*="popover"]') ||
                      el.parentElement?.querySelector('input[type="checkbox"]'));
      // 简单找含大区名字的小按钮/选项
      const regionNames = ['华东', '华南', '华北', '西南', '华中'];
      let count = 0;
      const allBtns = document.querySelectorAll('button, [role="option"]');
      for (const btn of allBtns) {
        if (count >= 3) break;
        if (regionNames.some(r => btn.textContent?.trim() === r || btn.textContent?.includes(r))) {
          btn.click();
          count++;
        }
      }
      return count;
    });
    await wait(600);
    // 关闭下拉（点击空白）
    await page.keyboard.press('Escape');
    await wait(2000);
    await shot(page, '04-regional.png');

    // 选择一个维度（年龄段）
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dimBtn = btns.find(b => b.textContent?.includes('维度') || b.textContent?.includes('配置'));
      if (dimBtn) dimBtn.click();
    });
    await wait(500);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="option"]'));
      const ageBtn = btns.find(b => b.textContent?.trim() === '年龄段' || b.textContent?.includes('年龄'));
      if (ageBtn) ageBtn.click();
    });
    await wait(2000);
    await shot(page, '04-regional-chart.png');
  } else {
    await shot(page, '04-regional.png');
    await shot(page, '04-regional-chart.png');
  }

  // ── 4. 状态对比 ──────────────────────────────────────────
  console.log('状态对比…');
  await clickSidebar(page, '状态对比');
  await wait(2500);
  await shot(page, '05-status.png');
  await shot(page, '05-status-chart.png');

  // ── 5. 核心洞察 ──────────────────────────────────────────
  console.log('核心洞察…');
  await clickSidebar(page, '核心洞察');
  await wait(3000);
  await shot(page, '06-insight.png');

  // 截第一张人群卡片（局部）
  const cardBox = await page.evaluate(() => {
    // 找第一个 insight card
    const cards = document.querySelectorAll('[class*="segment"], [class*="card"], [class*="insight"]');
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (r.width > 400 && r.height > 200) {
        return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 500) };
      }
    }
    // fallback: 截页面主体上半
    return { x: 200, y: 60, width: 1220, height: 550 };
  });
  await page.screenshot({
    path: path.join(OUT_DIR, '06-insight-card.png'),
    clip: cardBox,
  });
  console.log('  ✓ 06-insight-card.png');

  // ── 6. 区域特征 ──────────────────────────────────────────
  console.log('区域特征…');
  await clickSidebar(page, '区域特征');
  await wait(2500);
  await shot(page, '07-rfeature.png');

  await browser.close();
  console.log('\n所有截图已保存到 docs/screenshots/');
})().catch(err => {
  console.error('截图失败:', err.message);
  process.exit(1);
});
