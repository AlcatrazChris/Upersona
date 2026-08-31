export async function readJsonResponse<T>(response: Response, endpoint: string): Promise<T> {
  const body = await response.text();

  if (!body.trim()) {
    throw new Error(`${endpoint} returned an empty response (HTTP ${response.status})`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const detail = title ? `: ${title}` : '';
    throw new Error(`${endpoint} returned HTML instead of JSON (HTTP ${response.status})${detail}`);
  }
}
