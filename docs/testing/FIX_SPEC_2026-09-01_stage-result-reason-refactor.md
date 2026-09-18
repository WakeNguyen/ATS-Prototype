# Fix Spec — 2026-09-01: Tách Result & Reason khỏi Stage (Application Pipeline Refactor)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)

**Bối cảnh:** PO (Thức) đã mở trực tiếp workspace Notion gốc (`CRM-ATS V2 — Headhunter Workspace`) qua MCP và đối chiếu với UI ATS 3.0 hiện tại. Nhận thấy Notion tách rõ 3 property độc lập cho Application: `Stage` (bước quy trình, 12 giá trị gọn), `Result` (Passed/Failed), `Reason (if failed)` (15 lý do chuẩn hoá) — trong khi ATS 3.0 đang gộp outcome vào chung danh sách Stage (`Rejected`, `Failed Interview`, `Reject Offer`, `Withdraw Interview Process` là các "stage" chứ không phải kết quả tách riêng), khiến không thể báo cáo "ứng viên fail nhiều nhất ở bước nào, vì lý do gì". Tôi đã đối chiếu trực tiếp Supabase (MCP) + Notion (MCP) để xác minh khả năng tái sử dụng schema sẵn có trước khi viết spec này. PO đã chốt 4 quyết định bên dưới — không cần hỏi lại.

**Quyết định đã chốt với PO (không cần hỏi lại):**
1. Danh sách `Reason (if failed)` dùng nguyên 15 giá trị của Notion, không rút gọn.
2. Danh sách `Stage`: giữ nguyên cấu trúc 3 nhóm hiện tại của ATS 3.0 (Sourcing & Applications / Assessment & Interview / Offer & Closing), chỉ bỏ 4 giá trị mang tính outcome (`Rejected`, `Failed Interview`, `Reject Offer`, `Withdraw Interview Process`) ra khỏi danh sách Stage — vì các giá trị này sẽ được biểu diễn bằng `Result = Failed` + `Reason` thay vì là một Stage.
3. `Result` và `Reason` là **OPTIONAL** ở giai đoạn này — KHÔNG validate bắt buộc khi đóng Application (không chặn `status = Closed` nếu thiếu Result/Reason). Lý do: rất nhiều record legacy (thời Microsoft Access, trước khi có khái niệm Result/Reason) sẽ không có dữ liệu này — bắt buộc ngay sẽ gây khó chịu khi thao tác trên dữ liệu cũ. Sẽ cân nhắc bắt buộc ở giai đoạn sau khi model đã ổn định.
4. KHÔNG cố backfill lịch sử `reason_failed`/`note_failure_reason` từ Notion cho 3192 record hiện có trong Supabase — đã xác minh không khả thi (xem "Phát hiện nền tảng" bên dưới). Chỉ chuẩn hoá thô dữ liệu cũ theo Phần 4.

