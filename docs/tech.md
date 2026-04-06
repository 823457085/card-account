# 打牌记账小程序 — 技术方案

## 1. 技术栈选型

### 1.1 首选方案：微信小程序原生开发

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | 微信小程序原生框架 | 稳定、成熟，符合产品定位 |
| 开发语言 | TypeScript | 类型安全，便于维护 |
| UI 组件 | 原生组件 + 自定义组件 | 减少包体积 |
| 状态管理 | MobX-mini / 响应式 API | 轻量够用 |
| 本地存储 | wx.setStorage / wx.getStorage | 键值对存储 |
| 云能力（可选） | 微信云开发 | 未来云同步用，当前 MVP 暂不接入 |
| 构建工具 | 微信开发者工具内置 | - |
| 包管理 | npm（小程序支持） | - |

### 1.2 备选方案：H5 应用

如需跨平台（网页、小程序双端），可考虑：

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | UniApp / Taro | 一套代码多端运行 |
| 开发语言 | TypeScript | - |
| UI 组件 | Vant Weapp / uView | 适配小程序端 |

> **建议**：MVP 阶段采用微信小程序原生开发，快速交付。后续如需跨平台再迁移。

---

## 2. 数据库设计（本地存储）

### 2.1 数据持久化策略

- 使用 `wx.setStorageSync` / `wx.getStorageSync` 进行同步读写
- 按数据类型分键存储，避免单键过大
- 房间数据按 roomId 隔离，支持多人本地协同

### 2.2 存储结构

```typescript
// === 键名设计 ===

// 游戏房间列表
STORAGE_KEYS = {
  ROOMS: 'card_account_rooms',        // Room[]
  CURRENT_ROOM: 'card_account_current_room', // string (roomId)
  GAME_RECORDS: 'card_account_records', // GameRecord[]
  PLAYER_PROFILES: 'card_account_profiles', // PlayerProfile[]
}
```

### 2.3 数据模型（TypeScript）

```typescript
// ---------- 枚举 ----------

enum GameType {
  MAHJONG = 'mahjong',      // 麻将
  DOUDIZHU = 'doudizhu',    // 斗地主
  GUIDAN = 'guidan',        // 掼蛋
  CUSTOM = 'custom',        // 自定义
}

enum RoomStatus {
  IN_PROGRESS = 'in_progress',
  SETTLED = 'settled',
}

enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

// ---------- 实体 ----------

interface Player {
  playerId: string;        // UUID
  name: string;            // 昵称 4-8字符
  avatarColor: string;     // 头像背景色（随机分配）
  currentScore: number;    // 当前累计分数
  createdAt: number;       // 时间戳
}

interface Room {
  roomId: string;          // 6位数字房间码
  name: string;            // 房间名称
  gameType: GameType;      // 玩法类型
  initialScore: number;    // 初始分数，默认 1000
  unitAmount: number;      // 单位金额（元），默认 1
  players: Player[];        // 玩家列表
  rounds: Round[];          // 所有局记录
  status: RoomStatus;       // 房间状态
  createdAt: number;       // 创建时间
  updatedAt: number;       // 更新时间
  creatorId: string;        // 创建者 playerId
}

interface Round {
  roundId: string;         // UUID
  roundNumber: number;      // 局号（1, 2, 3...）
  winners: string[];       // 赢家 playerId 列表
  losers: string[];        // 输家 playerId 列表
  amount: number;          // 金额
  settledItems: SettlementItem[]; // 计算后的应付明细
  createdAt: number;       // 记牌时间
}

interface SettlementItem {
  from: string;            // 付款方 playerId
  to: string;              // 收款方 playerId
  amount: number;          // 金额
}

interface GameRecord {
  recordId: string;        // UUID
  roomSnapshot: Omit<Room, 'rounds'>; // 房间快照（不含局列表）
  finalScores: { playerId: string; name: string; score: number }[]; // 最终排名
  totalRounds: number;     // 总局数
  settlements: SettlementItem[]; // 最终结算明细
  startedAt: number;       // 开始时间
  endedAt: number;         // 结束时间
  duration: number;        // 持续时长（毫秒）
}

interface PlayerProfile {
  playerId: string;        // UUID
  name: string;            // 历史昵称（用于快速加入）
  avatarColor: string;     // 头像颜色
  playCount: number;       // 累计游戏次数
  totalWin: number;        // 累计净胜分
}
```

### 2.4 本地存储分区

| 键名 | 数据类型 | 说明 | 生命周期 |
|------|----------|------|----------|
| `card_account_rooms` | `Room[]` | 所有进行中的房间 | 手动删除或结算后归档 |
| `card_account_records` | `GameRecord[]` | 历史战局（最多保留100条） | 永久 |
| `card_account_profiles` | `PlayerProfile[]` | 玩家档案 | 永久 |
| `card_account_settings` | `Settings` | 用户设置 | 永久 |

---

## 3. 核心模块与接口设计

### 3.1 模块划分

