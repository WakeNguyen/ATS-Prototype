# FIX_SPEC — 2026-09-07 — Bỏ giới hạn Daily Post Quota (Max posts/day) theo yêu cầu User, chấp nhận rủi ro

**Mức độ ưu tiên: Thấp/Trung bình — thay đổi chính sách theo yêu cầu trực tiếp của User (đã hiểu rõ và chấp nhận rủi ro), không phải bug.**

## Bối cảnh
Field "Daily Post Quota (Max posts/day)" trên `FbAccountEditModal.js` hiện đang được ENFORCE (chặn cứng) ở 2 điểm trong `src/app/campaign_actions.js`:

1. **`_getEligibilityState`** (dòng ~596-631): tính `remainingQuota = Math.max(0, acc.daily_quota - postsToday)` cho mỗi tài khoản.
2. **`computeCampaignDispatchPreview`** (dòng ~721): `const candidates = Array.from(accountState.values()).filter(a => a.remainingQuota > 0);` — tài khoản hết quota bị loại khỏi danh sách ứng viên nhận job MỚI trong preview.
3. **`triggerCampaignRun`** (dòng ~886-889): chặn cứng khi thực thi thật —
   ```js
   if (acc.remainingQuota <= 0) {
     droppedItems.push({ ...item, reason: 'quota_exceeded' });
     continue;
   }
   ```

User đã xác nhận muốn **bỏ hẳn giới hạn này**, chấp nhận rủi ro (spam/checkpoint tài khoản do đăng quá nhiều trong ngày).

## Việc cần sửa

**Cách tối thiểu, không đổi schema/UI, dễ đảo ngược nếu cần sau này:**

1. Trong `_getEligibilityState`, đổi dòng tính quota:
   ```js
   const remainingQuota = Math.max(0, acc.daily_quota - postsToday);
   ```
   thành (luôn trả về giá trị lớn — coi như không giới hạn):
   ```js
   const remainingQuota = Number.MAX_SAFE_INTEGER;
   ```
2. **KHÔNG cần sửa gì thêm** ở `computeCampaignDispatchPreview` (dòng ~721) hay `triggerCampaignRun` (dòng ~886-889) — vì cả 2 chỗ đó chỉ SO SÁNH `remainingQuota > 0` / `<= 0`, một khi bước 1 luôn trả về số cực lớn, 2 điều kiện chặn này tự động không bao giờ kích hoạt nữa mà không cần đụng vào logic.
3. **Giữ nguyên** cột `daily_quota` trong DB, field "Daily Post Quota (Max posts/day)" trên `FbAccountEditModal.js`, và biến `postsToday` — không xoá gì, chỉ vô hiệu hoá phần ENFORCE. Việc này giúp dễ dàng bật lại giới hạn sau này (nếu User đổi ý) chỉ bằng cách revert đúng 1 dòng ở bước 1.
4. Cân nhắc: đổi label field trên UI từ "Daily Post Quota (Max posts/day)" thành "Daily Post Quota (Max posts/day) — hiện không được áp dụng" hoặc thêm dòng ghi chú nhỏ dưới field, để tránh User sau này hiểu lầm là field vẫn có tác dụng. **Không bắt buộc, tuỳ AG/User quyết định có cần làm ngay hay để sau.**

## Yêu cầu verify
1. Tạo/dùng 1 tài khoản test có `daily_quota = 1`, giả lập đã có 1 bản ghi `campaign_run_items` với `status='Sent'` hôm nay cho tài khoản đó → chạy `computeCampaignDispatchPreview` cho 1 campaign có tài khoản này → xác nhận tài khoản VẪN xuất hiện trong danh sách ứng viên dispatch (không bị loại vì "hết quota" nữa).
2. `npm run build` PASS 100%.
3. Xác nhận KHÔNG có regression nào khác dùng biến `remainingQuota` cho mục đích khác ngoài việc chặn quota (grep lại toàn bộ `remainingQuota` trong file để chắc chắn).