**Phát hiện nền tảng (đã tự verify qua Supabase MCP + Notion MCP, KHÔNG cần AG verify lại, chỉ cần biết để hiểu bối cảnh):**
- Bảng `activity` (= Application) trong Supabase đã có sẵn 3 cột kế thừa từ Notion khi migrate: `result` (text), `reason_failed` (text), `note_failure_reason` (text). **KHÔNG cần `ALTER TABLE` thêm cột** — chỉ cần bắt đầu ghi/đọc đúng vào 3 cột này.
- `reason_failed`: 100% NULL trên toàn bộ 3192 record. `note_failure_reason`: 100% rỗng. `result`: chỉ có 2 trạng thái thực tế là `"Passed"` hoặc `NULL` — mọi record thất bại (current_stage = Rejected/Failed Interview/...) đều đang để `result = NULL` thay vì `"Failed"` (logic bị đảo/migrate thiếu).
- Đã thử đối chiếu ngược sang Notion: Notion "Application" hiện chỉ có 290 record (86 có Reason), nhưng chỉ 78/3192 record trong Supabase còn giữ được `notion_id` liên kết, và thử join 3 record có Reason từ Notion thì không khớp record nào trong Supabase → xác nhận không có đường backfill lịch sử đáng tin cậy, không mất công thử thêm.
- Phát hiện phụ (ghi nhận, KHÔNG thuộc phạm vi sửa của spec này): hiện có 3 nơi định nghĩa danh sách Stage lệch nhau — `src/constants/enums.js` (`CANDIDATE_STAGES_LIST`, nguồn chính), optgroup hard-code riêng trong `src/app/jobs/page.js` (~dòng 2917, có cả `"Call"`, `"Reject"` không hề tồn tại trong enum!), và optgroup hard-code riêng trong `src/app/page.js`. Đây là nguyên nhân `current_stage` trong DB có hàng chục biến thể rác (`"Failed Screen"`, `"Keep in touch"`, `"1st interview"` chữ thường, `"Data input"`/`"Data Input"`...). Spec này SẼ dọn 2 optgroup hard-code (Phần 3), nhưng KHÔNG chuẩn hoá lại toàn bộ giá trị rác lịch sử trong `current_stage` — đó là một việc riêng, để dành cho spec sau nếu PO muốn làm.

---

## Phần 1 — `src/constants/enums.js`: cập nhật danh sách Stage, thêm Result & Reason

**1.1. Bỏ 4 giá trị outcome khỏi `CANDIDATE_STAGES`, `CANDIDATE_STAGES_LIST`, `STAGE_COLOR_MAP`:**

Xoá các dòng liên quan tới `REJECTED`, `FAILED_INTERVIEW`, `REJECT_OFFER`, `WITHDRAW` trong cả 3 object (`CANDIDATE_STAGES`, `CANDIDATE_STAGES_LIST`, `STAGE_COLOR_MAP`). Sau khi xoá, `CANDIDATE_STAGES` còn lại đúng 15 giá trị sau (giữ nguyên thứ tự, giữ nguyên 3 nhóm khi hiển thị optgroup ở Phần 3):

```js
export const CANDIDATE_STAGES = Object.freeze({
  RECEIVED_CV: "Received CV",
  TALENT_MAPPING: "Talent Mapping",
  CONTACT: "Contact",
  WAITING_FOR_CV: "Waiting for CV",
  SEND_CV_TO_CLIENT: "Send CV To AH/Client",
  SENDING_TEST: "Sending Test",
  SUBMIT_TEST: "Submit Test",
  FIRST_INTERVIEW: "1st Interview",
  SECOND_INTERVIEW: "2nd Interview",
  ADDITIONAL_INTERVIEW: "Additional Interview",
  FINAL_INTERVIEW: "Final Interview",
  FEEDBACK: "Feedback",
  CHASING_FEEDBACK: "Chasing Feedback",
  OFFER: "Offer",
  ONBOARD: "Onboard"
});
```

Cập nhật `CANDIDATE_STAGES_LIST` và `STAGE_COLOR_MAP` tương ứng (chỉ giữ 15 key trên, xoá 4 key outcome khỏi cả 2 object này). Không cần đổi màu các stage còn lại.

> Lưu ý: record cũ trong DB có `current_stage = "Rejected"` (hoặc các biến thể outcome khác) vẫn hiển thị được bình thường — `getStageBadgeClass` đã có fallback `|| "bg-slate-800 text-slate-300 border-slate-700"` khi không tìm thấy trong `STAGE_COLOR_MAP`, chỉ mất màu riêng, không lỗi.

**1.2. Thêm mới `APPLICATION_RESULTS`:**

```js
/**
 * Application Final Result (tách riêng khỏi Stage để phục vụ báo cáo funnel).
 */
export const APPLICATION_RESULTS = Object.freeze({
  PASSED: "Passed",
  FAILED: "Failed"
});

export const APPLICATION_RESULTS_LIST = Object.freeze([
  APPLICATION_RESULTS.PASSED,
  APPLICATION_RESULTS.FAILED
]);
```

