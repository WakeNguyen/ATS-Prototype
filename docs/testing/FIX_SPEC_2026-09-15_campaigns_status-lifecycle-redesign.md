**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Redesign Campaign Status: 7 giá trị → 3 giá trị user-chọn + 1 giá trị hệ thống

## Bối cảnh

Sau khi fix bug "Status không lưu được" sáng nay, PO hỏi sâu về cơ chế Status và phát hiện: **6/7 giá trị hiện tại không có tác dụng thật** — hệ thống chỉ thật sự dựa vào `is_active` (boolean, chỉ đổi khi `status='Archived'`) để quyết định có cho campaign chạy hay không, không đọc trực tiếp `status`. Đã thống nhất với PO (qua phân tích ma trận 3 công tắc `is_active`/`auto_run_enabled`/`status`) phương án redesign sau — đọc kỹ TOÀN BỘ spec này trước khi làm, đây là thay đổi lớn, nhiều file.

## Mô hình mới đã chốt với PO

**`status` (DB, cột `text`, không đổi kiểu) có 4 giá trị:**
- `Draft` — user chủ động chưa muốn chạy, hoặc đang chạy mà muốn tạm dừng. `is_active = false`.
- `Active` — vận hành bình thường. `is_active = true`.
- `Archived` — đã đóng vĩnh viễn. `is_active = false`.
- `Needs Review` — **CHỈ hệ thống tự set** (circuit breaker khi gặp lỗi hệ thống nghiêm trọng trong 1 lượt chạy), **user KHÔNG BAO GIỜ được chọn giá trị này qua UI**. Bản chất hành vi giống hệt `Draft` (`is_active = false`), chỉ khác label để cảnh báo user "cái này hệ thống tự dừng vì lỗi, không phải bạn chủ động".

**"Running" KHÔNG còn là giá trị lưu trong `status` nữa** — chuyển thành badge tạm thời, suy trực tiếp từ `campaign_runs`/`warm_join_runs` đang có run `status='Running'` (dữ liệu này đã có sẵn qua field `latest_run_status` trong `getCampaigns()`), không lưu trùng.

**Quy tắc vàng:** `is_active` **LUÔN LUÔN được server tính lại từ `status`** (`is_active = (status === 'Active')`), **KHÔNG bao giờ tin giá trị `is_active` client gửi lên nữa** — đóng hoàn toàn khả năng lệch pha giữa 2 field (nguồn gốc của toàn bộ vụ điều tra sáng nay).

## Phạm vi — 7 file code + schema/data trên CẢ 2 schema

**Code:**
1. `src/app/campaign_actions.js`
2. `src/app/components/CampaignEditModal.js`
3. `src/app/campaigns/page.js`
4. `src/app/api/webhooks/campaign-run-callback/route.js`
5. `src/app/api/webhooks/warm-join-run-callback/route.js`
6. `src/app/api/webhooks/auto-run-eligible-campaigns/route.js`

**Schema + Data (AG làm trên `sandbox` — role `ag_dev_role` có quyền; Claude tự làm trên `public` sau khi AG xong và Claude QA code PASS, KHÔNG giao AG đụng `public`):**
```sql
-- 1. Migrate dữ liệu status cũ sang mô hình mới (Draft/Needs Review/Archived giữ nguyên)
UPDATE {schema}.campaigns SET status = 'Active' WHERE status IN ('Ready', 'Running', 'Failed');
UPDATE {schema}.campaigns SET status = 'Draft' WHERE status = 'Paused';
UPDATE {schema}.campaigns SET status = 'Archived' WHERE status = 'Completed';

-- 2. Đồng bộ lại is_active theo đúng status mới (nguồn xác định duy nhất từ nay)
UPDATE {schema}.campaigns SET is_active = (status = 'Active');

-- 3. Dọn auto_run_enabled rác trên campaign đã Archived (tránh cờ bật ngầm không còn ý nghĩa)
UPDATE {schema}.campaigns SET auto_run_enabled = false WHERE status = 'Archived' AND auto_run_enabled = true;

-- 4. Thêm ràng buộc DB chặn giá trị status rác (GEMINI.md Phần B mục 2.1 — data integrity)
ALTER TABLE {schema}.campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('Draft', 'Active', 'Archived', 'Needs Review'));
```
AG chạy đúng 4 câu trên với `{schema}` = `sandbox` (dùng `apply_migration` hoặc `execute_sql` qua n8n MCP/Supabase MCP nếu có quyền, hoặc qua `sql` client trong 1 script test riêng — tự quyết định cách chạy phù hợp môi trường sandbox). Claude sẽ tự chạy đúng 4 câu này trên `public` sau khi QA code xong — AG KHÔNG được tự ý chạy trên `public`.

