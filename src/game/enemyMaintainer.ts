import { SuiClient } from "@mysten/sui/client";

export interface EnemyConfig {
  baseHp: number;
  baseDamage: number;
  baseSpeed: number;
}

export interface MaintainerConfig {
  rpcUrl: string;
  baseDifficulty: number; // 1-9 từ WorldMap
  chunkCount: number; // Số chunks trên map
  onSpawnEnemy: (config: EnemyConfig) => void; // Callback spawn 1 quái
  onDifficultyUpdate?: (info: DifficultyInfo) => void;
}

export interface DifficultyInfo {
  baseDifficulty: number;
  networkScore: number; // 0-100
  validatorHealth: number; // 0-100
  effectiveDifficulty: number;
  targetEnemyCount: number; // Số quái cần duy trì
  currentEnemyCount: number;
  networkStatus: string;
  validatorStatus: string;
}

// Base stats theo difficulty (balanced for fun gameplay)
const DIFFICULTY_STATS = {
  1: { hp: 2, damage: 5, speed: 35, enemiesPerChunk: 0.5 }, // Very Easy
  2: { hp: 3, damage: 8, speed: 40, enemiesPerChunk: 0.8 }, // Easy
  3: { hp: 4, damage: 10, speed: 45, enemiesPerChunk: 1 }, // Normal
  4: { hp: 5, damage: 12, speed: 50, enemiesPerChunk: 1.2 }, // Medium
  5: { hp: 6, damage: 15, speed: 55, enemiesPerChunk: 1.5 }, // Hard
  6: { hp: 8, damage: 18, speed: 60, enemiesPerChunk: 2 }, // Very Hard
  7: { hp: 10, damage: 22, speed: 65, enemiesPerChunk: 2.5 }, // Expert
  8: { hp: 15, damage: 28, speed: 70, enemiesPerChunk: 3 }, // Master
  9: { hp: 20, damage: 35, speed: 75, enemiesPerChunk: 4 }, // Nightmare
} as const;

export class EnemyMaintainer {
  private client: SuiClient;
  private config: MaintainerConfig;
  private currentEnemyCount: number = 0;
  private targetEnemyCount: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTxCount: bigint = BigInt(0);
  private currentDifficulty: DifficultyInfo | null = null;

  // Cache để giảm số lần call RPC
  private cachedNetworkScore: number = 50;
  private cachedValidatorHealth: number = 100;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION_MS = 30000; // Cache 30 giây
  private isFetching: boolean = false;

  constructor(config: MaintainerConfig) {
    this.config = config;
    this.client = new SuiClient({ url: config.rpcUrl });
    this.calculateTargetCount();
  }

  private calculateTargetCount() {
    const stats = this.getBaseStats();
    // Target = chunks × enemiesPerChunk (cơ bản, sẽ được điều chỉnh theo network)
    this.targetEnemyCount = Math.ceil(
      this.config.chunkCount * stats.enemiesPerChunk
    );
  }

  private getBaseStats() {
    const level = Math.max(
      1,
      Math.min(9, this.config.baseDifficulty)
    ) as keyof typeof DIFFICULTY_STATS;
    return DIFFICULTY_STATS[level];
  }

  // Gọi từ game mỗi khi quái chết hoặc spawn
  updateEnemyCount(count: number) {
    this.currentEnemyCount = count;
  }

