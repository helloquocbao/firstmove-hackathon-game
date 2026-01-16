export type TileKind = "ground" | "barrier" | "abyss";
export type DecoKind = "none" | "walkable" | "blocking";
export type PaintLayer = "base" | "decor";

export type TileDef = {
  id: number;
  name: string;
  image: string;
  kind: TileKind;
};

export type DecoDef = {
  id: number;
  name: string;
  image: string;
  kind: DecoKind;
};

export const TILE_SPRITE_SIZE = 64;

const TILE_BASE_PATH = "/sprites/Tiles/tilemap-slices";
const DECO_BASE_PATH = "/sprites/decorations";

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

// Decoration definitions
const DECO_ENTRIES: { name: string; kind: DecoKind }[] = [
  { name: "grass_1", kind: "walkable" },
  { name: "grass_2", kind: "walkable" },
  { name: "flower_1", kind: "walkable" },
  { name: "flower_2", kind: "walkable" },
  { name: "tree_1", kind: "blocking" },
  { name: "tree_2", kind: "blocking" },
  { name: "rock_1", kind: "blocking" },
  { name: "rock_2", kind: "blocking" },
  { name: "bush_1", kind: "blocking" },
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

export const DECO_DEFS: DecoDef[] = DECO_ENTRIES.map((entry, index) => ({
  id: index + 1,
  name: entry.name,
  image: `${DECO_BASE_PATH}/${entry.name}.png`,
  kind: entry.kind,
}));

const TILE_BY_ID = new Map(TILE_DEFS.map((def) => [def.id, def]));
const DECO_BY_ID = new Map(DECO_DEFS.map((def) => [def.id, def]));

export const MAX_TILE_ID = TILE_DEFS.length;
export const MAX_DECO_ID = DECO_DEFS.length;
export const DEFAULT_GROUND_TILE_ID =
  TILE_DEFS.find((def) => def.kind === "ground")?.id ?? 1;
export const VOID_TILE_ID = 0;
export const NO_DECO_ID = 0;

export function getTileDef(id: number) {
  return TILE_BY_ID.get(id);
}

export function getDecoDef(id: number) {
  return DECO_BY_ID.get(id);
}

export function isTileDefined(id: number) {
  return TILE_BY_ID.has(id);
}

export function isDecoDefined(id: number) {
  return DECO_BY_ID.has(id);
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

export function normalizeDecoId(id: number) {
  return isDecoDefined(id) ? id : NO_DECO_ID;
}

export function isDecoWalkable(id: number) {
  if (id === NO_DECO_ID) return true;
  const def = DECO_BY_ID.get(id);
  return def?.kind === "walkable";
}

export function isDecoBlocking(id: number) {
  const def = DECO_BY_ID.get(id);
  return def?.kind === "blocking";
}

// Kiểm tra tổng hợp: tile + decoration có đi qua được không
export function canWalkAt(tileId: number, decoId: number = 0) {
  return isWalkableTile(tileId) && isDecoWalkable(decoId);
}