```
src/
├── pages/              # 页面
│   ├── index/           # 首页
│   ├── room/            # 房间页（游戏进行中）
│   ├── settlement/      # 结算页
│   ├── history/         # 历史战局列表
│   └── record-detail/   # 战局详情
├── components/          # 自定义组件
│   ├── player-card/     # 玩家卡片
│   ├── score-input/     # 分数输入
│   ├── round-list/      # 局记录列表
│   └── settlement-view/ # 结算视图
├── services/            # 业务逻辑层
│   ├── room.service.ts       # 房间管理
│   ├── round.service.ts       # 记牌逻辑
│   ├── settlement.service.ts  # 结算算法
│   ├── storage.service.ts     # 本地存储封装
│   └── room-code.service.ts   # 房间码生成与验证
├── utils/               # 工具函数
│   ├── uuid.ts          # UUID 生成
│   ├── calculator.ts    # 算账工具
│   └── validator.ts     # 验证规则
├── types/               # TypeScript 类型定义
│   └── index.ts
└── constants/           # 常量
    └── index.ts
```

### 3.2 核心接口（Service 层）

#### 3.2.1 房间服务 `RoomService`

```typescript
class RoomService {
  // 创建房间
  createRoom(params: {
    name: string;
    gameType: GameType;
    initialScore?: number;
    unitAmount?: number;
    creatorName: string;
  }): Room;

  // 根据房间码加入房间
  joinRoom(roomId: string, playerName: string): Room;

  // 获取房间信息
  getRoom(roomId: string): Room | null;

  // 离开房间
  leaveRoom(roomId: string, playerId: string): void;

  // 获取所有进行中的房间
  getAllRooms(): Room[];

  // 删除房间
  deleteRoom(roomId: string): void;
}
```

#### 3.2.2 记牌服务 `RoundService`

```typescript
class RoundService {
  // 记牌（创建新局）
  addRound(params: {
    roomId: string;
    winners: string[];   // 赢家 playerId 列表
    losers: string[];     // 输家 playerId 列表
    amount: number;       // 金额
  }): Round;

  // 获取房间所有局记录
  getRounds(roomId: string): Round[];

  // 撤销上一局（允许撤回最近一条）
  undoRound(roomId: string): boolean;
}
```

#### 3.2.3 结算服务 `SettlementService`

```typescript
class SettlementService {
  // 计算单局应付明细（最小转账算法）
  calculateRoundSettlement(
    players: Player[],
    winners: string[],
    losers: string[],
    amount: number
  ): SettlementItem[];

  // 计算最终结算（汇总所有局）
  calculateFinalSettlement(room: Room): {
    finalScores: { playerId: string; score: number }[];
    settlements: SettlementItem[];
  };

  // 归档战局到历史记录
  archiveGameRecord(room: Room): GameRecord;
}
```

#### 3.2.4 房间码服务 `RoomCodeService`

```typescript
class RoomCodeService {
  // 生成合规的6位房间码
  generateRoomCode(): string;

  // 校验房间码合法性
  validateRoomCode(code: string): boolean;

  // 校验规则：
  // 1. 6位纯数字
  // 2. 不以0开头
  // 3. 不允许连续三位递增/递减（如123、321）
  // 4. 不允许三位重复（如111、000）
}
```

### 3.3 页面间跳转协议

| 跳转场景 | 路径 | 参数 |
|----------|------|------|
| 首页 → 创建房间 | `/pages/room/room` | `?mode=create&gameType=mahjong` |
| 首页 → 加入房间 | `/pages/room/room` | `?mode=join&roomId=384721` |
| 首页 → 历史战局 | `/pages/history/history` | - |
| 房间 → 结算页 | `/pages/settlement/settlement` | `?roomId=384721` |
| 历史 → 战局详情 | `/pages/record-detail/record-detail` | `?recordId=uuid` |

---

## 4. 目录结构

```
card-account/
├── project.config.json       # 微信小程序项目配置
├── app.js                    # 应用入口
├── app.json                  # 全局配置
├── app.wxss                  # 全局样式
├── pages/
│   ├── index/
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   ├── room/
│   │   ├── room.js
│   │   ├── room.wxml
│   │   ├── room.wxss
│   │   └── room.json
│   ├── settlement/
│   │   ├── settlement.js
│   │   ├── settlement.wxml
│   │   ├── settlement.wxss
│   │   └── settlement.json
│   ├── history/
│   │   ├── history.js
│   │   ├── history.wxml
│   │   ├── history.wxss
│   │   └── history.json
│   └── record-detail/
│       ├── record-detail.js
│       ├── record-detail.wxml
│       ├── record-detail.wxss
│       └── record-detail.json
├── components/
│   ├── player-card/
│   │   ├── player-card.js
│   │   ├── player-card.wxml
│   │   └── player-card.wxss
│   ├── score-board/
│   │   ├── score-board.js
│   │   ├── score-board.wxml
│   │   └── score-board.wxss
│   └── settlement-summary/
│       ├── settlement-summary.js
│       ├── settlement-summary.wxml
│       └── settlement-summary.wxss
├── services/
│   ├── storage.service.js
│   ├── room.service.js
│   ├── round.service.js
│   ├── settlement.service.js
│   └── room-code.service.js
├── utils/
│   ├── uuid.js
│   ├── calculator.js
│   └── validator.js
├── types/
│   └── index.js
└── constants/
    └── index.js
```