  async start(checkIntervalMs: number = 10000) {
    // Fetch ngay lập tức
    await this.checkAndMaintain();

    // Check định kỳ
    this.intervalId = setInterval(() => {
      this.checkAndMaintain();
    }, checkIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAndMaintain() {
    const now = Date.now();
    const shouldFetchFromSui =
      now - this.lastFetchTime > this.CACHE_DURATION_MS;

    let networkScore = this.cachedNetworkScore;
    let validatorHealth = this.cachedValidatorHealth;

    // Chỉ fetch từ Sui nếu cache hết hạn và không đang fetch
    if (shouldFetchFromSui && !this.isFetching) {
      this.isFetching = true;
      try {
        const [systemState, checkpoint] = await Promise.all([
          this.client.getLatestSuiSystemState(),
          this.client.getCheckpoint({ id: "latest" }),
        ]);

        networkScore = this.calculateNetworkScore(systemState, checkpoint);
        validatorHealth = this.calculateValidatorHealth(systemState);

        // Update cache
        this.cachedNetworkScore = networkScore;
        this.cachedValidatorHealth = validatorHealth;
        this.lastFetchTime = now;

        console.log("[EnemyMaintainer] Fetched fresh data from Sui");
      } catch (error) {
        console.warn(
          "[EnemyMaintainer] Sui fetch failed, using cached data:",
          error
        );
      } finally {
        this.isFetching = false;
      }
    }

    // Tính toán difficulty (dùng cached data nếu không fetch mới)
    try {
      // Tính effective difficulty và target count
      const networkFactor = 0.8 + (networkScore / 100) * 0.4; // 0.8 - 1.2
      const validatorFactor = 0.9 + (validatorHealth / 100) * 0.2; // 0.9 - 1.1
      const effectiveDifficulty = Math.min(
        9,
        this.config.baseDifficulty * networkFactor * validatorFactor
      );

      // Tính target enemy count dựa trên effective difficulty
      const baseStats = this.getBaseStats();
      const adjustedEnemiesPerChunk =
        baseStats.enemiesPerChunk * (0.7 + (effectiveDifficulty / 9) * 0.6); // 0.7 - 1.3

      this.targetEnemyCount = Math.ceil(
        this.config.chunkCount * adjustedEnemiesPerChunk
      );

      // Giới hạn tối đa
      const maxEnemies = Math.min(20, this.config.chunkCount * 3);
      this.targetEnemyCount = Math.min(this.targetEnemyCount, maxEnemies);

      // Đảm bảo ít nhất 1 quái
      this.targetEnemyCount = Math.max(1, this.targetEnemyCount);

      // Update difficulty info
      this.currentDifficulty = {
        baseDifficulty: this.config.baseDifficulty,
        networkScore,
        validatorHealth,
        effectiveDifficulty,
        targetEnemyCount: this.targetEnemyCount,
        currentEnemyCount: this.currentEnemyCount,
        networkStatus: this.getNetworkStatus(networkScore),
        validatorStatus: this.getValidatorStatus(validatorHealth),
      };

      if (this.config.onDifficultyUpdate) {
        this.config.onDifficultyUpdate(this.currentDifficulty);
      }

      // Spawn thêm quái nếu cần (chỉ spawn 1 con mỗi lần check)
      if (this.currentEnemyCount < this.targetEnemyCount) {
        this.spawnOneEnemy(effectiveDifficulty);
      }

      console.log(
        `[EnemyMaintainer] Current: ${this.currentEnemyCount}/${this.targetEnemyCount} | ` +
          `Difficulty: ${effectiveDifficulty.toFixed(1)} | ` +
          `Net: ${networkScore.toFixed(0)} | Val: ${validatorHealth.toFixed(0)}`
      );
    } catch (error) {
      console.error("[EnemyMaintainer] Error:", error);
      // Fallback: vẫn maintain với base difficulty
      if (this.currentEnemyCount < this.targetEnemyCount) {
        this.spawnOneEnemy(this.config.baseDifficulty);
      }
    }
  }

  private calculateNetworkScore(systemState: any, checkpoint: any): number {
    const currentTxCount = BigInt(checkpoint.networkTotalTransactions || "0");
    const gasPrice = BigInt(systemState.referenceGasPrice || "1000");

    // TX delta
    let txDelta = 0;
    if (this.lastTxCount > BigInt(0)) {
      txDelta = Number(currentTxCount - this.lastTxCount);
    }
    this.lastTxCount = currentTxCount;

    // Score
    const txScore = Math.min(50, txDelta / 40);
    const gasRatio = Number(gasPrice) / 1000;
    const gasScore = Math.min(50, gasRatio * 10);

    return Math.min(100, txScore + gasScore);
  }

  private calculateValidatorHealth(systemState: any): number {
    const validators = systemState.activeValidators || [];
    const activeCount = validators.length;

    let score = 0;

    // Điểm từ số validators (0-50)
    if (activeCount >= 100) score += 50;
    else if (activeCount >= 80) score += 40;
    else if (activeCount >= 60) score += 30;
    else if (activeCount >= 40) score += 20;
    else score += 10;

    // Điểm từ epoch progress (0-50)
    const epochDuration = Number(systemState.epochDurationMs || 86400000);
    const epochStart = Number(systemState.epochStartTimestampMs || Date.now());
    const epochProgress = (Date.now() - epochStart) / epochDuration;

    if (epochProgress < 1.0) score += 50;
    else if (epochProgress < 1.2) score += 35;
    else score += 20;

    return Math.min(100, score);
  }

  private getNetworkStatus(score: number): string {
    if (score < 25) return "🟢 Quiet";
    if (score < 50) return "🟡 Normal";
    if (score < 75) return "🟠 Busy";
    return "🔴 Very Busy";
  }

  private getValidatorStatus(score: number): string {
    if (score >= 80) return "🟢 Healthy";
    if (score >= 60) return "🟡 Good";
    if (score >= 40) return "🟠 Warning";
    return "🔴 Critical";
  }

  private spawnOneEnemy(effectiveDifficulty: number) {
    const baseStats = this.getBaseStats();

    // Scale stats theo effective difficulty
    const difficultyScale = effectiveDifficulty / this.config.baseDifficulty;

    const config: EnemyConfig = {
      baseHp: Math.ceil(baseStats.hp * difficultyScale),
      baseDamage: Math.ceil(baseStats.damage * difficultyScale),
      baseSpeed: Math.ceil(baseStats.speed * difficultyScale),
    };

    this.config.onSpawnEnemy(config);
    this.currentEnemyCount++;
  }

  getCurrentDifficulty(): DifficultyInfo | null {
    return this.currentDifficulty;
  }

  getTargetCount(): number {
    return this.targetEnemyCount;
  }

  getCurrentCount(): number {
    return this.currentEnemyCount;
  }
}

// Singleton
let maintainerInstance: EnemyMaintainer | null = null;

export function initEnemyMaintainer(config: MaintainerConfig): EnemyMaintainer {
  if (maintainerInstance) {
    maintainerInstance.stop();
  }
  maintainerInstance = new EnemyMaintainer(config);
  return maintainerInstance;
}

export function getEnemyMaintainer(): EnemyMaintainer | null {
  return maintainerInstance;
}

export function stopEnemyMaintainer() {
  if (maintainerInstance) {
    maintainerInstance.stop();
    maintainerInstance = null;
  }
}
