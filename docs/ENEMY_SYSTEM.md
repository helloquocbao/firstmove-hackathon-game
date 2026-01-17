# Enemy System & Dynamic Difficulty

Hệ thống spawn quái và điều chỉnh độ khó dựa trên dữ liệu on-chain từ Sui blockchain.

## 📁 Files liên quan

| File                          | Mô tả                                                       |
| ----------------------------- | ----------------------------------------------------------- |
| `src/game/enemyMaintainer.ts` | Logic chính: fetch Sui data, tính difficulty, spawn quái    |
| `src/game/start.ts`           | Game engine: render quái, xử lý combat, tích hợp maintainer |
| `src/pages/GamePage.jsx`      | UI: hiển thị difficulty info, truyền data vào game          |

---

## 🎮 Flow tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUI BLOCKCHAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│  WorldMap Object          │  System State           │  Checkpoints  │
│  - difficulty: 1-9        │  - activeValidators     │  - txCount    │
│  - chunk_count            │  - totalStake           │  - gasPrice   │
│  - required_power         │  - epochDurationMs      │               │
└─────────────────────────────────────────────────────────────────────┘
                │                       │                    │
                ▼                       ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ENEMY MAINTAINER                                │
│                                                                      │
│  1. Fetch data từ Sui mỗi 10 giây                                   │
│  2. Tính Network Score (0-100) từ TX count + Gas price              │
│  3. Tính Validator Health (0-100) từ validators + stake             │
│  4. Tính Effective Difficulty = Base × Network × Validator          │
│  5. Nếu currentEnemies < targetEnemies → spawn 1 quái               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           GAME                                       │
│                                                                      │
│  - Goblins với HP, Damage, Speed theo difficulty                    │
│  - UI hiển thị: Network Status, Validator Health, Enemies count     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Difficulty Stats

### Base Stats theo Level (từ WorldMap on-chain)

| Level | Label     | HP  | Damage | Speed | Enemies/Chunk |
| ----- | --------- | --- | ------ | ----- | ------------- |
| 1     | Very Easy | 2   | 5      | 35    | 0.5           |
| 2     | Easy      | 3   | 8      | 40    | 0.8           |
| 3     | Normal    | 4   | 10     | 45    | 1.0           |
| 4     | Medium    | 5   | 12     | 50    | 1.2           |
| 5     | Hard      | 6   | 15     | 55    | 1.5           |
| 6     | Very Hard | 8   | 18     | 60    | 2.0           |
| 7     | Expert    | 10  | 22     | 65    | 2.5           |
| 8     | Master    | 15  | 28     | 70    | 3.0           |
| 9     | Nightmare | 20  | 35     | 75    | 4.0           |

### Network Score (Congestion)

Tính từ hoạt động network:

```typescript
txScore = min(50, txDelta / 40)           // 0-50 điểm từ số TX mới
gasScore = min(50, (gasPrice / 1000) × 10) // 0-50 điểm từ gas price
networkScore = txScore + gasScore          // 0-100
```

| Score  | Status       | Ý nghĩa                |
| ------ | ------------ | ---------------------- |
| 0-25   | 🟢 Quiet     | Ít giao dịch, gas thấp |
| 25-50  | 🟡 Normal    | Hoạt động bình thường  |
| 50-75  | 🟠 Busy      | Nhiều giao dịch        |
| 75-100 | 🔴 Very Busy | Congestion nặng        |

### Validator Health Score

Tính từ tình trạng validators:

```typescript
// Điểm từ số validators (0-50)
if (activeCount >= 100) score += 50;
else if (activeCount >= 80) score += 40;
// ...

// Điểm từ epoch progress (0-50)
if (epochProgress < 1.0) score += 50;
// ...
```

| Score  | Status      | Ý nghĩa           |
| ------ | ----------- | ----------------- |
| 80-100 | 🟢 Healthy  | Network ổn định   |
| 60-80  | 🟡 Good     | Tốt               |
| 40-60  | 🟠 Warning  | Cần chú ý         |
| 0-40   | 🔴 Critical | Network có vấn đề |

---

## 🔢 Công thức Effective Difficulty

```typescript
// Network Factor: 0.8 - 1.2
networkFactor = 0.8 + (networkScore / 100) × 0.4

// Validator Factor: 0.9 - 1.1
validatorFactor = 0.9 + (healthScore / 100) × 0.2

// Effective Difficulty (capped at 9)
effectiveDifficulty = min(9, baseDifficulty × networkFactor × validatorFactor)
```

### Ví dụ

