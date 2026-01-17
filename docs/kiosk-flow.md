## Flow Marketplace Chunk World

### 1. Claim chunk (mint land)
- **FE**: EditorGame gọi `claim_chunk` với tiles/decor/image URL, coin payment (first chunk free).  
- **Move**: xác thực fee/tiles, chọn tọa độ (gần chunk hiện có), mint `ChunkNFT`, lập entry dynamic `(cx,cy)->chunk_id`, emit `ChunkClaimedEvent`. Chunk NFT kết thúc trong ví người chơi.

### 2. List chunk (lên kiosk)
- **FE mới** gọi `list_chunk` và chuyển ownership của `ChunkNFT` vào dynamic field `ListingKey { chunk_id }`.
- **Move**: kiểm tra chunk thuộc world hiện tại, giá > 0, tạo `ChunkListing`, lưu dưới DF, emit `ChunkListedEvent`. Chunk nằm dưới kiosk (world) thay vì ví owner.

### 3. Buy chunk
- **FE**: buyer hiển thị listing dựa trên event, gửi transaction gọi `buy_chunk` kèm `REWARD_COIN`.
- **Move**: kiểm tra listing tồn tại, payment >= price, chia coin (giữ phần giá trong `SellerPayout`, refund phần dư), đổi người sở hữu chunk, emit `ChunkSoldEvent`.
- **Chú ý**: seller không nhận tiền ngay mà phần giá vào `SellerPayout` để rút sau.

### 4. Withdraw proceeds (rút tiền)
- **FE**: seller xem số dư pending (từ dynamic field hoặc event) và gọi `withdraw_proceeds(amount)`.
- **Move**: kiểm tra số dư, lấy coin từ `balance`, chuyển vào ví seller, error nếu thiếu hoặc amount không hợp lệ.

### 5. Cancel listing
- **FE**: nếu muốn rút chunk khi chưa bán, gọi `cancel_listing`.
- **Move**: kiểm tra seller, chuyển `ChunkNFT` trở lại ví và emit `ChunkDelistedEvent`.

### Sơ đồ sự kiện
1. `ChunkClaimedEvent` – chunk vừa mint.  
2. `ChunkListedEvent` – chunk lên kiosk.  
3. `ChunkSoldEvent` – chuyển chunk + ghi seller/buyer/price.  
4. `ChunkDelistedEvent` – listing bị hủy.  

### FE cần thêm
- Tab marketplace/kiosk hiển thị listing: fetch event/dynamic field `ListingKey`.
- Mỗi chunk: show price, owner, buy button (gọi `buy_chunk`), nếu là owner thì cho `withdraw_proceeds` và `cancel_listing`.
- Hiển thị pending proceeds để owner rút (có thể query `SellerPayoutKey`).

### Kiểm tra & triển khai
- Chạy `sui move build` + `sui move test` sau khi chỉnh `chunk_world.move`.  
- Publish package và cập nhật `VITE_PACKAGE_ID`/env.  
- Cập nhật FE gọi các entry mới trong `EditorGame.tsx` hoặc page marketplace riêng.
