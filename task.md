# Stock Claude Development OS

最后更新: 2026-02-21
唯一业务主文档: `task.md`
历史需求归档: `archive/PRD_2026-02-18.archived.txt`

## 1. Machine Board (固定格式，AI/人工共用)

状态枚举: `TODO | DOING | BLOCKED | DONE`

| ID | Status | Priority | Area | Task | Owner | Updated | VerifyCmd |
|---|---|---|---|---|---|---|---|
| T-001 | DONE | P0 | NewTrade | 实时价点击可回填且失败不覆盖输入 | codex/longport-api + codex/electron-ui | 2026-02-21 | npm run test:run |
| T-002 | DONE | P0 | Dashboard/Stats | 重点持仓名称 + 连盈连亏 + 总盈亏口径修复 | codex/data-pipeline + codex/electron-ui | 2026-02-21 | npm run test:run |
| T-003 | DONE | P1 | TradeLog | 日期排序切换 + 总价格列 + 手续费列 | codex/data-pipeline + codex/electron-ui | 2026-02-21 | npm run test:run |
| T-004 | DONE | P1 | Positions/Quote | 当前价与联动修复 + 排序 + 首次买入时间重置 | codex/data-pipeline + codex/electron-ui + codex/longport-api | 2026-02-21 | npm run test:run |
| T-005 | DONE | P2 | Statistics | 月/日粒度切换 + 盈亏折线图 | codex/data-pipeline + codex/electron-ui | 2026-02-21 | npm run test:run |

## 2. Hard Rules (强约束)

1. 单一信息源: 任务状态、优先级、验收标准只更新 `task.md`。
2. 并行规则: 默认任一时刻最多 1 个任务为 `DOING`；显式启用 `/MUTITASK` 时允许多个 `DOING`，但每个 `DOING` 必须绑定独立 `Owner`(分支/工作树) 且影响文件集不重叠。
3. 文档防分叉: 根目录只允许 `AGENTS.md` 与 `task.md` 两个 Markdown 文件。
4. 新文档策略: 需求背景或历史记录一律放 `archive/`，优先使用 `.txt`。
5. 开发顺序: `P0 -> P1 -> P2`，除非明确标注阻塞原因。

## 3. Scope and Acceptance (逐任务定义)

### T-001 新建交易实时价点击不生效

- 影响文件:
  - `src/renderer/pages/NewTrade.tsx`
  - `src/main/ipc/quote-handlers.ts`
  - `src/main/services/quote-service.ts`
- 验收标准:
  - 点击实时价后，`price` 字段立即更新。
  - 请求失败有可见提示，且不清空已有输入。

### T-002 首页看板数据正确性修复

- 影响文件:
  - `src/renderer/pages/Dashboard.tsx`
  - `src/main/services/stats-service.ts`
  - `src/main/services/account-service.ts`
- 验收标准:
  - 重点持仓显示“代码 + 名称”。
  - 连盈/连亏和交易流水核对一致。
  - 总盈亏按统一口径可复算。

### T-003 交易日志排序和字段增强

- 影响文件:
  - `src/renderer/pages/TradeLog.tsx`
  - `src/main/services/trade-service.ts`
- 验收标准:
  - 日期支持正序/倒序切换并定义默认排序。
  - 新增总价格列、佣金列、印花税列、总费用列。
  - CSV 导出字段与页面一致。

### T-004 当前持仓行情与排序修复

- 影响文件:
  - `src/renderer/pages/Positions.tsx`
  - `src/main/services/stats-service.ts`
  - `src/main/services/quote-service.ts`
- 验收标准:
  - 当前市值、浮动盈亏等字段可排序。
  - 行情价格与源数据一致，失败有兜底提示。
  - 清仓后再买入时，首次买入时间按新持仓周期重置。

### T-005 月度统计支持日度切换和图表逻辑调整

- 影响文件:
  - `src/renderer/pages/Statistics.tsx`
  - 相关统计聚合逻辑
- 验收标准:
  - 支持月/日粒度切换。
  - 盈亏金额为折线图，交易次数逻辑保持一致。

## 4. Data Contracts (不可歧义口径)

### 4.1 总盈亏

- 日净值定义: `daily_equity = close_market_value + cash`。
- 总盈亏定义: `total_pnl = latest_daily_equity - initial_capital`。
- 总收益率定义: `total_return = total_pnl / initial_capital`。
- 展示复用: 所有页面必须调用同一计算入口，不允许页面内重复实现。

