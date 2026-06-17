# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# upersona-v2

调研数据洞察平台。用户上传 Excel / CSV，系统自动识别字段类型，提供图表分析、地域对比、人群聚类等多个视图，所有 AI 分析调用外部 DeepSeek API。

## 技术栈

- **框架**：Next.js 14 App Router（`/src/app/`），全 TypeScript
- **状态**：Zustand + IndexedDB 持久化（`idb-keyval`，非 localStorage，无大小限制）
- **图表**：Recharts（Bar / Pie / Line / Stacked / Grouped / RankingHeatmap）
- **样式**：Tailwind CSS
- **云端**：Supabase（数据存储 + 用户认证数据库）
- **AI**：DeepSeek API，通过内部 API Routes 代理
- **JWT**：`jose` 库（Edge Runtime 兼容），非 `jsonwebtoken`

## 常用命令

```bash
npm run dev      # 启动开发服务器 (localhost:3000)
npm run build    # 构建生产包（同时做 TypeScript 类型检查）
npx tsc --noEmit # 仅做类型检查（不构建），改完代码后必跑
```

## 必须的环境变量

`.env.local` 需配置：

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # 仅服务端，绝不暴露客户端
JWT_SECRET=                  # 用于签发/验证 JWT session
AI_API_KEY=                  # DeepSeek API Key（也接受 DEEPSEEK_API_KEY）
AI_BASE_URL=                 # 可选，默认 https://api.deepseek.com/v1
AI_MODEL=                    # 可选，默认 deepseek-chat；推荐 deepseek-v3 或更新版本
```

## 核心架构

### 数据模型（唯一语言）

`src/types/dataSchema.ts` 中的 `Dataset` 和 `Field` 是整个系统的唯一数据语言。所有输入（xlsx/csv/json）都先经 `src/lib/dataParser.ts` 转换为 `Dataset`，然后所有视图、图表引擎、AI 调用都消费这一格式。

`Field.options` 是可选的（`?: string[]`）——从云端加载的数据集可能没有此字段，代码里凡引用它都要加 `?? []` 或 `?.length` 防空。

`Field.multiDelimiter` 默认为 `'┋'`，用于拆分 `multi_choice` 类型的值；字段可单独覆盖。

### 状态层（Zustand Store）

`src/store/datasetStore.ts` 是唯一的全局状态。IndexedDB key 名为 **`upersona-datasets`**（注意：非 `dataset-store`）。

持久化字段（`partialize`）：

- `datasets[]` — 含完整 records，**但上限 50,000 行**（超过部分不写入 IndexedDB）
- `viewConfigs` — 每个数据集的视图配置（`Record<datasetId, ViewConfig>`）
- `savedCharts` — 每个数据集的已保存图表
- `canvasElements` — 画布文字元素（自由布局模式）
- `personaConfigs` — 人群画像配置
- `savedPrompts` — 全局已保存的 AI Prompt 模板列表
- `activeDatasetId / activePersonaConfigId`

`ChartConfig`（图表样式设置）单独存在 **localStorage**，key 格式为 `upersona-chart-config-${pageKey}`，由 `src/lib/chartConfig.ts` 的 `loadChartConfig / saveChartConfig` 管理，与 Zustand 无关。

### ViewConfig（视图配置）

`src/lib/viewConfig.ts` 中的 `ViewConfig` 记录每个数据集的分析配置：

- `statusFieldKey` — 哪个字段是"订单状态"
- `geoRegionKey / geoProvinceKey / geoCityKey` — 地理字段
- `statusGroups` — 状态分组（强意向 / 中性 / 弱意向）
- `clusterResults` — AI 聚类结果缓存（`Record<cacheKey, ClusterInsightResult>`）
- `viewPrompts` — 各视图自定义 AI Prompt，key 是 5 个视图 ID 之一：`'persona' | 'regional' | 'status' | 'insight' | 'rfeature'`

`autoDetectViewConfig()` 在首次加载数据集时自动推断上述字段。

### 五个分析视图

`src/app/page.tsx` 中定义，挂载在同一主页面，通过 Tab 切换：

| id | 标签 | 组件 |
|----|------|------|
| `persona` | 用户画像 | `PersonaView` |
| `regional` | 地域对比 | `RegionalView` |
| `status` | 状态对比 | `StatusView` |
| `insight` | 核心洞察 | `InsightView`（AI 聚类）|
| `rfeature` | 区域特征 | `RegionalFeatureView` |

`/dataset/[id]` 路由是遗留深链跳转，只设置 `activeDatasetId` 后立即 redirect 到 `/`，不是真实的数据集页面。

### AI 聚类输出 Schema（InsightView）

`ClusterSegment` 包含以下核心字段（`src/lib/viewConfig.ts`）：

- `who_data: DataPoint[]` — 左列人群画像：AI 选哪些字段的哪些取值展示
- `insight_sections: InsightSection[]` — 3 行消费心理表格；第 3 行的 `data?: DataPoint` 用于内联条形图
- `preference_data: DataPoint[]` — 底部购车偏好图表

`DataPoint = { field: string, values: string[], label?: string }` —— AI 明确指定展示哪些值，渲染器再去 `filteredRecords` 计算真实百分比（确保数据准确）。

所有旧字段（`key_traits`, `dimensions`, `chart_fields`, `preference_fields`）保留用于向后兼容，新生成的结果不再输出它们。

### 人群画像分群报告（PersonaConfig.segments）

`src/types/personaSchema.ts` 中的 `SegmentDef` 定义单个分群：

- `filterField / filterValues` — 筛选条件（`filterField` 为空字符串 = 全量）
- `demoFields / chartFields` — 左栏人口统计字段 / 右下角迷你对比图字段
- `cachedNarrative?: SegmentNarrative` — AI 生成的叙事文本，缓存在分群定义里

`SegmentNarrative` 由 `POST /api/ai/segment-narrative` 生成，包含 `psych_title / psych_text / sections / purchase_text`。

### 图表引擎

- `src/components/charts/engine/ChartRenderer.tsx` — 根据 `ChartType` 分发到各 Engine
- `src/components/charts/engine/shared.tsx` — 共享工具：`applyTopN()`（top-N + 合并「其他」）、`ChartTooltip`、`BarLabelContent`
- `ChartConfig.colorScheme = 'mckinsey'` 时 `isSingleColorScheme()` 返回 true，所有条形图用同一颜色（`#003087`），「其他」固定 `#b0bec5`

