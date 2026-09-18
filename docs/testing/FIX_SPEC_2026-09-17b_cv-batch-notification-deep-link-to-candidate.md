**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-17b — Notification "Hoàn tất batch CV" phải dẫn tới đúng hồ sơ Candidate thay vì Action Menu

## Bối cảnh

PO báo: khi click vào notification "✅ Hoàn tất batch CV: N/N" trên Notification Center (bell icon), trang chuyển sang **Action Menu** (`/`) thay vì dẫn thẳng tới **hồ sơ candidate tương ứng** vừa được xử lý.

## Đã xác nhận qua đọc trực tiếp (KHÔNG suy diễn)

- **Đây KHÔNG phải bug ở `src/`.** `src/app/components/PendingCVClientWrapper.js` dòng 226-232 (tính năng "Bug8-notification-clickthrough", `DEVELOPMENT_LOG.md` 2026-09-13) chỉ đơn giản `router.push(notif.link)` — hoạt động đúng, tổng quát cho MỌI loại notification. Vấn đề là **giá trị `link` được n8n set cứng thành `'/'`** ngay từ lúc tạo notification, không bao giờ đổi.
- Đã đọc trực tiếp workflow n8n **"CV Parser → ATS 3.0 (Supabase) Dedup"** (`fofSZKkdyhlVd9Lc`, đang `active`) qua n8n MCP (`get_workflow_details`). Node chịu trách nhiệm tạo đúng notification "Hoàn tất batch CV" (title PO đang thấy) là node **`Finalize Batch`** (id nội bộ `finalize_batch_node`), 1 Code node POST tới `{baseUrl}/api/webhooks/notifications` với `link: '/'` hardcode.
- **Dữ liệu để tính đúng deep link đã có sẵn, KHÔNG cần thêm bảng/cột mới**: node `Finalize Batch` đã GET `{baseUrl}/api/webhooks/cv-batch-item?batch_id=...` về biến `items`, mỗi item có cột `candidate_id` (xem `src/app/api/webhooks/cv-batch-item/route.js:19`).
  - Đã đọc sub-workflow **"CV Parser - Process Single Item"** (`WfSingle00000001`), node `Update Batch Item Status`: `candidate_id: $('Call ATS Webhook').item?.json?.id || $('Call ATS Webhook').item?.json?.matched_candidate_id || null`. Nguồn 2 giá trị này từ `src/app/api/webhooks/cv-import/route.js`:
    - `match_status = 'NEW'` (dòng 140-145): trả `id` = candidate MỚI vừa tạo.
    - `match_status = 'UPDATE'` (1 match, dòng 149-150, 179-181): trả `matched_candidate_id` = candidate ĐÃ TỒN TẠI khớp trùng (không null).
    - `match_status = 'CONFLICT'` (≥2 match, dòng 150): `targetCandidateId = null` → `matched_candidate_id = null` → `cv_import_batch_items.candidate_id` sẽ là `null` cho case này (đúng bản chất: CONFLICT không có 1 candidate xác định để trỏ tới).
  - **Kết luận: `cv_import_batch_items.candidate_id` đã sẵn sàng chứa đúng ID candidate cần deep-link cho CẢ 2 case `NEW` và `UPDATE`** (2 case chiếm đa số theo ảnh PO gửi: "Hồ sơ mới" / "Cần duyệt (trùng 1 hồ sơ)"), chỉ `CONFLICT`/`failed`/batch nhiều file là không có 1 candidate xác định.
- Cơ chế đọc deep link phía Candidates page đã hoạt động sẵn (không cần sửa): `src/app/candidates/page.js:734` đọc `searchParams.get("id")` → tự động load đúng candidate. Dạng URL đúng: **`/candidates?id=<candidate_id>`** (KHÔNG phải `/candidates/<id>` — đã có 1 chỗ khác trong code, `src/app/actions.js:2272`, dùng nhầm dạng `/candidates/${c.id}`, nhưng đó là vấn đề RIÊNG, KHÔNG thuộc phạm vi spec này — không đụng vào).

## Phạm vi — CHỈ 1 node trong 1 workflow n8n, KHÔNG đụng gì khác

**Workflow**: `fofSZKkdyhlVd9Lc` ("CV Parser → ATS 3.0 (Supabase) Dedup")
**Node**: `Finalize Batch` (id `finalize_batch_node`) — chỉ sửa nội dung `parameters.jsCode` của node này.

**KHÔNG đụng**:
- Node `Update Progress Notification` (id `update_progress`) — notification tạm thời lúc đang chạy (`link: '/'` giữ nguyên), vì PO chỉ báo lỗi ở notification "Hoàn tất" (final), không phải notification "Đang xử lý". Để ngoài phạm vi, tránh mở rộng không cần thiết.
- Node `Create Progress Notification` — notification khởi tạo ban đầu (0/N, chưa có candidate nào xử lý xong) — giữ `link: '/'`, hợp lý vì chưa có dữ liệu để trỏ đi đâu.
- Sub-workflow `WfSingle00000001`, các webhook route trong `src/`, `PendingCVClientWrapper.js` — tất cả đã đúng, không sửa.
- KHÔNG sửa `src/app/actions.js:2272` (bug khác, không thuộc phạm vi PO báo lần này).

Nếu phát hiện cần sửa thêm ngoài đúng 1 node này, DỪNG LẠI và in `ESCALATE:` (GEMINI.md mục 10).

## Chi tiết triển khai

Trong node `Finalize Batch`, code hiện tại có đoạn (rút gọn, giữ nguyên phần đầu không đổi — fetch `items`, tính `processed`/`newCount`/`updateCount`/`conflictCount`/`failedCount`/`logLines` qua vòng `for`):

