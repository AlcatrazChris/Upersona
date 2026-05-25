import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * 分页拉取 users 表，突破 PostgREST 默认 1000 条上限。
 *
 * 用法示例：
 *   const users = await fetchUsers(db, 'age_group, occupation_category', q =>
 *     q.eq('data_version', versionId).eq('order_status', '已锁单')
 *   );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUsers(
  db: ReturnType<typeof createServiceClient>,
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters: (q: any) => any,
  pageSize = 1000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const all = [];
  let page  = 0;

  while (true) {
    const start = page * pageSize;
    const end   = start + pageSize - 1;
    let q = db.from('users').select(columns).range(start, end);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw new Error(`fetchUsers page ${page}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  return all;
}
