/**
 * 数据集 Zustand Store
 *
 * 管理所有上传的 Dataset，持久化到 localStorage（最多 50MB）。
 * 提供：addDataset / removeDataset / updateDataset / getDataset / getAll
 *
 * 使用：
 *   const { datasets, addDataset, removeDataset } = useDatasetStore();
 */

'use client';

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';
import type { ChartType } from '@/components/charts/engine/types';
import type { ChartConfig } from '@/lib/chartConfig';

// ── 保存的图表 ─────────────────────────────────────────────────

/** 用户在图表构建器中保存的单张图表 */
export interface SavedChart {
  id: string;
  fieldKey: string;
  chartType: ChartType;
  /** 可由用户编辑；默认等于字段名 */
  title: string;
  config: ChartConfig;
  createdAt: string;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type DatasetSummary = Omit<Dataset, 'records'>;

// ── Store 接口 ────────────────────────────────────────────────

interface DatasetStore {
  /** 所有已加载的 Dataset（含 records） */
  datasets: Dataset[];

  // ── CRUD ──────────────────────────────────────────────
  /** 添加（或替换同 id 的）Dataset */
  addDataset: (dataset: Dataset) => void;
  /** 按 id 删除 */
  removeDataset: (id: string) => void;
  /** 按 id 更新（部分字段）*/
  updateDataset: (id: string, patch: Partial<Dataset>) => void;
  /** 按 id 查询 */
  getDataset: (id: string) => Dataset | undefined;

  // ── 字段管理 ────────────────────────────────────────
  /** 更新单字段类型（用户手动覆盖自动识别结果） */
  updateFieldType: (datasetId: string, fieldKey: string, type: FieldType) => void;
  /** 更新字段标签 */
  updateFieldName: (datasetId: string, fieldKey: string, name: string) => void;
  /** 切换字段可见性（隐藏/显示） */
  toggleFieldVisible: (datasetId: string, fieldKey: string) => void;

  // ── 激活数据集 ──────────────────────────────────────
  /** 当前激活（展示）的 Dataset ID */
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;

