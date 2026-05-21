import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
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

  const regionField = type === 'city' ? 'region_city' : type === 'province' ? 'region_province' : 'region_area';
  const SELECT_COLS = 'intent_label,age_group,education,occupation_category,family_structure,annual_income,consumption_views,car_interests,info_channels,hobbies,competing_models,use_scenarios,order_status,is_upgrade';

  // 查询地区数据
  let regionQ = db.from('users').select(SELECT_COLS)
    .eq('data_version', vd.version_id).eq(regionField, name);
  if (orderStatus !== 'all') regionQ = regionQ.eq('order_status', orderStatus);
  const { data: users, error } = await regionQ;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!users || users.length === 0) return NextResponse.json({ error: '该筛选条件下无数据' }, { status: 404 });

  // 查询全国数据（用于偏差计算）
  let natQ = db.from('users').select(SELECT_COLS).eq('data_version', vd.version_id);
  if (orderStatus !== 'all') natQ = natQ.eq('order_status', orderStatus);
  const { data: natUsers } = await natQ;

  type InsightUser = NonNullable<typeof users>[number];

  const totalSamples = users.length;
  const strongCount  = users.filter(u => u.intent_label === 1).length;
  const weakCount    = totalSamples - strongCount;
  const strongRatio  = parseFloat((strongCount / totalSamples * 100).toFixed(1));

  // 统计函数
  function topN(arr: InsightUser[], extract: (u: InsightUser) => string | string[] | null | undefined, n: number) {
    const counter: Record<string, number> = {};
    for (const u of arr) {
      const val = extract(u);
      const items = Array.isArray(val) ? val : [val];
      for (const v of items) { if (v && v !== '(跳过)') counter[v] = (counter[v] || 0) + 1; }
    }
    return Object.entries(counter).sort((a,b) => b[1]-a[1]).slice(0, n)
      .map(([label, count]) => ({ label, count, pct: parseFloat((count / arr.length * 100).toFixed(1)) }));
  }

  const stats = {
    topOccupations:      topN(users, u => u.occupation_category, 4),
    topAgeGroups:        topN(users, u => u.age_group, 3),
    topEducation:        topN(users, u => u.education, 2),
    topIncome:           topN(users, u => u.annual_income, 3),
    topFamilyStructure:  topN(users, u => u.family_structure, 2),
    topCarInterests:     topN(users, u => u.car_interests || [], 4),
    topInfoChannels:     topN(users, u => u.info_channels || [], 3),
    topConsumptionViews: topN(users, u => u.consumption_views || [], 3),
    topHobbies:          topN(users, u => u.hobbies || [], 4),
    topCompetingModels:  topN(users, u => u.competing_models || [], 3),
    topUseScenarios:     topN(users, u => u.use_scenarios || [], 3),
    isUpgrade:           topN(users, u => u.is_upgrade, 1),
  };

  // 计算与全国的偏差（TOP 职业、TOP 年龄段、TOP 渠道）
  const deviations: { dimension: string; local: number; national: number; diff: number; label: string }[] = [];
  if (natUsers && natUsers.length > 0) {
    type NatUser = NonNullable<typeof natUsers>[number];
    const natN = natUsers.length;

    // 各维度 TOP1 的地区 vs 全国占比
    const dimConfigs = [
      { key: 'occupation', label: '职业', localTop: stats.topOccupations[0] },
      { key: 'age', label: '年龄段', localTop: stats.topAgeGroups[0] },
      { key: 'education', label: '学历', localTop: stats.topEducation[0] },
      { key: 'income', label: '收入', localTop: stats.topIncome[0] },
      { key: 'family', label: '家庭结构', localTop: stats.topFamilyStructure[0] },
      { key: 'channel', label: '了解渠道', localTop: stats.topInfoChannels[0] },
      { key: 'interest', label: '关注内容', localTop: stats.topCarInterests[0] },
    ];

    const natExtract: Record<string, (u: NatUser) => string | string[] | null | undefined> = {
      occupation: u => u.occupation_category,
      age:        u => u.age_group,
      education:  u => u.education,
      income:     u => u.annual_income,
      family:     u => u.family_structure,
      channel:    u => u.info_channels || [],
      interest:   u => u.car_interests || [],
    };

    for (const { key, label, localTop } of dimConfigs) {
      if (!localTop) continue;
      const natCount = natUsers.filter(u => {
        const val = natExtract[key](u);
        return Array.isArray(val) ? val.includes(localTop.label) : val === localTop.label;
      }).length;
      const natPct = parseFloat((natCount / natN * 100).toFixed(1));
      deviations.push({ dimension: key, label: `${label}/${localTop.label}`, local: localTop.pct, national: natPct, diff: parseFloat((localTop.pct - natPct).toFixed(1)) });
    }
  }

  // 查缓存
  const cacheKey = makeCacheKey('core_card_v2', type, name, orderStatus);
  let aiCard = null;
  let cached = false;

  if (!noCache) {
    const { data: cachedData } = await db.from('insights_cache').select('content').eq('cache_key', cacheKey).single();
    if (cachedData) { try { aiCard = JSON.parse(cachedData.content); cached = true; } catch {} }
  }

  if (!aiCard) {
    try {
      aiCard = await generateCoreUserCard({ region: name, orderStatus, totalSamples, strongCount, weakCount, strongRatio, stats, deviations });
      await db.from('insights_cache').upsert({
        cache_key: cacheKey, insight_type: 'core_card_v2',
        content: JSON.stringify(aiCard),
        data_version: vd.version_id, generated_at: new Date().toISOString(),
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
