export const SUI_RPC_URL =
  import.meta.env.VITE_SUI_RPC ?? "https://fullnode.testnet.sui.io";

export const PACKAGE_ID =
  import.meta.env.VITE_PACKAGE_ID ??
  "0xf3f4c1accd9281509e844d17043c7491f52c55aea7f7d4190dcb74efc5b166ce";
export const ADMIN_CAP_ID =
  import.meta.env.VITE_ADMIN_CAP ??
  "0x02c3be02fe16a73d4873935a70449cd4b1bf413ad4c96e927b4a4e7d922b3357";
export const WORLD_REGISTRY_ID =
  import.meta.env.VITE_WORLD_REGISTRY ??
  "0xa20bbb3e61c44bf2ac588e6248faf63bcb0297ddf863c457685932e9ec1f6b07";
export const REWARD_VAULT_ID =
  import.meta.env.VITE_REWARD_VAULT ??
  "0x3e08ae2937e847a534c16a08d15d7a1637180dabd184144d0d4c5f5307d03ab0";
export const TREASURY_CAP_ID =
  import.meta.env.VITE_TREASURY_CAP ??
  "0x53d26f433377314e6267d5087af83996bcd7ad5daf0e034eddd701375863b2d1";
export const REWARD_COIN_TYPE = PACKAGE_ID
  ? `${PACKAGE_ID}::reward_coin::REWARD_COIN`
  : "";
export const RANDOM_OBJECT_ID = import.meta.env.VITE_RANDOM_OBJECT_ID ?? "0x8";
