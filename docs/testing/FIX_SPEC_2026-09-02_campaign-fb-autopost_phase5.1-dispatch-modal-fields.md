# FIX SPEC — PHẦN 5.1: Sửa Lỗi Sai Tên Trường Trong Modal Preview & Dispatch Breakdown

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** Đây là follow-up sau khi Claude QA review PHẦN 5 (commit `b1de7f5`). Kết quả: kiến trúc và UI tổng thể đúng hướng, tái dùng đúng pattern (NavbarTabs 5 tab, RunHistoryTable mới thay vì ActivityLogPanel như đã yêu cầu), nhưng phát hiện 1 lỗi chức năng thật trong `src/app/components/CampaignDispatchPreviewModal.js` cần vá trước khi cho dùng thật, cùng 2 lỗi nhỏ đi kèm. Spec này chỉ vá đúng các lỗi đã xác nhận, không mở rộng gì thêm.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi:
1. Sửa `src/app/components/CampaignDispatchPreviewModal.js` (lỗi P1 — mục 1).
2. Sửa `src/app/components/RunHistoryTable.js` — 1 dòng fallback hiển thị (mục 2).
3. Sửa `src/app/campaign_actions.js` — thêm field `proxyUrl` (đã mask) vào output của `computeCampaignDispatchPreview` VÀ đổi field `stats.totalEligibleGroups` cho khớp UI (mục 3).

❌ NGOÀI phạm vi: không đổi logic Smart Dispatcher, không đổi `triggerCampaignRun`, không đổi UI khác ngoài các điểm nêu trên.

Nếu thấy cần sửa gì khác ngoài danh sách trên, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Lỗi P1 (bắt buộc sửa) — Sai tên trường `groupId` vs `socialGroupId` làm hỏng chức năng bỏ chọn từng nhóm

**Bằng chứng cụ thể:** `computeCampaignDispatchPreview()` trong `campaign_actions.js` (dòng ~671) trả về mỗi item trong mảng `dispatch` với field tên là **`socialGroupId`** (không phải `groupId`):
```js
dispatchedJobs.push({
  socialGroupId: group.id,
  groupName: group.name,
  ...
});
```
Nhưng `CampaignDispatchPreviewModal.js` lại đọc/dùng `item.groupId` ở TẤT CẢ 7 chỗ (dòng 60, 81-98, 114, 287, 290, 291, 300, 305) — field này luôn là `undefined` vì không tồn tại trên object thật.

**Hậu quả thực tế đã xác nhận qua đọc code (không cần chạy UI để thấy):** vì mọi item đều map ra cùng 1 giá trị `undefined`, `Set` chỉ chứa đúng 1 phần tử `undefined` — không phân biệt được từng dòng. Kết quả: bấm tick/bỏ tick BẤT KỲ dòng nào sẽ tick/bỏ tick TẤT CẢ các dòng cùng lúc (vì tất cả cùng chia sẻ 1 key `undefined` trong Set). Happy path "chọn hết rồi bấm Confirm" vẫn chạy đúng (vì state mặc định ban đầu vốn đã là "chọn hết"), nhưng tính năng cốt lõi của modal này — cho phép recruiter bỏ chọn riêng từng nhóm rủi ro trước khi bắn — **hoàn toàn không hoạt động**.

**Yêu cầu sửa:** Đổi toàn bộ 7 chỗ dùng `.groupId` / tham số `groupId` trong `CampaignDispatchPreviewModal.js` thành `.socialGroupId` (giữ tên biến local `groupId` trong hàm `toggleGroup(groupId)` như cũ nếu muốn, chỉ cần đảm bảo giá trị truyền vào luôn lấy từ `item.socialGroupId`, không phải `item.groupId`). Cụ thể các dòng cần sửa (tham chiếu số dòng tại thời điểm review, có thể lệch nhẹ):
- Dòng 60: `.map((d) => d.groupId)` → `.map((d) => d.socialGroupId)`
- Dòng 98: tương tự
- Dòng 114: `selectedGroupIds.has(d.groupId)` → `selectedGroupIds.has(d.socialGroupId)`
- Dòng 287: `selectedGroupIds.has(item.groupId)` → `selectedGroupIds.has(item.socialGroupId)`
- Dòng 290: `key={item.groupId || idx}` → `key={item.socialGroupId || idx}`
- Dòng 291, 300: `toggleGroup(item.groupId)` → `toggleGroup(item.socialGroupId)`
- Dòng 305: `{item.groupName || item.groupId}` → `{item.groupName || item.socialGroupId}`