## Chi tiết code cần sửa

### 1. `src/app/campaign_actions.js`

**1a. `createCampaign` (dòng 340-364):** Thêm `status = 'Draft'` vào destructure (default cho campaign mới), BỎ tham số `is_active` khỏi destructure (không tin client nữa). Đổi INSERT (dòng 383-391): cột `is_active` dùng `${status === 'Active'}` thay vì `${is_active}`; cột `status` (hiện đang hardcode `'Ready'`) đổi thành `${status}`. Thêm validate: nếu `status` không thuộc `['Draft', 'Active', 'Archived']` → trả lỗi rõ ràng (không cho tạo mới với `Needs Review` hay giá trị lạ).

**1b. `updateCampaign` (dòng 439-463 destructure, dòng 486-519 UPDATE):** Đổi `validStatuses` (dòng ~488, phần đã thêm sáng nay) từ `['Draft', 'Ready', 'Running', 'Paused', 'Completed', 'Failed', 'Archived']` thành `['Draft', 'Active', 'Archived']` — **loại `Needs Review` khỏi whitelist** (nếu ai gọi `updateCampaign` với `status: 'Needs Review'` phải bị từ chối, chỉ webhook callback mới được set giá trị này qua raw SQL riêng). BỎ tham số `is_active` khỏi destructure — không nhận từ client nữa. Đổi dòng UPDATE SET: `is_active = CASE WHEN ${status !== undefined} THEN ${status === 'Active'} ELSE is_active END` (thay cho dòng `is_active = COALESCE(...)` hiện tại) — is_active giờ LUÔN đi kèm status trong cùng 1 lần update, không tách rời.

**1c. `getCampaigns` (dòng 118-126):** Đổi sentinel filter từ `HIDE_COMPLETED`/`status <> 'Completed'` thành `HIDE_ARCHIVED`/`status <> 'Archived'`.

**1d. `checkCampaignAutoCompletion` (dòng 1220-1263, và block tương tự cho target-pool-reached ở dòng ~1283-1287 — đọc thêm phần sau dòng 1263 để tìm block thứ 2 này):** Đổi `status = 'Ready'` → `status = 'Archived'` ở cả 2 UPDATE (end_date passed VÀ target pool reached).

**1e. `checkWarmingCampaignAutoCompletion` (dòng ~1334-1388, 2 block UPDATE ở dòng 1344 và 1386):** Hiện tại 2 block này CHỈ set `is_active=false, auto_run_enabled=false`, KHÔNG đụng `status` — đây là thiếu sót, campaign Warming auto-complete xong vẫn còn `status` cũ (vd `Active`), tạo trạng thái mâu thuẫn (`is_active=false` nhưng status hiện Active). Sửa cả 2 block: thêm `status = 'Archived'` vào UPDATE.

### 2. `src/app/components/CampaignEditModal.js`

**2a. `CAMPAIGN_STATUS_OPTIONS` (dòng 32-40):** Đổi từ 7 phần tử xuống:
```js
const CAMPAIGN_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Active", label: "Active" },
  { value: "Archived", label: "Archived" }
];
```

