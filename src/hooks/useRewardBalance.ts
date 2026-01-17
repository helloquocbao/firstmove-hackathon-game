import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { REWARD_COIN_TYPE } from "../chain/config";
import { suiClient } from "../chain/suiClient";

/**
 * Hook to fetch and track the user's CHUNK reward token balance
 */
export function useRewardBalance() {
  const account = useCurrentAccount();
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchBalance() {
      if (!account?.address || !REWARD_COIN_TYPE) {
        setBalance(0);
        return;
      }
      
      setIsLoading(true);
      try {
        const coins = await suiClient.getCoins({
          owner: account.address,
          coinType: REWARD_COIN_TYPE,
        });
        const total = coins.data.reduce(
          (sum, coin) => sum + BigInt(coin.balance),
          BigInt(0),
        );
        // DECIMALS = 0 in reward_coin.move, so no division needed
        setBalance(Number(total));
      } catch (err) {
        console.error("Failed to fetch reward balance:", err);
        setBalance(0);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBalance();
  }, [account?.address]);

  return { balance, isLoading, account };
}
