# QA Report (PHẦN 5.9) — Mở rộng Search + Bỏ Cap Cứng cho 2 Modal Picker — 2026-09-04

**Người review:** Claude (Architect/QA) — độc lập với AG (Implementer)
**Đối tượng review:** Commit `6c55213` (feature chính) + `551140d` (devlog fixup).

**Kết luận: ⚠️ CHƯA PASS — có 1 lỗi nghiêm trọng cần fix trước khi chấp nhận trọn gói** (phần đúng phạm vi spec 5.9 thì đạt 100%; lỗi phát sinh nằm ở phần AG tự mở rộng thêm ngoài spec).

---

## PHẦN 1 — Phần ĐÚNG PHẠM VI spec 5.9: PASS 100%

Đối chiếu diff với FIX_SPEC PHẦN H/I: cả 2 file (`CampaignEditModal.js`, `FbAccountEditModal.js`) đều triển khai đúng — `pageSize` giảm còn 100, debounce 300ms gọi `getSocialGroups({search, pageSize:100})`, `knownGroupsRef`/`mergeKnownGroups` đúng cơ chế union-theo-id, xoá hẳn `filteredGroups` client-filter cũ, dòng chữ đếm tổng số đã thêm đúng vị trí. Grep xác nhận không còn `pageSize: 400`/`pageSize: 300` nào sót lại trong repo.

Điểm cộng ngoài yêu cầu tối thiểu nhưng hợp lý: sửa checkbox từ `onChange={() => toggleGroup(...)}` sang `readOnly` + `pointer-events-none` (giữ nguyên `onClick` ở row cha) — tránh khả năng double-toggle khi cả row-click lẫn checkbox-onChange cùng bắn (row đã có `onClick` từ trước, giờ checkbox chỉ hiển thị trạng thái, không tự bắn sự kiện riêng nữa).

## PHẦN 2 — Phần AG TỰ Ý mở rộng ngoài phạm vi spec (không được yêu cầu)

AG phát hiện và sửa thêm 1 bug CÓ SẴN TỪ TRƯỚC, không liên quan gì đến PHẦN 5.9, trong lúc đụng vào 2 file này:

- `getCampaignDetail()` trả về **shape lồng** `{success, data: {campaign, targetGroups, assignedAccounts, runs}}` — nhưng code CŨ của `CampaignEditModal.js` đọc thẳng `const c = detailRes.data; c.name; c.targetGroups` — SAI shape, khiến trước đây mở "Edit Campaign" cho 1 campaign có sẵn sẽ **luôn hiện tên trống và KHÔNG tick sẵn target groups đã gán** (2 field này chưa từng populate đúng). AG sửa thành đọc đúng `detailRes.data.campaign`/`detailRes.data.targetGroups`.
- Tương tự, `payload` gửi lên `updateCampaign`/`createCampaign` trước đây dùng `name`/`max_posts_per_day` — nhưng cột thật trong bảng `campaigns` là `campaign_name`/`max_posts_per_run` (xác nhận qua Supabase), 2 server action cũng destructure đúng 2 tên này — nghĩa là **trước đây lưu campaign qua modal này KHÔNG BAO GIỜ cập nhật đúng tên campaign hay max_posts_per_run** (COALESCE giữ nguyên giá trị cũ vì field gửi lên luôn `undefined` với đúng tên cột thật). AG sửa thêm `campaign_name`, `is_active`, `max_posts_per_run` vào payload.
- Tương tự bên `FbAccountEditModal.js`: `getFbAccountDetail()` trả field thật `account_name` (không phải `name`) — code cũ đọc `acc.name` nên ô Name luôn trống khi mở Edit; AG sửa `acc.account_name || acc.name`. Và payload đổi `name` → thêm `account_name` cho đúng field `updateFbAccount()` cần.

