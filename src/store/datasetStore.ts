'use client';

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// IndexedDB adapter for Zustand persist 鈥?no size limit unlike localStorage
const idbStorage = {
  getItem: (name: string) => get<string>(name).then(v => v ?? null),
  setItem: (name: string, value: string) => set(name, value),
  removeItem: (name: string) => del(name),
};
import type { Dataset, Field, FieldType } from '@/types/dataSchema';
import type { ChartType } from '@/components/charts/engine/types';
import type { ChartConfig } from '@/lib/chartConfig';
import type { PersonaConfig } from '@/types/personaSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import { isSkipValue } from '@/lib/skipPatterns';

export interface SavedChart {
  id: string;
  fieldKey: string;
  chartType: ChartType;
  title: string;
  config: ChartConfig;
  createdAt: string;
  groupFieldKey?: string;
  selectedGroups?: string[];
  gridSpan?: 1 | 2;             // legacy grid mode
  position?: { x: number; y: number }; // free-canvas position
  canvasWidth?: number;          // card width on canvas in px (default 380)
}

export interface CanvasTextElement {
  id: string;
  x: number;
  y: number;
  width: number;   // px
  content: string;
  fontSize: number; // px default 14
  bold: boolean;
  color: string;    // css color
}

export interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type DatasetSummary = Omit<Dataset, 'records'>;

interface DatasetStore {
  // Persona dashboard configs
  personaConfigs: Record<string, PersonaConfig[]>;
  savePersonaConfig: (datasetId: string, config: PersonaConfig) => void;
  removePersonaConfig: (datasetId: string, configId: string) => void;
  updatePersonaConfig: (datasetId: string, configId: string, patch: Partial<PersonaConfig>) => void;
  activePersonaConfigId: string | null;
  setActivePersonaConfigId: (id: string | null) => void;
  datasets: Dataset[];
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
  updateDataset: (id: string, patch: Partial<Dataset>) => void;
  getDataset: (id: string) => Dataset | undefined;
  updateFieldType: (datasetId: string, fieldKey: string, type: FieldType) => void;
  updateFieldName: (datasetId: string, fieldKey: string, name: string) => void;
  updateFieldMultiDelimiter: (datasetId: string, fieldKey: string, delimiter: string) => void;
  updateFieldOrdering: (datasetId: string, fieldKey: string, isOrdered: boolean, orderedValues: string[]) => void;
  toggleFieldVisible: (datasetId: string, fieldKey: string) => void;
  removeField: (datasetId: string, fieldKey: string) => void;
  cleanSkipValues: (datasetId: string, fieldKey: string) => void;
  /** 从云端拉取的完整数据集 + 配置，原子写入本地 store 并激活 */
  loadFromCloud: (
    datasetId: string,
    dataset:   Dataset,
    config:    {
      view_config?:      ViewConfig        | null;
      persona_configs?:  PersonaConfig[]   | null;
      saved_charts?:     SavedChart[]      | null;
      canvas_elements?:  CanvasTextElement[] | null;
    } | null,
  ) => void;
  addAIDerivedField: (
    datasetId: string,
    sourceFieldKey: string,
    newFieldKey: string,
    newFieldName: string,
    mapping: Record<string, string>,
  ) => void;
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;
  savedCharts: Record<string, SavedChart[]>;
  saveChart: (datasetId: string, chart: Omit<SavedChart, 'id' | 'createdAt'>) => void;
  removeSavedChart: (datasetId: string, chartId: string) => void;
  updateSavedChart: (datasetId: string, chartId: string, patch: Partial<SavedChart>) => void;
  reorderSavedCharts: (datasetId: string, fromIndex: number, toIndex: number) => void;
  // Canvas free-layout
  canvasElements: Record<string, CanvasTextElement[]>;
  addCanvasText: (datasetId: string, x?: number, y?: number) => void;
  updateCanvasText: (datasetId: string, id: string, patch: Partial<CanvasTextElement>) => void;
  removeCanvasText: (datasetId: string, id: string) => void;
  // System settings 鈥?saved prompts
  savedPrompts: SavedPrompt[];
  addSavedPrompt: (name: string, prompt: string) => void;
  removeSavedPrompt: (id: string) => void;
  // Per-dataset view config (status field, geo fields, persona fields, insight prompt/results)
  viewConfigs: Record<string, ViewConfig>;
  updateViewConfig: (datasetId: string, patch: Partial<ViewConfig>) => void;
}

function patchField(fields: Field[], key: string, patch: Partial<Field>): Field[] {
  return fields.map(f => (f.key === key ? { ...f, ...patch } : f));
}