**2b. Dropdown Status (dòng ~533-543):** Nếu campaign đang sửa có `status === "Needs Review"`, thêm 1 `<option>` disabled hiển thị rõ ràng NGAY TRƯỚC 3 option chuẩn, để user thấy đúng trạng thái hiện tại (không bị dropdown hiện sai/rỗng) nhưng không thể chọn lại nó:
```jsx
<select value={status} onChange={(e) => setStatus(e.target.value)} ...>
  {status === "Needs Review" && (
    <option value="Needs Review" disabled>⚠️ Needs Review (system-flagged)</option>
  )}
  {CAMPAIGN_STATUS_OPTIONS.map((opt) => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>
```

**2c. State khởi tạo (dòng 117):** `useState("Draft")` — giữ nguyên, mặc định Draft cho campaign mới đã đúng theo mô hình mới.

**2d. Payload gửi lên (dòng 332-355):** BỎ dòng `is_active: status !== "Archived"` khỏi payload — không cần gửi nữa vì server (mục 1a/1b ở trên) giờ tự tính từ `status`.

### 3. `src/app/campaigns/page.js`

**3a. Default filter (dòng 230):** Đổi `useState("HIDE_COMPLETED")` → `useState("HIDE_ARCHIVED")`.

**3b. Dropdown filter Status (dòng ~1128-1135):** Đổi thành:
```jsx
<option value="HIDE_ARCHIVED">Active (Hide Archived)</option>
<option value="ALL">All Statuses</option>
<option value="Draft">Draft</option>
<option value="Active">Active</option>
<option value="Archived">Archived</option>
<option value="Needs Review">Needs Review</option>
```
(Giữ `Needs Review` làm lựa chọn LỌC — user không set được qua Edit Modal, nhưng vẫn cần tìm được campaign đang bị flag để xử lý.)

**3c. `hasRunningCampaign` (dòng 345):** Đổi từ `c.status === "Running"` thành `c.latest_run_status === "Running"` (field đã có sẵn trong response `getCampaigns()`, dòng 87-91 của `campaign_actions.js`).

**3d. `isRunning` cho từng row (dòng 1212):** Tương tự, đổi `c.status === "Running"` thành `c.latest_run_status === "Running"`.

**3e. `renderCampaignStatusBadge` (dòng 810-861):** Viết lại nhận cả object `c` (không chỉ `status`) để biết cả `latest_run_status`:
```js
const renderCampaignStatusBadge = (c) => {
  if (c.latest_run_status === "Running") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <Loader2 size={11} className="animate-spin" />
        Running
      </span>
    );
  }
  switch (c.status) {
    case "Needs Review":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertCircle size={11} />
          Needs Review
        </span>
      );
    case "Active":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Active
        </span>
      );
    case "Archived":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          Archived
        </span>
      );
    case "Draft":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          Draft
        </span>
      );
  }
};
```
Cập nhật TẤT CẢ nơi gọi `renderCampaignStatusBadge(...)` (grep lại trong file) để truyền cả object campaign `c` thay vì `c.status`.

**3f. Cảnh báo khi Save Status rời khỏi "Active" trong lúc có run đang chạy (yêu cầu mới của PO, tiếng Anh theo chuẩn GEMINI.md mục 5):** Trong hàm xử lý Save của Edit Modal (nơi gọi `updateCampaign`) — nếu campaign đang sửa có `latest_run_status === "Running"` VÀ user đổi `status` từ khác "Active" thành khác, hiển thị 1 toast/banner cảnh báo ngay sau khi save thành công:
```
"Note: the run currently in progress will continue to completion — pausing only prevents future runs."
```
(Không hủy run đang chạy — hành vi giữ nguyên như hiện tại, chỉ cần thêm dòng thông báo để user không hiểu nhầm là Pause sẽ dừng ngay lập tức. Đặt trong `CampaignEditModal.js` — kiểm tra field `latestRunStatus`/tương đương đã được truyền vào modal qua prop `campaign` hay chưa; nếu chưa có, hỏi lại Claude trước khi tự thêm prop mới — theo đúng quy ước "hỏi khi không chắc" cuối file.)

## Việc KHÔNG được làm

