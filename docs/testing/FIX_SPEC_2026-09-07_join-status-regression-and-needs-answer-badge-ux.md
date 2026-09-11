# FIX_SPEC — 2026-09-07 — join_status bị ghi đè lùi trạng thái (đã Joined lại thành "Needs Answer") + badge "Needs Answer" không bấm được ở đúng chỗ

**Mức độ ưu tiên: Trung bình — gây hiểu lầm dữ liệu (group đã join thật nhưng UI báo sai) và khó thao tác (không sửa được câu trả lời từ đúng chỗ user bấm).**
**Người phát hiện:** User — vào thẳng Facebook group "VIỆC LÀM CƠ KHÍ ĐỒNG NAI" thấy tài khoản ĐÃ tham gia nhóm ("Đã tham gia"), nhưng ATS 3.0 vẫn hiển thị "Needs Answer"; đồng thời bấm vào badge "Needs Answer" trong Run History không có phản ứng gì.

---

## Bug A — `join_status` bị ghi đè lùi trạng thái, làm mất thông tin "đã Joined"

**Root cause (đã đọc code xác nhận):** `src/app/api/webhooks/warm-join-run-progress/route.js`, trong vòng lặp `for (const g of groupItems)` (dòng ~63-108), có 2 nhánh update CÙNG 1 cột `social_group_urls.join_status` KHÔNG có thứ tự ưu tiên hay điều kiện bảo vệ lẫn nhau:

```js
if (action === 'Joined' && socialGroupId && fbAccountId) {
  UPDATE social_group_urls SET join_status = 'Joined', ... WHERE id = ${socialGroupId}
}

if ((needsCustomAnswer || action === 'AutoAnswered' || action === 'JoinRequested') && adminQuestions && socialGroupId) {
  UPDATE social_group_urls SET join_status = 'Needs Custom Answer', ... WHERE id = ${socialGroupId}
}
```

`join_status` là cột Ở CẤP ĐỘ NHÓM (1 dòng / 1 group), nhưng thực tế nhiều tài khoản FB khác nhau có thể tương tác với CÙNG 1 nhóm ở CÁC THỜI ĐIỂM KHÁC NHAU (đúng như tính năng "Accounts Joined X/Y" đã có, dùng bảng riêng `fb_account_groups`). Nếu tài khoản A đã join thành công (set `join_status = 'Joined'`), nhưng SAU ĐÓ 1 sự kiện khác (tài khoản B gặp câu hỏi lạ, hoặc thậm chí 1 lần retry/warm lại của CHÍNH tài khoản A) trả về `needsCustomAnswer = true` cho group này — nhánh thứ 2 sẽ **ghi đè `join_status` từ 'Joined' lùi lại thành 'Needs Custom Answer'**, dù thực tế nhóm đã có ít nhất 1 tài khoản join thành công thật (dữ liệu trong `fb_account_groups` vẫn đúng, không bị mất — chỉ có cột tổng hợp `join_status` trên `social_group_urls` bị sai).

Đây khớp chính xác với hiện tượng User quan sát: nhóm đã join thật (có dòng trong `fb_account_groups`) nhưng cột `join_status` tổng hợp bị 1 sự kiện sau đó ghi đè sai thành "Needs Custom Answer".

### Fix đề xuất (nhỏ, không đổi kiến trúc)
Thêm điều kiện bảo vệ vào câu UPDATE thứ 2 — KHÔNG ghi đè nếu nhóm đã ở trạng thái `'Joined'`:
```js
if ((needsCustomAnswer || action === 'AutoAnswered' || action === 'JoinRequested') && adminQuestions && socialGroupId) {
  await sqlTx`
    UPDATE social_group_urls SET
      join_status = 'Needs Custom Answer',
      admin_questions = ${adminQuestions}
    WHERE id = ${socialGroupId} AND join_status != 'Joined'
  `;
  // Notification vẫn có thể giữ nguyên (báo cho User biết có 1 tài khoản khác gặp câu hỏi mới ở nhóm này),
  // nhưng CHỈ tạo notification nếu câu UPDATE ở trên thực sự đổi được dòng nào (dùng RETURNING id để kiểm tra),
  // tránh spam thông báo cho nhóm đã join xong.
}
```
**Lưu ý cho AG:** đây là fix tối thiểu để KHÔNG làm hỏng luồng hiện có — nếu muốn triệt để hơn (group_status phản ánh đúng theo TỪNG tài khoản thay vì 1 cột tổng hợp duy nhất), đó là việc tái kiến trúc lớn hơn (đổi `join_status` từ cột trên `social_group_urls` sang tính toán động từ `fb_account_groups` + trạng thái riêng), KHÔNG nằm trong phạm vi fix nhanh này — chỉ đề xuất nếu User muốn làm sau.

