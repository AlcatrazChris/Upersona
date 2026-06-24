/**
 * clusterEngine
 *
 * 对调研记录做统计聚类：
 *   1. One-hot 编码分类字段（支持 single_choice / multi_choice）
 *   2. K-means++ 初始化 + 迭代（seeded PRNG，同输入必定同输出）
 *   3. Calinski-Harabasz 指数 + 均衡惩罚确定最优 k（2-4）
 *      - 任何群体占比 > 65% 的方案会被降分，给更均衡的 k 机会
 *      - 任何群体占比 < 8%  的方案也会被降分，避免极小碎片群
 *   4. 每个群体输出 pct（真实占比）和 delta（相对全体均值的偏差）
 *
 * 全部纯 JS/TS 计算，无浏览器/Node.js 专有 API，客户端和服务端均可调用。
 */

import type { Field } from '@/types/dataSchema';

// ── Public types ───────────────────────────────────────────────

export interface FieldDistItem {
  value:      string;
  pct:        number;  // 在该群体内的占比 %
  count:      number;
  overallPct: number;  // 在全量数据中的占比 %
  delta:      number;  // pct - overallPct（正值 = 此群体中更突出）
}

export interface ClusterFieldDist {
  fieldName:  string;
  fieldKey:   string;
  topValues:  FieldDistItem[];
  allOptions: string[];
}

export interface ClusterProfile {
  id:                  number;
  size:                number;
  pct:                 number;
  clusterFieldDist:    ClusterFieldDist[];
  supplementFieldDist: ClusterFieldDist[];
}

export interface ClusteringResult {
  optimalK:     number;
  chScore:      number;  // 真实 CH 值（未含惩罚，仅供调试）
  clusters:     ClusterProfile[];
  /** fieldName → valid option strings，用于 AI DataPoint 校验 */
  fieldOptions: Record<string, string[]>;
}

// ── 均衡惩罚阈值 ──────────────────────────────────────────────

/** 单个群体占比超过此值时，CH 分数会按比例降低 */
const MAX_CLUSTER_RATIO = 0.65;
/** 单个群体占比低于此值时，CH 分数会按比例降低 */
const MIN_CLUSTER_RATIO = 0.08;

// ── Seeded PRNG (LCG) ─────────────────────────────────────────

function makePRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function dataSeed(records: Record<string, unknown>[], fields: Field[]): number {
  let h = (records.length * 2654435761) >>> 0;
  const n = Math.min(30, records.length);
  for (let i = 0; i < n; i++) {
    for (const f of fields) {
      const v = String(records[i][f.key] ?? '');
      for (let j = 0; j < Math.min(8, v.length); j++) {
        h = (Math.imul(h, 31) + v.charCodeAt(j)) >>> 0;
      }
    }
  }
  return h || 1;
}

// ── Options resolution ────────────────────────────────────────

function getEffectiveOptions(field: Field, records: Record<string, unknown>[]): string[] {
  if (field.options && field.options.length > 0) return field.options.slice(0, 20);
  const delim = field.multiDelimiter ?? '┋';
  const counter = new Map<string, number>();
  for (const rec of records) {
    const raw = String(rec[field.key] ?? '').trim();
    if (!raw) continue;
    const vals = field.type === 'multi_choice' ? raw.split(delim).map(v => v.trim()) : [raw];
    for (const v of vals) if (v) counter.set(v, (counter.get(v) ?? 0) + 1);
  }
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([v]) => v);
}

// ── Correlated field groups ───────────────────────────────────
// 从事行业/工作单位类型/职业类型 高度共线，合并编码后按 1/groupSize 加权
// 避免同一信号被重复放大

const CORR_GROUP_KW = [
  ['行业', '单位类型', '职业'],
];

function fieldGroupId(field: Field): string {
  for (let g = 0; g < CORR_GROUP_KW.length; g++) {
    if (CORR_GROUP_KW[g].some(kw => field.name.includes(kw))) return `g${g}`;
  }
  return field.key;
}

// ── One-hot encoding ──────────────────────────────────────────

interface EncodingCol {
  fieldKey: string;
  value:    string;
  isMulti:  boolean;
  delim:    string;
  weight:   number;
}

