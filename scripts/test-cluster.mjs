/**
 * test-cluster.mjs
 * 读取华境S调研 xlsx，对聚类字段跑 K-means + CH × 均衡惩罚，输出聚类结果。
 * 运行：node scripts/test-cluster.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const require = createRequire(import.meta.url);
const XLSX = require('../node_modules/xlsx/xlsx.js');

// ── 数据文件路径（优先用已清洗版本）──────────────────────────

const XLSX_FILES = [
  'E:/Projects/【华境S】用户画像/华境S首批用户调研0616_已清洗v2.xlsx',
  'E:/Projects/【华境S】用户画像/华境S首批用户调研0616_已清洗.xlsx',
  'E:/Projects/【华境S】用户画像/华境S首批用户调研0616.xlsx',
  'E:/Projects/【华境S】用户画像/用户画像_合并问卷_最终版.xlsx',
];

// ── PRNG ──────────────────────────────────────────────────────

function makePRNG(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ── K-means ───────────────────────────────────────────────────

function sqDist(a, b) { let d = 0; for (let i = 0; i < a.length; i++) { const dx = a[i]-b[i]; d += dx*dx; } return d; }

function centroid(vecs) {
  const c = new Array(vecs[0].length).fill(0);
  for (const v of vecs) for (let i = 0; i < v.length; i++) c[i] += v[i];
  for (let i = 0; i < c.length; i++) c[i] /= vecs.length;
  return c;
}

function kmeanspp(X, k, rand) {
  const cents = [[...X[Math.floor(rand() * X.length)]]];
  for (let c = 1; c < k; c++) {
    const dists = X.map(x => Math.min(...cents.map(ct => sqDist(x, ct))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = total > 0 ? rand() * total : 0, idx = X.length - 1;
    for (let i = 0; i < X.length; i++) { r -= dists[i]; if (r <= 0) { idx = i; break; } }
    cents.push([...X[idx]]);
  }
  return cents;
}

function runKMeans(X, k, rand, maxIter = 50) {
  let centroids = kmeanspp(X, k, rand);
  let labels = new Array(X.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < X.length; i++) {
      let best = 0, bestD = sqDist(X[i], centroids[0]);
      for (let c = 1; c < k; c++) { const d = sqDist(X[i], centroids[c]); if (d < bestD) { bestD = d; best = c; } }
      if (best !== labels[i]) { labels[i] = best; changed = true; }
    }
    if (!changed) break;
    for (let c = 0; c < k; c++) {
      const m = X.filter((_, i) => labels[i] === c);
      if (m.length) centroids[c] = centroid(m);
    }
  }
  return { labels, centroids };
}

function calinskiHarabasz(X, labels, k) {
  const n = X.length;
  if (n <= k || k <= 1) return 0;
  const gm = centroid(X);
  let B = 0, W = 0;
  for (let c = 0; c < k; c++) {
    const m = X.filter((_, i) => labels[i] === c);
    if (!m.length) continue;
    const cm = centroid(m);
    B += m.length * sqDist(cm, gm);
    W += m.reduce((s, x) => s + sqDist(x, cm), 0);
  }
  return W === 0 ? 0 : (B / (k - 1)) / (W / (n - k));
}

function balancedScore(ch, labels, k) {
  const counts = new Array(k).fill(0);
  labels.forEach(l => counts[l]++);
  const n = labels.length;
  const maxR = Math.max(...counts) / n;
  const minR = Math.min(...counts) / n;
  return ch * Math.min(1, 0.65 / maxR) * Math.min(1, minR / 0.08);
}

// ── One-hot encoding ──────────────────────────────────────────

function encodeAll(records, fieldCols) {
  // fieldCols: [{colName, options, isMulti}]
  const cols = [];
  for (const fc of fieldCols) {
    for (const opt of fc.options.slice(0, 12)) {
      cols.push({ colName: fc.colName, value: opt, isMulti: fc.isMulti });
    }
  }
  const encoded = records.map(rec => {
    const vec = new Array(cols.length).fill(0);
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const raw = String(rec[col.colName] ?? '').trim();
      if (!raw) continue;
      if (col.isMulti) {
        if (raw.split('┋').map(v => v.trim()).includes(col.value)) vec[i] = 1;
      } else {
        if (raw === col.value) vec[i] = 1;
      }
    }
    return vec;
  });
  return { encoded, cols };
}

// ── 字段分布 ──────────────────────────────────────────────────

function fieldDist(records, colName, isMulti = false, overallMap = null) {
  const counter = new Map();
  let total = 0;
  for (const rec of records) {
    const raw = String(rec[colName] ?? '').trim();
    if (!raw) continue;
    const vals = isMulti ? raw.split('┋').map(v => v.trim()) : [raw];
    for (const v of vals) if (v) { counter.set(v, (counter.get(v) ?? 0) + 1); total++; }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([value, count]) => {
      const pct = total > 0 ? count / total * 100 : 0;
      const overallPct = overallMap?.get(value) ?? 0;
      return { value, pct: pct.toFixed(1), count, delta: (pct - overallPct).toFixed(1) };
    });
}

// ── 自动推断聚类字段 ─────────────────────────────────────────

const CLUSTER_KW = ['年龄', '学历', '行业', '职业', '岗位', '工作状态', '工作生活', '生活状态', '收入', '单位类型'];
// '状态' 已移除（与 InsightView 保持一致），避免排除"工作生活状态"
const EXCL_KW    = ['大区', '省份', '城市', '地区', '意向', '订单', '阶段', '号码', '姓名', '电话', '联系', '编号', 'ID'];

// ── Main ──────────────────────────────────────────────────────

function tryLoadFile(paths) {
  for (const p of paths) {
    try {
      const buf = readFileSync(resolve(p));
      return { wb: XLSX.read(buf, { type: 'buffer' }), path: p };
    } catch {
      // try next
    }
  }
  return null;
}

const loaded = tryLoadFile(XLSX_FILES);
if (!loaded) {
  console.error('❌ 未找到任何数据文件，请检查路径');
  process.exit(1);
}

console.log(`\n📄 数据文件: ${loaded.path}`);
const { wb } = loaded;
const sheetName = wb.SheetNames[0];
console.log(`   工作表: ${sheetName}（共 ${wb.SheetNames.length} 个工作表: ${wb.SheetNames.join(', ')}）`);

const ws = wb.Sheets[sheetName];
const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
console.log(`   总行数: ${rawRows.length}`);

if (rawRows.length === 0) { console.error('❌ 工作表为空'); process.exit(1); }

// 打印前几列（字段名）
const allCols = Object.keys(rawRows[0]);
console.log(`\n📋 共 ${allCols.length} 列，前 30 列：`);
allCols.slice(0, 30).forEach((c, i) => console.log(`   ${String(i+1).padStart(2)} | ${c}`));
if (allCols.length > 30) console.log(`   ... 还有 ${allCols.length - 30} 列`);

// 识别聚类字段
const clusterCols = allCols.filter(c =>
  CLUSTER_KW.some(kw => c.includes(kw)) && !EXCL_KW.some(kw => c.includes(kw))
);
const suppCols = allCols.filter(c =>
  !CLUSTER_KW.some(kw => c.includes(kw)) && !EXCL_KW.some(kw => c.includes(kw)) &&
  c.length > 2 && c.length < 30
).slice(0, 6);

console.log(`\n🎯 自动识别聚类字段（${clusterCols.length} 个）: ${clusterCols.join(' | ')}`);
console.log(`   补充维度（取前 6）: ${suppCols.join(' | ')}`);

if (clusterCols.length === 0) { console.error('❌ 未找到聚类字段'); process.exit(1); }

// 构建字段 options
function getOptions(records, colName) {
  const counter = new Map();
  for (const rec of records) {
    const raw = String(rec[colName] ?? '').trim();
    if (!raw) continue;
    const vals = raw.includes('┋') ? raw.split('┋').map(v => v.trim()) : [raw];
    for (const v of vals) if (v) counter.set(v, (counter.get(v) ?? 0) + 1);
  }
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([v]) => v);
}

const fieldColDefs = clusterCols.map(c => ({
  colName: c,
  options: getOptions(rawRows, c),
  isMulti: rawRows.slice(0, 50).some(r => String(r[c] ?? '').includes('┋')),
}));

// One-hot encode
const { encoded } = encodeAll(rawRows, fieldColDefs);
const valid = encoded.map((v, i) => ({ v, i })).filter(e => e.v.some(x => x > 0));
console.log(`\n   有效记录（至少一个聚类字段有值）: ${valid.length} / ${rawRows.length}`);

if (valid.length < 20) { console.error('❌ 有效记录太少'); process.exit(1); }

// 训练样本（最多 3000）
const seed = valid.length * 17 + valid[0].i;
const rand = makePRNG(seed);
let trainSample = valid;
if (valid.length > 3000) {
  const shuffled = [...valid];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  trainSample = shuffled.slice(0, 3000);
}
const trainX = trainSample.map(e => e.v);

// 尝试 k=2,3,4（每个 k 跑 3 次重启，取最高均衡分）
const N_RESTARTS = 3;
console.log(`\n📊 各 k 值评分（${N_RESTARTS} 次重启，CH 原始值 & 均衡后得分）：`);
console.log('   k | CH原始   | 均衡得分  | 分布');

let bestK = 2, bestScore = -Infinity, bestCentroids = null;
for (let k = 2; k <= Math.min(4, Math.floor(trainX.length / 5)); k++) {
  let kBestScore = -Infinity, kBestCH = 0, kBestCentroids = null, kBestLabels = null;
  for (let r = 0; r < N_RESTARTS; r++) {
    const { labels, centroids } = runKMeans(trainX, k, makePRNG(seed + k * 997 + r * 31337));
    const ch = calinskiHarabasz(trainX, labels, k);
    const score = balancedScore(ch, labels, k);
    if (score > kBestScore) { kBestScore = score; kBestCH = ch; kBestCentroids = centroids; kBestLabels = labels; }
  }

  const counts = new Array(k).fill(0);
  kBestLabels.forEach(l => counts[l]++);
  const dist = counts.map(c => `${(c / trainX.length * 100).toFixed(1)}%`).join(' / ');

  const flag = kBestScore > bestScore ? ' ← 当前最优' : '';
  console.log(`   ${k} | ${kBestCH.toFixed(3).padEnd(8)} | ${kBestScore.toFixed(3).padEnd(9)} | ${dist}${flag}`);

  if (kBestScore > bestScore) { bestScore = kBestScore; bestK = k; bestCentroids = kBestCentroids; }
}

// 全量分配
const allValidX  = valid.map(e => e.v);
const allOrigIdx = valid.map(e => e.i);
const allLabels  = allValidX.map(x => {
  let best = 0, bestD = sqDist(x, bestCentroids[0]);
  for (let c = 1; c < bestCentroids.length; c++) {
    const d = sqDist(x, bestCentroids[c]); if (d < bestD) { bestD = d; best = c; }
  }
  return best;
});

// 按群体大小排序
const clusterGroups = [];
for (let c = 0; c < bestK; c++) {
  const memberIdxs = allLabels.map((l, pos) => l === c ? allOrigIdx[pos] : -1).filter(i => i >= 0);
  clusterGroups.push({ c, size: memberIdxs.length, memberIdxs });
}
clusterGroups.sort((a, b) => b.size - a.size);

// 计算全量字段分布（用于 delta）
const overallMaps = new Map();
for (const fc of fieldColDefs) {
  const distMap = new Map();
  const counter = new Map(); let total = 0;
  for (const rec of rawRows) {
    const raw = String(rec[fc.colName] ?? '').trim();
    if (!raw) continue;
    const vals = fc.isMulti ? raw.split('┋').map(v => v.trim()) : [raw];
    for (const v of vals) if (v) { counter.set(v, (counter.get(v) ?? 0) + 1); total++; }
  }
  counter.forEach((cnt, val) => distMap.set(val, total > 0 ? cnt / total * 100 : 0));
  overallMaps.set(fc.colName, distMap);
}

// 输出结果
console.log(`\n✅ 最优 k = ${bestK}，输出各群体特征：\n`);
const total = valid.length;

clusterGroups.forEach(({ size, memberIdxs }, rankIdx) => {
  const pct = (size / total * 100).toFixed(1);
  console.log(`${'='.repeat(60)}`);
  console.log(`群体 ${rankIdx + 1}  |  占比 ${pct}%  |  n = ${size}`);
  console.log(`${'='.repeat(60)}`);

  for (const fc of fieldColDefs) {
    const memberRecs = memberIdxs.map(i => rawRows[i]);
    const dist = fieldDist(memberRecs, fc.colName, fc.isMulti, overallMaps.get(fc.colName));
    if (!dist.length) continue;
    console.log(`\n  【${fc.colName}】`);
    dist.forEach(d => {
      const flag = parseFloat(d.delta) >= 5 ? ' ▲' : parseFloat(d.delta) <= -5 ? ' ▽' : '';
      console.log(`    ${d.value.padEnd(20)} ${d.pct.padStart(5)}%  (全体均值对比: ${d.delta > 0 ? '+' : ''}${d.delta}pp${flag})`);
    });
  }
  console.log();
});

console.log('\n💡 诊断建议：');
const maxPct = clusterGroups[0].size / total;
if (maxPct > 0.65) {
  console.log(`  ⚠️  最大群体占比 ${(maxPct*100).toFixed(1)}% 仍偏高（> 65%）`);
  console.log(`     可能原因：数据本身同质化程度高，聚类字段区分度不足`);
  console.log(`     建议：检查聚类字段是否包含真正区分性的维度（如收入/购车用途/增换购）`);
} else {
  console.log(`  ✅ 群体分布相对均衡（最大群体 ${(maxPct*100).toFixed(1)}%）`);
}
console.log(`\n  聚类字段: ${clusterCols.join(', ')}`);
console.log(`  注：本脚本用相同算法（均衡惩罚 CH）, 结果与浏览器端一致`);