**Đánh giá:** đây là những phát hiện GIÁ TRỊ THẬT — không phải AG tưởng tượng ra, đã xác minh lại bằng cách đọc trực tiếp `getCampaignDetail`/`getFbAccountDetail`/`updateCampaign`/`createCampaign`/`updateFbAccount` và schema bảng thật qua Supabase, đúng như AG mô tả. Tuy nhiên đây là phạm vi mở rộng ĐÁNG KỂ (sửa cả luồng lưu Campaign/FB Account, không chỉ picker nhóm), AG có ghi vào `DEVELOPMENT_LOG.md` (không giấu) nhưng mô tả khá nhẹ ("cập nhật payload truyền `campaign_name` chuẩn") so với mức độ ảnh hưởng thật (đây là fix cho 1 bug khiến việc SỬA CAMPAIGN/FB ACCOUNT qua đúng modal chính gần như không lưu được tên/target groups đã gán từ trước — nghiêm trọng hơn nhiều so với cách mô tả).

## PHẦN 3 — ❌ LỖI MỚI PHÁT SINH TỪ CHÍNH PHẦN MỞ RỘNG NGOÀI SPEC (cần fix trước khi PASS)

Trong lúc sửa `payload` của `FbAccountEditModal.js`, AG thêm dòng:
```js
reset_ip_url: "",
```
Modal này **KHÔNG có field nào cho user xem/sửa `reset_ip_url`** — trường luôn bị hard-code thành chuỗi rỗng mỗi lần submit. Đối chiếu với `updateFbAccount()`:
```js
reset_ip_url = CASE WHEN ${reset_ip_url !== undefined} THEN ${reset_ip_url || null} ELSE reset_ip_url END,
```
Vì payload luôn gửi `reset_ip_url: ""` (không phải `undefined`), điều kiện `!== undefined` LUÔN đúng → `"" || null` = `null` → **MỌI lần lưu FB Account qua modal này (kể cả chỉ đổi `daily_quota`/`notes`) đều XOÁ SẠCH `reset_ip_url` đang có, không có cách nào giữ lại.** Đây là lỗi ghi đè âm thầm mất dữ liệu (silent data loss), không phải lỗi hiển thị.

**Mức độ ảnh hưởng hiện tại:** `sandbox` và `public` hiện đều **0 dòng** trong `fb_accounts` (chưa migrate PHẦN 2) — nên CHƯA có dữ liệu thật nào bị mất tại thời điểm QA. Nhưng đây là quả bom hẹn giờ: ngay khi PHẦN 2 migrate xong 2 FB Account thật (có khả năng đã có `reset_ip_url` từ Notion), chỉ cần sửa 1 field bất kỳ qua modal này (ví dụ đổi quota) là mất `reset_ip_url` ngay lập tức, không có cảnh báo.

**Yêu cầu fix (gửi AG):** trong `payload` của `handleSave` (`FbAccountEditModal.js`), XOÁ dòng `reset_ip_url: ""` khỏi payload hoàn toàn (không gửi field này lên nếu modal không có UI để sửa nó) — để `updateFbAccount` tự giữ nguyên giá trị cũ qua đúng nhánh `ELSE reset_ip_url` sẵn có. Test lại: set 1 giá trị `reset_ip_url` test qua Supabase trực tiếp cho 1 account, mở modal đổi `daily_quota`, save, xác nhận `reset_ip_url` KHÔNG bị mất.

---

## Kết luận

| Hạng mục | Kết quả |
|---|---|
| Search/pagination/merge-known-groups đúng phạm vi spec 5.9 | ✅ PASS 100% |
| Fix ngoài phạm vi (campaign_name/account_name/targetGroups load đúng) | ✅ Xác minh đúng, có giá trị thật, nhưng cần AG minh bạch hơn về mức độ ảnh hưởng khi báo cáo lần sau |
| Bug mới: `reset_ip_url` bị xoá âm thầm mỗi lần save FB Account | ❌ **BLOCKING** — cần fix trước khi PASS trọn gói |
| **Verdict PHẦN 5.9** | **⚠️ Chờ fix 1 dòng rồi PASS lại** |
