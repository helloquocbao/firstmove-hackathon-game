export const SUI_RPC_URL =
  import.meta.env.VITE_SUI_RPC ?? "https://fullnode.testnet.sui.io";

export const PACKAGE_ID =
  import.meta.env.VITE_PACKAGE_ID ??
  "0x1db384099fc63a48cd0e35aeda0832ef958defcb3c6d1822ae8a6bd51a9bdc34";
export const ADMIN_CAP_ID =
  import.meta.env.VITE_ADMIN_CAP ??
  "0x102c0f57de9f6ec1107af60eabce8a444270344b4cd9c85c3106a523fd5a35b2";
export const WORLD_REGISTRY_ID =
  import.meta.env.VITE_WORLD_REGISTRY ??
  "0x43244a99411c2c3ddd6aba56a5bcd0592e7f816d66718673d7d80dd62bafe87b";
export const REWARD_VAULT_ID =
  import.meta.env.VITE_REWARD_VAULT ??
  "0xc7fe09791cc0b45605bbe16afb8291e33d6790e95d63b0695c4c179fc53438eb";
export const TREASURY_CAP_ID =
  import.meta.env.VITE_TREASURY_CAP ??
  "0x2c5dffa25f5af4f0ae543b06cf9046361c2db4d34c14ca4f331e3cbf4ffc883c";
export const REWARD_COIN_TYPE = PACKAGE_ID
  ? `${PACKAGE_ID}::reward_coin::REWARD_COIN`
  : "";
export const RANDOM_OBJECT_ID = import.meta.env.VITE_RANDOM_OBJECT_ID ?? "0x8";
