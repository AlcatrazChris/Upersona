'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

function writeParam(key: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, '', url);
}

export function useUrlStringState<T extends string>(
  key: string,
  fallback: T,
  allowed?: readonly T[],
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(fallback);
  const [initialized, setInitialized] = useState(false);
  const allowedKey = allowed?.join('|') ?? '';

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key) as T | null;
    if (raw && (!allowed || allowed.includes(raw))) setValue(raw);
    setInitialized(true);
  }, [key, allowedKey]);

  useEffect(() => {
    if (initialized) writeParam(key, value === fallback ? '' : value);
  }, [fallback, initialized, key, value]);

  return [value, setValue];
}

export function useUrlArrayState(
  key: string,
  fallback: string[] = [],
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [value, setValue] = useState<string[]>(fallback);
  const [initialized, setInitialized] = useState(false);
  const fallbackKey = fallback.join(',');

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    if (raw) setValue(raw.split(',').filter(Boolean));
    setInitialized(true);
  }, [key]);

  useEffect(() => {
    if (!initialized) return;
    writeParam(key, value.join(',') === fallbackKey ? '' : value.join(','));
  }, [fallbackKey, initialized, key, value]);

  return [value, setValue];
}