- Không đụng `RunHistoryTable.js` — file đó xử lý `campaign_runs.status`/`warm_join_runs.status` (trạng thái từng LƯỢT CHẠY: Running/Completed/Needs Review/Failed), là khái niệm HOÀN TOÀN KHÁC với `campaigns.status` (trạng thái vòng đời CAMPAIGN) đang sửa trong spec này — 2 bảng, 2 domain, không liên quan.
- Không sửa `_executeCampaignRunInternal`/`triggerWarmJoinRun`/`_acquireWarmJoinRunLock` — logic check `is_active` ở đó đã đúng, không cần đổi vì `is_active` vẫn là nguồn xác định duy nhất để chặn chạy, chỉ đổi CÁCH `is_active` được tính (mục 1a/1b).
- Không chạy migration/ALTER TABLE trên `public` — đây là việc Claude tự làm riêng sau khi QA code.
- Không thêm cơ chế hủy run đang chạy khi user đổi status — PO đã xác nhận giữ hành vi hiện tại (không hủy), chỉ cần thêm cảnh báo UI.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check` toàn bộ 6 file code đã sửa → PASS.
2. `git diff --stat` → đúng 6 file code (+ doc).
3. Chạy đúng 4 câu SQL migration trên `sandbox`, xác nhận:
   - Không còn dòng nào có `status` ngoài `('Draft','Active','Archived','Needs Review')`.
   - `is_active` khớp 100% với `(status = 'Active')` cho mọi dòng.
   - Constraint `campaigns_status_check` đã tồn tại (thử INSERT/UPDATE 1 dòng test với `status='Bogus'` → PHẢI bị DB từ chối bởi constraint, không phải bởi validate JS).
4. Test thật qua `npm run dev` trong `sandbox`:
   - Tạo campaign mới → mặc định Draft, `is_active=false` trong DB.
   - Đổi sang Active → lưu → `is_active=true` trong DB, badge hiển thị "Active".
   - Đổi sang Archived → lưu → `is_active=false`, `auto_run_enabled` bị tắt nếu đang bật.
   - Trigger 1 run thật cho campaign Active, TRONG LÚC đang chạy mở Edit Modal đổi sang Draft → lưu → xác nhận thấy cảnh báo tiếng Anh đúng nội dung, run đang chạy KHÔNG bị hủy giữa chừng (verify qua `campaign_runs` vẫn tiếp tục tới khi tự hoàn thành).
   - Giả lập 1 run bị `systemicFailure` (hoặc kiểm tra lại code path `campaign-run-callback` với `systemicFailure: true`) → xác nhận `campaigns.status` chuyển đúng `Needs Review`, badge hiển thị đúng màu đỏ cảnh báo, dropdown Edit Modal hiện option "⚠️ Needs Review (system-flagged)" disabled, user chỉ chọn được Draft/Active/Archived để thoát khỏi trạng thái này.
   - Test Auto-Scheduler: campaign Draft với `auto_run_enabled=true` → xác nhận KHÔNG bị auto-trigger (do `is_active=false`).
5. `/api/biz-test` + `/api/qa-test` → PASS 100%, không regression (đặc biệt các case liên quan `max_posts_per_run`, `WARM-CLAMP`).
6. `npm run build` → PASS 100% routes.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md — đây là thay đổi lớn (schema + nhiều file), cần liệt kê ĐẦY ĐỦ từng file + lý do. Cập nhật `docs/USER_MANUAL_DRAFT.md` mục liên quan tới Campaign Status nếu có mô tả cũ về 7 trạng thái.

Báo cáo hoàn thành phải kèm output nguyên văn `git status`, `git diff --stat`, `npm run build`, kết quả 4 câu SQL migration trên sandbox (số dòng bị ảnh hưởng mỗi câu), và kết quả từng kịch bản test ở mục Verify (không ghi "PASS" suông).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ (UI/trình bày, không đổi hành vi nghiệp vụ) → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi (ĐẶC BIỆT: bất kỳ thao tác nào trên `public`) → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Nếu prop `campaign`/`latestRunStatus` chưa có sẵn để làm mục 3f (cảnh báo run đang chạy) → in `QUESTION:` hỏi rõ, đừng tự đoán cấu trúc data truyền vào modal.