```js
// ... (giữ nguyên toàn bộ phần trên, không đổi) ...

// 1. Mark batch completed
try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/api/webhooks/cv-batch',
    headers: headers,
    body: { action: 'UPDATE', batch_id: batchId, status: 'completed' },
    json: true
  });
} catch (e) {
  console.error('Error completing batch:', e);
}

// 2. Final notification update
const finalSeverity = (conflictCount > 0 || failedCount > 0) ? 'warning' : 'success';
const summaryMsg = `Tổng kết: ${newCount} hồ sơ mới, ${updateCount} cần duyệt, ${conflictCount} trùng lặp, ${failedCount} lỗi.\n\n` + logLines.join('\n');

try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/api/webhooks/notifications',
    headers: headers,
    body: {
      id: notifId,
      type: 'cv_batch_progress',
      title: `Hoàn tất batch CV: ${done}/${total}`,
      message: summaryMsg,
      severity: finalSeverity,
      link: '/',
      metadata: { total, done, new: newCount, update: updateCount, conflict: conflictCount, failed: failedCount }
    },
    json: true
  });
} catch (e) {
  console.error('Error updating final notification:', e);
}

return [{ json: { status: 'completed', batchId, total, done, newCount, updateCount, conflictCount, failedCount } }];
```

**Thêm đúng 1 đoạn tính `link`** ngay TRƯỚC dòng `// 1. Mark batch completed` (sau vòng `for (const p of processed) {...}`), và **đổi `link: '/'` thành `link,`** trong body của notification cuối:

```js
// Xác định deep link tới đúng hồ sơ candidate. Chỉ trỏ thẳng tới 1 candidate khi
// batch có đúng 1 file VÀ item đó đã có candidate_id xác định (case NEW hoặc
// UPDATE — matched_candidate_id được /api/webhooks/cv-import trả về và lưu
// chung vào cột candidate_id của cv_import_batch_items). Batch nhiều file hoặc
// CONFLICT/failed (không có candidate_id) thì trỏ về trang danh sách Candidates
// chung, không đoán bừa 1 candidate_id trong nhiều hồ sơ đã xử lý.
let link = '/candidates';
if (total === 1 && processed.length === 1 && processed[0].candidate_id) {
  link = '/candidates?id=' + processed[0].candidate_id;
}
```

Rồi trong object body POST `/api/webhooks/notifications` cuối cùng, đổi:
```js
      link: '/',
```
thành:
```js
      link,
```

**Toàn bộ phần còn lại của node (fetch items, tính processed/newCount/updateCount/conflictCount/failedCount/logLines, mark batch completed, POST notification, return) giữ NGUYÊN 100% không đổi.**

## Cách thực thi (n8n)

Dùng n8n MCP tool cập nhật ĐÚNG node `Finalize Batch` (id `finalize_batch_node`) trong workflow `fofSZKkdyhlVd9Lc` — chỉ thay `parameters.jsCode` của node này bằng bản đầy đủ đã áp dụng 2 thay đổi ở trên (giữ nguyên toàn bộ phần code còn lại), giữ nguyên `id`, `name`, `type`, `typeVersion`, `position`, và toàn bộ `connections` của workflow. Đọc `get_workflow_best_practices`/`get_workflow_sdk_reference` nếu cần trước khi cập nhật, theo đúng hướng dẫn chuẩn của n8n MCP server. **Publish workflow sau khi sửa** (nếu công cụ yêu cầu bước publish riêng) để bản mới thực sự active, không chỉ lưu draft.

## Việc KHÔNG được làm

- Không đụng bất kỳ node nào khác, không đổi `connections`.
- Không sửa `src/` (không cần thiết cho spec này).
- Không tự publish/archive workflow khác ngoài `fofSZKkdyhlVd9Lc`.

## Verify bắt buộc trước khi báo hoàn thành

1. Đọc lại `get_workflow_details(fofSZKkdyhlVd9Lc)` sau khi sửa — xác nhận CHỈ `parameters.jsCode` của node `Finalize Batch` thay đổi, mọi node/connection khác giữ nguyên y hệt bản gốc (so sánh bằng mắt hoặc `get_workflow_versions_diff` nếu công cụ hỗ trợ).
2. Test thật: upload 1 CV batch 1 file qua form/webhook thật (hoặc dùng `test_workflow`/`execute_workflow` nếu n8n MCP hỗ trợ chạy thử an toàn không ảnh hưởng dữ liệu thật — nếu không có cách test an toàn, mô tả rõ đã kiểm tra bằng cách nào) → xác nhận notification "Hoàn tất batch CV: 1/1" tạo ra có `link` dạng `/candidates?id=<số>` đúng với candidate vừa xử lý (kiểm tra trực tiếp qua `GET /api/webhooks/cv-batch-item?batch_id=...` hoặc đọc bảng `notifications` nếu có quyền) — click thử trên UI thật dẫn đúng tới hồ sơ candidate đó.
3. Nếu có thể, test thêm 1 batch nhiều file (≥2) → xác nhận `link` fallback về `/candidates` (không có `?id=`).

## Tài liệu

Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md — ghi rõ đây là thay đổi n8n (không phải `src/`), tên workflow + node đã sửa, và kết quả test.

Báo cáo hoàn thành kèm bằng chứng đọc lại workflow sau khi sửa (không chỉ báo "đã sửa xong"). Nếu có sai lệch so với spec, ghi theo mục 10.7 GEMINI.md.
