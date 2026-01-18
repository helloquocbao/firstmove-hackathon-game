# HiddenKey - 3 Minute Pitch (VI/EN)

## Opening / Mo dau
- EN: We are HiddenKey. Chunk World is an on-chain world builder on Sui: every land tile (ChunkNFT) is a real NFT you can build, trade, and earn from.
- VI: Chung toi la HiddenKey. Chunk World la game xay the gioi on-chain tren Sui: moi o dat (ChunkNFT) la NFT that, co the xay, giao dich va kiem CHUNK.

## Problem & Idea / Van de & Y tuong
- EN: Players want real ownership, transparent trading, and assets usable across apps; web2 cannot deliver.
- VI: Nguoi choi can so huu that, giao dich minh bach, tai san dung duoc o ung dung khac; web2 khong dap ung.
- EN: We put land, edits, trading, and rewards fully on-chain. Loop: claim chunk, build/edit, play to earn CHUNK, trade, withdraw.
- VI: Dua dat, chinh sua, giao dich, thuong len on-chain. Vong lap: nhan chunk, xay/sua, choi nhan CHUNK, mua/ban, rut tien.

## Core On-Chain Logic / Logic On-Chain (Non-tech)
- EN: The chain is the "truth source" for land, characters, trades, and rewards.
- VI: Blockchain la "so cai that" giu dat, nhan vat, giao dich va thuong.
- EN: You mint land (ChunkNFT), edit it, and trade it for CHUNK; the chain records ownership and payments.
- VI: Ban mint dat (ChunkNFT), sua, mua/ban bang CHUNK; chuoi ghi nhan quyen so huu va thanh toan.
- EN: Characters are soulbound (non-tradable) and level up by playing and claiming rewards.
- VI: Nhan vat la soulbound (khong ban duoc) va tang chi so khi choi, nhan thuong.
- EN: Marketplace is on-chain: list, buy, cancel; seller money stays on-chain until they withdraw.
- VI: Cho on-chain: dang ban, mua, huy; tien nguoi ban giu tren chuoi den khi rut.
- EN: Basic rules enforced on-chain: valid tiles, fair prices, right owner, daily play limits.
- VI: Luat co ban tren chuoi: tile hop le, gia hop ly, dung chu, gioi han luot choi moi ngay.

## Gameplay Difficulty & Enemies (data from Sui) / Do kho & quai (lay du lieu tu Sui)
- EN: We use the world’s base difficulty (1–9) and number of chunks to set how many enemies should exist. Every few seconds we read Sui network activity (TPS) via `getTotalTransactionBlocks` to know if the network is busy or quiet.
- VI: Lay do kho world (1–9) va so luong chunk de dat so quai muc tieu. Moi vai giay doc TPS mang Sui bang `getTotalTransactionBlocks` de biet mang ban hay nhan.
- EN: Effective difficulty = base difficulty x a factor from network load (capped). If current enemies are below target, spawn one more; enemy stats scale with this.
- VI: Do kho thuc te = do kho goc x he so theo tai mang (co gioi han). Neu so quai hien tai duoi muc tieu thi spawn them; chi so quai cung nhan theo do kho thuc te.
- EN: Enemy HP/damage/speed scale with that effective difficulty, so busier network or harder world means tougher/more enemies.
- VI: Chi so quai (HP/sat thuong/toc do) nhan theo do kho thuc te; mang ban hoac world kho hon thi quai manh/dong hon.

**Note**: `sui_getTotalTransactionBlocks` returns the total executed programmable transaction blocks (PTBs) — one RPC call gives the count used to infer TPS/load.

## Frontend & Gameplay / Giao dien & Gameplay
- EN: Pages: Landing, Game, Editor, Marketplace. WalletHeader shows CHUNK + connect.
- VI: Trang: Landing, Game, Editor, Marketplace. WalletHeader hien CHUNK + connect.
- EN: Marketplace reads events + dynamic fields; shows chunk images; buy/list/delist; withdraw proceeds.
- VI: Marketplace doc event + dynamic field; hien anh chunk; mua/list/huy; rut proceeds.
- EN: Enemy/difficulty maintainer scales spawn using world difficulty + network TPS to keep target enemy count.
- VI: Enemy maintainer dung difficulty world + TPS mang de giu so quai muc tieu.

## Why On-Chain Matters / Vi sao On-Chain
- EN: True ownership, P2P trades, transparent rewards, composable assets for other dApps.
- VI: So huu that, giao dich P2P, thuong minh bach, tai san dung duoc o dApp khac.
- EN: Without blockchain it’s just centralized web2 entertainment; no real ownership, no open trading, no interoperable assets.
- VI: Bo blockchain chi con giai tri web2; khong so huu that, khong giao dich mo, khong tai san tuong tac.

## 3-Min Demo Script / Kich ban demo 3 phut
1) EN: Edit a chunk (update_chunk: tiles + image).  
   VI: Sua chunk (update_chunk: tiles + anh).
2) EN: List the chunk with CHUNK price.  
   VI: List chunk, dat gia CHUNK.
3) EN: Buy from another wallet, show transfer.  
   VI: Mua tu vi khac, thay chunk doi chu.
4) EN: Seller withdraws proceeds (CHUNK to wallet).  
   VI: Nguoi ban rut proceeds (CHUNK ve vi).
5) EN (optional): Play_v2 + claim_reward to earn CHUNK and boost stats.  
   VI (tuy chon): Choi play_v2 + claim_reward de nhan CHUNK va tang chi so.

## Near-Term Enhancements / Huong mo rong
- EN: Move marketplace to Sui Kiosk (if kiosk IDs available); add zkLogin onboarding; balance difficulty/spawn/reward.
- VI: Chuyen cho sang Sui Kiosk (neu co kiosk ID); them zkLogin; can bang difficulty/spawn/reward.

## Closing / Ket
- EN: HiddenKey builds Chunk World for real on-chain ownership and gameplay. Thank you.
- VI: HiddenKey xay Chunk World cho quyen so huu on-chain va gameplay thuc su. Cam on.
