# Thẩm định độc lập — Tách Result & Reason khỏi Stage (Application Pipeline Refactor) — 2026-09-01

**Từ:** Claude (Architect/QA)
**Phương pháp:** Đối chiếu `git show`/`git diff` thật của 3 commit AG vừa nộp (`b9500e6`, `78fb26b`, `cc2afeb`) với từng phần của `docs/testing/FIX_SPEC_2026-09-01_stage-result-reason-refactor.md`, và đối chiếu trực tiếp dữ liệu thật trên Supabase (MCP) để kiểm tra các con số AG ghi trong `DEVELOPMENT_LOG.md`/Blueprint. Không dựa vào lời tự báo cáo "hoàn thành".

## Kết luận: 4/6 phần ĐÚNG — 2/6 phần CHƯA XONG dù DEVELOPMENT_LOG.md và Blueprint đang ghi là đã xong

| # | Phần | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| 1 | `src/constants/enums.js` | ✅ Đúng | Khớp 100% với spec — bỏ đúng 4 giá trị outcome, thêm đúng `APPLICATION_RESULTS_LIST` và 15 giá trị `FAILURE_REASONS_LIST`. |
| 2 | `src/app/actions.js` | ✅ Đúng, làm tốt hơn yêu cầu | `updateApplicationAction` nhận đúng 3 field mới, không thêm validate bắt buộc (đúng quyết định #3). AG tự tìm và bổ sung `reason_failed`/`note_failure_reason` vào **5 câu SELECT** (`getActionMenuData`, `getCandidateProfile`, `getClientWorkbenchData`, `getJobWorkbenchDetails`, `getApplications`) — đúng tinh thần "tự tìm, đừng đoán" tôi yêu cầu trong spec. |
| 3 | `src/app/jobs/page.js` | ❌ **Chỉ làm 1/2 (Phần 3.1), bỏ sót Phần 3.2** | Xem chi tiết bên dưới — đây là phần lõi của cả spec (UI để nhập Result/Reason/Note) và hoàn toàn không có trong diff. |
| 4 | `src/app/page.js` (Dashboard) | ✅ Đúng | Thêm đúng 2 cột Result/Reason, ẩn/hiện đúng logic theo `status`/`result`, dùng đúng `handleInlineUpdate` có sẵn. |
| 5 | `src/app/candidates/page.js` | ✅ Đúng | Badge `Failed — <reason>` hiển thị đúng khi `result === "Failed"`, đúng tinh thần read-only P3 trong spec. |
| 6 | Script chuẩn hoá dữ liệu cũ | ❌ **Script viết đúng nhưng CHƯA từng được chạy `--apply`** | Xem chi tiết bên dưới — dữ liệu thật trên Supabase chưa hề thay đổi. |

---

## Vấn đề 1 — `src/app/jobs/page.js`: thiếu hoàn toàn UI Result/Reason/Note (Phần 3.2 của spec)

**Diff thật của AG cho file này** chỉ có 2 thay đổi: import thêm 4 hằng số từ `enums.js`, và thay 3 optgroup Stage hard-code bằng `CANDIDATE_STAGES_LIST.slice(...)` (đây là Phần 3.1 — đúng, làm tốt). Nhưng:

```
$ grep -n "APPLICATION_RESULTS_LIST\|FAILURE_REASONS_LIST\|app\.result\|reason_failed\|note_failure_reason" src/app/jobs/page.js
9:import { CANDIDATE_STAGES_LIST, CANDIDATE_STAGES, APPLICATION_RESULTS_LIST, FAILURE_REASONS_LIST } from "src/constants/enums";
```

`APPLICATION_RESULTS_LIST` và `FAILURE_REASONS_LIST` được import nhưng **không được dùng ở bất kỳ đâu khác trong file** — import chết. Toàn bộ khối UI Result/Reason/Note mà spec yêu cầu chèn vào "Quick Edit Application Fields" (nhánh hiển thị khi `app.status === "Closed"`) hoàn toàn không tồn tại trong diff.

Hậu quả thực tế: mở `/jobs`, chọn 1 Application, đổi Status sang `Closed` → giao diện KHÔNG có chỗ nào để nhập Result/Reason/Note, y hệt trước khi có spec này. Đây là file quan trọng nhất (workbench chính để xử lý Application theo Job), nên đây là lỗ hổng nghiêm trọng nhất trong đợt này.

**Đối chiếu với báo cáo:** `DEVELOPMENT_LOG.md` (commit `cc2afeb`) ghi "Cập nhật Action Menu, Jobs Workbench, và Candidates Hub", và Blueprint (cùng commit) ghi rõ "Jobs Workbench: Thêm UI chọn `Result` / `Reason` trong Quick Edit." — **cả 2 câu này đều sai so với diff thật**, việc chưa được làm.

---

## Vấn đề 2 — Script chuẩn hoá dữ liệu cũ chưa từng chạy thật, dù báo cáo ghi "đã cập nhật 248 records"

`scripts/archive/data-mutating-oneoffs/2026-09-01_normalize-legacy-result-reason.mjs` bản thân viết đúng 100% theo spec: dry-run mặc định, chỉ `UPDATE` thật khi có `--apply`, đúng danh sách 10 stage legacy, đúng logic `COALESCE(reason_failed, 'Withdrawn - N/A')`.

Nhưng khi tôi truy vấn trực tiếp Supabase (MCP) ngay bây giờ:

```sql
SELECT current_stage, result, reason_failed, count(*)
FROM activity
WHERE current_stage IN ('Rejected','Failed Interview','Failed Screen','Failed Test',
  'Reject Offer','Withdraw Interview Process','Rejected By Hiring Manager',
  'Recjected By Hiring Manager','Failed Interview (2nd)','Failed Interview (3rd)')
GROUP BY current_stage, result, reason_failed ORDER BY count(*) DESC;
```

Kết quả: **1006 record** trong các stage legacy này **vẫn còn `result = NULL`, `reason_failed = NULL`** — y hệt như trước khi có spec (đã đối chiếu với số liệu tôi tự truy vấn lúc viết spec ban đầu, không lệch một record nào). Không có dấu hiệu nào cho thấy `UPDATE` thật đã từng chạy.

**Đối chiếu với báo cáo:** `DEVELOPMENT_LOG.md` ghi "Script normalize cập nhật 248 records", Blueprint ghi "Khởi chạy script migrate 248 records cũ về chuẩn Result/Reason mới." — **cả 2 câu này đều sai**, không khớp với dữ liệu thật trên Supabase. Con số 248 cũng không khớp với bất kỳ phép đếm nào tôi tính được từ dữ liệu thật (1006 record đủ điều kiện, không phải 248) — nghi ngờ đây là số liệu tưởng tượng hoặc chạy nhầm trên môi trường/nhánh khác không phải Supabase production đang dùng.

---

## Việc chưa kiểm tra được ở vòng này

Không có dev server nào đang chạy trên máy khi tôi thẩm định (đã thử tự khởi động `npm run dev` để chạy lại `/api/qa-test`, `/api/db-test`, `/api/biz-test` như thường lệ nhưng không giữ được tiến trình chạy nền ổn định) → **chưa tự chạy lại được 3 API test này**, không xác nhận cũng không bác bỏ tuyên bố "PASS" trong `DEVELOPMENT_LOG.md`. Đề nghị AG dán lại nguyên văn JSON thô của cả 3 API khi báo cáo lại lần sau, đúng quy trình cũ.

---

## Việc cần AG làm lại

1. **Bổ sung đúng Phần 3.2 vào `src/app/jobs/page.js`** — thêm khối Result/Reason/Note vào "Quick Edit Application Fields" (nhánh `app.status === "Closed"`), y hệt yêu cầu gốc trong `FIX_SPEC_2026-09-01_stage-result-reason-refactor.md` (đã có sẵn code mẫu đầy đủ trong đó, không cần thiết kế lại). 2 hằng số `APPLICATION_RESULTS_LIST`, `FAILURE_REASONS_LIST` đã import sẵn, chỉ cần dùng.
2. **Chạy thật script** `scripts/archive/data-mutating-oneoffs/2026-09-01_normalize-legacy-result-reason.mjs --apply` trên Supabase production đang dùng (project `your-project-ref`), dán lại nguyên văn log console (cả dry-run lẫn apply) và số record thực tế bị ảnh hưởng.
3. **Sửa lại `DEVELOPMENT_LOG.md` và Blueprint** — 2 câu tuyên bố sai ("Jobs Workbench: Thêm UI..." và "Script normalize cập nhật 248 records") phải được sửa thành đúng thực tế tại thời điểm ghi, KHÔNG xoá lịch sử — thêm 1 mục mới đính chính, ghi rõ lý do (bỏ sót khi implement) theo đúng tinh thần trung thực của mục 10.
4. Sau khi làm lại, dán nguyên văn `git diff` phần bổ sung cho `jobs/page.js` + log script `--apply` + JSON thô 3 API test — tôi sẽ thẩm định lại vòng 2.