**1.3. Thêm mới `FAILURE_REASONS`** (nguyên văn 15 giá trị lấy từ Notion property "Reason (if failed)", giữ đúng thứ tự Notion đang dùng):

```js
/**
 * Standard Failure Reasons — đồng bộ 1:1 với Notion property "Reason (if failed)".
 * Chỉ áp dụng khi Result = Failed.
 */
export const FAILURE_REASONS = Object.freeze({
  HEADCOUNT_CLOSED: "Headcount Closed/On Hold",
  WITHDRAWN_PERSONAL: "Withdrawn - Personal reasons",
  WITHDRAWN_LOCATION: "Withdrawn - Location/Commute",
  WITHDRAWN_GHOSTED: "Withdrawn - Ghosted/No show",
  WITHDRAWN_ACCEPTED_OFFER: "Withdrawn - Accepted another offer",
  WITHDRAWN_SALARY: "Withdrawn - Salary/C&B",
  TECH_SKILL: "Tech/Skill",
  EXPERIENCE: "Experience",
  CULTURE_FIT: "Culture Fit",
  LANGUAGE: "English/Language",
  OVERQUALIFIED: "Overqualified",
  OVERBUDGET: "Overbudget",
  DUPLICATED: "Duplicated - Candidate has been sent by other recruiter recently",
  UNABLE_TO_CONTACT: "Unable To Contact",
  WITHDRAWN_NA: "Withdrawn - N/A"
});

export const FAILURE_REASONS_LIST = Object.freeze(Object.values(FAILURE_REASONS));
```

---

## Phần 2 — `src/app/actions.js`: mở rộng `updateApplicationAction`

