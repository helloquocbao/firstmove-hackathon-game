# HiddenKey - 3 Minute Pitch (VI/EN)

## Opening / Mở đầu
- EN: We are HiddenKey. Chunk World is an on-chain world builder on Sui: every land tile (ChunkNFT) is a real NFT you can build, trade, and earn from.
- VI: Chúng tôi là HiddenKey. Chunk World là game xây thế giới on-chain trên Sui: mỗi ô đất (ChunkNFT) là NFT thật, có thể xây, giao dịch và kiếm CHUNK.

## Problem & Idea / Vấn đề & Ý tưởng
- EN: Players want real ownership, transparent trading, and assets usable across apps; web2 cannot deliver.
- VI: Người chơi cần sở hữu thật, giao dịch minh bạch, tài sản dùng được ở dApp khác; web2 không đáp ứng.
- EN: We put land, edits, trading, and rewards fully on-chain. Loop: claim chunk, build/edit, play to earn CHUNK, trade, withdraw.
- VI: Đưa đất, chỉnh sửa, giao dịch, thưởng lên on-chain. Vòng lặp: nhận chunk, xây/sửa, chơi nhận CHUNK, mua/bán, rút tiền.

## Core On-Chain Logic / Logic On-Chain (Non-tech)
- EN: The chain is the “truth source” for land, characters, trades, and rewards.
- VI: Blockchain là “sổ cái thật” giữ đất, nhân vật, giao dịch và thưởng.
- EN: You mint land (ChunkNFT), edit it, and trade it for CHUNK; the chain records ownership and payments.
- VI: Bạn mint đất (ChunkNFT), sửa, mua/bán bằng CHUNK; chuỗi ghi nhận quyền sở hữu và thanh toán.
- EN: Characters are soulbound (non-tradable) and level up by playing and claiming rewards.
- VI: Nhân vật là soulbound (không bán được) và tăng chỉ số khi chơi, nhận thưởng.
- EN: Marketplace is on-chain: list, buy, cancel; seller’s money stays on-chain until they withdraw.
- VI: Chợ on-chain: đăng bán, mua, hủy; tiền của người bán giữ trên chuỗi đến khi rút.
- EN: Basic rules enforced on-chain: valid tiles, fair prices, right owner, daily play limits.
- VI: Luật cơ bản trên chuỗi: tile hợp lệ, giá hợp lý, đúng chủ, giới hạn lượt chơi mỗi ngày.

### Gameplay Difficulty & Enemies (data from Sui) / Độ khó & quái (lấy dữ liệu từ Sui)
- EN: We use the world’s base difficulty (1–9) and number of chunks to set how many enemies should exist. Every few seconds we read Sui network activity (TPS) to know if the network is busy or quiet.
- VI: Lấy độ khó world (1–9) và số lượng chunk để đặt số quái mục tiêu. Mỗi vài giây đọc hoạt động mạng Sui (TPS) để biết mạng bận hay nhàn.
- EN: Effective difficulty = base difficulty × a factor from network load (capped). If current enemies are below target, spawn one more.
- VI: Độ khó thực tế = độ khó gốc × hệ số theo tải mạng (có giới hạn). Nếu số quái hiện tại thấp hơn mục tiêu, spawn thêm 1.
- EN: Enemy HP/damage/speed scale with that effective difficulty, so busier network or harder world means tougher/more enemies.
- VI: Chỉ số quái (HP/sát thương/tốc độ) nhân theo độ khó thực tế; mạng bận hoặc world khó hơn ⇒ quái mạnh/đông hơn.

## Frontend & Gameplay / Giao diện & Gameplay
- EN: Pages: Landing, Game, Editor, Marketplace. WalletHeader shows CHUNK + connect.
- VI: Trang: Landing, Game, Editor, Marketplace. WalletHeader hiện CHUNK + connect.
- EN: Marketplace reads events + dynamic fields; shows chunk images; buy/list/delist; withdraw proceeds.
- VI: Marketplace đọc event + dynamic field; hiển thị ảnh chunk; mua/list/hủy; rút proceeds.
- EN: Enemy/difficulty maintainer scales spawn using world difficulty + network TPS to keep target enemy count.
- VI: Enemy maintainer dùng difficulty world + TPS mạng để giữ số quái mục tiêu.

## Why On-Chain Matters / Vì sao On-Chain
- EN: True ownership, P2P trades, transparent rewards, composable assets for other dApps.
- VI: Sở hữu thật, giao dịch P2P, thưởng minh bạch, tài sản dùng được ở dApp khác.
- EN: Without blockchain it’s just centralized web2 entertainment; no real ownership, no open trading, no interoperable assets.
- VI: Bỏ blockchain chỉ còn giải trí web2; không sở hữu thật, không giao dịch mở, không tài sản tương tác.

## 3-Min Demo Script / Kịch bản demo 3 phút
1) EN: Edit a chunk (update_chunk: tiles + image).  
   VI: Sửa chunk (update_chunk: tiles + ảnh).
2) EN: List the chunk with CHUNK price.  
   VI: List chunk, đặt giá CHUNK.
3) EN: Buy from another wallet, show transfer.  
   VI: Mua từ ví khác, thấy chunk đổi chủ.
4) EN: Seller withdraws proceeds (CHUNK to wallet).  
   VI: Người bán rút proceeds (CHUNK về ví).
5) EN (optional): Play_v2 + claim_reward to earn CHUNK and boost stats.  
   VI (tuỳ chọn): Chơi play_v2 + claim_reward để nhận CHUNK và tăng chỉ số.

## Near-Term Enhancements / Hướng mở rộng
- EN: Move marketplace to Sui Kiosk (if kiosk IDs available); add zkLogin onboarding; balance difficulty/spawn/reward.
- VI: Chuyển chợ sang Sui Kiosk (nếu có kiosk ID); thêm zkLogin; cân bằng difficulty/spawn/reward.

## Closing / Kết
- EN: HiddenKey builds Chunk World for real on-chain ownership and gameplay. Thank you.
- VI: HiddenKey xây Chunk World cho quyền sở hữu on-chain và gameplay thực sự. Cảm ơn. 
