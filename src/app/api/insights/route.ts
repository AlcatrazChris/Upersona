import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { generateCoreUserCard } from '@/lib/deepseek';
import { makeCacheKey } from '@/lib/utils';
import type { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type        = searchParams.get('type') || 'area';
  const name        = searchParams.get('name');
  const noCache     = searchParams.get('noCache') === '1';
  const orderStatus = (searchParams.get('orderStatus') || 'all') as OrderStatus;

  if (!name) return NextResponse.json({ error: '缺少参数: name' }, { status: 400 });

  const db = createServiceClient();
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });

  const regionField = type === 'city' ? 'region_city'
    : type === 'province' ? 'region_province' : 'region_area';

  // 从 DB 读取字段配置（管理员可控制哪些字段参与分析）
  interface FieldConfig { key: string; label: string; enabled: boolean; type: string; }
  let fieldConfigs: FieldConfig[] = [];
  try {
    const { data: promptRow } = await db.from('ai_prompts')
      .select('user_prompt').eq('prompt_key', 'insights_fields').single();
    if (promptRow?.user_prompt) {
      fieldConfigs = JSON.parse(promptRow.user_prompt) as FieldConfig[];
    }
  } catch {}

  // 默认字段（DB 读取失败时的兜底）
  const DEFAULT_FIELDS = [
    'occupation_raw','occupation_category','age_group','education','annual_income',
    'family_structure','is_upgrade','consumption_views','use_scenarios',
    'competing_models','info_channels','car_interests','hobbies',
  ];
  const enabledKeys = fieldConfigs.length > 0
    ? fieldConfigs.filter(f => f.enabled).map(f => f.key)
    : DEFAULT_FIELDS;

  const SELECT_COLS = [
    'intent_label', 'order_status', 'finance_term',
    ...enabledKeys.filter(k => !['intent_label','order_status','finance_term'].includes(k)),
  ].join(',');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type UserRow = any;
  let users: UserRow[];
  try {
    users = await fetchUsers(db, SELECT_COLS, q => {
      let r = q.eq('data_version', vd.version_id).eq(regionField, name);
      if (orderStatus !== 'all') r = orderStatus === '锁单/提车' ? r.in('order_status', ['已锁单', '订单完成']) : r.eq('order_status', orderStatus);
      return r;
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (users.length === 0)
    return NextResponse.json({ error: '该筛选条件下无数据' }, { status: 404 });

  // 全国数据（用于偏差计算）
  let natUsers: UserRow[];
  try {
    natUsers = await fetchUsers(db, SELECT_COLS, q => {
      let r = q.eq('data_version', vd.version_id);
      if (orderStatus !== 'all') r = orderStatus === '锁单/提车' ? r.in('order_status', ['已锁单', '订单完成']) : r.eq('order_status', orderStatus);
      return r;
    });
  } catch { natUsers = []; }

  const totalSamples = users.length;
  const strongCount  = users.filter(u => u.intent_label === 1).length;
  const weakCount    = totalSamples - strongCount;
  const strongRatio  = parseFloat((strongCount / totalSamples * 100).toFixed(1));

  // ── 统计函数 ──
  function topN(arr: UserRow[], extract: (u: UserRow) => string | string[], n: number) {
    const counter: Record<string, number> = {};
    for (const u of arr) {
      const val = extract(u);
      const items = Array.isArray(val) ? val : [val];
      for (const v of items) {
        if (v && v !== '(跳过)') counter[v] = (counter[v] || 0) + 1;
      }
    }
    return Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([label, count]) => ({ label, count, pct: parseFloat((count / arr.length * 100).toFixed(1)) }));
  }

  const stats = {
    topOccupations:      topN(users, u => u.occupation_category, 4),
    topOccupationRaw:    topN(users, u => u.occupation_raw, 8),
    topAgeGroups:        topN(users, u => u.age_group, 3),
    topEducation:        topN(users, u => u.education, 2),
    topIncome:           topN(users, u => u.annual_income, 3),
    topFamilyStructure:  topN(users, u => u.family_structure, 2),
    topCarInterests:     topN(users, u => u.car_interests ?? [], 4),
    topInfoChannels:     topN(users, u => u.info_channels ?? [], 3),
    topConsumptionViews: topN(users, u => u.consumption_views ?? [], 3),
    topHobbies:          topN(users, u => u.hobbies ?? [], 4),
    topCompetingModels:  topN(users, u => u.competing_models ?? [], 3),
    topUseScenarios:     topN(users, u => u.use_scenarios ?? [], 3),
    isUpgrade:           topN(users, u => u.is_upgrade, 1),
    // 金融期数：0=全款，>0=分期，转为标签后统计
    financeTermDist:     topN(users, u => {
      const t = Number(u.finance_term) || 0;
      return t === 0 ? '全款' : `分期${t}期`;
    }, 6),
  };

  // ── 收入 × 金融期数交叉统计（用于 AI 分析决策逻辑）──
  const financeRate = (() => {
    const total = users.length;
    const financeCount = users.filter((u: UserRow) => Number(u.finance_term) > 0).length;
    const financeRate  = total > 0 ? parseFloat((financeCount / total * 100).toFixed(1)) : 0;

    // 各收入段的分期比例
    const INC_ORDER = ['15万以下','15-19万','20-24万','24-29万','30-39万','40-49万','50万以上'];
    const byIncome = INC_ORDER.map(inc => {
      const sub  = users.filter((u: UserRow) => u.annual_income === inc);
      const fin  = sub.filter((u: UserRow) => Number(u.finance_term) > 0).length;
      return { income: inc, n: sub.length, finPct: sub.length > 0 ? parseFloat((fin / sub.length * 100).toFixed(1)) : 0 };
    }).filter(r => r.n >= 3);

    // 平均分期期数（仅分期用户）
    const finUsers = users.filter((u: UserRow) => Number(u.finance_term) > 0);
    const avgTerm  = finUsers.length > 0
      ? parseFloat((finUsers.reduce((s: number, u: UserRow) => s + (Number(u.finance_term) || 0), 0) / finUsers.length).toFixed(1))
      : 0;

    return { financeRate, avgTerm, financeCount, byIncome };
  })();

  // ── 代表性用户行抽样（随机取最多20条，供AI做跨维度聚类）──
  function sampleRows(arr: UserRow[], n: number): string[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    return shuffled.map(u => {
      const ms = (arr: string[] | null) => (arr ?? []).join('/') || '-';
      const ft = Number(u.finance_term) || 0;
      const finLabel = ft === 0 ? '全款' : `分期${ft}期`;
      return [
        u.occupation_raw || u.occupation_category,
        u.age_group,
        u.annual_income,
        u.family_structure,
        u.education,
        u.is_upgrade === '是' ? '增换购' : '首购',
        finLabel,
        ms(u.consumption_views),
        ms(u.use_scenarios),
        ms(u.competing_models),
        ms(u.info_channels),
      ].join('|');
    });
  }

  const sampleUserRows = sampleRows(users, 20);
  // ── 偏差计算 ──
  const deviations: { dimension: string; local: number; national: number; diff: number; label: string }[] = [];
  if (natUsers.length > 0) {
    const natN = natUsers.length;
    const dimConfigs: { key: string; label: string; localTop: { label: string; pct: number } | undefined; extract: (u: UserRow) => string | string[] }[] = [
      { key: 'occupation', label: '职业',    localTop: stats.topOccupations[0],     extract: u => u.occupation_category },
      { key: 'age',        label: '年龄段',  localTop: stats.topAgeGroups[0],        extract: u => u.age_group },
      { key: 'education',  label: '学历',    localTop: stats.topEducation[0],        extract: u => u.education },
      { key: 'income',     label: '收入',    localTop: stats.topIncome[0],           extract: u => u.annual_income },
      { key: 'family',     label: '家庭结构', localTop: stats.topFamilyStructure[0], extract: u => u.family_structure },
      { key: 'channel',    label: '了解渠道', localTop: stats.topInfoChannels[0],    extract: u => u.info_channels ?? [] },
      { key: 'interest',   label: '关注内容', localTop: stats.topCarInterests[0],    extract: u => u.car_interests ?? [] },
    ];

    for (const { label, localTop, extract } of dimConfigs) {
      if (!localTop) continue;
      const natCount = natUsers.filter(u => {
        const val = extract(u);
        return Array.isArray(val) ? val.includes(localTop.label) : val === localTop.label;
      }).length;
      const natPct = parseFloat((natCount / natN * 100).toFixed(1));
      deviations.push({
        dimension: label, label: `${label}/${localTop.label}`,
        local: localTop.pct, national: natPct,
        diff: parseFloat((localTop.pct - natPct).toFixed(1)),
      });
    }
  }

  // ── 缓存查询 ──
  const cacheKey = makeCacheKey('core_card_v3', type, name, orderStatus);
  let aiCard = null;
  let cached = false;

  if (!noCache) {
    const { data: cachedData } = await db.from('insights_cache').select('content').eq('cache_key', cacheKey).single();
    if (cachedData) { try { aiCard = JSON.parse(cachedData.content); cached = true; } catch {} }
  }

  if (!aiCard) {
    try {
      aiCard = await generateCoreUserCard({
        region: name, orderStatus, totalSamples, strongCount, weakCount, strongRatio,
        stats, deviations, sampleUserRows, financeRate,
      });
      await db.from('insights_cache').upsert({
        cache_key: cacheKey, insight_type: 'core_card_v3',
        content: JSON.stringify(aiCard),
        data_version: vd.version_id,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });
    } catch (err) {
      console.error('AI 卡片生成失败:', err);
    }
  }

  return NextResponse.json({
    regionType: type, regionName: name, orderStatusFilter: orderStatus,
    sampleCount: totalSamples, strongIntentCount: strongCount,
    weakIntentCount: weakCount, strongIntentRatio: strongRatio,
    aiCard, cached,
  });
}
