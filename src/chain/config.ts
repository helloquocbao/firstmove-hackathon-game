export const SUI_RPC_URL =
  import.meta.env.VITE_SUI_RPC ?? "https://fullnode.testnet.sui.io";

export const PACKAGE_ID =
  import.meta.env.VITE_PACKAGE_ID ??
  "0xbaaefc8a2c7edfc447c43081e965149271880a592ce52f6e07d76eddfb9543eb";
export const ADMIN_CAP_ID =
  import.meta.env.VITE_ADMIN_CAP ??
  "0xa4a1267cec03af6304b38f441a78f51a4d1f14ed1ce63477b5774a5eb78142c7";
export const WORLD_REGISTRY_ID =
  import.meta.env.VITE_WORLD_REGISTRY ??
  "0x48006dc4b25992858ef49573cb239f350fb31607da470baec68f0e61d5e16b93";
export const REWARD_VAULT_ID =
  import.meta.env.VITE_REWARD_VAULT ??
  "0xfa098932d9029ce58e4df43ba605d4dc5765463647942ab722bbb9de6fa2ab6e";
export const TREASURY_CAP_ID =
  import.meta.env.VITE_TREASURY_CAP ??
  "0x879c131a0c8ee16985af033c635ccf431d41fbc00ab2c344e5c059892abe6599";
export const REWARD_COIN_TYPE = PACKAGE_ID
  ? `${PACKAGE_ID}::reward_coin::REWARD_COIN`
  : "";
export const RANDOM_OBJECT_ID = import.meta.env.VITE_RANDOM_OBJECT_ID ?? "0x8";
