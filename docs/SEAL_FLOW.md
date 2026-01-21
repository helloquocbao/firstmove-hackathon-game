# Luồng chơi với Seal và claim reward

Tóm lược luồng hiện tại trong `chunk_world.move` sau khi chuyển sang Seal, bỏ hash key:

- **PlayTicket** lưu: `player`, `policy_id` (BCS-encode `play_id`), `min_reward`, `max_reward`.
- **play_v1** (free) và **play_v2** (trả phí):
  - Kiểm tra power và giới hạn lượt/epoch.
  - Tính `play_id = world.next_play_id`, tăng `next_play_id`.
  - Tạo `policy_id = bcs::to_bytes(&play_id)` (identity dùng cho Seal).
  - Lưu `PlayTicket { player, policy_id, min_reward, max_reward }`.
  - Emit `PlayCreatedEvent`.
  - Không còn truyền/kiểm tra hash key.

- **seal_approve(id, play_id, world, ctx)**:
  - `id` là `policy_id` (bytes BCS của `play_id`), phải là tham số đầu tiên (yêu cầu Seal SDK).
  - Abort nếu `PlayTicket` không tồn tại, `policy_id` không khớp, hoặc sender khác `player`.
  - Được key server gọi qua `dry_run_transaction_block` làm bằng chứng trước khi cấp khóa giải mã.

- **claim_reward(world, vault, character, randomness, play_id, ctx)**:
  - Chỉ cần `play_id` (đã được chứng thực qua `seal_approve` bởi key server).
  - Kiểm tra `PlayTicket` tồn tại, lấy `player` và reward bounds.
  - Random reward trong `[min_reward, max_reward]`, unreserve và rút coin.
  - Chuyển coin cho `player` (sender phải trùng `player`).
  - Cộng power/potential và emit `RewardClaimedEvent`, `CharacterUpdatedEvent`.

## Cách gọi với Seal SDK (client)

1. Sau khi nhận `play_id` từ event `PlayCreatedEvent`, tạo `policyId = bcs::to_bytes(play_id)` (hex/bytes tùy SDK).
2. Seal SDK encrypt/decrypt dùng `policyId` làm identity.
3. Khi decrypt, build tx cho `seal_approve`:
   - target: `<package_id>::world::seal_approve`
   - args: `policyId` (vector<u8>), `play_id` (u64), `world_id` (object)
4. Key server dry-run tx; nếu không abort → cấp share/khóa giải mã.
5. Sau khi nhận plaintext (hoặc chỉ cần proof), người chơi gửi `claim_reward(play_id)` từ đúng ví `player`.

## Dữ liệu on-chain liên quan

- `PlayTicket` (dynamic field trên `world.id`, key = `PlayKey { id: play_id }`): chứa `player`, `policy_id`, reward bounds.
- `PlayCreatedEvent`: theo dõi `play_id`, reward bounds, creator.
- `RewardClaimedEvent`: ghi nhận reward thực nhận và cập nhật power/potential.

## Lưu ý

- `policy_id` phải khớp BCS(play_id); client không cần gửi hash key.
- `seal_approve` phải được gọi bằng đúng ví `player`; key server sẽ dùng kết quả dry-run để quyết định.
- `claim_reward` vẫn yêu cầu sender là `player`; không có bước hash key nữa, nên việc cấp khóa/giải mã phải được đảm bảo qua Seal/`seal_approve`.