---

## 5. 关键算法

### 5.1 最小转账结算算法

```javascript
/**
 * 计算最小转账路径
 * @param {Array} players - 玩家列表（含最终分数）
 * @param {number} initialScore - 初始分数
 * @returns {Array} 转账明细列表 [{from, to, amount}]
 */
function calculateMinTransfers(players, initialScore) {
  // 1. 计算每人差值
  const balances = players.map(p => ({
    playerId: p.playerId,
    balance: p.currentScore - initialScore
  }));

  // 2. 分离应收和应付
  const receivables = balances.filter(b => b.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const payables = balances.filter(b => b.balance < 0)
    .sort((a, b) => a.balance - b.balance); // 负数从小到大（绝对值从大到小）

  const transfers = [];

  // 3. 贪心配对
  let i = 0, j = 0;
  while (i < receivables.length && j < payables.length) {
    const receivable = receivables[i];
    const payable = payables[j];

    const amount = Math.min(receivable.balance, Math.abs(payable.balance));

    if (amount > 0) {
      transfers.push({
        from: payable.playerId,
        to: receivable.playerId,
        amount: amount
      });
    }

    receivable.balance -= amount;
    payable.balance += amount; // 负数增加（绝对值减小）

    if (receivable.balance === 0) i++;
    if (Math.abs(payable.balance) === 0) j++;
  }

  return transfers;
}
```

### 5.2 单局分数计算

```javascript
/**
 * 计算单局每个人的分数变化
 * @param {Array} players - 所有玩家
 * @param {Array} winners - 赢家 playerId 列表
 * @param {Array} losers - 输家 playerId 列表
 * @param {number} amount - 金额
 * @returns {Map} playerId -> scoreDelta
 */
function calculateRoundScoreDelta(players, winners, losers, amount) {
  const deltaMap = new Map();
  players.forEach(p => deltaMap.set(p.playerId, 0));

  const winnerCount = winners.length;
  const loserCount = losers.length;

  if (winnerCount === 1 && loserCount === 1) {
    // 1v1：输家付给赢家全部金额
    deltaMap.set(winners[0], amount);
    deltaMap.set(losers[0], -amount);
  } else if (winnerCount === 1 && loserCount > 1) {
    // 1 vs 多：输家们平分付给赢家
    const perLoser = amount / loserCount;
    winners.forEach(w => deltaMap.set(w, amount));
    losers.forEach(l => deltaMap.set(l, -perLoser));
  } else if (winnerCount > 1 && loserCount === 1) {
    // 多 vs 1：输家付给赢家们平分
    const perWinner = amount / winnerCount;
    winners.forEach(w => deltaMap.set(w, perWinner));
    losers.forEach(l => deltaMap.set(l, -amount));
  } else {
    // 多 vs 多：按人数比例分摊
    const totalPlayers = winnerCount + loserCount;
    winners.forEach(w => deltaMap.set(w, amount * loserCount / totalPlayers));
    losers.forEach(l => deltaMap.set(l, -amount * winnerCount / totalPlayers));
  }

  return deltaMap;
}
```

---

## 6. 风险与注意事项

### 6.1 当前风险

| 风险 | 影响 | 应对 |
|------|------|------|
| 本地存储容量限制 | 微信小程序单个 key 上限 10MB | 历史记录最多保留 100 条，超出后自动清理旧记录 |
| 房间码冲突 | 同一设备同一时间只能进入一个房间 | 退出房间前不允许创建新房间 |
| 多设备同步缺失 | MVP 为纯本地存储，换设备数据丢失 | 未来可通过微信云开发实现同步 |
| 数据导出格式 | 暂无标准格式 | MVP 阶段导出为文本摘要 |

### 6.2 未来扩展点

1. **云同步**：接入微信云开发，房间数据实时同步
2. **扫码加入**：利用微信小程序码能力
3. **分享卡片**：生成分享图片到朋友圈/群
4. **多种玩法模板**：预设规则模板

---

## 7. 开发里程碑

| 阶段 | 内容 | 交付物 |
|------|------|--------|
| M1 | 项目初始化、页面框架、基础组件 | 可运行的空页面 |
| M2 | 房间服务、创建/加入房间 | 房间管理可用 |
| M3 | 记牌服务、实时排名 | 核心游戏流程跑通 |
| M4 | 结算服务、历史记录 | 完整 MVP |
| M5 | 单元测试、细节优化 | 交付 |

---

*文档版本：v1.0*
*最后更新：2026-04-04*