### 4.2 连盈/连亏

- 序列范围: 仅统计已平仓交易(`SELL`)。
- 序列排序: `trade_date ASC, created_at ASC, id ASC`。
- 盈亏字段: 使用净盈亏值(必须扣除手续费；若 `realized_pnl` 非净值，先统一归一化)。
- 判定规则:
  - `net_pnl > 0` 记为赢。
  - `net_pnl < 0` 记为亏。
  - `net_pnl = 0` 记为平，且中断连盈/连亏计数。

## 5. Runbook (每次开发必走)

1. 将目标任务状态改为 `DOING`，并更新 `Updated` 日期。
2. 实现最小闭环(代码 + 必要测试)。
3. 执行验证命令并记录关键结果。
4. 任务改为 `DONE` 或 `BLOCKED`，注明阻塞原因/后续动作。
5. 执行治理检查:
   - `powershell -ExecutionPolicy Bypass -File scripts/check-task-board.ps1`
   - `powershell -ExecutionPolicy Bypass -File scripts/check-doc-policy.ps1`

## 6. Test Strategy (完整测试策略)

### 6.1 Unit Tests (核心算法)

- 必测:
  - 总盈亏口径计算。
  - 连盈/连亏计算(含 `net_pnl = 0` 边界)。
  - 清仓后再买入的首次买入时间重置。
  - 手续费/净盈亏归一化。

### 6.2 Integration Tests (IPC + Service + DB)

- 必测:
  - NewTrade 实时价回填链路(渲染层 -> IPC -> 服务层)。
  - TradeLog 排序与字段一致性。
  - Positions 行情拉取成功/失败兜底。
  - Statistics 月/日粒度聚合一致性。

### 6.3 Traversal / E2E (发布前遍历)

- 必测链路:
  - 新建交易 -> 交易日志 -> 当前持仓 -> 统计 -> 首页看板。
  - 导入 -> 校验 -> 入库 -> 展示。
  - 备份 -> 恢复 -> 关键数据抽查。
- 异常遍历:
  - 行情接口失败。
  - 空数据集。
  - 非法数据/缺字段导入。

## 7. Release Gate (发布门禁，必须全通过)

1. 自动化通过:
   - `npm run test:run`
   - `npm run build`
   - `powershell -ExecutionPolicy Bypass -File scripts/check-task-board.ps1`
   - `powershell -ExecutionPolicy Bypass -File scripts/check-doc-policy.ps1`
2. 人工遍历通过:
   - 本文件 `8. Traversal Checklist` 全部勾选。
3. 缺陷门禁:
   - `Blocker = 0`，`High = 0`。
4. 数据口径抽检:
   - 总盈亏、连盈连亏至少各抽检 3 组样本，结果一致。

## 8. Traversal Checklist (人工遍历清单)

### 8.1 交易录入

- [ ] 点击实时价后可回填价格。
- [ ] 行情失败时有提示且不覆盖用户输入。
- [ ] 费用、总额计算结果正确。

### 8.2 交易日志

- [ ] 日期排序可正序/倒序切换。
- [ ] 总价格/手续费列显示正确。
- [ ] CSV 导出与页面字段一致。

### 8.3 当前持仓

- [ ] 当前价格与行情源一致。
- [ ] 当前市值/浮盈字段排序正确。
- [ ] 清仓后再买入时首次买入时间重置正确。

### 8.4 统计与看板

- [ ] 月/日粒度切换正确，图表含义一致。
- [ ] 总盈亏可按统一口径复算。
- [ ] 连盈/连亏显示与流水一致。

### 8.5 数据管理

- [ ] 导入成功/失败统计准确。
- [ ] 备份后可恢复并通过关键字段抽查。

## 9. Commands

```bash
npm run build
npm run test:run
npm run dev
powershell -ExecutionPolicy Bypass -File scripts/check-task-board.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-doc-policy.ps1
powershell -ExecutionPolicy Bypass -File scripts/release-gate.ps1
```

## 10. Change Log

### 2026-02-21

- 启用 `task.md` 作为唯一业务主文档。
- PRD 迁移至 `archive/PRD_2026-02-18.archived.txt`。
- 引入 Machine Board + Hard Rules + Data Contracts。
- 增加完整测试策略、发布门禁与人工遍历清单。
- 并行规则更新: 默认单 `DOING`，`/MUTITASK` 模式允许多 `DOING`（需独立 Owner 与非重叠文件集）。
