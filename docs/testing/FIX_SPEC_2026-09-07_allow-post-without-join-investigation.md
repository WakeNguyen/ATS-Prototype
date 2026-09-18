# FIX_SPEC — 2026-09-07 (v2 — đã xác nhận khả thi) — Thêm option cho phép nick tự đăng bài vào nhóm chưa join

**Mức độ ưu tiên: Trung bình — tính năng mới theo yêu cầu User.**
**Đã xác nhận khả thi:** User đã tự tay thử thủ công trên trình duyệt thật (đăng bài vào 1 nhóm chưa join) và **LÀM ĐƯỢC** — vậy đây KHÔNG phải giới hạn từ nền tảng Facebook, mà là do chính script Playwright của mình tự đặt ra bước kiểm tra membership trước khi đăng. Bản v2 này bỏ toàn bộ phần cảnh báo/khuyến nghị test-trước ở bản v1 vì đã được xác nhận thực tế — AG có thể triển khai thẳng.

**Giới hạn của Claude khi viết spec này:** Toàn bộ logic kiểm tra "Account is NOT a member of this group. Please join group first." (thấy trong log thật execution #956/#961) **KHÔNG nằm trong repo `ats-web` này** — đã grep toàn bộ `src/` và `scripts/` cho chuỗi "is NOT a member" / "join group first" → **0 kết quả**. Logic này chắc chắn nằm trong script `run-batch.js` (hoặc file tương đương) chạy trực tiếp trên VPS bridge server, ngoài phạm vi thư mục `ats-web` mà Claude được cấp quyền đọc. **AG cần tự vào VPS để xác định chính xác vị trí đoạn code này trước khi sửa** — spec này nêu hướng thiết kế, không có số dòng cụ thể vì Claude chưa đọc được file đó.

## Việc cần AG làm

### 1. Xác định vị trí code thật trên VPS
Tìm file script Playwright thực hiện hành động đăng bài vào nhóm (rất có thể tên `run-batch.js`, được `scripts/bridge-server.js` trong repo này spawn qua dòng `spawn(process.execPath, [scriptFullPath, tempFilePath], ...)` với `scriptName` truyền vào từ endpoint `/api/facebook-post-v2`). Trong file đó, tìm đoạn kiểm tra membership trước khi đăng bài (chuỗi lỗi khớp chính xác: `"Account [X] is NOT a member of this group. Please join group first."`).

### 2. Thêm cờ cấu hình theo campaign
Thêm cột `allow_post_without_join boolean NOT NULL DEFAULT false` vào bảng `campaigns` (migration chạy trên cả 2 schema nếu vẫn còn dùng `sandbox`, hoặc chỉ `public` nếu đã cutover hẳn — kiểm tra `DB_SCHEMA` hiện tại trong `.env.local`). Thêm UI toggle trong `CampaignEditModal.js` (ví dụ checkbox "Cho phép đăng bài vào nhóm chưa join (rủi ro tự chịu)"), mặc định tắt để giữ hành vi an toàn hiện tại cho các campaign cũ.

### 3. Truyền cờ xuống VPS
Trong `src/app/campaign_actions.js`, các hàm build dispatch (`computeCampaignDispatchPreview`, `triggerCampaignRun`) cần lấy thêm `campaign.allow_post_without_join` và đưa vào payload gửi n8n. Trong n8n Workflow A, node `Build FB Post Bridge Payload` cần thêm field này vào từng job:
```js
jobs: dispatch.map(function (d) {
  return {
    ...,
    allowPostWithoutJoin: !!body.allowPostWithoutJoin
  };
})
```

### 4. Sửa script trên VPS bỏ qua kiểm tra khi cờ bật
Tại đúng đoạn kiểm tra membership tìm được ở Bước 1, bọc điều kiện: chỉ chặn/dừng khi `!job.allowPostWithoutJoin`; khi cờ bật, bỏ qua bước kiểm tra và đi thẳng vào luồng đăng bài (thao tác UI Facebook bình thường: vào nhóm, bấm nút đăng bài) — giữ nguyên toàn bộ logic đăng bài phía sau, chỉ bỏ đúng bước tiền-kiểm-tra này.

## Yêu cầu verify
1. Bật cờ cho 1 campaign test, dispatch tới 1 nhóm chưa join (dùng đúng tài khoản/nhóm User đã tự test thành công thủ công, hoặc 1 nhóm tương tự) → xác nhận đăng thành công thật qua script tự động (không chỉ thủ công).
2. Test cờ tắt (mặc định): xác nhận hành vi CŨ không đổi — vẫn yêu cầu join trước như hiện tại, không ảnh hưởng các campaign đang chạy bình thường.
3. `npm run build` PASS 100%.
4. Chạy migration trên đúng schema đang dùng thật (`public`), xác nhận cột mới có giá trị mặc định `false` cho toàn bộ campaign hiện có (không có campaign nào vô tình bật cờ này).
