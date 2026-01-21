# Chunk Adventure - Play & Claim Flow (code hi?n t?i)

## T?ng quan
- Không còn hash/key d? claim. On-chain luu `PlayTicket { player, policy_id=BCS(play_id), min_reward, max_reward }`.
- Gi?i h?n choi theo epoch: `play_v1` (free) t?i da 2 l?n/ngày; `play_v2` (paid) t?i da 3 l?n/ngày.
- Reward coin du?c reserve khi play; claim rút coin và tang `power/potential` theo d? khó world.

## Flow play
1. Ch?n nhân v?t (ph?i có `power >= world.required_power`).
2. G?i:
   - `play_v1(world, vault, character)`  
     - Không phí, reserve `MIN_REWARD` (2). Gi?i h?n 2 l?n/epoch (`tx_context::epoch`).
   - `play_v2(world, vault, character, fee_coin)`  
     - Tr? phí `PLAY_FEE` (5), reserve `MAX_REWARD` (15). Gi?i h?n 3 l?n/epoch.
3. Contract:
   - Reset b? d?m daily khi sang epoch m?i.
   - Tang `world.next_play_id`, t?o `policy_id = bcs::to_bytes(play_id)`.
   - Luu `PlayTicket` vào DF `PlayKey { id: play_id }`.
   - Emit `PlayCreatedEvent { play_id, min_reward, max_reward, creator }`.

### So d? play/claim nhanh
```mermaid
flowchart LR
    PLAYBTN[Player: Play (v1/v2)] --> CHECKS[Check power + daily limit]
    CHECKS --> RESERVE[Reserve reward coin]
    RESERVE --> TICKET[Create PlayTicket + policy_id = BCS(play_id)]
    TICKET --> EVT[PlayCreatedEvent]
    EVT --> CLAIMBTN[Player nh?n Claim]
    CLAIMBTN --> CLAIMTX[claim_reward(world, vault, character, randomness, play_id)]
    CLAIMTX --> REWARD[Random reward in [min,max] + withdraw coin]
    REWARD --> UPDATE[+power = reward * difficulty; +potential = difficulty]
    UPDATE --> EMIT[RewardClaimedEvent + CharacterUpdatedEvent]
```

## Claim reward
1. FE ch? c?n `play_id` và `character` (dúng owner). Không c?n key.
2. `claim_reward`:
   - Ki?m tra play t?n t?i, min/max h?p l?.
   - Random `reward` trong `[min_reward, max_reward]`.
   - `unreserve(max_reward)` r?i `withdraw(reward)` t? vault.
   - Sender ph?i là `player` c?a ticket (`E_INVALID_SEAL` n?u sai).
   - C?ng `power += reward * difficulty`, `potential += difficulty`.
   - Emit `RewardClaimedEvent`, `CharacterUpdatedEvent`.

## Seal approve (dành cho key server, tùy ch?n)
- `seal_approve(id: vector<u8>, play_id, world)` ki?m tra:
  - `PlayTicket` t?n t?i và `ticket.policy_id == id` (BCS(play_id)).
  - Sender == `ticket.player`.
- Dùng d? key server dry-run và phát secret n?u c?n, nhung claim không yêu c?u seal.

## Ki?m tra dã claim chua
- FE query `RewardClaimedEvent` theo `play_id` d? bi?t tr?ng thái.

## State luu local g?i ý
- `playId`, `worldId` (d? g?i claim sau).
- Không c?n luu key/hex n?a.