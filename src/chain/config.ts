export const SUI_RPC_URL =
  import.meta.env.VITE_SUI_RPC ?? "https://fullnode.testnet.sui.io";

export const PACKAGE_ID =
  import.meta.env.VITE_PACKAGE_ID ??
  "0x393ae48e00f54460ab4d746d32ebc7f0e5abea43fdad14448c1e0551c5f4e855";
export const ADMIN_CAP_ID =
  import.meta.env.VITE_ADMIN_CAP ??
  "0x3547fbf25542816bfeb498b4c9d3152fede7d1f87b1f0e7947f690d75993624c";
export const WORLD_REGISTRY_ID =
  import.meta.env.VITE_WORLD_REGISTRY ??
  "0x613379f166c164d5212229bd72d5012950abe4897c587641f0b47e2e4c48c66b";
export const REWARD_VAULT_ID =
  import.meta.env.VITE_REWARD_VAULT ??
  "0x6f64af90e5420775c27b1b849ebb6864da9e5feeb8babcff43c2b1e962bbd00b";
export const TREASURY_CAP_ID =
  import.meta.env.VITE_TREASURY_CAP ??
  "0xb241216e8286b08f09786ff6c70a66a8b41b90f51ee52c09c42f965b36f76b27";
export const REWARD_COIN_TYPE = PACKAGE_ID
  ? `${PACKAGE_ID}::reward_coin::REWARD_COIN`
  : "";
export const RANDOM_OBJECT_ID = import.meta.env.VITE_RANDOM_OBJECT_ID ?? "0x8";
