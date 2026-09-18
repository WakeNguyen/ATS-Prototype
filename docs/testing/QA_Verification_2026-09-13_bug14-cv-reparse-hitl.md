**Từ:** Claude (Architect/QA)

# QA Verification — Mục #14: Tự động re-parse CV qua HITL + báo lỗi rõ ràng

**Ngày:** 2026-09-13
**Kết quả:** ✅ PASS toàn bộ — verify bằng code trực tiếp (2 file Next.js + workflow n8n) VÀ 1 lần
chạy thật đầu-cuối (real Google Drive download, real Gemini AI parse, real dedup match) trên
candidate thật (Do Minh Thien #3429) — không phải giả lập.

## Verify code

- `src/app/actions.js`: `triggerCvReparse(candidateId)` đọc trực tiếp — khớp 100% spec (guard
  `assertRealRequestContext`, trích `driveFileId`, tạo notification "đang xử lý", dispatch webhook,
  `baseUrl` chỉ set khi `DB_SCHEMA=sandbox`).
- `src/app/candidates/page.js`: cả 2 điểm gọi (`handleAppendCvVersion` luôn gọi;
  `handleSaveProfile` chỉ gọi khi `cv_url` thực sự đổi) khớp 100% spec.
- `.env.local`: đã thêm `N8N_CV_REPARSE_WEBHOOK_URL`.
- n8n workflow "A5: CV Re-parse (Existing Candidate)" (`8sdwRFG354PTL8Oj`, `active: true`): đọc trực
  tiếp qua `get_workflow_details` — đúng 8 node, đúng kết nối, đúng credential, khớp 100% spec.

## Live test đầu-cuối (execution `7449`, ~13 giây)

Gọi trực tiếp webhook production với `candidateId` + `driveFileId` = CV THẬT hiện tại của Do Minh
Thien (#3429) — kịch bản an toàn nhất có thể (re-parse đúng CV của chính họ, không đụng ai khác).
Không test qua đường sandbox/tunnel được vì `cloudflared` đang tắt (HTTP 530) lúc test.

Kết quả từng node (đọc trực tiếp execution data, không qua báo cáo):
- `Process Single Item` → tải file thật từ Drive, AI parse thật, tự khớp dedup ra đúng
  `match_status: "UPDATE"`, `candidate_id` = chính Do Minh Thien (self-match đúng như thiết kế),
  tạo `pending_import_id` thật.
- `Build Reparse Notification` → dựng đúng nội dung "CV đã được đọc lại — có bản cập nhật cần
  duyệt", severity `success`.
- `POST Final Notification` → tạo notification thành công.

**Xác nhận an toàn:** `match_status: UPDATE` chỉ TẠO 1 dòng chờ duyệt (`pending_cv_imports`), KHÔNG
tự động ghi đè bất kỳ field nào của candidate — đúng thiết kế HITL đã thống nhất với User.

## Dọn dẹp sau test (theo mục 10.8)

Đã xoá đúng 4 bản ghi phát sinh từ test (theo ID, không đụng gì khác):
`pending_cv_imports` (1 dòng), `cv_import_batch_items` (1 dòng), `cv_import_batches` (1 dòng),
`notifications` (1 dòng). Verify lại: `cv_import_batches` nguồn `cv_reparse` còn 0 dòng; 2 dòng
`pending_cv_imports` còn lại của candidate 3429 đều từ 09/09 (đã Approved từ trước), không liên
quan tới test này.

## Kết luận

#14 hoạt động đúng đầu-cuối trên dữ liệu và hạ tầng thật, không có tác dụng phụ ngoài ý muốn, không
để sót dữ liệu QA.
