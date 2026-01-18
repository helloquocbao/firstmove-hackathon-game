# Chunk World - Project Overview / Tổng quan

## What It Is / Dự án là gì
- EN: On-chain world builder on Sui: each land tile (ChunkNFT) is an NFT you can build on, trade, and earn from.
- VI: Game xây thế giới on-chain trên Sui: mỗi ô đất (ChunkNFT) là NFT có thể xây, giao dịch và kiếm thưởng.
- EN: Loop: claim chunks, build/edit, play to earn CHUNK, trade chunks, withdraw proceeds.
- VI: Vòng lặp: nhận chunk, xây/sửa, chơi nhận CHUNK, mua/bán chunk, rút tiền.
- EN: Tech: Move (`chunk_world::world`), React/Vite, @mysten/dapp-kit, CHUNK reward coin.
- VI: Công nghệ: Move (`chunk_world::world`), React/Vite, @mysten/dapp-kit, token CHUNK.

## Core On-Chain Logic (Move) / Logic on-chain chính
- EN: World state: `WorldMap` (shared), `WorldRegistry` (one world), `AdminCap` (create world).
- VI: Trạng thái: `WorldMap` (shared), `WorldRegistry` (1 world), `AdminCap` (tạo world).
- EN: Assets: `ChunkNFT` (land), `CharacterNFT` (soulbound), `ChunkListing`, `SellerPayout`, `RewardVault` + CHUNK.
- VI: Tài sản: `ChunkNFT` (đất), `CharacterNFT` (soulbound), `ChunkListing`, `SellerPayout`, `RewardVault` + CHUNK.
- EN Flows: claim/mint chunk (price↑ by chunk_count, adjacency check); edit chunk (tiles/decor/image, update_chunk); marketplace list/buy/cancel/withdraw (pay CHUNK, transfer chunk, store proceeds); gameplay play_v1/play_v2/claim_reward (random reward, boosts stats).
- VI Luồng: claim/mint chunk (giá tăng theo số chunk, kiểm tra liền kề); sửa chunk (tiles/decor/image, update_chunk); chợ list/mua/hủy/rút (trả CHUNK, chuyển chunk, giữ proceeds); gameplay play_v1/play_v2/claim_reward (thưởng ngẫu nhiên, tăng chỉ số).
- EN: Validation: tiles/decor length 25, URL cap, world match, buyer != seller, daily caps, difficulty/name bounds.
- VI: Ràng buộc: tiles/decor đủ 25, giới hạn URL, world trùng, buyer ≠ seller, giới hạn lượt/ngày, biên difficulty/tên.

## Frontend
- EN: Pages: Landing, Game, Editor, Marketplace. WalletHeader shows CHUNK balance + connect.
- VI: Trang: Landing, Game, Editor, Marketplace. WalletHeader hiện số dư CHUNK + nút connect.
- EN: Marketplace: listings via events + dynamic fields; shows chunk images; buy/list/delist; withdraw proceeds.
- VI: Marketplace: lấy listing từ event + dynamic fields; hiển thị ảnh chunk; mua/list/hủy; rút proceeds.
- EN: Enemy/difficulty maintainer: scales spawn targets using world difficulty + network TPS; cached RPC; maintains target enemy count.
- VI: Enemy maintainer: điều chỉnh spawn dựa trên difficulty world + TPS mạng; cache RPC; giữ số quái mục tiêu.

## Game Economy & Dynamic NFTs / Kinh tế & NFT động
- EN: ChunkNFT: mint cost grows with world size; editable on-chain; tradable for CHUNK.
- VI: ChunkNFT: giá mint tăng theo số chunk; chỉnh on-chain; giao dịch bằng CHUNK.
- EN: CharacterNFT (soulbound): power/potential increase via claim_reward.
- VI: CharacterNFT (soulbound): power/potential tăng qua claim_reward.
- EN: CHUNK token: pays land, fees, seller payouts.
- VI: CHUNK: trả đất, phí chơi, trả seller.
- EN: Dynamic NFT: chunk tiles/decor/image and character stats mutate on-chain; emits update events.
- VI: NFT động: tiles/decor/image của chunk và stats nhân vật đổi trên chain; emit event cập nhật.

## Why On-Chain Matters / Vì sao on-chain quan trọng
- EN: True ownership, P2P trading, transparent rewards, composability for other dApps.
- VI: Quyền sở hữu thật, giao dịch P2P, thưởng minh bạch, composable cho dApp khác.
- EN: Without blockchain it’s just a centralized web2 game, losing economic/collectible value.
- VI: Bỏ blockchain thì chỉ còn game web2 tập trung, mất giá trị kinh tế/sưu tầm.
- EN: Remove blockchain and only entertainment remains; no real ownership, no open trading, no interoperable assets.
- VI: Bỏ blockchain thì chỉ còn giải trí; không còn sở hữu thật, giao dịch mở, hay tài sản tương tác dApp khác.

## Demo Script (3 minutes) / Kịch bản demo
1) EN: Edit a chunk (update tiles + image with update_chunk).  
   VI: Sửa chunk (tiles + ảnh qua update_chunk).
2) EN: List the chunk (price in CHUNK).  
   VI: List chunk (giá CHUNK).
3) EN: Buy from another wallet, see transfer.  
   VI: Mua từ ví khác, thấy chunk chuyển chủ.
4) EN: Seller withdraws proceeds (CHUNK to wallet).  
   VI: Người bán rút proceeds (CHUNK về ví).
5) EN (optional): Show play_v2 + claim_reward, stats increase.  
   VI (tuỳ chọn): Chơi play_v2 + claim_reward, tăng chỉ số.

## Near-Term Enhancements / Hướng mở rộng gần hạn
- EN: Switch marketplace to Sui Kiosk (if kiosk IDs available); add zkLogin onboarding.
- VI: Chuyển chợ sang Sui Kiosk (nếu có kiosk ID); thêm zkLogin để onboard nhanh.
- EN: Balance difficulty/spawn/reward; richer chunk metadata.
- VI: Cân bằng difficulty/spawn/reward; làm phong phú metadata chunk.
