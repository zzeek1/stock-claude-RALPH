# 股票交易日志与复盘分析系统 - 开发指引

## 项目概述

本地桌面应用，用于记录股票交易、统计分析、AI智能复盘。面向低频交易员（每天1-3笔）。

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript |
| UI组件库 | Ant Design 5 |
| 图表 | Recharts 2 |
| 数据库 | sql.js (WASM SQLite，无需原生编译) |
| AI | Anthropic SDK (Claude API 流式输出) |
| 构建 | Vite 6 + electron-builder |
| 状态管理 | Zustand 5 |
| 路由 | react-router-dom 6 (HashRouter) |

## 目录结构

```
D:\code\stock-claude\
├── package.json              # 依赖和脚本
├── tsconfig.json             # 前端 TS 配置
├── tsconfig.main.json        # 主进程 TS 配置 (CommonJS)
├── vite.config.ts            # Vite 配置 (root: src/renderer)
├── electron-builder.yml      # 打包配置
├── dist/                     # 构建输出 (git忽略)
│   ├── main/main/            # 主进程编译输出
│   └── renderer/             # 前端构建输出
├── src/
│   ├── shared/               # 前后端共享代码
│   │   ├── types.ts          # 所有 TypeScript 类型定义
│   │   └── ipc-channels.ts   # IPC 通道常量
│   ├── main/                 # Electron 主进程 (Node.js)
│   │   ├── index.ts          # 入口：创建窗口、初始化DB、注册IPC
│   │   ├── preload.ts        # contextBridge 暴露 API 给渲染进程
│   │   ├── database/
│   │   │   ├── connection.ts # sql.js 连接管理、查询辅助函数
│   │   │   ├── migrate.ts    # 数据库迁移（版本化SQL）
│   │   │   └── sql.js.d.ts   # sql.js 类型声明
│   │   ├── services/         # 业务逻辑层
│   │   │   ├── trade-service.ts    # 交易CRUD、盈亏计算、持仓计算
│   │   │   ├── account-service.ts  # 账户快照
│   │   │   ├── stats-service.ts    # 统计聚合查询
│   │   │   ├── ai-service.ts       # Claude API 调用、Prompt组装
│   │   │   ├── export-service.ts   # CSV导出
│   │   │   └── settings-service.ts # 设置读写、API Key加密
│   │   └── ipc/              # IPC 处理器（桥接 service 和渲染进程）
│   │       ├── trade-handlers.ts
│   │       ├── stats-handlers.ts
│   │       ├── ai-handlers.ts
│   │       └── settings-handlers.ts
│   └── renderer/             # React 前端
│       ├── index.html        # HTML 入口
│       ├── main.tsx          # React 入口 (ConfigProvider + antd)
│       ├── App.tsx           # 路由配置 (HashRouter)
│       ├── components/
│       │   └── Layout/
│       │       └── AppLayout.tsx  # 侧边栏导航布局
│       ├── pages/
│       │   ├── Dashboard.tsx     # 首页看板：指标卡片 + 收益曲线 + 月度统计
│       │   ├── NewTrade.tsx      # 新建交易：分层表单、快速模式、自动计算
│       │   ├── TradeLog.tsx      # 交易日志：筛选、排序、展开详情、CSV导出
│       │   ├── Positions.tsx     # 当前持仓：自动计算
│       │   ├── Statistics.tsx    # 统计分析：6种图表 + 12项指标
│       │   ├── AIReview.tsx      # AI复盘：流式输出、历史记录、笔记
│       │   └── Settings.tsx      # 设置：资金、费率、API Key、策略标签
│       ├── stores/
│       │   └── index.ts          # Zustand stores (trade, settings, stats, position)
│       └── utils/
│           └── electron.d.ts     # window.electronAPI 类型声明
```

## 架构要点

### 数据流
```
渲染进程 (React)
    ↓ window.electronAPI.xxx()
    ↓ (contextBridge + ipcRenderer.invoke)
主进程 IPC Handler
    ↓
Service 层 (业务逻辑)
    ↓
Database 层 (sql.js)
    ↓ 返回 { success: boolean, data?: T, error?: string }
渲染进程
```

### 数据库
- 使用 sql.js (纯WASM)，非 better-sqlite3（本机无MSVC编译工具）
- 数据库文件存储在 `app.getPath('userData')/stock-claude.db`
- 每次写操作后自动 `saveDb()` 持久化到磁盘
- 辅助函数：`queryAll(sql, params)` / `queryOne(sql, params)` / `execute(sql, params)`
- 迁移机制：`migrate.ts` 中的 `MIGRATIONS` 数组，按版本号递增