---

## Bug B (thật ra là UX gây hiểu lầm, không hẳn "bug") — Bấm vào "Needs Answer" trong Run History không có gì xảy ra

**Root cause:** Cùng 1 trạng thái "cần trả lời câu hỏi" hiện đang được hiển thị ở **3 nơi khác nhau, với 3 hành vi khác nhau**, khiến User bấm nhầm chỗ:

1. **`src/app/components/RunHistoryTable.js`** (bảng Run History trong Campaign Detail Panel — ĐÚNG chỗ User đã bấm theo ảnh chụp màn hình): badge "Needs Answer" ở đây **CHỈ LÀ NHÃN HIỂN THỊ TĨNH** (log lịch sử 1 lượt chạy đã qua), KHÔNG có `onClick`, KHÔNG THỂ sửa được gì ở đây — đây là chủ đích thiết kế (log lịch sử), không phải bug, nhưng giao diện lại y hệt màu/kiểu 1 nút bấm được ở nơi khác nên User hiểu lầm là bấm được.
2. **`src/app/components/JoinStatusBadge.js`, dùng trong tab "Social Group URLs" (thư viện nhóm toàn cục)**: vì nơi này LUÔN truyền `joinedCount`/`totalActiveAccounts` (xem `campaigns/page.js` dòng ~2227), badge hiển thị dạng **tỉ lệ số** (vd "0/2") thay vì chữ "Needs Answer" — nút thực sự bấm được để mở popover nhập câu trả lời chỉ là **1 icon tam giác cảnh báo nhỏ, KHÔNG có chữ**, đứng cạnh badge tỉ lệ — rất dễ bị bỏ sót, không rõ ràng là bấm được.
3. **`src/app/components/JoinStatusBadge.js`, dùng trong tab "Overview & Groups" của TỪNG campaign** (`campaigns/page.js` dòng ~1614, KHÔNG truyền `joinedCount`/`totalActiveAccounts`): ở đây badge hiển thị đúng dạng chữ "Needs Answer" VÀ có `onClick` mở popover nhập câu trả lời — đây là nơi DUY NHẤT hoạt động đúng như mô tả trước đó của Claude.

### Fix đề xuất
1. **RunHistoryTable.js**: Với item có status "Needs Answer"/"Needs Custom Answer", đổi badge thành có thể bấm — bấm vào sẽ điều hướng sang tab "Social Group URLs" kèm cờ mở đúng nhóm đó (tái sử dụng đúng pattern đã có sẵn trong `warm-join-run-progress/route.js`: `link: '/campaigns?tab=social-groups&group_id=' + socialGroupId`). Nếu điều hướng phức tạp, tối thiểu: đổi tooltip/title thành "Đã xử lý xong lượt này — vào tab Social Group URLs để cập nhật câu trả lời", để không còn trông giống nút bấm được nhưng không phản hồi gì.
2. **JoinStatusBadge.js, nhánh `hasRatio` (tab Social Group URLs)**: đổi icon tam giác nhỏ hiện tại thành nút có CHỮ rõ ràng (ví dụ thêm text "Needs Answer" cạnh icon, giống hệt cách hiển thị ở nhánh `renderLegacyStatusBadge`), để nhất quán và dễ nhận biết là bấm được, giữa 2 tab.

## Yêu cầu verify
1. Test Bug A: mô phỏng 1 group đã `join_status='Joined'` (có dòng `fb_account_groups`), gửi 1 event `needsCustomAnswer=true` cho group đó qua webhook `warm-join-run-progress` → xác nhận `join_status` GIỮ NGUYÊN `'Joined'`, không bị ghi đè lùi.
2. Test Bug B: xác nhận nút mới ở Run History (hoặc tooltip mới) rõ ràng hơn; xác nhận badge trong tab Social Group URLs giờ có chữ, bấm được, mở đúng popover nhập câu trả lời.
3. `npm run build` PASS 100%.
