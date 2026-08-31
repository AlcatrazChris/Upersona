import { parseFileToDataset } from '@/lib/dataParser';

self.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; filename: string }>) => {
  try {
    const dataset = parseFileToDataset(event.data.buffer, event.data.filename, { maxRows: 10000, normalizeKnownSurveys: false });
    self.postMessage({ dataset });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : '文件解析失败',
    });
  }
};

export {};