### 数据库表
1. **trades** - 交易记录（35个字段，含价格、仓位、策略、情绪、市场环境等）
2. **account_snapshots** - 每日账户快照
3. **ai_reviews** - AI复盘结果
4. **settings** - 键值对配置
5. **schema_version** - 迁移版本跟踪

### API Key 安全
- 使用 Electron `safeStorage.encryptString()` 加密存储
- 降级方案：加密不可用时明文存储

### AI 复盘流程
1. 前端选择复盘类型和日期范围 → `ai:reviewStart`
2. 主进程查询交易数据 + 统计概览
3. 组装 System Prompt（交易教练角色）+ User Prompt（数据表格）
4. 调用 Claude API 流式输出
5. 通过 `ai:reviewStream` 事件推送到前端实时渲染
6. 完成后存入 `ai_reviews` 表

## 常用命令

```bash
npm run build:main     # 编译主进程 TypeScript
npm run build:renderer # Vite 构建前端
npm run build          # 全量构建
npm run start:check    # 构建并启动（推荐）
npm start              # 启动 Electron（需先 build）
npm run dev            # 开发模式（tsc watch + vite dev server）
npm run dist           # 打包为 Windows 安装包
```

## 常见问题与解决方案

### 问题：启动后界面空白，无任何内容显示

**可能原因 1：TypeScript 编译错误**
- 主进程代码有语法错误或类型错误
- 表现：构建时终端有红色错误输出

**可能原因 2：前端模块加载顺序问题**
- antd 和 @ant-design/icons 分开打包导致加载顺序不确定
- 表现：`Cannot read properties of undefined (reading 'primary')`

**排查步骤**
1. 运行 `npm run build` 查看是否有编译错误
2. 如果有红色错误信息，修复后再构建
3. 检查 `vite.config.ts` 中的 `manualChunks` 配置

**当前配置（已修复）**
```typescript
// vite.config.ts - antd 和 icons 必须打包在一起
if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design/icons')) {
  return 'vendor-ui';
}
```

### 问题：TypeScript 导入错误

**常见错误**
- `Module has no exported member 'xxx'` - 导出函数名拼写错误
  - 检查：`getSettings` → 正确是 `getAllSettings`
  - 检查：`getPositions` → 在 stats-service 中是 async 函数
- `Property 'xxx' does not exist` - 属性名错误
  - 检查：`unrealized_pnl` → 正确是 `floating_pnl`

### 问题：运行时错误无提示

**解决：启动.bat 现在会自动检查构建状态**
- 修改后的 `启动.bat` 每次都会执行 `npm run build`
- 构建失败会显示错误信息并阻止启动
- 不会出现在没有错误提示的情况下界面空白

## 已完成功能

- [x] 交易录入（分层表单、快速模式、股票搜索、费用自动计算）
- [x] 交易列表（筛选、排序、盈亏着色、展开详情、CSV导出）
- [x] 当前持仓（根据交易记录自动计算）
- [x] 统计看板（收益曲线、盈亏分布、策略对比、情绪分析、月度收益、最大回撤）
- [x] AI复盘（日/周/月复盘、流式输出、历史记录、收藏、笔记）
- [x] 设置（初始资金、费率、API Key加密、AI模型选择、自定义策略/标签）
- [x] 首页看板（指标卡片 + 收益曲线 + 月度统计）

## 待优化方向

- [ ] 首次使用引导向导
- [ ] 股票代码表扩充（目前仅30只常见股票，可加载完整CSV）
- [ ] 交易编辑功能（目前只能删除）
- [ ] 日历热力图（Statistics页面中未实现）
- [ ] 情绪-胜率热力图
- [ ] 账户快照手动/自动录入
- [ ] 数据备份/恢复
- [ ] 深色模式
- [ ] 应用图标（resources/icon.ico 未提供）
- [ ] 性能优化：Vite代码分割减小bundle体积
- [ ] 单元测试

## 修改指南

### 添加新页面
1. 在 `src/renderer/pages/` 创建组件
2. 在 `src/renderer/App.tsx` 添加路由
3. 在 `src/renderer/components/Layout/AppLayout.tsx` 添加菜单项

### 添加新的数据库字段
1. 在 `src/shared/types.ts` 更新类型
2. 在 `src/main/database/migrate.ts` 添加新版本迁移
3. 更新相关 service 的查询

### 添加新的 IPC 通道
1. 在 `src/shared/ipc-channels.ts` 添加常量
2. 在 `src/main/services/` 实现业务逻辑
3. 在 `src/main/ipc/` 注册 handler
4. 在 `src/main/preload.ts` 暴露给渲染进程
5. 在 `src/renderer/utils/electron.d.ts` 更新类型声明
