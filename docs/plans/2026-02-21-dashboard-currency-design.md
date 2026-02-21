# Dashboard 统一货币口径 Design

**日期:** 2026-02-21  
**范围:** 仅首页看板 `Dashboard`

## 目标
- 首页各面板都提供货币口径控制按钮。
- 任一面板修改后，所有面板口径实时同步。
- 用户选择持久化到本地，重启应用后自动恢复。
- 无历史配置时默认 `USD`。

## 方案
- 在 `Dashboard.tsx` 内维护单一 `displayCurrency` 状态（`USD | HKD | CNY`）。
- 通过本地 `localStorage` 持久化键（如 `dashboard.currencyCode`）。
- 抽取可复用 `CurrencyControl` 控件，在每个看板面板 `Card.extra` 渲染同一组控件。
- 复用 `Positions` 的汇率换算逻辑（基于 `quote.getFxRates`）。
- 金额类字段按目标口径转换后展示；百分比和次数类保持原值。

## 数据与计算
- 通过 `trade.list(direction=SELL)` 拉取已平仓记录，按市场货币换算后重算：
  - 总盈亏
  - 收益曲线（daily/cumulative）
  - 月度盈亏柱
- 通过 `position.list` 的市场字段换算浮动盈亏。

## 容错
- 汇率请求失败时：保留上次汇率；若无可用汇率则退化为原值显示。

## 测试点
- 无配置时默认 USD。
- 页面含多个“货币口径”控制，操作任一控制会同步更新。
- 切换币种后金额和货币符号更新。
- 切换后本地持久化，重载后恢复。