| Scenario            | Base | Network  | Validator | Effective |
| ------------------- | ---- | -------- | --------- | --------- |
| Đêm khuya, ít người | 3    | 🟢 (0.8) | 🟢 (1.1)  | 2.64      |
| Giờ cao điểm        | 3    | 🟡 (1.0) | 🟢 (1.1)  | 3.30      |
| NFT mint event      | 3    | 🔴 (1.2) | 🟢 (1.1)  | 3.96      |
| Network có vấn đề   | 3    | 🟡 (1.0) | 🔴 (0.9)  | 2.70      |

---

## 🧩 Cách sử dụng

### 1. Khởi tạo EnemyMaintainer

```typescript
import {
  initEnemyMaintainer,
  EnemyConfig,
  DifficultyInfo,
} from "./enemyMaintainer";

const maintainer = initEnemyMaintainer({
  rpcUrl: "https://fullnode.testnet.sui.io:443",
  baseDifficulty: 3, // Từ WorldMap on-chain
  chunkCount: 5, // Số chunks trên map
  onSpawnEnemy: (config: EnemyConfig) => {
    // Spawn goblin với config.baseHp, config.baseDamage, config.baseSpeed
    spawnGoblin(x, y, config.baseHp, config.baseDamage, config.baseSpeed);
  },
  onDifficultyUpdate: (info: DifficultyInfo) => {
    // Update UI
    console.log(`Difficulty: ${info.effectiveDifficulty}`);
    console.log(`Network: ${info.networkStatus}`);
    console.log(`Validators: ${info.validatorStatus}`);
  },
});

// Start checking mỗi 10 giây
maintainer.start(10000);
```

### 2. Cập nhật số quái hiện tại

```typescript
// Gọi khi quái chết hoặc spawn
maintainer.updateEnemyCount(currentCount);
```

### 3. Dừng maintainer

```typescript
import { stopEnemyMaintainer } from "./enemyMaintainer";

// Khi scene kết thúc
stopEnemyMaintainer();
```

---

## 📡 Events

Game emit các events để UI có thể listen:

```typescript
// Khi difficulty thay đổi
window.addEventListener("game:difficulty-update", (event) => {
  const info = event.detail;
  // info.baseDifficulty
  // info.effectiveDifficulty
  // info.networkStatus
  // info.validatorStatus
  // info.currentEnemyCount
  // info.targetEnemyCount
});
```

---

## 🎯 Target Enemy Count

Số quái cần duy trì trên map:

```typescript
// Base từ difficulty
enemiesPerChunk = DIFFICULTY_STATS[baseDifficulty].enemiesPerChunk

// Điều chỉnh theo network
adjustedEnemiesPerChunk = enemiesPerChunk × (0.7 + (effectiveDifficulty / 9) × 0.6)

// Target count
targetEnemyCount = ceil(chunkCount × adjustedEnemiesPerChunk)

// Giới hạn max
targetEnemyCount = min(targetEnemyCount, min(20, chunkCount × 3))
```

---

## ⏱️ Timeline hoạt động

```
0s      10s     20s     30s     40s
│       │       │       │       │
▼       ▼       ▼       ▼       ▼
┌───────┬───────┬───────┬───────┬───────
│ Fetch │ Fetch │ Fetch │ Fetch │ Fetch    ← Lấy data từ Sui
│       │       │       │       │
│ Calc  │ Calc  │ Calc  │ Calc  │ Calc     ← Tính difficulty mới
│       │       │       │       │
│ Spawn?│       │ Spawn?│       │ Spawn?   ← Spawn 1 quái nếu cần
└───────┴───────┴───────┴───────┴───────
```

**Lưu ý:** Chỉ spawn **1 quái mỗi lần check** để tránh spam. Quái được spawn từ từ để cân bằng map.

---

## 🔧 Config Constants

```typescript
// enemyMaintainer.ts
const CHECK_INTERVAL = 10000; // 10 giây
const MAX_ENEMIES = 20; // Tối đa 20 quái trên map
const MIN_ENEMIES = 1; // Ít nhất 1 quái

// start.ts
const CHUNK_SIZE = 5; // 5x5 tiles per chunk
const TILE_SIZE = 32; // 32px per tile
```

---

## 🐛 Debug

Xem console để theo dõi:

```
[EnemyMaintainer] Current: 3/5 | Difficulty: 2.8 | Net: 35 | Val: 85
[Maintainer] Spawned goblin at (12, 8) HP:4 DMG:10
```

---

## 📝 Notes

1. **Difficulty từ WorldMap** được set khi admin tạo world (1-9)
2. **Network activity** làm game khó hơn nhưng reward cũng nhiều hơn
3. **Validator health** ảnh hưởng nhẹ (~10%)
4. **Spawn xa player** ít nhất 4 tiles để tránh bất ngờ
5. **Cleanup** khi scene kết thúc để tránh memory leak
