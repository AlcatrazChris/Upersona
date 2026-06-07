/**
 * filterRecords — apply geographic + status filters to raw records
 */

import type { ViewConfig } from './viewConfig';

export type GeoLevel = 'all' | 'region' | 'province' | 'city';

export function geoKeyForLevel(config: ViewConfig, level: GeoLevel): string | undefined {
  if (level === 'region')   return config.geoRegionKey;
  if (level === 'province') return config.geoProvinceKey;
  if (level === 'city')     return config.geoCityKey;
  return undefined;
}

/** Filter records by status AND geography. '__all' sentinel = no status filter. */
export function filterRecords(
  records: Record<string, unknown>[],
  config:  ViewConfig,
  geoLevel:           GeoLevel,
  selectedGeoValues:  string[],
  selectedStatuses:   string[],  // ['__all'] or individual status values
): Record<string, unknown>[] {
  const filterStatus = (
    config.statusFieldKey &&
    selectedStatuses.length > 0 &&
    !selectedStatuses.includes('__all')
  );
  const geoKey = geoKeyForLevel(config, geoLevel);
  const filterGeo = geoKey && selectedGeoValues.length > 0;

  if (!filterStatus && !filterGeo) return records;

  return records.filter(r => {
    if (filterStatus) {
      const val = String(r[config.statusFieldKey!] ?? '').trim();
      if (!selectedStatuses.includes(val)) return false;
    }
    if (filterGeo) {
      const val = String(r[geoKey!] ?? '').trim();
      if (!selectedGeoValues.includes(val)) return false;
    }
    return true;
  });
}

/** Get sorted unique values for a geo level from ALL records (for dropdown options). */
export function getGeoOptions(
  records: Record<string, unknown>[],
  config:  ViewConfig,
  level:   GeoLevel,
): string[] {
  const key = geoKeyForLevel(config, level);
  if (!key) return [];
  const s = new Set<string>();
  for (const r of records) {
    const v = String(r[key] ?? '').trim();
    if (v) s.add(v);
  }
  return [...s].sort();
}

/** Get unique status values present in the records. */
export function getStatusOptions(
  records: Record<string, unknown>[],
  config:  ViewConfig,
): string[] {
  if (!config.statusFieldKey) return [];
  const s = new Set<string>();
  for (const r of records) {
    const v = String(r[config.statusFieldKey] ?? '').trim();
    if (v) s.add(v);
  }
  return [...s].sort();
}

/** Count records per status value. */
export function countByStatus(
  records: Record<string, unknown>[],
  config:  ViewConfig,
): Map<string, number> {
  const m = new Map<string, number>();
  if (!config.statusFieldKey) return m;
  for (const r of records) {
    const v = String(r[config.statusFieldKey] ?? '').trim();
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}
