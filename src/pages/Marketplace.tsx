import { useEffect, useMemo, useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, REWARD_COIN_TYPE } from "../chain/config";
import { suiClient } from "../chain/suiClient";
import "./Marketplace.css";

type ListingEventFields = {
  world_id?: string;
  chunk_id?: string;
  seller?: string;
  price?: number | string;
};

type Listing = {
  worldId: string;
  chunkId: string;
  seller: string;
  price: number;
  timestamp: number;
};

export default function Marketplace() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void refreshListings();
  }, []);

  const hasListings = listings.length > 0;

  async function refreshListings() {
    if (!PACKAGE_ID) return;
    setIsLoading(true);
    try {
      const listedType = `${PACKAGE_ID}::world::ChunkListedEvent`;
      const soldType = `${PACKAGE_ID}::world::ChunkSoldEvent`;
      const delistedType = `${PACKAGE_ID}::world::ChunkDelistedEvent`;

      const [listedPage, soldPage, delistedPage] = await Promise.all([
        suiClient.queryEvents({
          query: { MoveEventType: listedType },
          order: "descending",
          limit: 100,
        }),
        suiClient.queryEvents({
          query: { MoveEventType: soldType },
          order: "descending",
          limit: 100,
        }),
        suiClient.queryEvents({
          query: { MoveEventType: delistedType },
          order: "descending",
          limit: 100,
        }),
      ]);

      const closedIds = new Set<string>();
      [...soldPage.data, ...delistedPage.data].forEach((event) => {
        const parsed = event.parsedJson as Record<string, unknown>;
        const candidate =
          typeof parsed.chunk_id === "string"
            ? parsed.chunk_id
            : typeof parsed.chunkId === "string"
            ? parsed.chunkId
            : "";
        if (candidate) closedIds.add(candidate);
      });

      const parsed = listedPage.data
        .map((event) => {
          const detail = event.parsedJson as ListingEventFields;
          const chunkId =
            typeof detail.chunk_id === "string"
              ? detail.chunk_id
              : typeof detail.chunkId === "string"
              ? detail.chunkId
              : "";
          const worldId =
            typeof detail.world_id === "string"
              ? detail.world_id
              : typeof detail.worldId === "string"
              ? detail.worldId
              : "";
          const price = Number(detail.price ?? 0);
          if (!chunkId || !worldId || !price) return null;
          return {
            chunkId,
            worldId,
            price,
            seller: detail.seller || "unknown",
            timestamp: event.timestampMs ?? Date.now(),
          } satisfies Listing;
        })
        .filter((item): item is Listing => Boolean(item))
        .filter((item) => !closedIds.has(item.chunkId));

      setListings(parsed);
    } catch (error) {
      console.error("Failed to load listings:", error);
      setStatus("Không thể tải danh sách, thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  }

  const providerLabel = useMemo(() => {
    if (!account?.address) return "Chưa kết nối ví";
    return `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
  }, [account?.address]);

  async function handleBuy(listing: Listing) {
    if (!account?.address) {
      setStatus("Kết nối ví trước khi mua.");
      return;
    }

    setStatus("Chuẩn bị transaction...");
    try {
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: REWARD_COIN_TYPE,
      });
      if (coins.data.length === 0) {
        setStatus("Không có coin để trả. Vui lòng lấy CHUNK từ faucet.");
        return;
      }

      const coin = coins.data.find(
        (c) => BigInt(c.balance) >= BigInt(listing.price)
      ) ?? coins.data[0];

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::world::buy_chunk`,
        arguments: [
          tx.object(listing.worldId),
          tx.object(listing.chunkId),
          tx.object(coin.coinObjectId),
        ],
      });

      await signAndExecute({ transaction: tx });
      setStatus("Gửi giao dịch thành công, cập nhật sau.");
      void refreshListings();
    } catch (error) {
      console.error("Buy failed:", error);
      setStatus("Lỗi khi mua chunk. Xem console để biết chi tiết.");
    }
  }

  return (
    <div className="marketplace-page">
      <header className="marketplace-header">
        <div>
          <h1>Chunk Marketplace</h1>
          <p>Tìm chunk đang được rao bán và mua trực tiếp.</p>
        </div>
        <div className="marketplace-header__actions">
          <span className="marketplace-wallet">{providerLabel}</span>
          <ConnectButton />
        </div>
      </header>

      <section className="marketplace-panel">
        <div className="marketplace-panel__header">
          <h2>Danh sách land đang mở</h2>
          <button onClick={refreshListings} disabled={isLoading}>
            {isLoading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
        {status && <div className="marketplace-status">{status}</div>}
        {hasListings ? (
          <div className="marketplace-grid">
            {listings.map((listing) => (
              <article key={`${listing.chunkId}-${listing.timestamp}`} className="marketplace-card">
                <div>
                  <p className="marketplace-label">Chunk ID</p>
                  <p className="marketplace-value">{listing.chunkId}</p>
                </div>
                <div>
                  <p className="marketplace-label">World</p>
                  <p className="marketplace-value">{listing.worldId}</p>
                </div>
                <div>
                  <p className="marketplace-label">Seller</p>
                  <p className="marketplace-value">{listing.seller}</p>
                </div>
                <div>
                  <p className="marketplace-label">Price</p>
                  <p className="marketplace-value">{listing.price} CHUNK</p>
                </div>
                <button
                  className="marketplace-buy-btn"
                  onClick={() => handleBuy(listing)}
                  disabled={isPending}
                >
                  {isPending ? "Đang xử lý..." : "Mua chunk"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="marketplace-empty">
            Không tìm thấy chunk nào đang được rao bán hiện tại.
          </p>
        )}
      </section>
    </div>
  );
}
