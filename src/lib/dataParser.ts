/**
 * 通用数据解析层
 *
 * 支持 xlsx / xls / csv / json → Dataset（统一 JSON Schema）
 * 服务端（API Route）和客户端均可使用。
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { detectSchema } from '@/lib/schemaDetector';
import type { Dataset, Field } from '@/types/dataSchema';

// crypto.randomUUID 在 Node 18+ 和现代浏览器均可用
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 简易 fallback（不依赖任何外部包）
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── 解析选项 ─────────────────────────────────────────────────

export interface ParseOptions {
  /** 数据集名称（通常是文件名去掉扩展名） */
  name?: string;
  /** Excel: 指定 Sheet 名称，默认第一个 Sheet */
  sheetName?: string;
  /** 跳过前 N 行（处理表头注释等） */
  skipRows?: number;
  /** 最大解析行数（防止超大文件卡死） */
  maxRows?: number;
  /** CSV: 分隔符 */
  delimiter?: string;
}

// ── 主解析函数 ───────────────────────────────────────────────

/**
 * 从 ArrayBuffer 解析文件，返回 Dataset。
 * @param buffer   文件内容
 * @param filename 原始文件名（用于判断格式 + 默认名称）
 * @param options  解析选项
 */
export function parseFileToDataset(
  buffer: ArrayBuffer,
  filename: string,
  options: ParseOptions = {}
): Dataset {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const name = options.name ?? filename.replace(/\.[^.]+$/, '');
  const source = (['xlsx', 'xls', 'csv', 'json'] as const).find(e => e === ext) ?? 'xlsx';

  let records: Record<string, unknown>[] = [];
  let fields: Field[] = [];

  if (source === 'csv') {
    // ── CSV ────────────────────────────────────────────────
    const text = new TextDecoder('utf-8').decode(buffer);
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: options.delimiter,
    });
    records = result.data as Record<string, unknown>[];
  } else if (source === 'json') {
    // ── JSON ───────────────────────────────────────────────
    const text = new TextDecoder('utf-8').decode(buffer);
    const parsed = JSON.parse(text);
    records = Array.isArray(parsed) ? parsed : parsed.records ?? [];
  } else {
    // ── Excel (xlsx / xls) ────────────────────────────────
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = options.sheetName ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',       // 空单元格默认空字符串
      raw: false,       // 全部转为字符串（保持与 CSV 一致性）
    });
    records = options.skipRows ? raw.slice(options.skipRows) : raw;
  }

  // 行数限制
  if (options.maxRows && records.length > options.maxRows) {
    records = records.slice(0, options.maxRows);
  }

  // 推断 Schema
  fields = detectSchema(records);

  const now = new Date().toISOString();
  return {
    id: genId(),
    name,
    source,
    createdAt: now,
    updatedAt: now,
    rowCount: records.length,
    fields,
    records,
  };
}

// ── 客户端辅助：File → ArrayBuffer ───────────────────────────

export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

// ── 快速摘要（不含全量 records，用于列表展示）────────────────

export type DatasetSummary = Omit<Dataset, 'records'>;

export function toSummary(dataset: Dataset): DatasetSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { records: _, ...rest } = dataset;
  return rest;
}

// ── 将现有 Supabase 用户数据包装为 Dataset ───────────────────

/**
 * 从 /api/profile 返回的数据生成 Dataset 摘要（不含 records），
 * 主要用于让 AI 层理解当前数据结构，而非重新上传。
 */
export function createLegacyDatasetMeta(
  records: Record<string, unknown>[],
  name = '华境S用户调研数据'
): Dataset {
  const fields = detectSchema(records);
  const now = new Date().toISOString();
  return {
    id: 'legacy-huajing-s',
    name,
    source: 'supabase',
    createdAt: now,
    updatedAt: now,
    rowCount: records.length,
    fields,
    records,
  };
}