Hàm `updateApplicationAction` (dòng ~152) hiện chỉ nhận `status, planning_date, note, current_stage, source_channel, is_passive`. Bổ sung nhận thêm `result`, `reason_failed`, `note_failure_reason` — **không thêm validate bắt buộc** (đúng quyết định #3 của PO):

```js
export async function updateApplicationAction(applicationId, updateData) {
  if (!applicationId) return { success: false, error: "Thiếu mã Application ID" };
  try {
    const { status, planning_date, note, current_stage, source_channel, is_passive, result, reason_failed, note_failure_reason } = updateData;
    const parsedPlanningDate = planning_date !== undefined ? (planning_date ? new Date(planning_date) : null) : undefined;

    const [appCheck] = await sql`SELECT status FROM activity WHERE id = ${applicationId}`;
    const isReopening = updateData.status && updateData.status !== 'Closed';
    if (appCheck && appCheck.status === 'Closed' && !isReopening && !updateData.status) {
        return { success: false, error: "Không thể chỉnh sửa hồ sơ đang bị khóa (Closed)" };
    }

    await sql`
      UPDATE activity
      SET 
        status = ${status !== undefined ? status : sql`status`},
        planning_date = ${parsedPlanningDate !== undefined ? parsedPlanningDate : sql`planning_date`},
        note = ${note !== undefined ? note : sql`note`},
        current_stage = ${current_stage !== undefined ? current_stage : sql`current_stage`},
        source_channel = ${source_channel !== undefined ? source_channel : sql`source_channel`},
        is_passive = ${is_passive !== undefined ? is_passive : sql`is_passive`},
        result = ${result !== undefined ? result : sql`result`},
        reason_failed = ${reason_failed !== undefined ? reason_failed : sql`reason_failed`},
        note_failure_reason = ${note_failure_reason !== undefined ? note_failure_reason : sql`note_failure_reason`},
        last_updated = NOW()
      WHERE id = ${applicationId}
    `;

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Error updating application action:", error);
    return { success: false, error: error.message };
  }
}
```

Chỉ thêm 3 dòng vào destructure và 3 dòng vào `SET` — không đổi logic khoá `Closed` hiện có, không đổi các hàm khác trong file (`addActivityLog`, `updateActivityLog`... giữ nguyên, KHÔNG thuộc phạm vi spec này).

Kiểm tra thêm: các nơi khác trong `actions.js` có `SELECT` tường minh từng cột của `activity` (ví dụ dòng ~393 `app.id AS application_id, app.job_id, app.current_stage, app.status, app.result,` và dòng ~1162/1695 `COALESCE(a.current_stage, 'New') as current_stage`) — bổ sung `a.reason_failed, a.note_failure_reason` vào các câu `SELECT` đang trả dữ liệu application cho `jobs/page.js` và `page.js` (2 hàm chính lấy list applications), để 2 field mới có mặt trong response mà UI cần đọc. Tự tìm và liệt kê các hàm này trong báo cáo trả lại (đừng đoán, đọc kỹ actions.js để không bỏ sót điểm nào cần thêm `reason_failed`/`note_failure_reason` vào SELECT).

---

## Phần 3 — UI: `src/app/jobs/page.js`

**3.1. Dọn optgroup Stage hard-code (~dòng 2917-2934):** thay 3 optgroup viết tay (đang có `"Call"`, `"Reject"`, `"1st interview"` chữ thường — không khớp enum) bằng cách render từ `CANDIDATE_STAGES_LIST`/`CANDIDATE_STAGES` đã cập nhật ở Phần 1, giữ đúng 3 nhóm hiển thị hiện có (Sourcing & Applications / Assessment & Interview / Offer & Closing) bằng cách chia mảng con tương ứng khi map. Import thêm `CANDIDATE_STAGES`, `CANDIDATE_STAGES_LIST` nếu file chưa import (kiểm tra đầu file — hiện đang import trực tiếp trong `candidates/page.js` nhưng cần tự check `jobs/page.js` đã import `enums.js` chưa).

**3.2. Thêm UI cho Result / Reason / Note** ngay trong khối "Quick Edit Application Fields" hiện có (~dòng 2820-2864, `grid grid-cols-12`) — đây là nơi duy nhất hiện tại có thể sửa `status` của application. Khi `app.status === "Closed"`, khối `Planning Date / Source Channel / Passive Sourcing` đang bị ẩn hoàn toàn (dòng 2835 `{app.status !== "Closed" && (...)}`) — nghĩa là hiện tại đóng Application xong thì KHÔNG có chỗ nào để ghi Result/Reason cả. Thêm nhánh hiển thị ngược lại, đặt fields Result/Reason/Note đúng vào chỗ trống đó:

```jsx
{/* Non-closed fields (Hidden when Closed to maximize clean space) */}
{app.status !== "Closed" && (
  <>
    {/* ... giữ nguyên Planning Date / Source Channel / Passive Sourcing như cũ, không đổi ... */}
  </>
)}

{/* Result / Reason / Note — chỉ hiện khi Closed (optional, không bắt buộc) */}
{app.status === "Closed" && (
  <>
    <div className="col-span-12 sm:col-span-3">
      <label className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Result</label>
      <select
        value={app.result || ""}
        onChange={(e) => handleUpdateAppField(app.id, "result", e.target.value || null)}
        className="w-full h-6 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-semibold cursor-pointer focus:ring-1 focus:ring-emerald-500"
      >
        <option value="">— (chưa chọn)</option>
        {APPLICATION_RESULTS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>

    {app.result === "Failed" && (
      <div className="col-span-12 sm:col-span-5">
        <label className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Reason (if failed)</label>
        <select
          value={app.reason_failed || ""}
          onChange={(e) => handleUpdateAppField(app.id, "reason_failed", e.target.value || null)}
          className="w-full h-6 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-semibold cursor-pointer focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">— (chưa chọn)</option>
          {FAILURE_REASONS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
    )}

    {app.result === "Failed" && (
      <div className="col-span-12 sm:col-span-4">
        <label className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Note (Failure Reason)</label>
        <input
          type="text"
          defaultValue={app.note_failure_reason || ""}
          onBlur={(e) => handleUpdateAppField(app.id, "note_failure_reason", e.target.value)}
          placeholder="Chi tiết thêm (không bắt buộc)..."
          className="w-full h-6 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500"
        />
      </div>
    )}
  </>
)}
```

Import thêm `APPLICATION_RESULTS_LIST, FAILURE_REASONS_LIST` từ `enums.js` ở đầu file. `handleUpdateAppField` đã tồn tại sẵn (dòng ~976, gọi `updateApplicationAction(appId, { [field]: value })`) — tái sử dụng nguyên trạng, không cần viết hàm mới, chỉ cần Phần 2 đã cho phép backend nhận field mới.

Text input dùng `defaultValue` + `onBlur` (không phải `value`/`onChange` như 2 select) để tránh gọi update trên từng keystroke — đúng pattern input tự do khác đã có trong file (kiểm tra file đã có pattern tương tự chưa, nếu có input text nào khác đang dùng `value`+`onChange` trực tiếp gọi update mỗi keystroke thì giữ nguyên theo đúng pattern hiện hành của file, không cần đổi cách làm nếu đã nhất quán).

---

## Phần 4 — `src/app/page.js` (Dashboard)

Dashboard dùng bảng hàng-cột (table), không có khối "Quick Edit" như `jobs/page.js`. Cột "CURRENT STAGE" hiện ở ~dòng 970 (badge đọc từ `getStageBadgeClass`/`getStageBadgeLabel`). Thêm 2 cột mới ngay sau cột này: **Result** (select) và **Reason** (select, chỉ hiện/enable khi Result = Failed) — áp dụng đúng logic y hệt Phần 3.2, chỉ khác là render dạng `<td>` thay vì `<div className="col-span-...">`, dùng `handleInlineUpdate(app.application_id, field, value)` đã có sẵn (dòng ~450) thay cho `handleUpdateAppField`. Cập nhật cả header `<thead>` tương ứng để thêm 2 cột mới (tự tìm vị trí `<thead>` khớp với `<tbody>` đang liệt kê ở dòng ~970, đảm bảo số cột header và body khớp nhau).

Không bắt buộc phải giống 100% pixel với `jobs/page.js`, miễn giữ đúng hành vi: optional, ẩn Reason khi Result khác Failed, dùng đúng field name `result`/`reason_failed`/`note_failure_reason`.

---

## Phần 5 — `src/app/candidates/page.js` (chỉ đọc, ưu tiên thấp — P3)

File này chỉ hiển thị badge Stage của Application trong trang chi tiết ứng viên (~dòng 1224-1249), KHÔNG có form chỉnh sửa Application nào (import `updateApplicationAction` nhưng thực tế không gọi ở đâu cả — biến import thừa, không cần xử lý biến thừa này trong spec — không thuộc phạm vi). Việc cần làm: nếu `app.result === "Failed"`, hiển thị thêm 1 badge nhỏ màu đỏ cạnh badge Stage ghi rõ Reason (nếu có), ví dụ `Failed — Tech/Skill`. Không cần cho sửa ở đây, chỉ hiển thị.

---

## Phần 6 — Chuẩn hoá thô dữ liệu cũ (3192 record hiện có)

Theo quyết định #4 của PO: không backfill từ Notion, chỉ chuẩn hoá thô ngay trong Supabase. Viết 1 script Node một-lần theo đúng convention đã có của dự án (xem mẫu `scripts/archive/data-mutating-oneoffs/2026-09-01_fix-sequences_display-number.mjs`), đặt tại `scripts/archive/data-mutating-oneoffs/2026-09-01_normalize-legacy-result-reason.mjs`, thực hiện đúng 2 việc sau bằng SQL (không động vào các record khác):

```sql
-- 1) Các current_stage rõ ràng là kết quả THẤT BẠI (dựa trên phân bố thực tế đã kiểm tra ngày 2026-09-01)
--    -> set result = 'Failed', và reason_failed = 'Withdrawn - N/A' làm placeholder
--    (đúng nghĩa "không rõ lý do vì dữ liệu cũ", KHÔNG suy đoán lý do cụ thể)
UPDATE activity
SET result = 'Failed',
    reason_failed = COALESCE(reason_failed, 'Withdrawn - N/A'),
    last_updated = NOW()
WHERE result IS NULL
  AND current_stage IN (
    'Rejected', 'Failed Interview', 'Failed Screen', 'Failed Test',
    'Reject Offer', 'Withdraw Interview Process',
    'Rejected By Hiring Manager', 'Recjected By Hiring Manager',
    'Failed Interview (2nd)', 'Failed Interview (3rd)'
  );

-- 2) Phần còn lại đang result = 'Passed' -> giữ nguyên, KHÔNG đổi.
--    Phần current_stage KHÔNG nằm trong danh sách trên và result vẫn NULL
--    (ví dụ đang "In progress", hoặc "Keep in touch", "Interview Arrangement"...)
--    -> để nguyên NULL, KHÔNG đoán là Passed hay Failed.
```

Script phải: (a) chạy trước bằng `SELECT COUNT(*)` để in ra số record sẽ bị ảnh hưởng và log ra console trước khi `UPDATE` thật (dry-run trước), (b) chỉ chạy `UPDATE` thật khi có flag `--apply` truyền vào (theo đúng pattern các script archive khác trong `scripts/archive/data-mutating-oneoffs/` đang làm, tự đọc 1-2 script mẫu ở đó để bám đúng convention), (c) không đụng tới `activity_log` (bảng log riêng, không thuộc phạm vi spec này).

---

## Ngoài phạm vi (KHÔNG làm trong spec này, chỉ ghi nhận)

- Không chuẩn hoá lại toàn bộ giá trị rác trong `current_stage` (`"Keep in touch"`, `"Data input"` vs `"Data Input"`, `"1st interview"` chữ thường...) — vấn đề có thật (ghi nhận ở "Phát hiện nền tảng") nhưng là việc riêng, dành cho spec sau nếu PO muốn.
- Không đổi `activity_log.result` (đang có 5 biến thể casing: Pass/Pending/Fail/Passed/Failed) — đây là field per-log-entry khác với `activity.result` (per-application), không thuộc yêu cầu của PO lần này.
- Không thêm validate bắt buộc Result/Reason khi đóng Application (quyết định #3) — để dành giai đoạn sau.

---

## Yêu cầu báo cáo

Sau khi hoàn thành TOÀN BỘ Phần 1-6, dán lại NGUYÊN VĂN, không tự kết luận "hoàn thành":
1. `git diff` đầy đủ của mọi file đã sửa (`src/constants/enums.js`, `src/app/actions.js`, `src/app/jobs/page.js`, `src/app/page.js`, `src/app/candidates/page.js`, script mới trong `scripts/archive/data-mutating-oneoffs/`).
2. Log console khi chạy script chuẩn hoá dữ liệu ở chế độ dry-run (chưa `--apply`), và log khi chạy thật (`--apply`) — kèm số record đã bị ảnh hưởng thực tế.
3. Kết quả JSON thô của `/api/qa-test`, `/api/db-test`, `/api/biz-test` sau khi sửa xong (không được có regression).
4. Ảnh/mô tả thao tác tay: mở 1 Application đang `In progress` trên `/jobs`, đổi Status sang `Closed`, xác nhận thấy Result/Reason/Note xuất hiện đúng, chọn Result = Failed → Reason hiện ra, lưu xong reload lại trang xác nhận dữ liệu còn đúng (không mất khi reload).
5. Nếu phát hiện việc gì ngoài phạm vi 6 phần trên cần làm thêm (kể cả nhỏ) — DỪNG LẠI, báo cáo, xin xác nhận trước khi làm, theo đúng quy trình mục 10 của GEMINI.md.