function buildEncoding(fields: Field[], records: Record<string, unknown>[]): EncodingCol[] {
  const groupCounts = new Map<string, number>();
  for (const f of fields) {
    const gid = fieldGroupId(f);
    groupCounts.set(gid, (groupCounts.get(gid) ?? 0) + 1);
  }

  const cols: EncodingCol[] = [];
  for (const f of fields) {
    const opts = getEffectiveOptions(f, records);
    const isMulti = f.type === 'multi_choice';
    const delim   = f.multiDelimiter ?? '┋';
    const gid     = fieldGroupId(f);
    const gSize   = groupCounts.get(gid) ?? 1;
    const weight  = 1 / Math.sqrt(gSize);
    for (const opt of opts.slice(0, 12)) {
      cols.push({ fieldKey: f.key, value: opt, isMulti, delim, weight });
    }
  }
  return cols;
}

function encodeRecord(rec: Record<string, unknown>, cols: EncodingCol[]): number[] {
  const vec = new Array(cols.length).fill(0);
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const raw = String(rec[col.fieldKey] ?? '').trim();
    if (!raw) continue;
    if (col.isMulti) {
      if (raw.split(col.delim).map(v => v.trim()).includes(col.value)) vec[i] = col.weight;
    } else {
      if (raw === col.value) vec[i] = col.weight;
    }
  }
  return vec;
}

// ── Vector math ───────────────────────────────────────────────

function sqDist(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) { const dx = a[i] - b[i]; d += dx * dx; }
  return d;
}

function centroid(vecs: number[][]): number[] {
  const c = new Array(vecs[0].length).fill(0);
  for (const v of vecs) for (let i = 0; i < v.length; i++) c[i] += v[i];
  for (let i = 0; i < c.length; i++) c[i] /= vecs.length;
  return c;
}

// ── K-means++ + K-means ───────────────────────────────────────

