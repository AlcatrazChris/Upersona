# 用户画像平台 — 部署指南

## 前置准备

### 1. 注册 Supabase（免费）
1. 访问 https://supabase.com → 注册账号
2. 创建新项目（Project），记住数据库密码
3. 进入 **Settings → API**，获取：
   - `Project URL`（即 `NEXT_PUBLIC_SUPABASE_URL`）
   - `anon public` key（即 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
   - `service_role` key（即 `SUPABASE_SERVICE_ROLE_KEY`，⚠️ 保密）

### 2. 初始化数据库
1. 进入 Supabase 控制台 → **SQL Editor**
2. 点击 **New Query**
3. 粘贴 `supabase/schema.sql` 的全部内容
4. 点击 **Run**
5. 看到 `Schema 创建完成 ✓` 即成功

### 3. 注册 Vercel（免费）
1. 访问 https://vercel.com → 用 GitHub 账号登录
2. 导入项目（推送到 GitHub 后在 Vercel 中 Import）

---

## 本地开发

### 1. 安装依赖
```bash
cd huajing-persona
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local，填入 Supabase 和 DeepSeek 的配置
```

### 3. 导入初始数据
```bash
# 确保 .env.local 已配置好
node scripts/seed.mjs /path/to/DataPresona.xlsx
```
脚本会输出进度，完成后显示：
```
🎉 完成！数据版本 v1 已激活
   总记录数: 1030
   强意向(已锁单+完成): 350
   弱意向(未锁单): 680
```

### 4. 启动开发服务器
```bash
npm run dev
# 访问 http://localhost:3000
```

---

## 部署到 Vercel

### 方式一：GitHub 自动部署（推荐）
1. 将项目推送到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/你的用户名/huajing-persona.git
   git push -u origin main
   ```
2. 在 Vercel 控制台 → **Add New Project** → 选择你的仓库
3. 在 **Environment Variables** 中填入以下变量：
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...
   SUPABASE_SERVICE_ROLE_KEY      = eyJ...
   DEEPSEEK_API_KEY               = sk-...
   ADMIN_PASSWORD                 = 你的管理密码
   ```
4. 点击 **Deploy** → 等待 2-3 分钟
5. 部署完成后，访问 `https://huajing-persona.vercel.app`

### 方式二：Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
# 按提示填入环境变量
```

---

## 数据更新流程

当需要更新数据时：

**方式 A：通过 Admin 页面（推荐）**
1. 访问 `https://你的域名/admin`
2. 输入管理密码
3. 拖拽上传新的 `.xlsx` 文件
4. 等待处理完成（约 1-3 分钟，取决于新职业数量）

**方式 B：通过本地脚本**
```bash
node scripts/seed.mjs /path/to/new-data.xlsx
```

---

## 常见问题

**Q: DeepSeek API 调用失败怎么办？**
- 检查 `.env.local` 中 `DEEPSEEK_API_KEY` 是否正确
- 确认账户余额充足（https://platform.deepseek.com）
- 职业分类失败时会自动 fallback 为"其他"，不影响入库

**Q: Supabase 连接失败？**
- 检查 URL 和 Key 是否正确
- 确认 SQL Schema 已执行成功
- 确认 RLS 策略已创建

**Q: Admin 密码怎么设置？**
- 在 Vercel Dashboard → Environment Variables → 修改 `ADMIN_PASSWORD`
- 修改后需重新部署（Vercel 会自动触发）

**Q: 如何查看数据库内容？**
- 在 Supabase 控制台 → **Table Editor** 可以直接查看和编辑表数据
- **Database → Functions** 可以看到 `set_active_version` 等函数

---

## 项目目录结构

```
huajing-persona/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页概览
│   │   ├── profile/page.tsx    # 用户画像
│   │   ├── compare/page.tsx    # 地域对比
│   │   ├── predict/page.tsx    # 意向预测
│   │   ├── insights/page.tsx   # 核心洞察
│   │   ├── admin/page.tsx      # 数据管理
│   │   └── api/                # Serverless API Routes
│   │       ├── profile/        # 画像数据接口
│   │       ├── compare/        # 对比数据接口
│   │       ├── predict/        # 预测接口
│   │       ├── insights/       # 洞察接口
│   │       └── upload/         # 数据上传接口
│   ├── components/
│   │   ├── layout/             # 导航、顶栏
│   │   ├── charts/             # 图表组件
│   │   └── ...
│   ├── lib/
│   │   ├── supabase.ts         # 数据库客户端
│   │   ├── deepseek.ts         # AI API 封装
│   │   └── utils.ts            # 工具函数
│   └── types/index.ts          # 全局类型 + 维度配置
├── scripts/
│   ├── seed.mjs                # 数据导入脚本
│   └── env.mjs                 # 环境变量加载
├── supabase/
│   └── schema.sql              # 数据库建表语句
└── ...
```