### 跳过值识别

`src/lib/skipPatterns.ts` 提供 `isSkipValue(raw)` ——判断调研答案是否为"跳过/未作答"类无效值（支持 N/A、跳过、—、带括号变体等）。`cleanSkipValues` store action 调用它将记录中的跳过值替换为空字符串并重算统计。

### 云端同步

- 数据集分块存储：`upersona_dataset_chunks`，每块 1000 行（`CHUNK_SIZE`）
- 配置单独存储：`upersona_dataset_configs`（viewConfig / personaConfigs / savedCharts / canvasElements）
- `getSupabaseAdmin()` 仅在 API Routes 中使用，客户端组件禁止调用
- **`useAutoSyncCloud`**（`src/hooks/useAutoSyncCloud.ts`）：应用启动后自动拉取最新云端数据集；若当前活跃的是本地上传文件（`source !== 'supabase'`）则跳过
- **`useConfigAutoSync`**（`src/hooks/useConfigAutoSync.ts`）：当 `source=supabase` 的数据集配置在本地变更后，延迟 1.5s 自动 PATCH 推送配置到云端（仅配置，不重传记录）

### 认证

自定义 JWT，非第三方库（非 Clerk / NextAuth）。

- `src/middleware.ts` — Edge Runtime JWT 校验，公开路径：`/sign-in`、`/api/auth/*`
- `src/lib/auth-server.ts` — `signToken / verifyToken / verifyPassword`，**仅服务端**
- `src/lib/auth.ts` — 客户端 `AuthContext`，提供 `useAuth() / useRole() / useIsAdmin()`
- Cookie 名：`upersona_session`，httpOnly + secure + sameSite=strict
- 角色：`admin`（可上传/推送数据集）/ `viewer`（只读）

### API Routes 概览

所有 AI 路由均使用 `export const runtime = 'nodejs'`（不能用 Edge Runtime）。

| 路由 | 功能 |
|------|------|
| `POST /api/ai` | 通用人群洞察（使用 ViewConfig 构建上下文）|
| `POST /api/ai/cluster-insight` | McKinsey 式人群聚类分析 |
| `POST /api/ai/segment-narrative` | 人群画像叙述 |
| `POST /api/order` | AI 推荐字段取值排序 |
| `POST /api/enrich` | 数据集字段批量 AI 丰富 |
| `POST /api/enrich-field` | 单字段 AI 丰富 |
| `POST /api/parse` | 文件解析（服务端）|
| `GET/POST /api/datasets` | 数据集云端列表 / 推送 |
| `GET /api/datasets/[id]` | 拉取单个数据集（含分块重组）|
| `PATCH /api/datasets/[id]` | 仅更新配置（viewConfig / personaConfigs 等），不重传记录 |
| `POST /api/auth/login` | 登录（5 次失败锁定 15 分钟）|
| `POST /api/auth/logout` | 退出登录 |
| `GET /api/auth/me` | 获取当前用户信息 |
| `POST /api/auth/setup` | 初始化管理员账号 |
| `GET/POST /api/admin/users` | 管理员用户列表 / 新增 |
| `GET/PATCH/DELETE /api/admin/accounts/[id]` | 管理员账号详情操作 |

## 编码规范

- 改完任何文件后运行 `npx tsc --noEmit` 确认零错误
- `field.options` 必须用可选链访问，不能直接 `.length`
- `getSupabaseAdmin()` 仅允许在 `src/app/api/` 下调用
- AI Prompt 中注明"所有数据都是为结论服务的"原则：先形成洞察，再选择支撑结论的数据点
- 新增 AI 输出字段时，旧字段保留（向后兼容已缓存的 `clusterResults`）
- `filterRecords()` 中状态过滤的"全量"哨兵值为字符串 `'__all'`，不是空数组