function kmeanspp(X: number[][], k: number, rand: () => number): number[][] {
  const cents: number[][] = [];
  cents.push([...X[Math.floor(rand() * X.length)]]);
  for (let c = 1; c < k; c++) {
    const dists = X.map(x => Math.min(...cents.map(ct => sqDist(x, ct))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = total > 0 ? rand() * total : 0;
    let idx = X.length - 1;
    for (let i = 0; i < X.length; i++) { r -= dists[i]; if (r <= 0) { idx = i; break; } }
    cents.push([...X[idx]]);
  }
  return cents;
}

function runKMeans(
  X: number[][], k: number, rand: () => number, maxIter = 30,
): { labels: number[]; centroids: number[][] } {
  let centroids = kmeanspp(X, k, rand);
  let labels = new Array(X.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < X.length; i++) {
      let best = 0, bestD = sqDist(X[i], centroids[0]);
      for (let c = 1; c < k; c++) {
        const d = sqDist(X[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best !== labels[i]) { labels[i] = best; changed = true; }
    }
    if (!changed) break;
    for (let c = 0; c < k; c++) {
      const members = X.filter((_, i) => labels[i] === c);
      if (members.length > 0) centroids[c] = centroid(members);
    }
  }
  return { labels, centroids };
}

// ── Calinski-Harabasz ─────────────────────────────────────────

function calinskiHarabasz(X: number[][], labels: number[], k: number): number {
  const n = X.length;
  if (n <= k || k <= 1) return 0;
  const gMean = centroid(X);
  let B = 0, W = 0;
  for (let c = 0; c < k; c++) {
    const members = X.filter((_, i) => labels[i] === c);
    if (!members.length) continue;
    const cm = centroid(members);
    B += members.length * sqDist(cm, gMean);
    W += members.reduce((s, x) => s + sqDist(x, cm), 0);
  }
  return W === 0 ? 0 : (B / (k - 1)) / (W / (n - k));
}

/**
 * 在 CH 分数基础上叠加均衡惩罚：
 *   - 最大群体比例 > MAX_CLUSTER_RATIO：score 按 (MAX/actual) 比例缩减
 *   - 最小群体比例 < MIN_CLUSTER_RATIO：score 按 (actual/MIN) 比例缩减
 */
function balancedScore(ch: number, labels: number[], k: number): number {
  const counts = new Array(k).fill(0);
  labels.forEach(l => counts[l]++);
  const n = labels.length;
  const maxRatio = Math.max(...counts) / n;
  const minRatio = Math.min(...counts) / n;
  const maxPenalty = Math.min(1, MAX_CLUSTER_RATIO / maxRatio);
  const minPenalty = Math.min(1, minRatio / MIN_CLUSTER_RATIO);
  return ch * maxPenalty * minPenalty;
}

// ── 全量分布（用于计算 delta）────────────────────────────────

function computeOverallDist(
  records: Record<string, unknown>[],
  field: Field,
): Map<string, number> {
  const counter = new Map<string, number>();
  const delim = field.multiDelimiter ?? '┋';
  let total = 0;
  for (const rec of records) {
    const raw = String(rec[field.key] ?? '').trim();
    if (!raw) continue;
    const vals = field.type === 'multi_choice' ? raw.split(delim).map(v => v.trim()) : [raw];
    for (const v of vals) if (v) { counter.set(v, (counter.get(v) ?? 0) + 1); total++; }
  }
  const result = new Map<string, number>();
  counter.forEach((count, value) =>
    result.set(value, total > 0 ? count / total * 100 : 0)
  );
  return result;
}

// ── 群体内字段分布（含 delta）────────────────────────────────

function computeFieldDist(
  records:         Record<string, unknown>[],
  field:           Field,
  allOptions:      string[],
  overallDistMap:  Map<string, number>,
): ClusterFieldDist {
  const counter = new Map<string, number>();
  const delim = field.multiDelimiter ?? '┋';
  let total = 0;
  for (const rec of records) {
    const raw = String(rec[field.key] ?? '').trim();
    if (!raw) continue;
    const vals = field.type === 'multi_choice' ? raw.split(delim).map(v => v.trim()) : [raw];
    for (const v of vals) if (v) { counter.set(v, (counter.get(v) ?? 0) + 1); total++; }
  }
  const topValues = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => {
      const pct        = total > 0 ? count / total * 100 : 0;
      const overallPct = overallDistMap.get(value) ?? 0;
      return { value, pct, count, overallPct, delta: parseFloat((pct - overallPct).toFixed(1)) };
    });
  return { fieldName: field.name, fieldKey: field.key, topValues, allOptions };
}

// ── Cluster method types ─────────────────────────────────────

export type ClusterMethod = 'kmeans' | 'twostage';

export const CLUSTER_METHODS: { value: ClusterMethod; label: string; desc: string }[] = [
  { value: 'kmeans',   label: 'K-Means',         desc: '全字段统计聚类，自动选择最优 k' },
  { value: 'twostage', label: '两阶段(职业锚定)', desc: '先按行业/单位规则分组，再按收入细分，职业纯度更高' },
];

// ── Industry macro-group classification ──────────────────────

const IND_GROUPS: [string, string[]][] = [
  ['体制内',     ['政府', '事业', '国有', '国企', '公务', '军']],
  ['科技互联网', ['IT', '互联网', '信息', '科技', '通信', '电子', '软件']],
  ['金融',       ['金融', '银行', '保险', '证券', '投资', '基金']],
  ['制造工程',   ['制造', '工业', '建筑', '工程', '能源', '化工', '矿', '电力']],
  ['教育医疗',   ['教育', '培训', '医疗', '卫生', '保健', '福利']],
  ['商贸服务',   ['贸易', '批发', '零售', '商业', '餐饮', '住宿', '旅游', '物流', '运输']],
];

function classifyIndustry(record: Record<string, unknown>, industryKeys: string[]): string {
  const combined = industryKeys.map(k => String(record[k] ?? '')).join('');
  for (const [group, kws] of IND_GROUPS) {
    if (kws.some(kw => combined.includes(kw))) return group;
  }
  return '其他';
}

function findFieldByKeyword(fields: Field[], keywords: string[]): Field | undefined {
  return fields.find(f => keywords.some(kw => f.name.includes(kw)));
}

// ── Two-stage clustering ─────────────────────────────────────

function computeClusters2Stage(
  records:          Record<string, unknown>[],
  clusterFields:    Field[],
  supplementFields: Field[],
): ClusteringResult | null {
  if (records.length < 40 || clusterFields.length === 0) return null;

  // Dynamic thresholds based on dataset size
  const minGroupSize   = Math.max(15, Math.min(50, Math.floor(records.length * 0.12)));
  const minSubCluster  = Math.max(8,  Math.min(20, Math.floor(records.length * 0.06)));
  const subClusterAt   = Math.max(30, Math.min(50, Math.floor(records.length * 0.10)));

  const industryField = findFieldByKeyword(clusterFields, ['行业']);
  const unitField     = findFieldByKeyword(clusterFields, ['单位类型']);
  const incomeField   = findFieldByKeyword(clusterFields, ['收入']);

  const industryKeys = [industryField, unitField].filter(Boolean).map(f => f!.key);
  if (industryKeys.length === 0) return null;

  // Stage 1: classify records into macro industry groups
  const groupMap = new Map<string, number[]>();
  for (let i = 0; i < records.length; i++) {
    const g = classifyIndustry(records[i], industryKeys);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(i);
  }

  // Stage 2: within each group, sub-cluster by income (if large enough)
  const subClusterFields = [incomeField, findFieldByKeyword(clusterFields, ['岗位', '级别'])]
    .filter(Boolean) as Field[];

  const seed = dataSeed(records, clusterFields);
  const segmentIndices: number[][] = [];

  for (const [, indices] of groupMap) {
    if (indices.length < subClusterAt || subClusterFields.length === 0) {
      segmentIndices.push(indices);
      continue;
    }
    const subRecords = indices.map(i => records[i]);
    const cols = buildEncoding(subClusterFields, subRecords);
    if (cols.length === 0) { segmentIndices.push(indices); continue; }
    const X = subRecords.map(r => encodeRecord(r, cols));

    const subK = indices.length >= 200 ? 3 : 2;
    const rand = makePRNG(seed + indices.length * 7919);
    const { labels } = runKMeans(X, subK, rand);

    const subSizes = new Array(subK).fill(0);
    labels.forEach(l => subSizes[l]++);
    const tooSmall = subSizes.some(s => s < minSubCluster);

    if (tooSmall) {
      segmentIndices.push(indices);
    } else {
      for (let s = 0; s < subK; s++) {
        segmentIndices.push(indices.filter((_, j) => labels[j] === s));
      }
    }
  }

  // Merge groups smaller than minGroupSize
  const merged: number[][] = [];
  const small: number[][] = [];
  for (const seg of segmentIndices) {
    if (seg.length >= minGroupSize) merged.push(seg);
    else small.push(seg);
  }

  if (small.length > 0) {
    const otherIndices = small.flat();
    if (otherIndices.length >= minGroupSize) {
      merged.push(otherIndices);
    } else if (merged.length > 0) {
      merged.sort((a, b) => a.length - b.length);
      merged[0] = [...merged[0], ...otherIndices];
    } else {
      merged.push(otherIndices);
    }
  }

  // Sort by size descending
  merged.sort((a, b) => b.length - a.length);

  // Build profiles
  const total = records.length;
  const allFields = [...clusterFields, ...supplementFields];
  const overallDistMaps = new Map<string, Map<string, number>>();
  for (const f of allFields) overallDistMaps.set(f.key, computeOverallDist(records, f));
  const optionsMap = new Map<string, string[]>();
  for (const f of allFields) optionsMap.set(f.key, getEffectiveOptions(f, records));

  const clusters: ClusterProfile[] = merged.map((indices, id) => {
    const memberRecords = indices.map(i => records[i]);
    return {
      id,
      size: memberRecords.length,
      pct:  parseFloat((memberRecords.length / total * 100).toFixed(1)),
      clusterFieldDist: clusterFields.map(f =>
        computeFieldDist(memberRecords, f, optionsMap.get(f.key) ?? [], overallDistMaps.get(f.key) ?? new Map())
      ),
      supplementFieldDist: supplementFields.map(f =>
        computeFieldDist(memberRecords, f, optionsMap.get(f.key) ?? [], overallDistMaps.get(f.key) ?? new Map())
      ),
    };
  });

  const fieldOptions: Record<string, string[]> = {};
  for (const f of allFields) fieldOptions[f.name] = optionsMap.get(f.key) ?? [];

  return {
    optimalK: clusters.length,
    chScore:  0,
    clusters,
    fieldOptions,
  };
}

// ── Main entry ────────────────────────────────────────────────

const MAX_TRAIN = 3000;

export function computeClusters(
  records:          Record<string, unknown>[],
  clusterFields:    Field[],
  supplementFields: Field[],
  minK = 2,
  maxK = 5,
  method: ClusterMethod = 'kmeans',
): ClusteringResult | null {
  if (method === 'twostage') {
    return computeClusters2Stage(records, clusterFields, supplementFields);
  }
  if (records.length < minK * 10 || clusterFields.length === 0) return null;

  const seed = dataSeed(records, clusterFields);
  const rand = makePRNG(seed);

  const cols = buildEncoding(clusterFields, records);
  if (cols.length === 0) return null;

  // Collect valid (non-zero) record indices
  const validIndices: number[] = [];
  for (let i = 0; i < records.length; i++) {
    const vec = encodeRecord(records[i], cols);
    if (vec.some(x => x > 0)) validIndices.push(i);
  }
  if (validIndices.length < minK * 5) return null;

  // Sample for training (deterministic Fisher-Yates)
  let trainIndices = validIndices;
  if (validIndices.length > MAX_TRAIN) {
    const shuffled = [...validIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    trainIndices = shuffled.slice(0, MAX_TRAIN);
  }
  const trainX = trainIndices.map(i => encodeRecord(records[i], cols));

  // Find optimal k — 5 restarts per k, elbow-normalized scoring.
  // CH naturally decreases with k; raw-max always picks k=2.
  // We normalize by CH(2) and add a mild k bonus so finer segmentations
  // can win when they produce meaningfully different clusters.
  const N_RESTARTS = 5;
  const kMax = Math.min(maxK, Math.floor(trainX.length / 5));

  // First pass: collect best CH per k
  const kResults: { k: number; ch: number; labels: number[]; centroids: number[][] }[] = [];
  for (let k = minK; k <= kMax; k++) {
    let kBestCH = -Infinity, kBestLabels: number[] = [], kBestCentroids: number[][] = [];
    for (let r = 0; r < N_RESTARTS; r++) {
      const { labels, centroids } = runKMeans(trainX, k, makePRNG(seed + k * 997 + r * 31337));
      const ch = calinskiHarabasz(trainX, labels, k);
      if (ch > kBestCH) { kBestCH = ch; kBestLabels = labels; kBestCentroids = centroids; }
    }
    kResults.push({ k, ch: kBestCH, labels: kBestLabels, centroids: kBestCentroids });
  }

  // Second pass: elbow-normalized scoring
  const ch2 = kResults[0]?.ch || 1;
  let bestK = minK, bestScore = -Infinity, bestCH = 0, bestCentroids: number[][] = [];
  for (const { k, ch, labels, centroids } of kResults) {
    const normCH   = ch / ch2;
    const kBonus   = 1 + 0.12 * (k - minK);
    const score    = balancedScore(normCH * kBonus * ch2, labels, k);
    if (score > bestScore) { bestScore = score; bestCH = ch; bestK = k; bestCentroids = centroids; }
  }
  if (!bestCentroids.length) return null;

  // Assign ALL valid records to nearest centroid (encode on the fly)
  const allLabels: number[] = new Array(validIndices.length);
  for (let i = 0; i < validIndices.length; i++) {
    const vec = encodeRecord(records[validIndices[i]], cols);
    let best = 0, bestD = sqDist(vec, bestCentroids[0]);
    for (let c = 1; c < bestCentroids.length; c++) {
      const d = sqDist(vec, bestCentroids[c]);
      if (d < bestD) { bestD = d; best = c; }
    }
    allLabels[i] = best;
  }

  const total    = validIndices.length;
  const allFields = [...clusterFields, ...supplementFields];

  // Precompute overall distributions (for delta calculation)
  const overallDistMaps = new Map<string, Map<string, number>>();
  for (const f of allFields) overallDistMaps.set(f.key, computeOverallDist(records, f));

  const optionsMap = new Map<string, string[]>();
  for (const f of allFields) optionsMap.set(f.key, getEffectiveOptions(f, records));

  // Build cluster profiles
  const clusters: ClusterProfile[] = [];
  for (let c = 0; c < bestK; c++) {
    const memberOrigIndices = allLabels
      .map((label, pos) => label === c ? validIndices[pos] : -1)
      .filter(i => i >= 0);
    const memberRecords = memberOrigIndices.map(i => records[i]);
    clusters.push({
      id:   c,
      size: memberRecords.length,
      pct:  parseFloat((memberRecords.length / total * 100).toFixed(1)),
      clusterFieldDist: clusterFields.map(f =>
        computeFieldDist(
          memberRecords, f,
          optionsMap.get(f.key) ?? [],
          overallDistMaps.get(f.key) ?? new Map(),
        )
      ),
      supplementFieldDist: supplementFields.map(f =>
        computeFieldDist(
          memberRecords, f,
          optionsMap.get(f.key) ?? [],
          overallDistMaps.get(f.key) ?? new Map(),
        )
      ),
    });
  }

  // Sort largest-first, re-index
  clusters.sort((a, b) => b.size - a.size);
  clusters.forEach((c, i) => { c.id = i; });

  // fieldOptions: fieldName → valid values (for AI DataPoint validation)
  const fieldOptions: Record<string, string[]> = {};
  for (const f of allFields) fieldOptions[f.name] = optionsMap.get(f.key) ?? [];

  return {
    optimalK: bestK,
    chScore:  parseFloat(bestCH.toFixed(2)),
    clusters,
    fieldOptions,
  };
}
