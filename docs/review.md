# 打牌记账小程序 — Code Review 报告

**审查日期：** 2026-04-04
**审查人：** 代码审查员
**结论：** ⚠️ 有问题需修复

---

## 一、构建结论 ✅

**Build 能跑。** `npm run build` 通过，产物 `dist/` 正常生成（171KB JS + 3.4KB CSS）。

---

## 二、核心算法审查

### 2.1 房间码生成 — `src/services/roomCode.ts` ✅ 正确

- `generateRoomId()` 生成 6 位数字，排除连号（123、321）、重复（111、222）
- `validateRoomId()` 正确实现了校验规则
- 逻辑清晰，防暴力猜测（上限100次重试）

### 2.2 结算算法 — `src/services/settlement.ts` ⚠️ 有缺陷

**问题：浮点数精度导致结算不准确**

```typescript
if (credit.balance <= 0.5) i++;
if (debit.balance >= -0.5) j++;
```

代码用 `0.5` 作为"几乎为零"的容差，但 `balance = currentScore - initialScore`，`initialScore` 默认 1000，`currentScore` 是整数（加分/扣分都是整数），所以 `balance` 本身就是整数，容差 `0.5` 永远不可能触发边界 bug。但：

- `scoreChanges` 里的金额是 `loserShare * winners.length`，即 `amount * winners.length / losers.length * losers.length / winners.length = amount`，这部分是整数没问题
- 但如果多人游戏（3赢家2输家，分数=每局amount），`loserShare = amount / losers.length` 可能是**非整数**（如 amount=10，3人平分≈3.33）
- `Math.round(amount)` 虽然最后会 round，但过程中 `credit.balance` 累加非整数，最后 `>= -0.5` 的判断可能出错

**验证：** `amount=10, 3 losers → loserShare=3.333...` → `scoreChanges` 累积后余额出现浮点误差，`while` 循环可能提前退出或无法终止。

**修复建议：** 全部金额用**整数分**存储和计算，底层以"分"为单位，最后展示时 /100，或在 `recordRound` 里确保 `scoreChanges` 全部为整数：

```typescript
// 修复：确保 loserShare 为整数（向上取整分配多余部分）
const loserShare = Math.ceil(amount / losers.length);
const winnerShare = Math.floor(amount / winners.length);
```

### 2.3 记牌积分算法 — `src/store/useRoomStore.ts` 的 `recordRound` ⚠️ 整数溢出风险

```typescript
scoreChanges[lid] = -(loserShare * winners.length);
scoreChanges[wid] = winnerShare * losers.length;
```

这里用 `Math.round` 缺失了——如果 `loserShare * winners.length` 不是整数，会变成负的非整数浮点，导致 `undoRound` 恢复时 `currentScore -= change` 会变成加上浮点误差。

---

## 三、数据流与状态管理审查

### 3.1 Zustand Store ✅ 基本正确

- `useRoomStore` 和 `useHistoryStore` 职责清晰
- 持久化依赖 `localStorage`，有 try/catch 保护

### 3.2 ⚠️ 严重 Bug：`currentRoom` 与 `rooms` 共享同一对象引用

```typescript
createRoom: ... set({ rooms, currentRoom: room });  // room 是引用
joinRoom: ... room.players.push(player); set({ rooms: [...get().rooms], currentRoom: room }); // room 仍然是引用
```

`room` 对象在 `get().rooms` 中也有一份，直接修改 `room.players` 会同时影响 store 内两个地方。虽然最终 `set()` 会触发更新，但存在**脏读风险**（如果 `set` 前读取 `get()` 可能拿到未更新的状态）。

**修复建议：** 创建新对象副本：

```typescript
const updatedRoom = { ...room, players: [...room.players, player] };
```

### 3.3 ⚠️ Bug：`removePlayer` 和 `leaveRoom` 逻辑不对称

- `removePlayer`：保留了空房间在 `rooms` 里
- `leaveRoom`：会过滤掉空房间（`filter(r => r.players.length > 0)`）

这会导致用 `removePlayer` 移除最后一个玩家后，房间仍存在（status=active），但没有人可以再进入。

### 3.4 ⚠️ Bug：`undoRound` 中 `currentRoom` 更新不完整

```typescript
undoRound: (roomId) => {
  const room = get().rooms.find(r => r.roomId === roomId);
  // ...
  room.rounds.pop()!;
  // ...
  set({ rooms: [...get().rooms], currentRoom: { ...room } }); // ⚠️ 这里 ...room 浅拷贝了 players，但 rounds 已被 pop
}
```

`room.rounds` 已经被 `pop()` 修改了，但 `{ ...room }` 中 `rounds` 仍是引用，问题不大因为都是同一引用。不过风格上不一致。

---

## 四、安全问题审查

### 4.1 XSS ✅ 安全

