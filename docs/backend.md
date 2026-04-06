# 打牌记账小程序 — 后端技术方案

## 1. 技术栈选型

| 层级 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js 22 | LTS，稳定 |
| 框架 | Express 4 | 轻量、路由成熟，中间件生态丰富 |
| 数据库 | SQLite + better-sqlite3 | 同步 API，单文件存储，适合本地/轻量部署 |
| WebSocket | ws | 配合 Express，最轻量的 WS 库 |
| 语言 | TypeScript | 类型安全 |
| 构建 | tsx（开发） / tsc（生产） | 直接运行 TS，无需编译步骤 |

> 如需部署到生产环境，换 PostgreSQL + Prisma 即可，SQLite 同接口兼容。

---

## 2. 数据库设计

SQLite 文件：`backend/data/card-account.db`

### 表结构

```sql
-- 玩家档案（跨房间持久化）
CREATE TABLE player_profiles (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  play_count INTEGER DEFAULT 0,
  total_win INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 房间（进行中）
CREATE TABLE rooms (
  room_id TEXT PRIMARY KEY,      -- 6位数字房间码
  name TEXT NOT NULL,
  game_type TEXT NOT NULL,       -- mahjong|doudizhu|guidan|custom
  initial_score INTEGER DEFAULT 1000,
  unit_amount REAL DEFAULT 1.0,
  creator_id TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',  -- in_progress|settled
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 玩家（房间成员）
CREATE TABLE players (
  player_id TEXT PRIMARY KEY,    -- UUID
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  current_score INTEGER DEFAULT 1000,
  is_active INTEGER DEFAULT 1,   -- 1=在场，0=已离开
  joined_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

-- 局记录
CREATE TABLE rounds (
  round_id TEXT PRIMARY KEY,     -- UUID
  room_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  winners TEXT NOT NULL,         -- JSON: playerId[]
  losers TEXT NOT NULL,          -- JSON: playerId[]
  amount REAL NOT NULL,
  settled_items TEXT NOT NULL,   -- JSON: SettlementItem[]
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

-- 最终结算（结算后写入）
CREATE TABLE settlements (
  settlement_id TEXT PRIMARY KEY,
  room_id TEXT UNIQUE NOT NULL,
  final_scores TEXT NOT NULL,    -- JSON: {playerId, name, score}[]
  settlements TEXT NOT NULL,      -- JSON: SettlementItem[]
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration INTEGER NOT NULL,      -- ms
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

-- 历史战局（归档）
CREATE TABLE game_records (
  record_id TEXT PRIMARY KEY,
  room_snapshot TEXT NOT NULL,   -- JSON: Omit<Room,'rounds'>
  final_scores TEXT NOT NULL,    -- JSON
  total_rounds INTEGER NOT NULL,
  settlements TEXT NOT NULL,     -- JSON
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX idx_players_room ON players(room_id);
CREATE INDEX idx_rounds_room ON rounds(room_id);
CREATE INDEX idx_game_records_started ON game_records(started_at DESC);
```

### 数据模型映射

```typescript
// 类型同 docs/tech.md，保持一致
enum GameType { MAHJONG, DOUDIZHU, GUIDAN, CUSTOM }
enum RoomStatus { IN_PROGRESS, SETTLED }

interface Player { playerId, name, avatarColor, currentScore, createdAt }
interface Room { roomId, name, gameType, initialScore, unitAmount, players, rounds, status, createdAt, updatedAt, creatorId }
interface Round { roundId, roomId, roundNumber, winners, losers, amount, settledItems, createdAt }
interface SettlementItem { from, to, amount }
interface GameRecord { recordId, roomSnapshot, finalScores, totalRounds, settlements, startedAt, endedAt, duration, createdAt }
```

---

## 3. 核心 API

Base URL: `http://localhost:3000/api`

### 3.1 房间

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/rooms` | 创建房间 |
| GET | `/rooms/:roomId` | 获取房间详情（含成员、局记录） |
| POST | `/rooms/:roomId/join` | 加入房间 |
| POST | `/rooms/:roomId/leave` | 离开房间 |
| GET | `/rooms` | 列出所有进行中房间 |
| DELETE | `/rooms/:roomId` | 删除房间（仅创建者） |
| POST | `/rooms/:roomId/settle` | 结算房间 |

### 3.2 记牌

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/rooms/:roomId/rounds` | 记一局 |
| DELETE | `/rooms/:roomId/rounds/last` | 撤销最后一局 |

### 3.3 历史

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/records` | 历史战局列表（分页） |
| GET | `/records/:recordId` | 战局详情 |

### 3.4 玩家

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/profiles/:playerId` | 获取玩家档案 |
| PUT | `/profiles/:playerId` | 更新昵称 |

---

## 4. WebSocket 实时同步

### 连接

```
ws://localhost:3000/ws?playerId=xxx&roomId=xxx
```

### 认证

首次连接需在 5 秒内发送 `auth` 消息，否则断开：
```json
{ "type": "auth", "playerId": "xxx", "roomId": "xxx" }
```

### 服务端 → 客户端消息

| event | 触发场景 | payload |
|-------|---------|---------|
| `room:update` | 房间信息变更（成员变化、记牌） | 完整 Room 对象 |
| `room:deleted` | 房间被删除 | `{ roomId }` |
| `player:joined` | 新玩家加入 | Player |
| `player:left` | 玩家离开 | `{ playerId }` |
| `round:added` | 新增一局 | Round |
| `round:undone` | 撤销一局 | `{ roundId }` |
| `room:settled` | 房间结算完成 | `{ roomId, settlements }` |
| `error` | 操作失败 | `{ code, message }` |

### 客户端 → 服务端消息

| type | 说明 |
|------|------|
| `auth` | 认证（必须首个发送） |
| `ping` | 心跳（每 30s 发一次） |

---

## 5. 目录结构

```
backend/
├── data/                    # SQLite 数据文件
│   └── card-account.db
├── src/
│   ├── index.ts             # 入口（HTTP + WS 启动）
│   ├── routes/
│   │   ├── room.routes.ts   # 房间相关路由
│   │   ├── round.routes.ts  # 记牌路由
│   │   ├── record.routes.ts # 历史路由
│   │   └── profile.routes.ts
│   ├── services/
│   │   ├── room.service.ts
│   │   ├── round.service.ts
│   │   ├── settlement.service.ts
│   │   ├── record.service.ts
│   │   └── room-code.service.ts
│   ├── models/
│   │   └── db.ts            # SQLite 连接 + 初始化
│   ├── middleware/
│   │   └── error.middleware.ts
│   ├── utils/
│   │   ├── calculator.ts    # 最小转账、单局分数
│   │   └── uuid.ts          # UUID 生成
│   └── types.ts             # 共享类型（Room/Player/Round...）
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. 启动方式

```bash
cd backend
npm install
npm run dev       # 开发模式（tsx watch）
npm run build     # 编译
npm start         # 生产模式
# 服务：http://localhost:3000
# WebSocket：ws://localhost:3000/ws
```

---

*文档版本：v1.0*
*最后更新：2026-04-04*
