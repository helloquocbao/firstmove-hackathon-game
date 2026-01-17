import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { sha3_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  PACKAGE_ID,
  RANDOM_OBJECT_ID,
  REWARD_COIN_TYPE,
  REWARD_VAULT_ID,
  WORLD_REGISTRY_ID,
} from "../chain/config";
import { suiClient } from "../chain/suiClient";
import { startGame } from "../game/start";
import {
  isWalkableTile,
  normalizeTileId,
  normalizeDecoId,
} from "../game/tiles";
import "./GamePage.css";

const TILE_SIZE = 32;
const CHUNK_SIZE = 5;
const PLAY_FEE = 5n;
const PLAY_STATE_KEY = "PLAY_STATE";
const PLAY_TARGET_KEY = "PLAY_TARGET";

export default function GamePage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const [worldId, setWorldId] = useState("");
  const [worldListError, setWorldListError] = useState("");
  const [mapLoadError, setMapLoadError] = useState("");
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [loadedChunks, setLoadedChunks] = useState(null);
  const [rewardBalance, setRewardBalance] = useState("0");
  const [playId, setPlayId] = useState("");
  const [playKeyHex, setPlayKeyHex] = useState("");
  const [playNotice, setPlayNotice] = useState("");
  const [playError, setPlayError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimCheckMessage, setClaimCheckMessage] = useState("");
  const [isKeyFound, setIsKeyFound] = useState(false);
  const [isPlayBusy, setIsPlayBusy] = useState(false);
  const [isClaimBusy, setIsClaimBusy] = useState(false);
  const [isClaimCheckBusy, setIsClaimCheckBusy] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [pendingMapData, setPendingMapData] = useState(null);

  // Pre-start modal (local/off-chain entry)
  const [showStartModal, setShowStartModal] = useState(true);
  const [startMode, setStartMode] = useState("player");
  const [startModalError, setStartModalError] = useState("");
  const [startChainMode, setStartChainMode] = useState("v1");

  // Play mode: 'v1' = free (2 plays/day), 'v2' = paid (3 plays/day, better rewards)
  const [playMode, setPlayMode] = useState("v1");

  // UI visibility states for collapsible overlays
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Character stats
  const [characterId, setCharacterId] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [characterHealth, setCharacterHealth] = useState(0);
  const [characterPower, setCharacterPower] = useState(0);
  const [characterPotential, setCharacterPotential] = useState(0);
  const [characterDailyPlays, setCharacterDailyPlays] = useState(0);
  const [characterFreePlays, setCharacterFreePlays] = useState(0);

  // Create character modal
  const [showCreateCharacterModal, setShowCreateCharacterModal] =
    useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [createCharacterError, setCreateCharacterError] = useState("");

  // Restore session modal (for switching devices)
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePlayId, setRestorePlayId] = useState("");
  const [restoreKeyHex, setRestoreKeyHex] = useState("");
  const [restoreWorldId, setRestoreWorldId] = useState("");
  const [unclaimedPlays, setUnclaimedPlays] = useState([]); // List of unclaimed plays from chain
  const [isFetchingUnclaimed, setIsFetchingUnclaimed] = useState(false);

  // Dynamic difficulty info from chain
  const [difficultyInfo, setDifficultyInfo] = useState({
    baseDifficulty: 1,
    effectiveDifficulty: 1,
    targetEnemyCount: 0,
    currentEnemyCount: 0,
    networkStatus: "⚪ Loading...",
    validatorStatus: "⚪ Loading...",
  });

  useEffect(() => {
    const stored = loadPlayState();
    const target = loadPlayTarget();
    if (stored) {
      setPlayId(stored.playId);
      setPlayKeyHex(stored.keyHex);
      // Notify user about restored session
      if (stored.playId === "pending") {
        setPlayNotice(
          `⏳ Transaction pending, waiting for chain to index. Click "Retry Fetch" to recover Play ID.`
        );
      } else {
        setPlayNotice(
          `🔄 Restored pending session (Play ID: ${stored.playId}). Find the key to claim reward!`
        );
      }
    }
    setIsKeyFound(Boolean(target?.found));
  }, []);

  useEffect(() => {
    const handler = () => setIsKeyFound(true);
    window.addEventListener("game:key-found", handler);
    return () => window.removeEventListener("game:key-found", handler);
  }, []);

  // Listen for difficulty updates from game
  useEffect(() => {
    const handler = (event) => {
      const info = event.detail;
      if (info) {
        setDifficultyInfo({
          baseDifficulty: info.baseDifficulty ?? 1,
          effectiveDifficulty: info.effectiveDifficulty ?? 1,
          targetEnemyCount: info.targetEnemyCount ?? 0,
          currentEnemyCount: info.currentEnemyCount ?? 0,
          networkStatus: info.networkStatus ?? "⚪ Unknown",
          validatorStatus: info.validatorStatus ?? "⚪ Unknown",
        });
      }
    };
    window.addEventListener("game:difficulty-update", handler);
    return () => window.removeEventListener("game:difficulty-update", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setStartModalError("");
      setShowStartModal(true);
      setIsGameStarted(false);
      setStartMode(playId ? "resume" : "player");
    };
    window.addEventListener("game:player-dead", handler);
    return () => window.removeEventListener("game:player-dead", handler);
  }, [playId]);

  useEffect(() => {
    if (!playId || !PACKAGE_ID) {
      setClaimCheckMessage("");
      setIsClaimCheckBusy(false);
      return;
    }

    let isActive = true;
    setClaimCheckMessage("Checking reward status on-chain...");
    setIsClaimCheckBusy(true);

    void (async () => {
      try {
        const claimed = await hasRewardBeenClaimed(playId);
        if (!isActive) return;
        if (claimed) {
          resetPlayState("Reward already claimed on-chain.");
          setClaimCheckMessage("This play already has a claim recorded.");
        } else {
          setClaimCheckMessage("No claim event found yet for this play.");
        }
      } catch (error) {
        if (!isActive) return;
        setClaimCheckMessage(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        if (isActive) {
          setIsClaimCheckBusy(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [playId]);

  useEffect(() => {
    void (async () => {
      // Load world list and auto-load first world
      await loadWorldListAndMap();
    })();
  }, [WORLD_REGISTRY_ID]);

  useEffect(() => {
    void loadRewardBalance();
    void loadCharacter();
  }, [account?.address]);

  async function loadCharacter() {
    if (!account?.address || !PACKAGE_ID) {
      setCharacterId("");
      setCharacterName("");
      setCharacterHealth(0);
      setCharacterPower(0);
      setCharacterPotential(0);
      setCharacterDailyPlays(0);
      setCharacterFreePlays(0);
      return "";
    }
    try {
      const characterType = `${PACKAGE_ID}::world::CharacterNFT`;
      const result = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: characterType },
        options: { showContent: true },
      });

      if (result.data.length > 0) {
        const obj = result.data[0];
        const content = obj.data?.content;
        if (content && content.dataType === "moveObject") {
          const fields = normalizeMoveFields(content.fields);
          const nextId = obj.data?.objectId ?? "";
          setCharacterId(nextId);
          setCharacterName(String(fields.name ?? ""));
          setCharacterHealth(parseU32Value(fields.health) ?? 100);
          setCharacterPower(parseU32Value(fields.power) ?? 0);
          setCharacterPotential(parseU32Value(fields.potential) ?? 0);
          setCharacterDailyPlays(parseU32Value(fields.daily_plays) ?? 0);
          setCharacterFreePlays(parseU32Value(fields.free_daily_plays) ?? 0);
          return nextId;
        }
      }
    } catch (error) {
      console.error("Failed to load character:", error);
    }
    return "";
  }

  const isWalletBusy = isPending || isPlayBusy || isClaimBusy;

  async function loadWorldId() {
    setWorldListError("");
    if (!WORLD_REGISTRY_ID) {
      setWorldId("");
      return "";
    }

    try {
      const result = await suiClient.getObject({
        id: WORLD_REGISTRY_ID,
        options: { showContent: true },
      });

      const content = result.data?.content;
      if (!content || content.dataType !== "moveObject") {
        setWorldId("");
        return "";
      }

      const fields = normalizeMoveFields(content.fields);
      const worldField =
        fields.world_id ?? fields.worldId ?? fields.world ?? undefined;
      if (!worldField) {
        setWorldId("");
        return "";
      }

      const optionFields = normalizeMoveFields(worldField);
      const vec = optionFields.vec;
      const id = Array.isArray(vec) && vec.length > 0 ? String(vec[0]) : "";
      setWorldId(id);
      return id;
    } catch (error) {
      setWorldListError(error instanceof Error ? error.message : String(error));
      setWorldId("");
      return "";
    }
  }

  async function loadWorldListAndMap() {
    setMapLoadError("");
    setWorldListError("");
    setIsMapLoading(true);

    try {
      const ids = [];

      // First try to get from registry
      const registryId = await loadWorldId();
      if (registryId) ids.push(registryId);

      // Then query WorldCreatedEvent for more worlds
      if (PACKAGE_ID) {
        const eventType = `${PACKAGE_ID}::world::WorldCreatedEvent`;
        let cursor = null;
        let hasNextPage = true;
        let rounds = 0;

        while (hasNextPage && rounds < 6) {
          const page = await suiClient.queryEvents({
            query: { MoveEventType: eventType },
            cursor: cursor ?? undefined,
            limit: 50,
            order: "descending",
          });

          for (const event of page.data) {
            const parsed = event.parsedJson;
            if (!parsed || typeof parsed !== "object") continue;
            const record = parsed;
            const id =
              typeof record.world_id === "string"
                ? record.world_id
                : typeof record.worldId === "string"
                  ? record.worldId
                  : "";
            if (id && !ids.includes(id)) ids.push(id);
          }

          cursor = page.nextCursor ?? null;
          hasNextPage = page.hasNextPage;
          rounds += 1;
        }
      }

      // Auto-load the first world in the list
      if (ids.length > 0) {
        const firstWorldId = ids[0];
        setWorldId(firstWorldId);
        setIsMapLoading(false);
        await loadWorldMap(firstWorldId);
      } else {
        setMapLoadError("No worlds found.");
        setIsMapLoading(false);
      }
    } catch (error) {
      setWorldListError(error instanceof Error ? error.message : String(error));
      setIsMapLoading(false);
    }
  }

  async function loadRewardBalance() {
    if (!account?.address || !REWARD_COIN_TYPE) {
      setRewardBalance("0");
      return;
    }

    try {
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: REWARD_COIN_TYPE,
      });
      const total = coins.data.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        0n
      );
      setRewardBalance(total.toString());
    } catch (error) {
      console.error(error);
      setRewardBalance("0");
    }
  }

  async function getPlayableCoin() {
    if (!account?.address || !REWARD_COIN_TYPE) return null;
    const coins = await suiClient.getCoins({
      owner: account.address,
      coinType: REWARD_COIN_TYPE,
    });
    return coins.data.find((coin) => BigInt(coin.balance) >= PLAY_FEE) ?? null;
  }

  function storePlayState(nextState) {
    localStorage.setItem(PLAY_STATE_KEY, JSON.stringify(nextState));
  }

  function loadPlayState() {
    const raw = localStorage.getItem(PLAY_STATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function clearPlayState() {
    localStorage.removeItem(PLAY_STATE_KEY);
    localStorage.removeItem(PLAY_TARGET_KEY);
  }

  function resetPlayState(nextNotice) {
    clearPlayState();
    setPlayId("");
    setPlayKeyHex("");
    setIsKeyFound(false);
    if (nextNotice) {
      setPlayNotice(nextNotice);
    }
  }

  // Retry fetching playId from pending transaction
  async function retryFetchPlayId() {
    const stored = loadPlayState();
    if (!stored || stored.playId !== "pending" || !stored.digest) {
      return;
    }

    setPlayNotice("🔄 Retrying to fetch play ID from chain...");

    try {
      const txBlock = await suiClient.getTransactionBlock({
        digest: stored.digest,
        options: { showEvents: true },
      });

      const eventType = `${PACKAGE_ID}::world::PlayCreatedEvent`;
      const playEvent = txBlock.events?.find((e) => e.type === eventType);
      const parsed = playEvent?.parsedJson ?? {};
      const nextPlayId =
        typeof parsed.play_id === "string"
          ? parsed.play_id
          : typeof parsed.play_id === "number"
            ? String(parsed.play_id)
            : "";

      if (nextPlayId) {
        storePlayState({
          ...stored,
          playId: nextPlayId,
        });
        setPlayId(nextPlayId);
        setPlayNotice(
          `✅ Recovered Play ID: ${nextPlayId}. Find the key to claim!`
        );
      } else {
        setPlayError("Still couldn't fetch play_id. Try again later.");
      }
    } catch (error) {
      setPlayError(
        "Failed to fetch: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  // Fetch unclaimed plays của user từ on-chain events
  async function fetchUnclaimedPlays() {
    if (!account?.address || !PACKAGE_ID) return;

    setIsFetchingUnclaimed(true);
    try {
      // 1. Fetch tất cả PlayCreatedEvent của user
      const playEventType = `${PACKAGE_ID}::world::PlayCreatedEvent`;
      const claimEventType = `${PACKAGE_ID}::world::RewardClaimedEvent`;

      // Fetch play events (created by user)
      const playEvents = [];
      let cursor = null;
      let rounds = 0;
      const maxRounds = 10;

      while (rounds < maxRounds) {
        const page = await suiClient.queryEvents({
          query: { MoveEventType: playEventType },
          cursor: cursor ?? undefined,
          limit: 50,
          order: "descending",
        });

        const events = page.data ?? [];
        for (const event of events) {
          const parsed = event.parsedJson ?? {};
          if (parsed.creator === account.address) {
            playEvents.push({
              playId: String(parsed.play_id ?? ""),
              worldId: parsed.world_id ?? "",
              minReward: parsed.min_reward ?? 0,
              maxReward: parsed.max_reward ?? 0,
              timestamp: event.timestampMs,
            });
          }
        }

        if (!page.hasNextPage || !page.nextCursor) break;
        cursor = page.nextCursor;
        rounds++;
      }

      // 2. Fetch claimed play IDs
      const claimedPlayIds = new Set();
      cursor = null;
      rounds = 0;

      while (rounds < maxRounds) {
        const page = await suiClient.queryEvents({
          query: { MoveEventType: claimEventType },
          cursor: cursor ?? undefined,
          limit: 50,
          order: "descending",
        });

        const events = page.data ?? [];
        for (const event of events) {
          const parsed = event.parsedJson ?? {};
          if (parsed.recipient === account.address) {
            claimedPlayIds.add(String(parsed.play_id ?? ""));
          }
        }

        if (!page.hasNextPage || !page.nextCursor) break;
        cursor = page.nextCursor;
        rounds++;
      }

      // 3. Filter unclaimed plays
      const unclaimed = playEvents.filter((p) => !claimedPlayIds.has(p.playId));
      setUnclaimedPlays(unclaimed);

      if (unclaimed.length === 0) {
        setPlayNotice("✅ Không có play nào chưa claim!");
      } else {
        setPlayNotice(
          `📋 Tìm thấy ${unclaimed.length} play chưa claim. Chọn để restore.`
        );
      }
    } catch (error) {
      setPlayError(
        "Failed to fetch: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsFetchingUnclaimed(false);
    }
  }

  function storePlayTarget(target) {
    localStorage.setItem(PLAY_TARGET_KEY, JSON.stringify(target));
  }

  function loadPlayTarget() {
    const raw = localStorage.getItem(PLAY_TARGET_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function getStoredMapData() {
    const raw = localStorage.getItem("CUSTOM_MAP");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // Update characterHealth with current value
      parsed.characterHealth = characterHealth || 100;
      return parsed;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function reloadGameFromStorage() {
    const parsed = getStoredMapData();
    if (!parsed) return;
    startGame(parsed);
  }

  async function loadWorldMap(targetWorldId) {
    setMapLoadError("");
    setIsMapLoading(true);
    setLoadedChunks(null);

    try {
      const fieldEntries = await fetchAllDynamicFields(targetWorldId);
      if (fieldEntries.length === 0) {
        setMapLoadError("World has no chunks yet.");
        setLoadedChunks(0);
        return;
      }

      const chunkEntries = await resolveChunkEntries(
        targetWorldId,
        fieldEntries
      );
      if (chunkEntries.length === 0) {
        setMapLoadError("No chunk entries found.");
        setLoadedChunks(0);
        return;
      }

      const chunkIds = chunkEntries.map((entry) => entry.chunkId);
      const chunkObjects = await suiClient.multiGetObjects({
        ids: chunkIds,
        options: { showContent: true },
      });

      const maxCx = Math.max(...chunkEntries.map((entry) => entry.cx));
      const maxCy = Math.max(...chunkEntries.map((entry) => entry.cy));
      const width = (maxCx + 1) * CHUNK_SIZE;
      const height = (maxCy + 1) * CHUNK_SIZE;

      const newGrid = Array(height)
        .fill(0)
        .map(() => Array(width).fill(0));
      const newDecoGrid = Array(height)
        .fill(0)
        .map(() => Array(width).fill(0));

      for (let index = 0; index < chunkEntries.length; index++) {
        const entry = chunkEntries[index];
        const response = chunkObjects[index];
        let content = response.data?.content;
        if (!content || content.dataType !== "moveObject") {
          content = await fetchListedChunk(targetWorldId, entry.chunkId);
          console.log("Fetched listed chunk:", content);
        }
        if (!content || content.dataType !== "moveObject") continue;
        const fields = normalizeMoveFields(content.fields);
        const tiles = normalizeMoveVector(fields.tiles).map((tile) =>
          normalizeTileId(clampU8(parseU32Value(tile) ?? 0, 255))
        );
        const decorations = normalizeMoveVector(fields.decorations ?? []).map(
          (deco) => normalizeDecoId(clampU8(parseU32Value(deco) ?? 0, 255))
        );

        for (let y = 0; y < CHUNK_SIZE; y++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            const idx = y * CHUNK_SIZE + x;
            newGrid[entry.cy * CHUNK_SIZE + y][entry.cx * CHUNK_SIZE + x] =
              tiles[idx] ?? 0;
            newDecoGrid[entry.cy * CHUNK_SIZE + y][entry.cx * CHUNK_SIZE + x] =
              decorations[idx] ?? 0;
          }
        }
      }

      const mapData = {
        tileSize: TILE_SIZE,
        width,
        height,
        grid: newGrid,
        decoGrid: newDecoGrid,
        worldId: targetWorldId,
        characterHealth: characterHealth || 100,
        difficulty: 1, // default, will fetch from WorldMap
        chunkCount: chunkEntries.length,
      };

      // Fetch difficulty from WorldMap object
      try {
        const worldObj = await suiClient.getObject({
          id: targetWorldId,
          options: { showContent: true },
        });
        if (worldObj.data?.content?.dataType === "moveObject") {
          const worldFields = normalizeMoveFields(worldObj.data.content.fields);
          const difficulty = parseInt(worldFields.difficulty) || 1;
          mapData.difficulty = Math.max(1, Math.min(9, difficulty));
        }
      } catch (e) {
        console.warn("Could not fetch world difficulty:", e);
      }

      localStorage.setItem("CUSTOM_MAP", JSON.stringify(mapData));
      setPendingMapData(mapData);
      if (isGameStarted) {
        startGame(mapData);
      }
      setLoadedChunks(chunkEntries.length);
    } catch (error) {
      setMapLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsMapLoading(false);
    }
  }

  function pickKeyTarget() {
    const raw = localStorage.getItem("CUSTOM_MAP");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const grid = Array.isArray(parsed.grid) ? parsed.grid : [];
      const floors = [];
      for (let y = 0; y < grid.length; y += 1) {
        const row = grid[y] ?? [];
        for (let x = 0; x < row.length; x += 1) {
          if (isWalkableTile(Number(row[x]))) {
            floors.push({ x, y });
          }
        }
      }
      if (!floors.length) return null;
      return floors[Math.floor(Math.random() * floors.length)];
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async function handlePlayOnChain(nextMode) {
    setPlayError("");
    setPlayNotice("");
    setClaimError("");
    const resolvedMode = typeof nextMode === "string" ? nextMode : null;
    if (resolvedMode) {
      setPlayMode(resolvedMode);
    }
    const effectiveMode = resolvedMode ?? playMode;

    if (!account?.address) {
      setPlayError("Connect wallet first.");
      return;
    }
    if (!PACKAGE_ID || !REWARD_VAULT_ID) {
      setPlayError("Missing package or reward vault id.");
      return;
    }
    if (!worldId) {
      setPlayError("World not loaded.");
      return;
    }

    // Check if character exists
    if (!characterId) {
      setShowCreateCharacterModal(true);
      return;
    }

    // Check play limits
    if (effectiveMode === "v1" && characterFreePlays >= 2) {
      setPlayError(
        "Free play limit reached (2/day). Use Play V2 or wait for next epoch."
      );
      return;
    }
    if (effectiveMode === "v2" && characterDailyPlays >= 3) {
      setPlayError("Daily play limit reached (3/day). Wait for next epoch.");
      return;
    }

    // V2 requires coin, V1 is free
    let playableCoin = null;
    if (effectiveMode === "v2") {
      playableCoin = await getPlayableCoin();
      if (!playableCoin) {
        setPlayError("Need at least 5 CHUNK coin to play V2.");
        return;
      }
    }

    const keyBytes = new Uint8Array(16);
    crypto.getRandomValues(keyBytes);
    const sealBytes = sha3_256(keyBytes);
    const sealVector = Array.from(sealBytes);
    const keyHex = bytesToHex(keyBytes);

    setIsPlayBusy(true);
    try {
      const tx = new Transaction();

      if (effectiveMode === "v1") {
        // Play V1: Free play (no coin required)
        tx.moveCall({
          target: `${PACKAGE_ID}::world::play_v1`,
          arguments: [
            tx.object(worldId),
            tx.object(REWARD_VAULT_ID),
            tx.object(characterId),
            tx.pure.vector("u8", sealVector),
          ],
        });
      } else {
        // Play V2: Paid play (requires 5 CHUNK)
        tx.moveCall({
          target: `${PACKAGE_ID}::world::play_v2`,
          arguments: [
            tx.object(worldId),
            tx.object(REWARD_VAULT_ID),
            tx.object(characterId),
            tx.object(playableCoin.coinObjectId),
            tx.pure.vector("u8", sealVector),
          ],
        });
      }

      const result = await signAndExecute({ transaction: tx });
      console.log("result", result);

      // Retry logic: đợi transaction được index trên chain
      let txBlock = null;
      let retryCount = 0;
      const maxRetries = 5;
      const retryDelay = 1500; // 1.5 giây

      while (retryCount < maxRetries) {
        try {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          txBlock = await suiClient.getTransactionBlock({
            digest: result.digest,
            options: { showEvents: true },
          });
          if (txBlock && txBlock.events) {
            break; // Success
          }
        } catch (fetchError) {
          console.warn(
            `Retry ${retryCount + 1}/${maxRetries}: waiting for transaction...`,
            fetchError
          );
        }
        retryCount++;
      }

      if (!txBlock) {
        // Fallback: Lưu với keyHex, user có thể verify sau
        storePlayState({
          playId: "pending",
          keyHex,
          worldId: worldId,
          found: false,
          digest: result.digest,
        });
        setPlayKeyHex(keyHex);
        setPlayError(
          "Transaction submitted but couldn't fetch details. Please verify claim status later."
        );
        return;
      }
      console.log("txBlock", txBlock);
      const eventType = `${PACKAGE_ID}::world::PlayCreatedEvent`;
      console.log("eventType", eventType);
      const playEvent = txBlock.events?.find(
        (event) => event.type === eventType
      );
      console.log("playEvent", playEvent);
      const parsed = playEvent?.parsedJson ?? {};
      const nextPlayId =
        typeof parsed.play_id === "string"
          ? parsed.play_id
          : typeof parsed.play_id === "number"
            ? String(parsed.play_id)
            : "";
      console.log("nextPlayId", nextPlayId);
      if (!nextPlayId) {
        setPlayError("Play created but play_id not found.");
        return;
      }

      const target = pickKeyTarget();
      if (target) {
        storePlayTarget({ ...target, worldId: worldId, found: false });
      }

      storePlayState({
        playId: nextPlayId,
        keyHex,
        worldId: worldId,
        found: false,
      });
      setPlayId(nextPlayId);
      setPlayKeyHex(keyHex);
      setIsKeyFound(false);
      setIsGameStarted(true);
      reloadGameFromStorage();
      setPlayNotice(
        target
          ? `Key hidden at tile (${target.x}, ${target.y}).`
          : "Key generated. Load a map to hide it."
      );
      await loadRewardBalance();
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPlayBusy(false);
    }
  }

  async function handleStartModalAction() {
    setStartModalError("");
    if (startMode === "player") {
      if (isMapLoading) {
        setStartModalError("World is still loading.");
        return;
      }
      const nextMapData = pendingMapData ?? getStoredMapData();
      if (!nextMapData) {
        setStartModalError("World not ready yet.");
        return;
      }
      setIsGameStarted(true);
      setShowStartModal(false);
      startGame(nextMapData);
      return;
    }

    if (startMode === "resume") {
      const nextMapData = pendingMapData ?? getStoredMapData();
      if (!nextMapData) {
        setStartModalError("World not ready yet.");
        return;
      }
      setIsGameStarted(true);
      setShowStartModal(false);
      startGame(nextMapData);
      return;
    }

    if (!account?.address) {
      setStartModalError("Connect wallet to play on-chain.");
      return;
    }
    const resolvedCharacterId = characterId || (await loadCharacter());
    if (!resolvedCharacterId) {
      setStartModalError("Create a character first.");
      setShowCreateCharacterModal(true);
      return;
    }
    if (startChainMode === "v1" && characterFreePlays >= 2) {
      setStartModalError("Free play limit reached (2/day).");
      return;
    }
    if (startChainMode === "v2" && characterDailyPlays >= 3) {
      setStartModalError("Daily play limit reached (3/day).");
      return;
    }
    setShowStartModal(false);
    void handlePlayOnChain(startChainMode);
  }

  async function handleClaimOnChain() {
    setClaimError("");
    setPlayNotice("");

    if (!account?.address) {
      setClaimError("Connect wallet first.");
      return;
    }
    if (!PACKAGE_ID || !REWARD_VAULT_ID || !RANDOM_OBJECT_ID) {
      setClaimError("Missing chain config for claim.");
      return;
    }
    if (!playId || !playKeyHex) {
      setClaimError("No active play found.");
      return;
    }
    if (!isKeyFound) {
      setClaimError("Find the hidden key in game first.");
      return;
    }

    if (!worldId) {
      setClaimError("World not loaded.");
      return;
    }

    const keyBytes = Array.from(hexToBytes(playKeyHex));
    setIsClaimBusy(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::world::claim_reward`,
        arguments: [
          tx.object(worldId),
          tx.object(REWARD_VAULT_ID),
          tx.object(characterId),
          tx.object(RANDOM_OBJECT_ID),
          tx.pure.u64(BigInt(playId)),
          tx.pure.vector("u8", keyBytes),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      const txBlock = await suiClient.getTransactionBlock({
        digest: result.digest,
        options: { showEvents: true },
      });
      const eventType = `${PACKAGE_ID}::world::RewardClaimedEvent`;
      const rewardEvent = txBlock.events?.find(
        (event) => event.type === eventType
      );
      const parsed = rewardEvent?.parsedJson ?? {};
      const rewardValue =
        typeof parsed.reward === "string"
          ? parsed.reward
          : typeof parsed.reward === "number"
            ? String(parsed.reward)
            : "";

      resetPlayState(
        rewardValue ? `Claimed ${rewardValue} CHUNK.` : "Claimed reward."
      );
      await loadRewardBalance();
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsClaimBusy(false);
    }
  }

  async function handleVerifyClaimStatus() {
    setClaimError("");

    if (!playId) {
      setClaimCheckMessage("No active play to verify.");
      return;
    }
    if (!PACKAGE_ID) {
      setClaimCheckMessage("Missing package id for event search.");
      return;
    }
    if (isClaimCheckBusy) return;

    setClaimCheckMessage("Checking reward status on-chain...");
    setIsClaimCheckBusy(true);
    try {
      const claimed = await hasRewardBeenClaimed(playId);
      if (claimed) {
        resetPlayState("Reward already claimed on-chain.");
        setClaimCheckMessage("Reward was already claimed for that play.");
      } else {
        setClaimCheckMessage("No claim event found yet for this play.");
      }
    } catch (error) {
      setClaimCheckMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsClaimCheckBusy(false);
    }
  }

  async function handleCreateCharacter() {
    setCreateCharacterError("");

    if (!newCharacterName.trim()) {
      setCreateCharacterError("Character name is required.");
      return;
    }
    if (newCharacterName.trim().length > 32) {
      setCreateCharacterError("Name must be 32 characters or less.");
      return;
    }
    if (!WORLD_REGISTRY_ID) {
      setCreateCharacterError("Missing world registry id.");
      return;
    }

    setIsCreatingCharacter(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::world::create_character`,
        arguments: [
          tx.object(WORLD_REGISTRY_ID),
          tx.pure.string(newCharacterName.trim()),
        ],
      });

      await signAndExecute({ transaction: tx });

      // Reload character after creation
      await loadCharacter();

      setShowCreateCharacterModal(false);
      setNewCharacterName("");
      setPlayNotice("Character created! You can now start playing.");
    } catch (error) {
      setCreateCharacterError(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsCreatingCharacter(false);
    }
  }

  const mapReady =
    !isMapLoading && Boolean(pendingMapData ?? getStoredMapData());
  const hasPendingPlay = Boolean(playId);

  return (
    <div className="game-page">
      <div className="game-bg">
        <span className="game-cloud game-cloud--a" />
        <span className="game-cloud game-cloud--b" />
        <span className="game-cloud game-cloud--c" />
        <span className="game-haze" />
      </div>

      {/* Toggle buttons */}
      <button
        className="game-toggle-btn game-toggle-header"
        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
        title={isHeaderCollapsed ? "Show header" : "Hide header"}
      >
        {isHeaderCollapsed ? "☰" : "✕"}
      </button>
      <button
        className={`game-toggle-btn game-toggle-sidebar ${
          !isSidebarCollapsed ? "sidebar-open" : ""
        }`}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        title={isSidebarCollapsed ? "Show panel" : "Hide panel"}
      >
        {isSidebarCollapsed ? "◀" : "▶"}
      </button>

      <div className="game-shell">
        <header
          className={`game-header ${isHeaderCollapsed ? "collapsed" : ""}`}
        >
          <div>
            <div className="game-eyebrow">Skyworld run</div>
            <h1 className="game-title">Chunk adventure</h1>
            <p className="game-subtitle">
              Test your map and feel the flow before minting.
            </p>
          </div>
          <div className="game-links">
            <Link className="game-link" to="/">
              Home
            </Link>
            <Link className="game-link" to="/editor">
              Editor
            </Link>
          </div>
        </header>

        <div className="game-stage">
          <div className="game-frame">
            <canvas id="game" />
            {isMapLoading && (
              <div className="game-loading-overlay">
                <div className="game-loading-spinner" />
                <div className="game-loading-text">Loading world...</div>
              </div>
            )}
          </div>

          <aside
            className={`game-info ${isSidebarCollapsed ? "collapsed" : ""}`}
          >
            <div className="game-info__title flex justify-between items-center">
              <span className="font-bold">MISSION</span>
            </div>
            {isMapLoading && (
              <div className="game-info__note">Loading world...</div>
            )}
            {loadedChunks !== null && (
              <div className="game-info__note">
                Loaded {loadedChunks} chunks.
              </div>
            )}
            {worldListError && (
              <div className="game-info__error">{worldListError}</div>
            )}
            {mapLoadError && (
              <div className="game-info__error">{mapLoadError}</div>
            )}

            <div className="game-info__title">Wallet</div>
            <div className="game-info__card">
              <span>Reward balance</span>
              <span>{rewardBalance}</span>
            </div>
            <ConnectButton />

            {characterId && (
              <>
                <div className="game-info__title">Character</div>
                <div className="game-info__card">
                  <span>Name</span>
                  <span>{characterName || "-"}</span>
                </div>
                <div className="game-info__card">
                  <span>❤️ Health</span>
                  <span>{characterHealth}</span>
                </div>
                <div className="game-info__card">
                  <span>⚔️ Power</span>
                  <span>{characterPower}</span>
                </div>
                <div className="game-info__card">
                  <span>✨ Potential</span>
                  <span>{characterPotential}</span>
                </div>
                <div className="game-info__card">
                  <span>🎮 Daily Plays</span>
                  <span>{characterDailyPlays}/3</span>
                </div>
                <div className="game-info__card">
                  <span>🆓 Free Plays</span>
                  <span>{characterFreePlays}/2</span>
                </div>
              </>
            )}
            {!characterId && account?.address && (
              <div className="game-info__note">
                No character found. Create one in Editor.
              </div>
            )}

            <div className="game-info__title">Rewards</div>

            {/* Pending Session Warning */}
            {playId && !isKeyFound && (
              <div className="pending-session-warning">
                <div className="pending-session-header">
                  ⚠️ Pending Game Session
                </div>
                <div className="pending-session-info">
                  <span>Play ID: {playId}</span>
                  <span>
                    World: {loadPlayState()?.worldId?.slice(0, 10) || "-"}...
                  </span>
                </div>

                {/* Backup Key - User có thể copy để dùng máy khác */}
                <div className="backup-key-section">
                  <div className="backup-key-label">
                    🔑 Backup Key (copy này để dùng máy khác):
                  </div>
                  <div className="backup-key-value">
                    <code>{playKeyHex}</code>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(playKeyHex);
                        setPlayNotice("✅ Key copied to clipboard!");
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div className="pending-session-hint">
                  {playId === "pending"
                    ? "Transaction submitted but Play ID not yet indexed."
                    : "Find the key in the game to claim your reward!"}
                </div>
                <div className="pending-session-buttons">
                  {playId === "pending" && (
                    <button
                      className="game-btn game-btn--retry"
                      onClick={retryFetchPlayId}
                      disabled={isWalletBusy}
                    >
                      🔄 Retry Fetch
                    </button>
                  )}
                  <button
                    className="game-btn game-btn--cancel"
                    onClick={() => {
                      if (
                        confirm(
                          "Cancel this session? You will lose the play and cannot claim reward."
                        )
                      ) {
                        resetPlayState("Session cancelled.");
                      }
                    }}
                  >
                    Cancel Session
                  </button>
                </div>
              </div>
            )}

            <div className="game-info__card">
              <span>Play id</span>
              <span>{playId || "-"}</span>
            </div>
            <div className="game-info__card">
              <span>Key status</span>
              <span>{isKeyFound ? "found" : playId ? "hidden" : "-"}</span>
            </div>

            {/* Restore Session Button - Khi đổi máy */}
            {!playId && (
              <button
                className="game-btn game-btn--restore"
                onClick={() => setShowRestoreModal(true)}
              >
                🔄 Restore Session (đổi máy)
              </button>
            )}

            <div className="play-mode-selector">
              <label>
                <input
                  type="radio"
                  name="playMode"
                  value="v1"
                  checked={playMode === "v1"}
                  onChange={(e) => setPlayMode(e.target.value)}
                />
                V1 - Free ({characterFreePlays}/2)
              </label>
              <label>
                <input
                  type="radio"
                  name="playMode"
                  value="v2"
                  checked={playMode === "v2"}
                  onChange={(e) => setPlayMode(e.target.value)}
                />
                V2 - 5 CHUNK ({characterDailyPlays}/3)
              </label>
            </div>
            <button
              className="game-btn game-btn--primary"
              onClick={() => handlePlayOnChain()}
              disabled={isWalletBusy || !account?.address}
            >
              {isPlayBusy
                ? "Starting..."
                : `Start Play ${playMode.toUpperCase()}`}
            </button>
            <button
              className="game-btn"
              onClick={handleClaimOnChain}
              disabled={!playId || !isKeyFound || isWalletBusy}
            >
              {isClaimBusy ? "Claiming..." : "Claim reward"}
            </button>
            <button
              className="game-btn"
              onClick={handleVerifyClaimStatus}
              disabled={!playId || isWalletBusy || isClaimCheckBusy}
            >
              {isClaimCheckBusy ? "Checking..." : "Verify claim status"}
            </button>
            {playNotice && <div className="game-info__note">{playNotice}</div>}
            {playError && <div className="game-info__error">{playError}</div>}
            {claimError && <div className="game-info__error">{claimError}</div>}
            {claimCheckMessage && (
              <div className="game-info__note">{claimCheckMessage}</div>
            )}

            <div className="game-info__title">Controls</div>
            <div className="game-info__card">
              <span>Move</span>
              <span>W A S D</span>
            </div>
            <div className="game-info__card">
              <span>Attack</span>
              <span>Space</span>
            </div>

            {/* Dynamic Difficulty Info */}
            <div className="game-info__title">⛓️ Network Status</div>
            <div className="game-info__card">
              <span>Network</span>
              <span>{difficultyInfo.networkStatus}</span>
            </div>
            <div className="game-info__card">
              <span>Validators</span>
              <span>{difficultyInfo.validatorStatus}</span>
            </div>
            <div className="game-info__card">
              <span>Base Difficulty</span>
              <span>{difficultyInfo.baseDifficulty}/9</span>
            </div>
            <div className="game-info__card">
              <span>Effective</span>
              <span>{difficultyInfo.effectiveDifficulty.toFixed(1)}/9</span>
            </div>
            <div className="game-info__card">
              <span>Enemies</span>
              <span>
                {difficultyInfo.currentEnemyCount}/
                {difficultyInfo.targetEnemyCount}
              </span>
            </div>
            <div className="game-info__note">
              Difficulty scales with Sui network activity.
            </div>
          </aside>
        </div>
      </div>

      {/* Create Character Modal */}
      {showCreateCharacterModal && (
        <div className="game-modal-overlay">
          <div className="game-modal">
            <div className="game-modal__header">
              <h2>Create Character</h2>
              <button
                className="game-modal__close"
                onClick={() => setShowCreateCharacterModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="game-modal__body">
              <p>You need a character to play. Create one now!</p>
              <div className="game-field">
                <label>Character Name</label>
                <input
                  type="text"
                  value={newCharacterName}
                  onChange={(e) => setNewCharacterName(e.target.value)}
                  placeholder="Enter name (1-32 chars)"
                  maxLength={32}
                  disabled={isCreatingCharacter}
                />
              </div>
              {createCharacterError && (
                <div className="game-info__error">{createCharacterError}</div>
              )}
            </div>
            <div className="game-modal__footer">
              <button
                className="game-btn"
                onClick={() => setShowCreateCharacterModal(false)}
                disabled={isCreatingCharacter}
              >
                Cancel
              </button>
              <button
                className="game-btn game-btn--primary"
                onClick={handleCreateCharacter}
                disabled={isCreatingCharacter || !newCharacterName.trim()}
              >
                {isCreatingCharacter ? "Creating..." : "Create Character"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Session Modal */}
      {showRestoreModal && (
        <div className="game-modal-overlay">
          <div className="game-modal">
            <div className="game-modal__header">
              <span>🔄 Restore Session</span>
              <button onClick={() => setShowRestoreModal(false)}>×</button>
            </div>
            <div className="game-modal__body">
              {/* Fetch Unclaimed Plays */}
              <div className="unclaimed-section">
                <button
                  className="game-btn game-btn--primary"
                  onClick={fetchUnclaimedPlays}
                  disabled={isFetchingUnclaimed}
                  style={{ width: "100%", marginBottom: "12px" }}
                >
                  {isFetchingUnclaimed
                    ? "🔍 Đang tìm..."
                    : "🔍 Tìm Play chưa claim"}
                </button>

                {unclaimedPlays.length > 0 && (
                  <div className="unclaimed-list">
                    <div className="unclaimed-list-header">
                      📋 Play chưa claim ({unclaimedPlays.length}):
                    </div>
                    {unclaimedPlays.map((play) => (
                      <div
                        key={play.playId}
                        className={`unclaimed-item ${
                          restorePlayId === play.playId ? "selected" : ""
                        }`}
                        onClick={() => {
                          setRestorePlayId(play.playId);
                          setRestoreWorldId(play.worldId);
                        }}
                      >
                        <span>Play #{play.playId}</span>
                        <span className="unclaimed-reward">
                          💰 {play.minReward}-{play.maxReward}
                        </span>
                      </div>
                    ))}
                    <div className="unclaimed-note">
                      ⚠️ Bạn vẫn cần nhập Key đã backup từ máy cũ!
                    </div>
                  </div>
                )}
              </div>

              <div className="restore-divider">hoặc nhập thủ công</div>

              <div className="game-field">
                <label>Play ID</label>
                <input
                  type="text"
                  value={restorePlayId}
                  onChange={(e) => setRestorePlayId(e.target.value)}
                  placeholder="VD: 2"
                />
              </div>
              <div className="game-field">
                <label>Key (32 ký tự hex) ⚠️ Bắt buộc</label>
                <input
                  type="text"
                  value={restoreKeyHex}
                  onChange={(e) => setRestoreKeyHex(e.target.value)}
                  placeholder="VD: a1b2c3d4e5f6..."
                  maxLength={32}
                />
              </div>
              <div className="game-field">
                <label>World ID (optional)</label>
                <input
                  type="text"
                  value={restoreWorldId}
                  onChange={(e) => setRestoreWorldId(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>
            <div className="game-modal__footer">
              <button
                className="game-btn"
                onClick={() => setShowRestoreModal(false)}
              >
                Cancel
              </button>
              <button
                className="game-btn game-btn--primary"
                onClick={() => {
                  if (!restorePlayId || !restoreKeyHex) {
                    setPlayError("Play ID và Key là bắt buộc!");
                    return;
                  }
                  if (restoreKeyHex.length !== 32) {
                    setPlayError("Key phải có đúng 32 ký tự!");
                    return;
                  }
                  storePlayState({
                    playId: restorePlayId,
                    keyHex: restoreKeyHex,
                    worldId: restoreWorldId || worldId,
                    found: false,
                  });
                  setPlayId(restorePlayId);
                  setPlayKeyHex(restoreKeyHex);
                  setIsKeyFound(false);
                  setShowRestoreModal(false);
                  setPlayNotice(
                    `✅ Session restored! Play ID: ${restorePlayId}`
                  );
                }}
                disabled={!restorePlayId || !restoreKeyHex}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-start Modal */}
      {showStartModal && (
        <div className="game-modal-overlay game-modal-overlay--start">
          <div className="game-modal">
            <div className="game-modal__header">
              <h2>Start Run</h2>
              <button
                className="game-modal__close"
                onClick={() => setShowStartModal(false)}
              >
                X
              </button>
            </div>
            <div className="game-modal__body">
              <p>Choose your entry mode before the game begins.</p>
              {!mapReady && (
                <div className="game-start-loading">
                  <div className="game-loading-spinner" />
                  <div className="game-loading-text">Loading world...</div>
                </div>
              )}
              <div className="game-start-options">
                <label
                  className={`game-start-option ${
                    startMode === "player" ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="startMode"
                    value="player"
                    checked={startMode === "player"}
                    onChange={(e) => setStartMode(e.target.value)}
                    disabled={!mapReady}
                  />
                  <div>
                    <div className="game-start-option__title">Player</div>
                    <div className="game-start-option__note">
                      Off-chain practice run.
                    </div>
                  </div>
                </label>
                {hasPendingPlay && (
                  <label
                    className={`game-start-option ${
                      startMode === "resume" ? "active" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="startMode"
                      value="resume"
                      checked={startMode === "resume"}
                      onChange={(e) => setStartMode(e.target.value)}
                      disabled={!mapReady}
                    />
                    <div>
                      <div className="game-start-option__title">
                        Resume Key
                      </div>
                      <div className="game-start-option__note">
                        Continue your unclaimed play (#{playId}).
                      </div>
                    </div>
                  </label>
                )}
                <label
                  className={`game-start-option ${
                    startMode === "chain" ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="startMode"
                    value="chain"
                    checked={startMode === "chain"}
                    onChange={(e) => setStartMode(e.target.value)}
                    disabled={!mapReady}
                  />
                  <div>
                    <div className="game-start-option__title">On-chain</div>
                    <div className="game-start-option__note">
                      Choose V1 or V2 to start.
                    </div>
                  </div>
                </label>
                {startMode === "chain" && (
                  <div className="game-start-chain">
                    <label
                      className={`game-start-option ${
                        startChainMode === "v1" ? "active" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="startChainMode"
                        value="v1"
                        checked={startChainMode === "v1"}
                        onChange={(e) => setStartChainMode(e.target.value)}
                        disabled={!mapReady}
                      />
                      <div>
                        <div className="game-start-option__title">V1</div>
                        <div className="game-start-option__note">
                          Free play ({characterFreePlays}/2).
                        </div>
                      </div>
                    </label>
                    <label
                      className={`game-start-option ${
                        startChainMode === "v2" ? "active" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="startChainMode"
                        value="v2"
                        checked={startChainMode === "v2"}
                        onChange={(e) => setStartChainMode(e.target.value)}
                        disabled={!mapReady}
                      />
                      <div>
                        <div className="game-start-option__title">V2</div>
                        <div className="game-start-option__note">
                          Paid play ({characterDailyPlays}/3).
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
              {startModalError && (
                <div className="game-info__error">{startModalError}</div>
              )}
            </div>
            <div className="game-modal__footer">
              <button
                className="game-btn"
                onClick={() => setShowStartModal(false)}
              >
                Close
              </button>
              <button
                className="game-btn game-btn--primary"
                onClick={handleStartModalAction}
                disabled={
                  !mapReady || (startMode === "chain" && isWalletBusy)
                }
              >
                {startMode === "player"
                  ? "Player"
                  : startMode === "resume"
                    ? "Resume"
                    : "Play On-chain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeMoveFields(value) {
  if (!value || typeof value !== "object") return {};
  const record = value;
  if (record.fields && typeof record.fields === "object") {
    return record.fields;
  }
  return record;
}

function normalizeMoveVector(value) {
  if (Array.isArray(value)) return value;
  const fields = normalizeMoveFields(value);
  if (Array.isArray(fields.vec)) return fields.vec;
  return [];
}

function parseU32Value(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
}

function clampU8(value, max) {
  const clamped = Math.max(0, Math.min(max, value));
  return Number.isFinite(clamped) ? clamped : 0;
}

function extractObjectId(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const record = value;
  if (typeof record.bytes === "string") return record.bytes;
  if (typeof record.id === "string") return record.id;
  if (record.id && typeof record.id === "object") {
    const nested = record.id;
    if (typeof nested.bytes === "string") return nested.bytes;
    if (typeof nested.id === "string") return nested.id;
  }
  if (record.fields && typeof record.fields === "object") {
    const fields = record.fields;
    if (typeof fields.bytes === "string") return fields.bytes;
    if (typeof fields.id === "string") return fields.id;
    if (fields.id && typeof fields.id === "object") {
      const nested = fields.id;
      if (typeof nested.bytes === "string") return nested.bytes;
      if (typeof nested.id === "string") return nested.id;
    }
  }

  return "";
}

function extractChunkCoords(value) {
  const fields = normalizeMoveFields(value);
  const cx = parseU32Value(fields.cx);
  const cy = parseU32Value(fields.cy);
  if (cx === null || cy === null) return null;
  return { cx, cy };
}

async function fetchAllDynamicFields(parentId) {
  const all = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await suiClient.getDynamicFields({
      parentId,
      cursor: cursor ?? undefined,
      limit: 50,
    });
    all.push(...page.data);
    cursor = page.nextCursor ?? null;
    hasNextPage = page.hasNextPage;
  }

  return all;
}

async function resolveChunkEntries(worldId, fields) {
  const results = await Promise.allSettled(
    fields.map(async (field) => {
      if (field.name?.type && !field.name.type.includes("ChunkKey")) {
        return null;
      }
      const coords = extractChunkCoords(field.name?.value);
      if (!coords) return null;

      const fieldObject = await suiClient.getDynamicFieldObject({
        parentId: worldId,
        name: field.name,
      });
      const content = fieldObject.data?.content;
      if (!content || content.dataType !== "moveObject") return null;
      const fieldFields = normalizeMoveFields(content.fields);
      const chunkId = extractObjectId(fieldFields.value);
      if (!chunkId) return null;
      return { ...coords, chunkId };
    })
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((entry) => Boolean(entry));
}

function matchesPlayId(parsedJson, targetPlayId) {
  if (!targetPlayId || !parsedJson || typeof parsedJson !== "object") {
    return false;
  }
  const record = parsedJson;
  const candidate =
    typeof record.play_id === "string"
      ? record.play_id
      : typeof record.play_id === "number"
        ? String(record.play_id)
        : typeof record.playId === "string"
          ? record.playId
          : typeof record.playId === "number"
            ? String(record.playId)
            : "";
  return candidate === targetPlayId;
}

async function hasRewardBeenClaimed(targetPlayId) {
  if (!targetPlayId || !PACKAGE_ID) return false;
  const eventType = `${PACKAGE_ID}::world::RewardClaimedEvent`;
  let cursor = null;
  let rounds = 0;
  const limit = 50;
  const maxRounds = 6;

  while (rounds < maxRounds) {
    const page = await suiClient.queryEvents({
      query: { MoveEventType: eventType },
      cursor: cursor ?? undefined,
      limit,
      order: "descending",
    });
    const events = page.data ?? [];

    if (events.some((event) => matchesPlayId(event.parsedJson, targetPlayId))) {
      return true;
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
    rounds += 1;
  }

  return false;
}

async function fetchListedChunk(worldId, chunkId) {
  if (!PACKAGE_ID || !worldId || !chunkId) return null;
  const directName = {
    type: `${PACKAGE_ID}::world::ListingKey`,
    value: { chunk_id: chunkId },
  };
  const directContent = await loadListingContent(worldId, directName);
  if (directContent) return directContent;

  const wrappedName = {
    type: `${PACKAGE_ID}::world::ListingKey`,
    value: { chunk_id: { id: chunkId } },
  };
  const wrappedContent = await loadListingContent(worldId, wrappedName);
  if (wrappedContent) return wrappedContent;

  const bytesName = {
    type: `${PACKAGE_ID}::world::ListingKey`,
    value: { chunk_id: { bytes: chunkId } },
  };
  const bytesContent = await loadListingContent(worldId, bytesName);
  if (bytesContent) return bytesContent;

  const wrappedBytesName = {
    type: `${PACKAGE_ID}::world::ListingKey`,
    value: { chunk_id: { id: { bytes: chunkId } } },
  };
  const wrappedBytesContent = await loadListingContent(
    worldId,
    wrappedBytesName
  );
  if (wrappedBytesContent) return wrappedBytesContent;

  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await suiClient.getDynamicFields({
      parentId: worldId,
      cursor: cursor ?? undefined,
      limit: 200,
    });

    for (const field of page.data ?? []) {
      if (!field?.name?.type || !field.name.type.includes("ListingKey"))
        continue;
      const candidateId = extractListingChunkId(field.name.value);
      if (candidateId && candidateId === chunkId) {
        return await loadListingContent(worldId, field.name);
      }
    }

    cursor = page.nextCursor ?? null;
    hasNextPage = page.hasNextPage;
  }

  return null;
}

async function loadListingContent(worldId, fieldName) {
  try {
    const fieldObject = await suiClient.getDynamicFieldObject({
      parentId: worldId,
      name: fieldName,
    });
    const content = fieldObject.data?.content;
    if (!content || content.dataType !== "moveObject") return null;
    const listingFields = normalizeMoveFields(content.fields);
    const chunk = listingFields.chunk;
    if (!chunk) return null;
    return {
      dataType: "moveObject",
      fields: normalizeMoveFields(chunk),
    };
  } catch (error) {
    return null;
  }
}

function extractListingChunkId(value) {
  const fields = normalizeMoveFields(value);
  const raw = fields.chunk_id ?? fields.chunkId;
  const extracted = extractObjectId(raw);
  if (extracted) return extracted;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const rawFields = normalizeMoveFields(raw);
    if (typeof rawFields.bytes === "string") return rawFields.bytes;
  }
  const fallback = extractObjectId(fields);
  return fallback || "";
}
