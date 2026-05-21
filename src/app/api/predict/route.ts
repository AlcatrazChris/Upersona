import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { predictUserIntent } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';

// GET /api/predict?userId=123  →  单用户预测
// GET /api/predict?type=city&name=广州  →  地区未锁单用户列表 + 批量预测触发
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId   = searchParams.get('userId');
  const type     = searchParams.get('type');   // area|province|city
  const name     = searchParams.get('name');
  const noCache  = searchParams.get('noCache') === '1';

  const db = createServiceClient();

  // 获取当前活跃版本
  const { data: vData } = await db
    .from('data_versions')
    .select('version_id')
    .eq('is_active', true)
    .single();
  const versionId = vData?.version_id;

  // ── 单用户预测 ──
  if (userId) {
    const uid = parseInt(userId);

    // 查缓存
    if (!noCache) {
      const { data: cached } = await db
        .from('predictions_cache')
        .select('*')
        .eq('user_id', uid)
        .eq('data_version', versionId)
        .single();

      if (cached) {
        return NextResponse.json({
          userId: uid,
          intentScore: cached.intent_score,
          intentLevel: scoreToLevel(cached.intent_score),
          keyFactors: cached.key_factors,
          marketingAdvice: cached.marketing_advice,
          cached: true,
        });
      }
    }

    // 查用户数据
    const { data: user, error } = await db
      .from('active_users')
      .select('*')
      .eq('id', uid)
      .single();

    if (error || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    // 调用 DeepSeek 预测
    const result = await predictUserIntent({
      ageGroup:         user.age_group,
      education:        user.education,
      occupation:       user.occupation_category,
      familyStructure:  user.family_structure,
      income:           user.annual_income,
      isUpgrade:        user.is_upgrade,
      consumptionViews: user.consumption_views || [],
      useScenarios:     user.use_scenarios || [],
      carInterests:     user.car_interests || [],
      infoChannels:     user.info_channels || [],
      hobbies:          user.hobbies || [],
      competingModels:  user.competing_models || [],
      familyTripFreq:   user.family_trip_frequency || [],
      city:             user.region_city,
      province:         user.region_province,
      area:             user.region_area,
    });

    // 写入缓存
    await db.from('predictions_cache').upsert({
      user_id:          uid,
      data_version:     versionId,
      intent_score:     result.score,
      key_factors:      result.keyFactors,
      marketing_advice: result.marketingAdvice,
    }, { onConflict: 'user_id,data_version' });

    return NextResponse.json({
      userId: uid,
      intentScore:     result.score,
      intentLevel:     scoreToLevel(result.score),
      keyFactors:      result.keyFactors,
      marketingAdvice: result.marketingAdvice,
      cached: false,
    });
  }

  // ── 地区未锁单用户列表 ──
  if (type && name) {
    const regionField = type === 'city' ? 'region_city'
      : type === 'province' ? 'region_province'
      : 'region_area';

    const { data: weakUsers, error } = await db
      .from('active_users')
      .select('id, name, region_city, region_province, region_area, age_group, annual_income, occupation_category')
      .eq(regionField, name)
      .eq('intent_label', 0)  // 只取弱意向用户
      .limit(50);             // 最多返回50条，避免过多调用

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 查询这批用户中已有缓存的
    const userIds = (weakUsers || []).map(u => u.id);
    const { data: cachedPreds } = await db
      .from('predictions_cache')
      .select('user_id, intent_score, key_factors, marketing_advice')
      .in('user_id', userIds)
      .eq('data_version', versionId);

    const cachedMap: Record<number, { score: number; factors: string[]; advice: string }> = {};
    for (const c of cachedPreds || []) {
      cachedMap[c.user_id] = {
        score: c.intent_score,
        factors: c.key_factors,
        advice: c.marketing_advice,
      };
    }

    // 返回列表（含已缓存的预测结果）
    const list = (weakUsers || []).map(u => ({
      userId:       u.id,
      name:         u.name,
      city:         u.region_city,
      ageGroup:     u.age_group,
      income:       u.annual_income,
      occupation:   u.occupation_category,
      intentScore:  cachedMap[u.id]?.score ?? null,
      intentLevel:  cachedMap[u.id] ? scoreToLevel(cachedMap[u.id].score) : null,
      keyFactors:   cachedMap[u.id]?.factors ?? null,
      marketingAdvice: cachedMap[u.id]?.advice ?? null,
      cached:       !!cachedMap[u.id],
    }));

    // 按已有分数降序，未预测的排后面
    list.sort((a, b) => {
      if (a.intentScore === null && b.intentScore === null) return 0;
      if (a.intentScore === null) return 1;
      if (b.intentScore === null) return -1;
      return b.intentScore - a.intentScore;
    });

    return NextResponse.json({
      region: name,
      regionType: type,
      totalWeak: weakUsers?.length || 0,
      cachedCount: Object.keys(cachedMap).length,
      users: list,
    });
  }

  return NextResponse.json({ error: '缺少参数：userId 或 type+name' }, { status: 400 });
}

function scoreToLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