- React 默认转义，用户输入（昵称、房间名）都通过 JSX `{}` 渲染，无 `dangerouslySetInnerHTML`
- 房间码输入做了 `.replace(/\D/g, '')` 过滤

### 4.2 localStorage 注入 ✅ 无风险

- JSON 序列化/反序列化，无直接注入可能

### 4.3 房间码暴力破解 ⚠️ 风险低

- 6位数字校验，去掉连号重复后约 90 万种组合，100次/秒也需要约 2.5 小时，H5 场景可接受
- 无尝试次数限制，可考虑加 `joinRoom` 的调用频率限制

---

## 五、UX 问题审查

### 5.1 ⚠️ `HistoryDetailPage` 的 `recordId` 参数被忽略

```typescript
interface Props { recordId?: string | null; }
// ...
const record: GameRecord | undefined = records[0]; // ⚠️ 永远取第一条，不是 recordId 对应的那条
```

`recordId` prop 传入了但没有使用，`navigateTo('historyDetail', record.recordId)` 跳转到详情页时，永远显示 `records[0]`（最新一条），而不是传入的 `recordId` 对应的那条。

**修复建议：**
```typescript
const record: GameRecord | undefined = records.find(r => r.recordId === recordId);
```

### 5.2 ⚠️ 结算页跳转"查看详情"显示错误记录

`SettlementPage` 跳转到 `historyDetail` 时，`recordId` 参数没有传（`navigateTo('historyDetail')`），所以 `historyDetail` 也会显示 `records[0]`，而不是刚刚结算的那条。

### 5.3 ⚠️ `cursorPointer` 拼写错误

```tsx
<span style={{ color: '#FF6B6B', cursorPointer: 'pointer' }} ...>  // ❌ 应该是 cursor: 'pointer'
```

CSS 属性名错误，样式不生效。

### 5.4 `joinRoom` 错误提示不够精确

房间不存在和房间已结算（status=settled）都返回 `'房间不存在或已失效'`，用户无法区分。

### 5.5 结算按钮在无局数时不应可点击

```tsx
<button
  className={`btn ${room.rounds.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
  style={{ flex: 1 }}
  onClick={room.rounds.length > 0 ? handleSettle : undefined}  // ✅ 已处理
>
```

已正确处理。

---

## 六、其他代码问题

| 位置 | 问题 | 严重度 |
|------|------|--------|
| `types/index.ts` 底部 | `validateRoomId` 和 `generateRoomId` 写在 interface 文件里，应单独模块 | 低 |
| `useRoomStore` 多次 `set` | 每次操作都 `set` + `storage.set`，localStorage 写入频繁，可批量 | 低 |
| 无 loading 状态 | 创建/加入房间无异步 loading，用户感知差 | 低 |
| `navigateTo` 用 `window.location.hash` | 会触发页面刷新闪动，应改用 React state 路由 | 低 |
| `nanoid` 依赖 | 轻量，但 `generateId()` 可直接用 `Date.now().toString(36) + random` 去掉依赖 | 低 |

---

## 七、问题汇总

| # | 类别 | 位置 | 问题 | 严重度 |
|---|------|------|------|--------|
| 1 | 算法 | `settlement.ts` | 浮点精度：多人游戏时 `loserShare * winners.length` 可能非整数，while 循环边界判断不可靠 | **高** |
| 2 | 算法 | `useRoomStore.recordRound` | `scoreChanges` 可能为浮点数，`undoRound` 恢复时产生累积误差 | **高** |
| 3 | Bug | `HistoryDetailPage` | `recordId` prop 被忽略，永远显示 `records[0]` | **高** |
| 4 | Bug | `SettlementPage` | `navigateTo('historyDetail')` 未传 `recordId`，导致详情页显示错误记录 | **高** |
| 5 | Bug | `useRoomStore.removePlayer` | 空房间不过滤，与 `leaveRoom` 行为不一致 | 中 |
| 6 | Bug | `useRoomStore` | 直接修改 `room` 引用后再 `set`，同一对象在 `rooms` 和 `currentRoom` 中共享引用 | 中 |
| 7 | UX | `RoomPage` | `cursorPointer` 拼写错误，样式无效 | 低 |

---

## 八、修复优先级

1. **P0（必须修复）**：Issue #1、#2 — 浮点精度会导致结算金额错误
2. **P0（必须修复）**：Issue #3、#4 — 历史详情页数据错误，用户体验严重受损
3. **P1（建议修复）**：Issue #5、#6 — 状态管理不一致
4. **P2（可选）**：Issue #7 及其他低优先级改进

---

## 九、最终结论

> **有问题需修复（P0 级别 2 项，P1 级别 2 项）**

核心算法在单局整数金额下正确，但**多人非整数金额场景下存在浮点精度风险**；最严重的是**历史详情页的 `recordId` 永远被忽略**，用户点"查看详情"看到的是错误记录。修复 P0 问题后可通过复审。
