/**
 * 通用数据解析层
 *
 * 支持 xlsx / xls / csv / json → Dataset（统一 JSON Schema）
 * 服务端（API Route）和客户端均可使用。
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { detectSchema } from '@/lib/schemaDetector';
import { normalizeIndustryFields } from '@/lib/industryNormalizer';
import type { Dataset, Field } from '@/types/dataSchema';

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface ParseOptions {
  name?: string;
  sheetName?: string;
  skipRows?: number;
  maxRows?: number;
  delimiter?: string;
}

export function parseFileToDataset(
  buffer: ArrayBuffer,
  filename: string,
  options: ParseOptions = {}
): Dataset {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const name = options.name ?? filename.replace(/\.[^.]+$/, '');
  const source = (['xlsx', 'xls', 'csv', 'json'] as const).find(e => e === ext) ?? 'xlsx';

  let records: Record<string, unknown>[] = [];

  if (source === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer);
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: options.delimiter,
    });
    records = result.data as Record<string, unknown>[];
  } else if (source === 'json') {
    const text = new TextDecoder('utf-8').decode(buffer);
    const parsed = JSON.parse(text);
    records = Array.isArray(parsed) ? parsed : parsed.records ?? [];
  } else {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = options.sheetName ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    records = options.skipRows ? raw.slice(options.skipRows) : raw;
  }

  if (options.maxRows && records.length > options.maxRows) {
    records = records.slice(0, options.maxRows);
  }

  records = normalizeIndustryFields(records);
  const fields = detectSchema(records);
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

export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export type DatasetSummary = Omit<Dataset, 'records'>;

export function toSummary(dataset: Dataset): DatasetSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { records: _, ...rest } = dataset;
  return rest;
}
