import { useEffect, useMemo, useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
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

type ChunkInfo = {
  chunkId: string;
  chunkObjectId: string;
  worldId: string;
  cx?: number;
  cy?: number;
  imageUrl?: string;
};

export default function Marketplace() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const [listings, setListings] = useState<Listing[]>([]);
  const [ownedChunks, setOwnedChunks] = useState<ChunkInfo[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [listingStatus, setListingStatus] = useState("");

  const chunkType = PACKAGE_ID ? `${PACKAGE_ID}::world::ChunkNFT` : "";

  useEffect(() => {
    void refreshListings();
    void loadOwnedChunks();
  }, [account?.address]);

  const listedChunkIds = useMemo(
    () => new Set(listings.map((item) => item.chunkId)),
    [listings]
  );
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
        if (candidate) {
          closedIds.add(candidate);
        }
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
      console.log(`parsed`, parsed);
      setListings(parsed);
    } catch (error) {
      console.error("Failed to load listings:", error);
      setStatus("Không thể tải danh sách, thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOwnedChunks() {
    if (!account?.address || !chunkType) {
      setOwnedChunks([]);
      return;
    }

    try {
      const response = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: chunkType },
        options: { showContent: true },
      });

      const parsed = response.data
        .map((item) => {
          const content = item.data?.content;
          if (!content || content.dataType !== "moveObject") {
            return null;
          }
          const objectId = item.data?.objectId ?? "";
          if (!objectId) return null;
          const fields = content.fields as Record<string, unknown>;
          const worldId = extractObjectId(fields.world_id ?? fields.worldId);
          const cx =
            typeof fields.cx === "number" ? fields.cx : Number(fields.cx ?? 0);
          const cy =
            typeof fields.cy === "number" ? fields.cy : Number(fields.cy ?? 0);
          const imageUrl =
            typeof fields.image_url === "string" ? fields.image_url : "";
          return {
            worldId,
            chunkId: objectId,
            chunkObjectId: objectId,
            cx,
            cy,
            imageUrl,
          } satisfies ChunkInfo;
        })
        .filter((chunk): chunk is ChunkInfo => Boolean(chunk));

      setOwnedChunks(parsed);
      const defaults = parsed.reduce<Record<string, string>>((acc, chunk) => {
        if (!acc[chunk.chunkId]) acc[chunk.chunkId] = "";
        return acc;
      }, {});
      setPriceInputs((prev) => ({ ...defaults, ...prev }));
    } catch (error) {
      console.error("Failed to load chunks:", error);
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

      const coin =
        coins.data.find((c) => BigInt(c.balance) >= BigInt(listing.price)) ??
        coins.data[0];

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
      void loadOwnedChunks();
    } catch (error) {
      console.error("Buy failed:", error);
      setStatus("Lỗi khi mua chunk. Xem console để biết chi tiết.");
    }
  }

  const cardBackground = (seed: string) => {
    const hash = seed
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    const hue2 = (hue + 70) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 100%, 35%), hsl(${hue2}, 70%, 45%))`;
  };

  async function handleListChunk(chunk: ChunkInfo) {
    if (!account?.address) {
      setListingStatus("Kết nối ví trước khi rao bán.");
      return;
    }

    const priceValue = Number(priceInputs[chunk.chunkId]);
    if (!priceValue || priceValue <= 0) {
      setListingStatus("Giá phải lớn hơn 0.");
      return;
    }

    if (!chunk.worldId) {
      setListingStatus("Không xác định world ID.");
      return;
    }

    setListingStatus("Đang gửi request...");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::world::list_chunk`,
        arguments: [
          tx.object(chunk.worldId),
          tx.object(chunk.chunkObjectId),
          tx.pure("u64", priceValue),
        ],
      });

      await signAndExecute({ transaction: tx });
      setListingStatus("Chunk đã được đăng bán.");
      void refreshListings();
      void loadOwnedChunks();
    } catch (error) {
      console.error("List failed:", error);
      setListingStatus("Không thể đăng chunk. Kiểm tra console.");
    }
  }

  const ownedSection = (
    <section className="marketplace-section marketplace-owned">
      <div className="marketplace-panel__header">
        <h2>Chunks của bạn</h2>
        <button onClick={loadOwnedChunks}>Tải lại</button>
      </div>
      {listingStatus && (
        <div className="marketplace-status">{listingStatus}</div>
      )}
      {account?.address ? (
        ownedChunks.length > 0 ? (
          <div className="flex grid grid-cols-6 gap-4">
            {ownedChunks.map((chunk) => (
              <article
                key={chunk.chunkId}
                className="marketplace-owned-card col-span-1"
              >
                <div>
                  <img src={chunk?.imageUrl} />
                </div>
                <div>
                  <p className="marketplace-label">Chunk</p>
                  <p className="marketplace-value">{chunk.chunkId}</p>
                </div>
                <div>
                  <p className="marketplace-label">World</p>
                  <p className="marketplace-value">{chunk.worldId}</p>
                </div>
                <div>
                  <p className="marketplace-label">Coords</p>
                  <p className="marketplace-value">
                    ({chunk.cx ?? "?"}, {chunk.cy ?? "?"})
                  </p>
                </div>
                <div className="marketplace-listing-row">
                  <input
                    className="marketplace-price-input"
                    type="number"
                    min="1"
                    value={priceInputs[chunk.chunkId] ?? ""}
                    onChange={(event) =>
                      setPriceInputs((prev) => ({
                        ...prev,
                        [chunk.chunkId]: event.target.value,
                      }))
                    }
                    placeholder="Giá bán (CHUNK)"
                  />
                  <button
                    className="marketplace-buy-btn"
                    onClick={() => handleListChunk(chunk)}
                    disabled={isPending || listedChunkIds.has(chunk.chunkId)}
                  >
                    {listedChunkIds.has(chunk.chunkId)
                      ? "Đã rao"
                      : "Rao bán chunk"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="marketplace-empty">Bạn chưa có chunk nào trong ví.</p>
        )
      ) : (
        <p className="marketplace-empty">Kết nối ví để xem chunk của bạn.</p>
      )}
    </section>
  );

  return (
    <div className="marketplace-page">
      <section className="marketplace-hero">
        <div className="marketplace-hero__copy">
          <p className="marketplace-hero__tag">Marketplace Alpha</p>
          <h1>Buy &amp; Sell Chunk Lands</h1>
          <p className="marketplace-hero__subtitle">
            Every land is an NFT on Sui. List fast, explore others, and claim
            CHUNK tokens as payment.
          </p>
          <div className="marketplace-hero__cta">
            <button onClick={refreshListings} disabled={isLoading}>
              {isLoading ? "Đang tải..." : "Cập nhật danh sách"}
            </button>
            <ConnectButton />
          </div>
        </div>
        <div className="marketplace-hero__panel">
          <div className="marketplace-hero__panel-inner">
            <p>Wallet: {providerLabel}</p>
            <p>Active listings: {listings.length}</p>
            <p>Owned chunks: {ownedChunks.length}</p>
          </div>
        </div>
      </section>

      {ownedSection}

      <section className="marketplace-panel">
        <div className="marketplace-panel__header">
          <h2>Danh sách land đang mở</h2>
          <button onClick={refreshListings} disabled={isLoading}>
            {isLoading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
        {status && <div className="marketplace-status">{status}</div>}
        {hasListings ? (
          <div className="marketplace-grid marketplace-grid--tiles">
            {listings.map((listing) => (
              <article
                key={`${listing.chunkId}-${listing.timestamp}`}
                className="marketplace-card marketplace-card--tile"
              >
                <div
                  className="marketplace-card__preview"
                  style={{ backgroundImage: cardBackground(listing.chunkId) }}
                />
                <div className="marketplace-card__body">
                  <p className="marketplace-label">Chunk</p>
                  <p className="marketplace-value">
                    {listing.chunkId.slice(0, 12)}…
                  </p>
                  <p className="marketplace-label">World</p>
                  <p className="marketplace-value">
                    {listing.worldId.slice(0, 12)}…
                  </p>
                  <p className="marketplace-label">Price</p>
                  <p className="marketplace-value">{listing.price} CHUNK</p>
                </div>
                <button
                  className="marketplace-buy-btn"
                  onClick={() => handleBuy(listing)}
                  disabled={isPending}
                >
                  {isPending ? "Đang xử lý..." : "Mua"}
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

function extractObjectId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  if (record.id && typeof record.id === "object") {
    const nested = record.id as Record<string, unknown>;
    if (typeof nested.id === "string") return nested.id;
  }
  if (record.fields && typeof record.fields === "object") {
    const fields = record.fields as Record<string, unknown>;
    if (typeof fields.id === "string") return fields.id;
    if (fields.id && typeof fields.id === "object") {
      const nested = fields.id as Record<string, unknown>;
      if (typeof nested.id === "string") return nested.id;
    }
  }
  return "";
}