export const useDatasetStore = create<DatasetStore>()(
  persist(
    (set, get) => ({
      datasets: [],
      activeDatasetId: null,

      addDataset(dataset) {
        set(state => ({
          datasets: [dataset, ...state.datasets.filter(d => d.id !== dataset.id)],
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

      updateFieldMultiDelimiter(datasetId, fieldKey, delimiter) {
        set(state => ({
          datasets: state.datasets.map(d =>
            d.id === datasetId
              ? { ...d, fields: patchField(d.fields, fieldKey, { multiDelimiter: delimiter }) }
              : d
          ),
        }));
      },

      updateFieldOrdering(datasetId, fieldKey, isOrdered, orderedValues) {
        set(state => ({
          datasets: state.datasets.map(d =>
            d.id === datasetId
              ? { ...d, fields: patchField(d.fields, fieldKey, { isOrdered, orderedValues }) }
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
            const patched = { ...field, _hidden: !(field as Field & { _hidden?: boolean })._hidden };
            return { ...d, fields: d.fields.map(f => (f.key === fieldKey ? patched : f)) };
          }),
        }));
      },

      removeField(datasetId, fieldKey) {
        set(state => ({
          datasets: state.datasets.map(d => {
            if (d.id !== datasetId) return d;
            // Remove field from schema
            const fields = d.fields.filter(f => f.key !== fieldKey);
            // Remove the key from every record
            const records = d.records.map(r => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [fieldKey]: _dropped, ...rest } = r as Record<string, unknown>;
              return rest;
            });
            return { ...d, fields, records, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      cleanSkipValues(datasetId, fieldKey) {
        set(state => {
          const dataset = state.datasets.find(d => d.id === datasetId);
          if (!dataset) return state;
          const field = dataset.fields.find(f => f.key === fieldKey);
          if (!field) return state;

          // Replace skip values with empty string in records
          const records = dataset.records.map(r =>
            isSkipValue(r[fieldKey]) ? { ...r, [fieldKey]: '' } : r,
          );

          // Recompute statistics for this field
          const values = records.map(r => r[fieldKey]);
          const total = values.length;
          const nonEmpty = values.filter(v => v != null && String(v).trim() !== '');
          const missing = total - nonEmpty.length;
          const counter: Record<string, number> = {};
          for (const v of nonEmpty) {
            const s = String(v).trim();
            counter[s] = (counter[s] ?? 0) + 1;
          }
          const unique = Object.keys(counter).length;
          const topValues = Object.entries(counter)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([value, count]) => ({ value, count }));

          // Remove skip values from options array
          const newOptions = field.options
            ? field.options.filter(o => !isSkipValue(o))
            : undefined;

          const updatedField: Field = {
            ...field,
            options: newOptions,
            statistics: { count: total, unique, missing, topValues },
          };

          return {
            datasets: state.datasets.map(d =>
              d.id === datasetId
                ? {
                    ...d,
                    fields: d.fields.map(f => (f.key === fieldKey ? updatedField : f)),
                    records,
                    updatedAt: new Date().toISOString(),
                  }
                : d
            ),
          };
        });
      },

      loadFromCloud(datasetId, dataset, config) {
        set(state => {
          const next: Partial<typeof state> = {
            // Replace or prepend the dataset (keep other local datasets intact)
            datasets: [dataset, ...state.datasets.filter(d => d.id !== datasetId)],
            activeDatasetId: datasetId,
          };
          if (config?.view_config) {
            next.viewConfigs = { ...state.viewConfigs, [datasetId]: config.view_config! };
          }
          if (config?.persona_configs) {
            next.personaConfigs = { ...state.personaConfigs, [datasetId]: config.persona_configs! };
          }
          if (config?.saved_charts) {
            next.savedCharts = { ...state.savedCharts, [datasetId]: config.saved_charts! };
          }
          if (config?.canvas_elements) {
            next.canvasElements = { ...state.canvasElements, [datasetId]: config.canvas_elements! };
          }
          return next;
        });
      },

      addAIDerivedField(datasetId, sourceFieldKey, newFieldKey, newFieldName, mapping) {
        set(state => {
          const dataset = state.datasets.find(d => d.id === datasetId);
          if (!dataset) return state;

          // Apply mapping to every record
          const records = dataset.records.map(r => {
            const raw = String(r[sourceFieldKey] ?? '').trim();
            return { ...r, [newFieldKey]: mapping[raw] ?? '其他' };
          });

          // Compute derived field stats
          const allVals = records.map(r => String(r[newFieldKey] ?? '')).filter(Boolean);
          const freq = new Map<string, number>();
          for (const v of allVals) freq.set(v, (freq.get(v) ?? 0) + 1);

          const derivedField: Field = {
            key: newFieldKey,
            name: newFieldName,
            type: 'single_choice' as FieldType,
            options: [...freq.keys()],
            statistics: {
              count: records.length,
              unique: freq.size,
              missing: records.length - allVals.length,
              topValues: [...freq.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([value, count]) => ({ value, count })),
            },
            recommendedCharts: ['bar', 'pie', 'donut'],
            derived: true,
          };

          const updatedDataset: Dataset = {
            ...dataset,
            records,
            fields: [...dataset.fields, derivedField],
          };

          return {
            datasets: state.datasets.map(d => (d.id === datasetId ? updatedDataset : d)),
          };
        });
      },

      setActiveDatasetId(id) {
        set({ activeDatasetId: id });
      },

      savedCharts: {},

      saveChart(datasetId, chart) {
        set(state => {
          const prev = state.savedCharts[datasetId] ?? [];
          return {
            savedCharts: {
              ...state.savedCharts,
              [datasetId]: [...prev, { ...chart, id: genId(), createdAt: new Date().toISOString() }],
            },
          };
        });
      },

      removeSavedChart(datasetId, chartId) {
        set(state => ({
          savedCharts: {
            ...state.savedCharts,
            [datasetId]: (state.savedCharts[datasetId] ?? []).filter(c => c.id !== chartId),
          },
        }));
      },

      updateSavedChart(datasetId, chartId, patch) {
        set(state => ({
          savedCharts: {
            ...state.savedCharts,
            [datasetId]: (state.savedCharts[datasetId] ?? []).map(c =>
              c.id === chartId ? { ...c, ...patch } : c
            ),
          },
        }));
      },

      reorderSavedCharts(datasetId, fromIndex, toIndex) {
        set(state => {
          const charts = [...(state.savedCharts[datasetId] ?? [])];
          const [moved] = charts.splice(fromIndex, 1);
          charts.splice(toIndex, 0, moved);
          return { savedCharts: { ...state.savedCharts, [datasetId]: charts } };
        });
      },

      // 鈹€鈹€ Canvas text elements 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

      canvasElements: {},

      addCanvasText(datasetId, x = 120, y = 120) {
        set(state => {
          const prev = state.canvasElements[datasetId] ?? [];
          const el: CanvasTextElement = {
            id: genId(),
            x,
            y,
            width: 200,
            content: '双击编辑文字',
            fontSize: 14,
            bold: false,
            color: '#374151',
          };
          return { canvasElements: { ...state.canvasElements, [datasetId]: [...prev, el] } };
        });
      },

      updateCanvasText(datasetId, id, patch) {
        set(state => ({
          canvasElements: {
            ...state.canvasElements,
            [datasetId]: (state.canvasElements[datasetId] ?? []).map(e =>
              e.id === id ? { ...e, ...patch } : e
            ),
          },
        }));
      },

      removeCanvasText(datasetId, id) {
        set(state => ({
          canvasElements: {
            ...state.canvasElements,
            [datasetId]: (state.canvasElements[datasetId] ?? []).filter(e => e.id !== id),
          },
        }));
      },

      // 鈹€鈹€ Saved prompts 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

      savedPrompts: [],

      addSavedPrompt(name, prompt) {
        set(state => ({
          savedPrompts: [...state.savedPrompts, { id: genId(), name, prompt }],
        }));
      },

      removeSavedPrompt(id) {
        set(state => ({
          savedPrompts: state.savedPrompts.filter(p => p.id !== id),
        }));
      },

            // 鈹€鈹€ Persona configs 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

      personaConfigs: {},

      savePersonaConfig(datasetId, config) {
        set(state => {
          const prev = state.personaConfigs[datasetId] ?? [];
          const exists = prev.findIndex(c => c.id === config.id);
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = config;
            return { personaConfigs: { ...state.personaConfigs, [datasetId]: updated } };
          }
          return {
            personaConfigs: {
              ...state.personaConfigs,
              [datasetId]: [...prev, config],
            },
          };
        });
      },

      removePersonaConfig(datasetId, configId) {
        set(state => ({
          personaConfigs: {
            ...state.personaConfigs,
            [datasetId]: (state.personaConfigs[datasetId] ?? []).filter(c => c.id !== configId),
          },
          activePersonaConfigId:
            state.activePersonaConfigId === configId ? null : state.activePersonaConfigId,
        }));
      },

      updatePersonaConfig(datasetId, configId, patch) {
        set(state => ({
          personaConfigs: {
            ...state.personaConfigs,
            [datasetId]: (state.personaConfigs[datasetId] ?? []).map(c =>
              c.id === configId ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
            ),
          },
        }));
      },

      activePersonaConfigId: null,

      setActivePersonaConfigId(id) {
        set({ activePersonaConfigId: id });
      },

      // 鈹€鈹€ View configs 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

      viewConfigs: {},

      updateViewConfig(datasetId, patch) {
        set(state => ({
          viewConfigs: {
            ...state.viewConfigs,
            [datasetId]: { ...state.viewConfigs[datasetId], ...patch },
          },
        }));
      },
    }),

    {
      name: 'upersona-datasets',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        activeDatasetId: state.activeDatasetId,
        savedCharts:     state.savedCharts,
        canvasElements:  state.canvasElements,
        savedPrompts:    state.savedPrompts,
        viewConfigs:     state.viewConfigs,
        personaConfigs:  state.personaConfigs,
        activePersonaConfigId: state.activePersonaConfigId,
        datasets: state.datasets.map(d => ({
          ...d,
          records: d.records.slice(0, 50000),
        })),
      }),
    }
  )
);

export function useActiveDataset(): Dataset | undefined {
  return useDatasetStore((state) =>
    state.activeDatasetId
      ? state.datasets.find(d => d.id === state.activeDatasetId)
      : undefined
  );
}

export function useDatasetList(): Omit<Dataset, 'records'>[] {
  const datasets = useDatasetStore((state) => state.datasets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => datasets.map(({ records: _r, ...rest }) => rest), [datasets]);
}





