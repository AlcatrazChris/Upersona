# Upersona 项目说明

Upersona 是一个面向调研数据的用户洞察平台。管理员可上传 Excel、CSV 或 JSON 数据，系统会自动识别字段类型，并通过用户画像、地域对比、状态对比、核心洞察和区域特征五个视图完成分析。普通查看者只能读取已同步的数据和配置。

## 技术栈

- Next.js 14 App Router、React 18、TypeScript
- Tailwind CSS
- Zustand + IndexedDB（`idb-keyval`）
- Recharts
- Supabase
- 自定义 JWT（`jose` + `bcryptjs`）
- DeepSeek 兼容的 OpenAI 风格 AI API

## 本地运行

```bash
npm install
npm run dev
npm run build
```

当前项目要求 Node.js 24，版本记录在 `.node-version`。生产构建会同时执行 TypeScript 检查。

## 环境变量

在项目根目录创建 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
SETUP_SECRET=

AI_API_KEY=
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

`SUPABASE_SERVICE_ROLE_KEY`、`JWT_SECRET`、`SETUP_SECRET` 和 `AI_API_KEY` 只能在服务端使用，不得写入客户端组件或提交到仓库。`AI_API_KEY` 也可使用 `DEEPSEEK_API_KEY` 代替。

## 目录和模块

| 模块 | 当前职责 |
|---|---|
| `src/app/page.tsx` | 应用外壳、移动端导航、数据中心入口、五个视图的按需加载及 `?view=` 深链 |
| `src/app/sign-in` | 用户名密码登录、记住登录状态和错误反馈 |
| `src/app/api/auth` | 登录、退出、当前用户和首次管理员初始化 |
| `src/app/api/admin/accounts` | 管理员账号的查询、新增、改权、重置密码和删除 |
| `src/app/api/datasets` | Supabase 数据集及分析配置的读取、推送和更新 |
| `src/app/api/ai` | 通用洞察、聚类洞察和分群叙事 |
| `src/app/api/enrich*`、`api/order` | AI 字段派生及选项排序 |
| `src/components/views` | 五个业务分析视图和数据中心 |
| `src/components/charts` | 图表构建器、保存画布、通用图表设置 |
| `src/components/charts/engine` | 条形、饼形、环形、折线、堆叠、分组和排名热力图渲染内核 |
| `src/components/fields` | 字段统计、排序、清洗、删除和 AI 派生 |
| `src/components/persona` | 画像配置、分群报告和分群洞察卡片 |
| `src/components/shared` | 状态筛选组、AI 洞察面板、云端数据集选择器 |
| `src/store/datasetStore.ts` | 数据集、视图配置、图表、画布、画像配置和 Prompt 的唯一全局状态 |
| `src/lib/dataParser.ts` | xlsx/xls/csv/json 到统一 `Dataset` 的解析 |
| `src/workers/dataParser.worker.ts` | 在后台线程解析上传文件，避免大文件阻塞界面 |
| `src/lib/schemaDetector.ts` | 字段类型、地理字段、订单状态等自动识别 |
| `src/lib/timeStatus.ts` | 时间字段识别、月份标准化和按月筛选 |
| `src/lib/filterRecords.ts` | 地域、订单状态等通用记录筛选 |
| `src/lib/dataAggregator.ts` | 图表数据聚合 |
| `src/lib/chartConfig.ts` | 图表配色、标签、Top-N、高度和紧凑模式配置 |
| `src/hooks/useAutoSyncCloud.ts` | 启动后拉取最新云端数据集 |
| `src/hooks/useConfigAutoSync.ts` | 云端来源数据集的分析配置延迟同步 |
| `src/hooks/useModalA11y.ts` | 弹窗焦点约束、Esc 关闭、背景禁用和滚动锁定 |

## 五个分析视图

### 用户画像

按地域、订单状态、月份和分群筛选样本，以可复用图表卡展示画像字段分布。每张图表可独立选择类型和样式，并支持拖动或键盘调整高度。

### 地域对比

在大区、省份或城市层级选择多个地区，对单个画像维度进行堆叠或分组对比；订单状态和月份可作为统一状态变量筛选。

### 状态对比

时间字段由 `detectTimeField()` 自动识别，只作为状态筛选变量，不进入画像维度。页面按月份对比多个画像维度，同时支持订单状态二次筛选、跨数据集对比、条形/饼形/环形图切换、配色方案及高度调整。对比色由所选配色方案中按数量抽取高反差颜色。

### 核心洞察

根据当前地域、订单状态和月份范围生成并缓存 AI 人群聚类结果。AI 决定展示的数据点，百分比由前端基于真实记录重新计算。

### 区域特征

生成“地区 × 画像维度”的交叉矩阵，展示 Top 取值、占比和相对全量的差值，并可生成 AI 区域摘要。

## 数据模型和持久化

`src/types/dataSchema.ts` 中的 `Dataset` 与 `Field` 是各模块共用的数据格式。任何上传文件都必须先转换成 `Dataset`；`Field.options` 是可选值，读取时需使用 `?? []` 或可选链。

Zustand 持久化名称为 `upersona-datasets`，数据保存在 IndexedDB。主要内容包括：

- 完整数据集（持久化最多 50,000 条记录）
- 每个数据集的 `ViewConfig`
- 已保存图表和自由画布文字
- 画像配置和 AI Prompt 模板
- 当前数据集和画像配置

图表样式不进入 Zustand，而是以 `upersona-chart-config-${pageKey}` 为键保存在 `localStorage`。读取时会与当前默认配置合并，便于兼容旧数据。

## 状态变量规则

- 订单状态：来自 `ViewConfig.statusFieldKey` 和 `statusGroups`
- 时间状态：运行时自动识别日期字段，并标准化为 `YYYY-MM`
- 两类状态都可点选，用于统一筛选
- 时间字段必须从普通画像维度和后续图表候选中排除
- 通用“全量”哨兵值为 `__all`

## 图表内核

`ChartRenderer` 和 `GroupChartRenderer` 是统一渲染入口；各页面只负责准备聚合数据和保存局部图表类型。通用能力集中在图表内核及 `ChartSettingsPanel`：

- 配色方案、标签显示、Top-N 和“其他”
- 紧凑模式、网格线、百分比与图例
- 条形、饼形、环形、折线、堆叠、分组、排名热力图
- 鼠标拖动及键盘调整高度
- PNG/SVG 导出

新增图表功能时优先扩展内核，避免在业务视图重复实现。

## 认证和权限

- Cookie：`upersona_session`
- 角色：`admin`、`viewer`
- 登录连续失败 5 次会锁定 15 分钟
- 管理员可上传、清洗、删除、推送数据集及管理账号
- 查看者只可读取云端数据和分析结果
- `POST /api/auth/setup` 仅用于首次创建管理员，并要求 `SETUP_SECRET`
- `getSupabaseAdmin()` 只能在服务端 API 中调用

## 云端数据结构

- `upersona_dataset_chunks`：数据记录按每块 1000 行存储
- `upersona_dataset_configs`：视图配置、画像配置、图表和画布配置
- 本地文件上传在浏览器 Worker 中解析，避免 Vercel Serverless 响应体限制

## 修改约束

- 修改后至少运行 `npm run build`
- 新图表能力应复用图表内核和统一设置面板
- 新筛选能力应复用订单状态/时间状态的统一筛选组件
- 删除、清洗等不可逆操作必须二次确认
- 新弹窗应复用 `useModalA11y`
- 客户端不得读取服务端密钥
- AI 输出结构扩展时需兼容已缓存的旧结果
