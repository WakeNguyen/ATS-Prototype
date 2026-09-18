**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — "Phantom" FB Account đã gán nhưng không hiện checkbox để bỏ chọn

## Bối cảnh

PO phản hồi qua screenshot: mục "Target FB Accounts Pool" trong Campaign Edit Modal chỉ có 1 dòng account hiển thị (`Nick Chính - acc_02`), nhưng khi checkbox đó đang UNCHECK, label vẫn báo "(1 selected)" thay vì 0. Khi tick lên, thành "(2 selected)" — chênh lệch đúng 1 so với số checkbox thực tế nhìn thấy được.

## Nguyên nhân (đã xác nhận qua đọc code)

`src/app/components/CampaignEditModal.js`:
- Dòng 184: `setAvailableAccounts(accountsRes.data.filter(a => a.status === 'Active'))` — danh sách checkbox hiển thị **CHỈ** gồm account đang `status='Active'`.
- Dòng 241: `setSelectedAccountIds(new Set(assignedAccs.map((a) => a.id)))` — khởi tạo lựa chọn từ TOÀN BỘ account đã được gán cho campaign trước đó (`assignedAccounts`), **không lọc theo status**.

→ Nếu 1 account đã được gán cho campaign từ trước nhưng sau đó chuyển sang status khác `Active` (ví dụ `Checkpoint`/`Disabled`), ID của nó vẫn nằm trong `selectedAccountIds` (được tính vào số đếm), nhưng KHÔNG có checkbox nào hiển thị cho nó (vì bị lọc khỏi `availableAccounts`) — user hoàn toàn không thấy được, không thể bỏ chọn qua UI. Khi Save, account "ma" này vẫn được giữ nguyên trong `assignedAccountIds` gửi lên (`Array.from(selectedAccountIds)`, dòng 388) — không chỉ hiển thị sai, mà còn không thể sửa được qua giao diện.

**So sánh:** Đúng pattern này đã được xử lý ĐÚNG cho Target Groups ở dòng 240 (`setAvailableGroups(mergeKnownGroups(targetGroups))` kèm comment "đảm bảo nhóm đã gán sẵn luôn hiện, kể cả ngoài top 100") — nhưng chưa từng được áp dụng tương tự cho FB Accounts. Đây là thiếu sót nhất quán, không phải chủ đích thiết kế.

## Phạm vi (1 file)

`src/app/components/CampaignEditModal.js`

## Việc cần làm

Ngay sau dòng 241 (`setSelectedAccountIds(new Set(assignedAccs.map((a) => a.id)));`), thêm:
```js
// Đảm bảo account đã gán sẵn (dù không còn Active) vẫn hiện trong checklist —
// tránh đếm "phantom" selection không có checkbox tương ứng để bỏ chọn,
// cùng tinh thần với mergeKnownGroups() đã áp dụng cho Target Groups ở trên.
setAvailableAccounts((prev) => {
  const existingIds = new Set(prev.map((a) => a.id));
  const missingAssigned = assignedAccs.filter((a) => !existingIds.has(a.id));
  return missingAssigned.length > 0 ? [...prev, ...missingAssigned] : prev;
});
```
(`assignedAccs` đã có đủ field `status`/`account_name`/`account_ref` từ `getCampaignDetail` — dòng 198-212 của `campaign_actions.js`, KHÔNG cần sửa server action.)

## Việc KHÔNG được làm

- Không đổi dòng 184 (`filter(a => a.status === 'Active')`) — vẫn giữ nguyên quy tắc chỉ cho PICK MỚI account đang Active, chỉ bổ sung hiển thị account ĐÃ gán từ trước dù status khác.
- Không tự động bỏ chọn (uncheck) account không-Active khỏi `selectedAccountIds` — để user tự quyết định giữ hay bỏ qua UI, không âm thầm thay đổi assignment.
- Không đụng `campaign_actions.js` hay bất kỳ file nào khác.

## Verify bắt buộc

1. `node --check src/app/components/CampaignEditModal.js` → PASS.
2. `git diff --stat` → chỉ file trên (+ doc).
3. Test thật trong `sandbox`: tạo 1 FB account test, gán vào 1 campaign test, đổi status account đó sang khác `Active` (ví dụ `Checkpoint`) → mở lại Edit Modal của campaign đó → xác nhận:
   - Account đó VẪN hiện trong checklist (kèm badge status đúng màu, không phải "Active").
   - Số đếm "(N selected)" khớp CHÍNH XÁC với số checkbox đang tick nhìn thấy được.
   - Bỏ tick account đó → lưu → mở lại → xác nhận đã bị gỡ khỏi assignment thật (không còn "phantom" tồn tại ngầm).
   - Dọn dữ liệu test sau khi xong.
4. `/api/biz-test` + `/api/qa-test` → PASS 100%.
5. `npm run build` → PASS 100%.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md.

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