  // ── 保存的图表 ───────────────────────────────────────
  /** 每个 Dataset 对应的已保存图表列表（datasetId → charts） */
  savedCharts: Record<string, SavedChart[]>;
  /** 保存一张图表（自动生成 id + createdAt） */
  saveChart: (datasetId: string, chart: Omit<SavedChart, 'id' | 'createdAt'>) => void;
  /** 删除一张已保存图表 */
  removeSavedChart: (datasetId: string, chartId: string) => void;
  /** 更新已保存图表（如修改标题）*/
  updateSavedChart: (datasetId: string, chartId: string, patch: Partial<SavedChart>) => void;
}

// ── 辅助：更新 fields 数组中的某个 Field ─────────────────────
function patchField(fields: Field[], key: string, patch: Partial<Field>): Field[] {
  return fields.map(f => (f.key === key ? { ...f, ...patch } : f));
}

// ── Store 实现 ────────────────────────────────────────────────

export const useDatasetStore = create<DatasetStore>()(
  persist(
    (set, get) => ({
      datasets: [],
      activeDatasetId: null,

      addDataset(dataset) {
        set(state => ({
          datasets: [
            dataset,
            // 替换同 id 的旧数据集
            ...state.datasets.filter(d => d.id !== dataset.id),
          ],
          // 自动激活新导入的数据集
          activeDatasetId: dataset.id,
        }));
      },

      removeDataset(id) {
        set(state => ({
          datasets: state.datasets.filter(d => d.id !== id),
          activeDatasetId:
            state.activeDatasetId === id
              ? (state.datasets.find(d => d.id !== id)?.id ?? null)
              : state.activeDatasetId,
        }));
      },

      updateDataset(id, patch) {
        set(state => ({
          datasets: state.datasets.map(d =>
            d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
          ),
        }));
      },

      getDataset(id) {
        return get().datasets.find(d => d.id === id);
      },

      updateFieldType(datasetId, fieldKey, type) {
        set(state => ({
          datasets: state.datasets.map(d =>
            d.id === datasetId
              ? { ...d, fields: patchField(d.fields, fieldKey, { type }) }
              : d
          ),
        }));
      },

      updateFieldName(datasetId, fieldKey, name) {
        set(state => ({
          datasets: state.datasets.map(d =>
            d.id === datasetId
              ? { ...d, fields: patchField(d.fields, fieldKey, { name }) }
              : d
          ),
        }));
      },

      toggleFieldVisible(datasetId, fieldKey) {
        set(state => ({
          datasets: state.datasets.map(d => {
            if (d.id !== datasetId) return d;
            const field = d.fields.find(f => f.key === fieldKey);
            if (!field) return d;
            // 用 isOrdered 字段的 boolean 类型不合适，改用自定义扩展字段
            // 在 Field 上追加 _hidden 标志（运行时扩展，不影响 FieldType）
            const patched = { ...field, _hidden: !(field as Field & { _hidden?: boolean })._hidden };
            return { ...d, fields: d.fields.map(f => (f.key === fieldKey ? patched : f)) };
          }),
        }));
      },

      setActiveDatasetId(id) {
        set({ activeDatasetId: id });
      },

      // ── 保存图表 ──────────────────────────────────────
      savedCharts: {},

      saveChart(datasetId, chart) {
        set(state => {
          const prev = state.savedCharts[datasetId] ?? [];
          return {
            savedCharts: {
              ...state.savedCharts,
              [datasetId]: [
                ...prev,
                { ...chart, id: genId(), createdAt: new Date().toISOString() },
              ],
            },
          };
        });
      },

      removeSavedChart(datasetId, chartId) {
        set(state => {
          const prev = state.savedCharts[datasetId] ?? [];
          return {
            savedCharts: {
              ...state.savedCharts,
              [datasetId]: prev.filter(c => c.id !== chartId),
            },
          };
        });
      },

      updateSavedChart(datasetId, chartId, patch) {
        set(state => {
          const prev = state.savedCharts[datasetId] ?? [];
          return {
            savedCharts: {
              ...state.savedCharts,
              [datasetId]: prev.map(c => c.id === chartId ? { ...c, ...patch } : c),
            },
          };
        });
      },
    }),

    {
      name: 'huajing-datasets',          // localStorage key
      storage: createJSONStorage(() => localStorage),
      // records 可能很大，持久化时仅存摘要，恢复时 records 为空
      // 如需全量持久化，移除 partialize
      partialize: (state) => ({
        activeDatasetId: state.activeDatasetId,
        savedCharts: state.savedCharts,
        datasets: state.datasets.map(d => ({
          ...d,
          records: d.records.slice(0, 5000),
        })),
      }),
    }
  )
);

// ── 导出便捷 Selector ────────────────────────────────────────

/**
 * 获取当前激活的 Dataset。
 * find() 返回 store 中的对象引用（稳定），Zustand 用 Object.is 比较，不会循环。
 */
export function useActiveDataset(): Dataset | undefined {
  return useDatasetStore((state) =>
    state.activeDatasetId
      ? state.datasets.find(d => d.id === state.activeDatasetId)
      : undefined
  );
}

/**
 * 获取所有 Dataset 的摘要列表（不含 records，供列表页展示）。
 *
 * 实现原理：
 *  1. `state.datasets` selector 返回 store 中的数组引用（Zustand 不可变更新，
 *     仅在真正写入时才创建新引用）→ 默认 Object.is 比较有效，不会循环
 *  2. useMemo 仅在 datasets 引用变化时重算 map，避免每次渲染都 spread 新对象
 *
 * ⚠️ 不要在 selector 内部直接调用 .map()：每次运行都产生新数组引用，
 *    Zustand v5 的 useSyncExternalStore 会判断"状态变了"→ 无限重渲染。
 */
export function useDatasetList(): DatasetSummary[] {
  const datasets = useDatasetStore((state) => state.datasets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => datasets.map(({ records: _r, ...rest }) => rest), [datasets]);
}