Sau khi sửa, test thủ công: mở modal với ≥3 nhóm trong dispatch, bỏ tick đúng 1 nhóm, xác nhận CHỈ nhóm đó đổi trạng thái (mờ đi / bỏ tick), các nhóm khác giữ nguyên trạng thái tick.

---

## 2. Lỗi nhỏ — `RunHistoryTable.js` dòng ~249

Fallback hiển thị dòng bị loại (`droppedItems`) hiện là:
```js
<span className="font-semibold text-amber-200">{d.groupName || d.groupId}</span>
```
`droppedItems` trong `triggerCampaignRun` được tạo bằng cách spread lại item gốc (`{...item, reason: ...}`), nên field đúng cũng là `socialGroupId`, không phải `groupId`. Đổi thành `{d.groupName || d.socialGroupId}`. Ảnh hưởng thấp (vì `groupName` thường có sẵn) nhưng nên sửa cho nhất quán.

---

## 3. Lỗi nhỏ — 2 field hiển thị trong Stats Bar / cột Proxy không khớp dữ liệu thật

### 3.1. `stats.totalEligibleGroups` không tồn tại
`computeCampaignDispatchPreview` trả về `stats: { totalInCampaign, eligibleCount, skippedRecentlyCount, skippedNoUrlCount, skippedNoAccountAvailable }` — không có field `totalEligibleGroups`. Ô "Target Quota Active" trong modal (`{stats.totalEligibleGroups || 0} groups`) vì vậy luôn hiện `0 groups`. Sửa: đổi `stats.totalEligibleGroups` trong `CampaignDispatchPreviewModal.js` thành `stats.eligibleCount` (đây là field đúng nghĩa nhất tương ứng với ý "số nhóm đủ điều kiện dispatch").

### 3.2. Cột "Proxy / Node" luôn hiện "Direct IP (Host)"
`item.proxyUrl` được modal đọc nhưng `computeCampaignDispatchPreview`'s `dispatchedJobs.push({...})` không có field này — cột này hiện chưa bao giờ hiển thị dữ liệu thật. Sửa bằng cách bổ sung field `proxyUrl` (ĐÃ MASK — dùng `maskProxyUrl(decryptSecret(...))` giống pattern đã dùng ở `getFbAccounts`/`getFbAccountDetail`, TUYỆT ĐỐI không trả proxy thô) vào object push trong `computeCampaignDispatchPreview`, lấy từ `selectedAccount` (cần đảm bảo `selectedAccount` object trong vòng lặp có sẵn field `proxy_url` — nếu câu SELECT hiện tại của `_getEligibilityState`/`computeCampaignDispatchPreview` chưa lấy cột này thì bổ sung vào SELECT).

---

## 4. Yêu cầu test bắt buộc trước khi báo hoàn thành

1. Mở modal Preview & Dispatch Breakdown với campaign có ≥3 nhóm dispatch, bỏ tick riêng 1 nhóm → xác nhận chỉ đúng 1 dòng đổi trạng thái, các dòng khác không đổi.
2. Xác nhận "Select All"/"Deselect All" hoạt động đúng khi 1 phần đã bị bỏ tick thủ công trước đó.
3. Xác nhận Confirm & Start Posting chỉ gửi đúng danh sách nhóm còn được tick (kiểm tra qua `console.log` tạm thời hoặc network payload, xoá log trước khi commit).
4. Xác nhận ô "Target Quota Active" hiện đúng số (khớp `eligibleCount` thật, không phải luôn `0`).
5. Xác nhận cột "Proxy / Node" hiện đúng chuỗi đã mask (ví dụ `1**.**.**.**:****`), không hiện proxy thô.
6. Dữ liệu test cô lập theo mục 10.8 GEMINI.md.
7. Chạy lại `npm run build` xác nhận không lỗi biên dịch.

## 5. Báo cáo hoàn thành

Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md — cả 4 báo cáo trước đó của AG, gồm PHẦN 3, PHẦN 3.1, PHẦN 4a và PHẦN 5, đều thiếu dòng mở đầu này dù mỗi spec đều đã nêu rõ yêu cầu ở mục cuối; đề nghị AG chú ý áp dụng đúng định dạng từ lần báo cáo này trở đi).
