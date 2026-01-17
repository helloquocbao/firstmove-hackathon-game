/// <reference types="kaboom/global" />
import kaboom, { GameObj } from "kaboom";
import {
  TILE_DEFS,
  DECO_DEFS,
  TILE_SPRITE_SIZE,
  getTileDef,
  getDecoDef,
  isTileDefined,
  isWalkableTile,
  isDecoBlocking,
} from "./tiles";

let started = false;
const TILE = 32;
const CHUNK_SIZE = 5;
const PLAY_STATE_KEY = "PLAY_STATE";
const PLAY_TARGET_KEY = "PLAY_TARGET";

type GameMapData = {
  tileSize: number;
  grid: number[][];
  decoGrid?: number[][];
  worldId?: string;
};

export function startGame(mapData?: GameMapData) {
  if (started) {
    if (mapData) {
      console.log("Restarting game with new map data", mapData);
      go("game", { mapData });
    }
    return;
  }
  started = true;

  kaboom({
    global: true,
    canvas: document.getElementById("game") as HTMLCanvasElement,
    width: 960,
    height: 540,
    background: [203, 232, 255],
    scale: 1,
  });
  // debug.inspect = true;
  // debug.showArea = true;
  /* ================= SPRITES ================= */

  loadSprite("player-idle", "/sprites/player/Idle.png", {
    sliceX: 8,
    anims: {
      idle: { from: 0, to: 7, speed: 15, loop: true },
    },
  });

  loadSprite("player-run", "/sprites/player/Run.png", {
    sliceX: 6,
    anims: {
      run: { from: 0, to: 5, speed: 10, loop: true },
    },
  });

  loadSprite("player-attack", "/sprites/player/Attack.png", {
    sliceX: 4,
    anims: {
      attack: { from: 0, to: 3, speed: 12 },
    },
  });

  // Goblin sprite sheet: 5 rows, row 1 has 7 columns, rows 2-5 have 6 columns
  // Using sliceX=7 to accommodate max columns
  // Row 0: Idle (7 frames), Row 1: Run (6 frames), Row 2: Attack Right (6 frames),
  // Row 3: Attack Down (6 frames), Row 4: Attack Up (6 frames)
  loadSprite("goblin", "/sprites/goblin/Goblin.png", {
    sliceX: 7,
    sliceY: 5,
    anims: {
      idle: { from: 0, to: 6, speed: 8, loop: true }, // Row 0: frames 0-6 (7 frames)
      run: { from: 7, to: 12, speed: 10, loop: true }, // Row 1: frames 7-12 (6 frames, skip 13)
      "attack-right": { from: 14, to: 19, speed: 12 }, // Row 2: frames 14-19 (6 frames, skip 20)
      "attack-down": { from: 21, to: 26, speed: 12 }, // Row 3: frames 21-26 (6 frames, skip 27)
      "attack-up": { from: 28, to: 33, speed: 12 }, // Row 4: frames 28-33 (6 frames, skip 34)
    },
  });

  TILE_DEFS.forEach((tile) => {
    loadSprite(tile.name, tile.image);
  });

  DECO_DEFS.forEach((deco) => {
    loadSprite(deco.name, deco.image);
  });

  /* ================= MAP ================= */

  function loadMap(): GameMapData | null {
    const raw = localStorage.getItem("CUSTOM_MAP");
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function findSpawn(grid: number[][], size: number) {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (isWalkableTile(grid[y][x])) {
          return vec2(x * size + size / 2, y * size + size / 2);
        }
      }
    }
    return vec2(64, 64);
  }

  function drawTiles(
    grid: number[][],
    decoGrid: number[][] | undefined,
    tileSize: number
  ) {
    const scaleFactor = tileSize / TILE_SPRITE_SIZE;

    // Layer 1: Base tiles
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const tileId = grid[y][x];
        const tileDef = getTileDef(tileId);
        if (!tileDef) continue;
        add([
          sprite(tileDef.name),
          pos(x * tileSize, y * tileSize),
          anchor("topleft"),
          scale(scaleFactor),
          tileDef.kind === "abyss" ? "abyss" : "ground",
        ]);
      }
    }

    // Layer 2: Decorations
    if (decoGrid) {
      for (let y = 0; y < decoGrid.length; y++) {
        for (let x = 0; x < (decoGrid[y]?.length ?? 0); x++) {
          const decoId = decoGrid[y]?.[x] ?? 0;
          if (decoId === 0) continue;
          const decoDef = getDecoDef(decoId);
          if (!decoDef) continue;
          const decoObj = add([
            sprite(decoDef.name),
            pos(x * tileSize, y * tileSize),
            anchor("topleft"),
            scale(scaleFactor),
            "decoration",
          ]);
          // Add collision area for blocking decorations
          if (decoDef.kind === "blocking") {
            decoObj.use(area({ shape: new Rect(vec2(0), tileSize, tileSize) }));
            decoObj.use(body({ isStatic: true }));
          }
        }
      }
    }
  }

  /* ================= SCENE ================= */

  scene("game", (data?: { mapData?: GameMapData }) => {
    const resolvedMap = data?.mapData ?? loadMap();
    if (!resolvedMap?.grid) {
      add([text("NO MAP FOUND"), pos(center()), anchor("center")]);
      return;
    }

    const tileSize = resolvedMap.tileSize || TILE;
    const spawnPos = findSpawn(resolvedMap.grid, tileSize);
    drawTiles(resolvedMap.grid, resolvedMap.decoGrid, tileSize);

    /* ================= GOBLIN SYSTEM ================= */

    const GOBLIN_CONFIG = {
      speed: 80,
      chaseRange: 150,
      attackRange: 40,
      attackCooldown: 1.5,
      patrolRange: 100,
      health: 3,
    };

    type GoblinState = "idle" | "patrol" | "chase" | "attack";

    function findGoblinSpawns(grid: number[][], count: number) {
      const spawns: { x: number; y: number }[] = [];
      const candidates: { x: number; y: number }[] = [];

      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
          if (isWalkableTile(grid[y][x])) {
            candidates.push({ x, y });
          }
        }
      }

      // Randomly pick spawn points
      for (let i = 0; i < count && candidates.length > 0; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        spawns.push(candidates[idx]);
        candidates.splice(idx, 1);
      }

      return spawns;
    }

    function spawnGoblin(spawnX: number, spawnY: number) {
      const goblin = add([
        sprite("goblin", { anim: "idle" }),
        pos(spawnX * tileSize + tileSize / 2, spawnY * tileSize + tileSize / 2),
        area({ shape: new Rect(vec2(0), 40, 40) }),
        anchor("center"),
        scale(0.3),
        {
          state: "idle" as GoblinState,
          facing: 1,
          health: GOBLIN_CONFIG.health,
          attackTimer: 0,
          patrolTarget: null as { x: number; y: number } | null,
          patrolOrigin: { x: spawnX, y: spawnY },
          stateTimer: 0,
        },
        "goblin",
        "enemy",
      ]);

      return goblin;
    }

    function updateGoblin(
      goblin: ReturnType<typeof spawnGoblin>,
      playerPos: Vec2
    ) {
      const dist = goblin.pos.dist(playerPos);
      const dt_val = dt();
      goblin.attackTimer = Math.max(0, goblin.attackTimer - dt_val);
      goblin.stateTimer += dt_val;

      // State transitions
      if (dist <= GOBLIN_CONFIG.attackRange && goblin.attackTimer <= 0) {
        goblin.state = "attack";
      } else if (dist <= GOBLIN_CONFIG.chaseRange) {
        if (goblin.state !== "attack") goblin.state = "chase";
      } else {
        if (goblin.state === "chase") goblin.state = "patrol";
        if (goblin.state === "idle" && goblin.stateTimer > 2) {
          goblin.state = "patrol";
          goblin.stateTimer = 0;
        }
      }

      // State behaviors
      switch (goblin.state) {
        case "idle":
          if (goblin.curAnim() !== "idle") {
            goblin.play("idle");
          }
          break;

        case "patrol": {
          if (
            !goblin.patrolTarget ||
            goblin.pos.dist(
              vec2(
                goblin.patrolTarget.x * tileSize + tileSize / 2,
                goblin.patrolTarget.y * tileSize + tileSize / 2
              )
            ) < 10
          ) {
            // Pick new patrol target
            const ox = goblin.patrolOrigin.x;
            const oy = goblin.patrolOrigin.y;
            const range = Math.floor(GOBLIN_CONFIG.patrolRange / tileSize);
            const nx = ox + Math.floor(Math.random() * range * 2) - range;
            const ny = oy + Math.floor(Math.random() * range * 2) - range;
            if (
              nx >= 0 &&
              ny >= 0 &&
              ny < resolvedMap.grid.length &&
              nx < (resolvedMap.grid[ny]?.length ?? 0) &&
              isWalkableTile(resolvedMap.grid[ny]?.[nx] ?? 0)
            ) {
              goblin.patrolTarget = { x: nx, y: ny };
            } else {
              goblin.state = "idle";
              goblin.stateTimer = 0;
              break;
            }
          }

          const patrolPos = vec2(
            goblin.patrolTarget.x * tileSize + tileSize / 2,
            goblin.patrolTarget.y * tileSize + tileSize / 2
          );
          const patrolDir = patrolPos.sub(goblin.pos).unit();
          goblin.pos = goblin.pos.add(
            patrolDir.scale(GOBLIN_CONFIG.speed * 0.5 * dt_val)
          );
          goblin.facing = patrolDir.x >= 0 ? 1 : -1;
          goblin.flipX = goblin.facing === -1;

          if (goblin.curAnim() !== "run") {
            goblin.play("run");
          }
          break;
        }

        case "chase": {
          const chaseDir = playerPos.sub(goblin.pos).unit();
          const nextPos = goblin.pos.add(
            chaseDir.scale(GOBLIN_CONFIG.speed * dt_val)
          );

          // Check if next position is walkable
          const tileX = Math.floor(nextPos.x / tileSize);
          const tileY = Math.floor(nextPos.y / tileSize);
          if (
            tileY >= 0 &&
            tileY < resolvedMap.grid.length &&
            tileX >= 0 &&
            tileX < (resolvedMap.grid[tileY]?.length ?? 0) &&
            isWalkableTile(resolvedMap.grid[tileY]?.[tileX] ?? 0)
          ) {
            goblin.pos = nextPos;
          }

          goblin.facing = chaseDir.x >= 0 ? 1 : -1;
          goblin.flipX = goblin.facing === -1;

          if (goblin.curAnim() !== "run") {
            goblin.play("run");
          }
          break;
        }

        case "attack": {
          if (goblin.attackTimer <= 0) {
            // Determine attack direction
            const dir = playerPos.sub(goblin.pos);
            let attackAnim = "attack-right";
            if (Math.abs(dir.y) > Math.abs(dir.x)) {
              attackAnim = dir.y > 0 ? "attack-down" : "attack-up";
            }
            goblin.facing = dir.x >= 0 ? 1 : -1;
            goblin.flipX = goblin.facing === -1;

            goblin.play(attackAnim);
            goblin.attackTimer = GOBLIN_CONFIG.attackCooldown;

            // Spawn attack hitbox
            wait(0.2, () => {
              if (!goblin.exists()) return;
              const hitbox = add([
                pos(goblin.pos.x + goblin.facing * 25, goblin.pos.y),
                area({ shape: new Rect(vec2(0), 30, 30) }),
                anchor("center"),
                lifespan(0.15),
                "goblin-attack",
              ]);
            });
          }

          // Return to chase after attack animation
          if (goblin.attackTimer < GOBLIN_CONFIG.attackCooldown - 0.5) {
            goblin.state = "chase";
          }
          break;
        }
      }
    }

    // Spawn goblins on map
    const goblinCount = Math.max(
      1,
      Math.floor(
        (resolvedMap.grid.length * (resolvedMap.grid[0]?.length ?? 0)) / 50
      )
    );
    const goblinSpawns = findGoblinSpawns(resolvedMap.grid, goblinCount);
    const goblins = goblinSpawns.map((spawn) => spawnGoblin(spawn.x, spawn.y));

    // Update all goblins
    onUpdate(() => {
      goblins.forEach((goblin) => {
        if (goblin.exists()) {
          updateGoblin(goblin, player.pos);
        }
      });
    });

    // Handle player attack hitting goblins
    onCollide("attack", "goblin", (attack, goblin) => {
      goblin.health -= 1;
      if (goblin.health <= 0) {
        goblin.destroy();
      } else {
        // Knockback
        const knockDir = goblin.pos.sub(player.pos).unit();
        goblin.pos = goblin.pos.add(knockDir.scale(20));
      }
    });

    // Handle goblin attack hitting player
    onCollide("goblin-attack", "player", () => {
      // Player takes damage - restart for now
      go("game", { mapData: resolvedMap });
    });

    /* ================= PLAYER ================= */

    const player = add([
      sprite("player-idle", { anim: "idle" }),
      pos(spawnPos),
      area({ shape: new Rect(vec2(0), 65, 70) }),
      anchor("center"),
      {
        speed: 200,
        facing: 1, // 1 right, -1 left
        attacking: false,
      },
      scale(0.3),
      "player",
    ]);

    const playTarget = loadPlayTarget();
    const playState = loadPlayState();
    const worldMatch =
      !playTarget?.worldId ||
      !resolvedMap.worldId ||
      playTarget.worldId === resolvedMap.worldId;
    if (
      playTarget &&
      worldMatch &&
      !playTarget.found &&
      Number.isFinite(playTarget.x) &&
      Number.isFinite(playTarget.y) &&
      isWalkableTile(resolvedMap.grid[playTarget.y]?.[playTarget.x] ?? 0)
    ) {
      const keyPos = vec2(
        playTarget.x * tileSize + tileSize / 2,
        playTarget.y * tileSize + tileSize / 2
      );
      const keyObj = add([
        rect(tileSize * 0.6, tileSize * 0.6),
        pos(keyPos),
        area(),
        anchor("center"),
        color(250, 210, 72),
        "key",
      ]);
      let keyFound = false;
      player.onCollide("key", () => {
        if (keyFound) return;
        keyFound = true;
        keyObj.destroy();
        markKeyFound(playTarget, playState?.playId);
      });
    }

    onUpdate(() => {
      camPos(player.pos);
      camScale(1.3); // Zoom camera 2x để nhìn rõ hơn
    });

    /* ================= INPUT STATE ================= */

    let moveDir = vec2(0, 0);
    let isFalling = false;

    function handleFallDeath() {
      if (isFalling) return;
      isFalling = true;
      go("game", { mapData: resolvedMap });
    }

    onKeyDown("a", () => {
      moveDir.x = -1;
      player.facing = -1;
    });

    onKeyDown("d", () => {
      moveDir.x = 1;
      player.facing = 1;
    });

    onKeyDown("w", () => (moveDir.y = -1));
    onKeyDown("s", () => (moveDir.y = 1));

    /* ================= MOVE ================= */

    function getTileIdAt(pos: Vec2) {
      const x = Math.floor(pos.x / tileSize);
      const y = Math.floor(pos.y / tileSize);
      if (y < 0 || y >= resolvedMap.grid.length) return null;
      if (x < 0 || x >= (resolvedMap.grid[y]?.length ?? 0)) return null;
      const value = resolvedMap.grid[y]?.[x];
      return typeof value === "number" ? value : null;
    }

    function canMove(pos: Vec2) {
      const tileId = getTileIdAt(pos);
      if (tileId === null) return true;
      if (!isTileDefined(tileId)) return true;
      return isWalkableTile(tileId);
    }

    /* ================= ATTACK ================= */

    function spawnAttackHitbox() {
      add([
        pos(player.pos.x + player.facing * 20, player.pos.y),
        area({ shape: new Rect(vec2(1), 10, 20) }),
        anchor("center"),
        lifespan(0.1),
        "attack",
      ]);
    }

    function attack() {
      if (player.attacking) return;

      player.attacking = true;

      player.use(sprite("player-attack"));
      player.play("attack");

      wait(0.1, spawnAttackHitbox);

      wait(0.45, () => {
        player.attacking = false;
      });
    }

    onKeyPress("space", attack);

    /* ================= UPDATE LOOP ================= */

    player.onUpdate(() => {
      /* ---- MOVE ---- */
      if (!player.attacking && moveDir.len() > 0) {
        const next = player.pos.add(moveDir.unit().scale(player.speed * dt()));
        if (canMove(next)) player.pos = next;
      }

      /* ---- FLIP (1 nơi duy nhất) ---- */
      const currentTile = getTileIdAt(player.pos);
      if (currentTile === null || !isTileDefined(currentTile)) {
        handleFallDeath();
        return;
      }

      player.flipX = player.facing === -1;

      /* ---- ANIMATION FSM ---- */
      if (player.attacking) {
        moveDir = vec2(0, 0);
        return;
      }

      if (moveDir.len() > 0) {
        if (player.curAnim() !== "run") {
          player.use(sprite("player-run"));
          player.play("run");
        }
      } else {
        if (player.curAnim() !== "idle") {
          player.use(sprite("player-idle"));
          player.play("idle");
        }
      }

      /* ---- RESET INPUT ---- */
      moveDir = vec2(0, 0);
    });
  });

  if (mapData) {
    go("game", { mapData });
  } else {
    go("game");
  }
}

function loadPlayState(): { playId?: string } | null {
  const raw = localStorage.getItem(PLAY_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function loadPlayTarget(): {
  x: number;
  y: number;
  found?: boolean;
  worldId?: string;
} | null {
  const raw = localStorage.getItem(PLAY_TARGET_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function markKeyFound(target: { x: number; y: number }, playId?: string) {
  localStorage.setItem(
    PLAY_TARGET_KEY,
    JSON.stringify({ ...target, found: true })
  );
  window.dispatchEvent(
    new CustomEvent("game:key-found", { detail: { playId } })
  );
}
