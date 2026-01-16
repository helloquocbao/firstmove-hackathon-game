export type TileKind = "ground" | "barrier" | "abyss";

export type TileDef = {
  id: number;
  name: string;
  image: string;
  kind: TileKind;
};

export const TILE_SPRITE_SIZE = 64;

const TILE_BASE_PATH = "/sprites/Tiles/tilemap-slices";

const TILE_NAMES = [
  "land_1",
  "barrier_1",
  "cliff_1",
  "cliff_2",
  "cliff_3",
  "cliff_4",
  "cliff_5",
  "cliff_6",
  "cliff_7",
  "cliff_8",
  "cliff_9",
  "cliff_10",
  "cliff_12",
  "cliff_13",
  "cliff_14",
  "cliff_16",
  "cliff_17",
  "cliff_18",
  "cliff_19",
];

// Phân loại tile theo prefix
function getTileKind(name: string): TileKind {
  if (name.startsWith("cliff_")) return "abyss"; // Vực - chết khi đi vào
  if (name.startsWith("barrier_")) return "barrier"; // Vật cản - không đi qua được
  if (name.startsWith("land_")) return "ground"; // Đất - có thể đi qua
  return "ground"; // Mặc định
}

export const TILE_DEFS: TileDef[] = TILE_NAMES.map((name, index) => ({
  id: index + 1,
  name,
  image: `${TILE_BASE_PATH}/${name}.png`,
  kind: getTileKind(name),
}));

const TILE_BY_ID = new Map(TILE_DEFS.map((def) => [def.id, def]));

export const MAX_TILE_ID = TILE_DEFS.length;
export const DEFAULT_GROUND_TILE_ID =
  TILE_DEFS.find((def) => def.kind === "ground")?.id ?? 1;
export const VOID_TILE_ID = 0;

export function getTileDef(id: number) {
  return TILE_BY_ID.get(id);
}

export function isTileDefined(id: number) {
  return TILE_BY_ID.has(id);
}

export function isWalkableTile(id: number) {
  const def = TILE_BY_ID.get(id);
  return def?.kind === "ground";
}

export function isBarrierTile(id: number) {
  const def = TILE_BY_ID.get(id);
  return def?.kind === "barrier";
}

export function isAbyssTile(id: number) {
  const def = TILE_BY_ID.get(id);
  return def?.kind === "abyss";
}

export function isSpawnableTile(id: number) {
  // Player và quái chỉ spawn được trên đất
  return isWalkableTile(id);
}

export function isBlockingTile(id: number) {
  // Barrier và abyss đều chặn di chuyển
  const def = TILE_BY_ID.get(id);
  return def?.kind === "barrier" || def?.kind === "abyss";
}

export function normalizeTileId(id: number) {
  return isTileDefined(id) ? id : VOID_TILE_ID;
}
