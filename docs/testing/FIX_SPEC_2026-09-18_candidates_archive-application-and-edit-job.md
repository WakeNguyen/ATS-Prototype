**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-18 — Archive (ẩn) Application record + Edit Job (sửa job gán nhầm)

## Bối cảnh & quyết định đã chốt với PO (không suy diễn — trích lại nguyên văn quyết định)

1. PO muốn có nút "xoá" 1 application record (dòng trong "Applications & Pipeline" trên Candidate 360°) — lý do gốc: **gán nhầm Job, không sửa được**. Sau khi Claude tư vấn (framework Pros/Cons/Value/Trade-off/Recommendation theo GEMINI.md Phần C), PO đồng ý hướng **Archive (ẩn mềm)** thay vì DELETE cứng, PLUS thêm nút **Edit Job** để giải quyết đúng gốc rễ (sửa nhầm job) thay vì phải xoá-tạo-lại.
2. PO hỏi: nếu Edit Job cho phép đổi sang 1 job mà candidate đã có application khác ở đó thì sao? → Đã xác nhận qua đọc trực tiếp code: **không có ràng buộc UNIQUE nào trên `(candidate_id, job_id)`** ở cả 2 schema — nếu làm ẩu sẽ tạo dòng trùng lặp âm thầm. **Bắt buộc** Edit Job phải tái dùng đúng logic chống trùng đã có ở `assignCandidateToJob` (`actions.js:852-861`).
3. PO hỏi: record archived có bị loại khỏi phân tích/export sau này không? → Đã chốt: **CÓ, mặc định loại trừ mọi nơi tính dữ liệu pipeline thật** (Action Menu, Candidates, số đếm applicant trên Jobs, và bất kỳ tính năng export/phân tích nào xây dựng sau này phải áp dụng cùng filter `is_active = true`) — nhưng dữ liệu KHÔNG mất, vẫn còn trong DB, có thể khôi phục qua UI "Show Archived".

## Đã xác nhận qua đọc trực tiếp code (KHÔNG suy diễn)

- Bảng `activity` **chưa có cột nào kiểu archive/soft-delete**. Naming convention đã dùng SẴN trong dự án cho đúng nhu cầu này: cột boolean `is_active` (xem `campaigns.is_active`, `social_group_urls.is_active`, pattern filter `WHERE is_active = true` / `includeInactive` override tại `campaign_actions.js:2593,2609,3101`). **Dùng lại đúng tên `is_active`**, KHÔNG tự đặt tên khác (`archived_at`/`deleted_at` không có tiền lệ nào trong schema).
- `app.job_id` đã có sẵn trong dữ liệu trả về của cả `getCandidateProfile` (`actions.js:471`) lẫn card JSX (`candidates/page.js`) — không cần thêm SELECT cho phần hiển thị, chỉ cần thêm hành động ghi.
- Job-picker (search + chọn Job) đã có sẵn, triển khai inline trong `AssignToJobModal` (`candidates/page.js`, state dòng ~225-234, fetch dòng ~278-298, debounce ~336-346, handler chọn ~357-362, JSX dropdown ~534-631) dùng `getJobSearchData` (`actions.js:2181-2233`). **PHẢI tái dùng đúng pattern này** cho Edit Job modal (copy cấu trúc state/fetch/debounce/JSX, đổi hành động submit), không tự chế lại UI khác.
- Guard "khoá sửa khi Closed" trong `updateApplicationAction` (`actions.js:196-199`) sẽ CHẶN nhầm nếu route Archive/Edit Job qua hàm này (vì phần lớn record cần archive/sửa job chính là các record `Closed`/`Failed`) — do đó **PHẢI tạo 2 server action MỚI, riêng biệt**, không sửa/mở rộng `updateApplicationAction`.

## Phạm vi

1. **DB Migration** (cả `public` và `sandbox`): thêm cột `is_active boolean NOT NULL DEFAULT true` vào bảng `activity`.
2. **`src/app/actions.js`**: 2 action mới (`setApplicationActive`, `changeApplicationJob`) + sửa 4 query đọc để loại trừ `is_active = false` khỏi kết quả mặc định.
3. **`src/app/candidates/page.js`**: thêm nút Archive/Unarchive + nút Edit Job trên mỗi card, modal `EditJobModal` mới (copy pattern `AssignToJobModal`), và khu vực "Show Archived" để khôi phục.

Không đụng file/bảng nào khác ngoài danh sách trên. Nếu phát hiện cần mở rộng, DỪNG LẠI và in `ESCALATE:` (GEMINI.md mục 10).

---

## PHẦN A — DB Migration

Chạy trên CẢ 2 schema (`public` và `sandbox`), theo đúng mục 10.8/mục 9 GEMINI.md — đây là ALTER TABLE thêm cột, KHÔNG phải DELETE/UPDATE hàng loạt nên không cần liệt kê danh sách bản ghi, nhưng vẫn phải kiểm tra 2 lần đang ở đúng schema nào trước khi chạy:

```sql
ALTER TABLE public.activity  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE sandbox.activity ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
```

Lưu file migration vào `docs/testing/SQL_2026-09-18_activity_is_active-column.sql` (theo đúng tiền lệ đặt tên file SQL migration đã có, ví dụ `SQL_2026-09-15_campaigns_status-migration-public.sql`).

Verify: `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema IN ('public','sandbox') AND table_name = 'activity' AND column_name = 'is_active';` → phải trả về đúng 2 dòng, `data_type = boolean`, default `true`.

---

## PHẦN B — 2 Server Action mới trong `src/app/actions.js`

Đặt ngay sau `updateApplicationAction` (kết thúc ở dòng ~223, xem code hiện tại bên dưới để xác định đúng vị trí):

```js
// 1.4 Archive (ẩn mềm) / Khôi phục 1 Application — độc lập với guard khoá "Closed" của
// updateApplicationAction, vì archive chính là hành động cần làm được TRÊN các record
// Closed/Failed do gán nhầm — không tái dùng updateApplicationAction để tránh bị chặn nhầm.
export async function setApplicationActive(applicationId, isActive) {
  if (!applicationId) return { success: false, error: "Thiếu mã Application ID" };
  try {
    await sql`
      UPDATE activity SET is_active = ${!!isActive}, last_updated = NOW()
      WHERE id = ${applicationId}
    `;
    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error setting application active state:", error);
    return { success: false, error: error.message };
  }
}

// 1.5 Đổi Job cho 1 Application đã tồn tại (sửa lỗi gán nhầm Job — KHÔNG phải tạo mới).
// Tái dùng đúng logic chống trùng + kiểm tra trạng thái Job đích đã có trong
// assignCandidateToJob (actions.js dòng ~847-861), chỉ khác: loại trừ chính application
// đang sửa ra khỏi check trùng (id != applicationId), vì nếu không sẽ luôn tự báo trùng
// với chính nó.
export async function changeApplicationJob(applicationId, newJobId) {
  if (!applicationId || !newJobId) return { success: false, error: "Thiếu Application ID hoặc Job ID" };
  try {
    const result = await sql.begin(async (tx) => {
      const [app] = await tx`SELECT candidate_id, job_id FROM activity WHERE id = ${applicationId}`;
      if (!app) throw new Error("Application không tồn tại");
      if (app.job_id === newJobId) throw new Error("Job mới trùng với job hiện tại của application này");

      const [targetJob] = await tx`SELECT status, job_title FROM jobs WHERE id = ${newJobId}`;
      if (targetJob && (targetJob.status === 'Closed' || targetJob.status === 'Filled' || targetJob.status === 'On Hold')) {
        throw new Error(`Vị trí tuyển dụng "${targetJob.job_title}" hiện đang ở trạng thái ${targetJob.status} và không nhận thêm ứng viên.`);
      }

      const [existingApp] = await tx`
        SELECT id, status FROM activity
        WHERE candidate_id = ${app.candidate_id} AND job_id = ${newJobId} AND id != ${applicationId}
      `;
      if (existingApp) {
        if (existingApp.status === 'Closed' || existingApp.status === 'Cancelled') {
          throw new Error("Ứng viên này đã từng ứng tuyển vào vị trí này và hiện đang bị đóng hồ sơ. Vui lòng kiểm tra lại.");
        }
        throw new Error("Ứng viên đã được gán vào vị trí này và hiện đang ở trong pipeline.");
      }

      const [updated] = await tx`
        UPDATE activity SET job_id = ${newJobId}, last_updated = NOW()
        WHERE id = ${applicationId}
        RETURNING *
      `;
      return updated;
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error) {
    console.error("Error changing application job:", error);
    return { success: false, error: error.message };
  }
}
```

### Sửa 4 query đọc — loại trừ `is_active = false` khỏi kết quả mặc định (Action Menu, applicant counts)

1. **`getActionMenuData`** (`actions.js:39-164`) — thêm `AND app.is_active = true` vào CẢ 2 khối `WHERE` (query đếm `countRes` ở khoảng dòng 78-92, và query dữ liệu `data` ở khoảng dòng 126-140) — ngay sau dòng `AND (${filterPassive}::boolean IS NULL OR app.is_passive = ${filterPassive})`, trước khối `AND (... formattedSearch ...)`.

2. **`getCandidateProfile`** (`actions.js:436-533`) — **KHÔNG lọc bỏ** archived khỏi query (khác 3 chỗ còn lại), vì Candidates page cần hiển thị CẢ 2 nhóm (active + archived, tách riêng — xem PHẦN C). Chỉ cần thêm cột `app.is_active` vào SELECT ở dòng ~471:
   ```js
   app.id AS application_id, app.job_id, app.is_active, app.current_stage, app.status, app.result, app.reason_failed, app.note_failure_reason,
   ```

3. **`getClientWorkbenchData`** (applicant_count, `actions.js:~1218`) — sửa điều kiện JOIN (không phải WHERE, vì đây là LEFT JOIN + COUNT + GROUP BY, sửa ở WHERE sẽ sai logic khi 1 job có toàn record archived):
   ```js
   LEFT JOIN activity a ON j.id = a.job_id AND a.is_active = true
   ```

4. **`getJobSearchData`** (candidate_count, `actions.js:~2213`) — cùng lý do, sửa JOIN condition:
   ```js
   LEFT JOIN activity app ON j.id = app.job_id AND app.is_active = true
   ```

---

## PHẦN C — UI `src/app/candidates/page.js`

### C.1. Tách applications thành 2 nhóm (active / archived) trước khi render

Tìm chỗ đang lặp `applications.map(app => {...})` (khoảng dòng 1663) — thêm ngay TRƯỚC đoạn JSX render danh sách (không đổi cấu trúc bên trong `.map`, chỉ đổi NGUỒN mảng được map và bọc thêm phần "Show Archived"):

```js
const activeApplications = applications.filter(a => a.is_active !== false);
const archivedApplications = applications.filter(a => a.is_active === false);
const [showArchived, setShowArchived] = useState(false); // đặt cạnh các useState khác ở đầu component, KHÔNG khai báo trong JSX
```

Render `activeApplications.map(app => {...})` (giữ nguyên 100% JSX card hiện tại). Ngay sau khối `.map` đó (trước phần đóng section "Applications & Pipeline"), nếu `archivedApplications.length > 0`, hiển thị:

```jsx
{archivedApplications.length > 0 && (
  <div className="mt-2">
    <button
      type="button"
      onClick={() => setShowArchived(prev => !prev)}
      className="text-xs text-slate-500 hover:text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
    >
      {showArchived ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      <span>{showArchived ? "Hide" : "Show"} Archived ({archivedApplications.length})</span>
    </button>
    {showArchived && (
      <div className="mt-2 flex flex-col gap-3 opacity-70">
        {archivedApplications.map(app => (
          // Render lại ĐÚNG cùng 1 card component/markup như active, KHÔNG tạo bản sao code
          // khác — trích xuất phần JSX card hiện tại (dòng ~1670-1808) thành 1 hàm
          // renderApplicationCard(app) dùng chung cho cả 2 nhóm, chỉ khác nút Archive đổi
          // thành "Restore" khi app.is_active === false.
        ))}
      </div>
    )}
  </div>
)}
```

**Bắt buộc**: để tránh trùng lặp code, refactor khối JSX card (dòng ~1670-1808 hiện tại) thành 1 hàm/component nội bộ `renderApplicationCard(app)` trong cùng file, dùng chung cho cả `activeApplications.map` và `archivedApplications.map` — không copy-paste 2 bản JSX giống hệt nhau.

### C.2. Nút Archive / Restore — thêm vào cụm nút góc phải card (cạnh nút "Timeline" hiện có, khoảng dòng 1740-1747)

```jsx
<button
  onClick={async () => {
    const willArchive = app.is_active !== false;
    if (willArchive && !window.confirm(`Archive application #${app.display_number}? It will be hidden from Action Menu, applicant counts, and this list by default — you can restore it anytime via "Show Archived".`)) {
      return;
    }
    const res = await setApplicationActive(app.application_id, !willArchive);
    if (res.success) {
      notify(willArchive ? "✓ Application archived" : "✓ Application restored");
      loadCandidateData(candidate.id);
    } else {
      notify("Failed: " + res.error);
    }
  }}
  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
  title={app.is_active === false ? "Restore this application" : "Archive this application (hide from all views, recoverable)"}
>
  {app.is_active === false ? <ArchiveRestore size={12} /> : <Archive size={12} />}
  <span>{app.is_active === false ? "Restore" : "Archive"}</span>
</button>
```

Import `Archive, ArchiveRestore` vào khối import `lucide-react` hiện có trong file (tìm khối import icon hiện tại, thêm 2 icon này, giữ nguyên các icon khác).

### C.3. Nút Edit Job — đặt cạnh tên Job ở đầu card (khoảng dòng 1676-1681, `#{app.display_number} {app.job_title}`)

```jsx
<div className="flex items-center gap-1.5">
  <span className="font-bold text-sm text-slate-100 truncate">
    #{app.display_number || "?"} {app.job_title || "Untitled Position"}
  </span>
  <button
    onClick={() => setEditJobTarget(app)}
    className="text-slate-500 hover:text-emerald-400 cursor-pointer shrink-0"
    title="Edit Job (fix a wrong job assignment)"
  >
    <Pencil size={12} />
  </button>
</div>
```

Import `Pencil` vào cùng khối import `lucide-react`. Thêm state `const [editJobTarget, setEditJobTarget] = useState(null);` cạnh các state khác.

### C.4. Modal `EditJobModal` mới — copy đúng pattern job-picker từ `AssignToJobModal`

Tạo 1 component mới trong CÙNG FILE (`candidates/page.js`), đặt ngay sau định nghĩa `AssignToJobModal` hiện có, **copy y hệt cấu trúc** state/fetch/debounce/JSX dropdown chọn Job đã dùng trong `AssignToJobModal` (state dòng ~225-234, `fetchJobs` ~278-298, debounce effect ~336-346, `handleSelectJob` ~357-362, JSX dropdown ~534-631) — KHÔNG tự thiết kế UI khác, chỉ đổi:
- Props: nhận `application` (object app đang sửa, cần `application_id`, `candidate_id` implicit qua `candidate.id`, `job_id` hiện tại để hiển thị "Current Job" tham khảo) thay vì chỉ `candidate`.
- Submit handler: gọi `changeApplicationJob(application.application_id, selectedJobId)` thay vì `assignCandidateToJob(...)`.
- Bỏ các field không liên quan (source_channel, note, initialStage, planningDate — Edit Job CHỈ đổi job, không đổi các field khác của application).
- Hiển thị rõ "Current Job: #{application.display_number} {application.job_title}" ở đầu modal để PO biết đang sửa job cho application nào, tránh nhầm.

Render `<EditJobModal application={editJobTarget} isOpen={!!editJobTarget} onClose={() => setEditJobTarget(null)} onChanged={() => { notify("✓ Job updated"); loadCandidateData(candidate.id); }} />` ở cùng vị trí với `<AssignToJobModal ... />` hiện có (khoảng dòng 1884-1892).

### C.5. Import 2 action mới

Thêm `setApplicationActive, changeApplicationJob` vào khối import từ `"../actions"` hiện có (dòng 8-24), giữ nguyên các import khác.

## Việc KHÔNG được làm

- Không sửa `updateApplicationAction` — 2 hành động mới phải là action riêng, độc lập với guard "Closed" của hàm đó.
- Không đổi tên cột thành `archived_at`/`deleted_at` — dùng đúng `is_active` theo convention có sẵn.
- Không xoá dữ liệu thật nào (đây là feature ẩn/khôi phục, không phải DELETE).
- Không đụng `Action Menu` (`src/app/page.js`) hay `Jobs page` UI ngoài phần query đã nêu ở PHẦN B — chỉ sửa query phía server, không cần đổi UI 2 trang đó.
- Không tạo component `EditJobModal` ở file riêng — giữ trong `candidates/page.js` cùng `AssignToJobModal` để nhất quán vị trí.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/actions.js src/app/candidates/page.js` → PASS.
2. Migration: query `information_schema.columns` xác nhận cột `is_active` tồn tại đúng cả 2 schema.
3. Test thật trên `npm run dev` (tự tạo 1 candidate test + 2 job test cô lập theo mục 10.8 GEMINI.md, dọn sạch sau khi xong):
   - Tạo application cho candidate test vào Job A → bấm Archive → xác nhận: (a) biến mất khỏi card list mặc định trên Candidates, (b) biến mất khỏi Action Menu, (c) applicant_count của Job A trên trang Jobs giảm đúng 1, (d) vẫn thấy lại qua "Show Archived", (e) bấm Restore → xuất hiện lại đầy đủ ở cả 3 nơi trên.
   - Tạo 2 application cho CÙNG candidate test vào Job A và Job B (2 job khác nhau) → bấm Edit Job trên application đang ở Job A, chọn đổi sang Job B → xác nhận bị CHẶN với đúng thông báo lỗi trùng (không tạo ra 2 dòng activity cùng job).
   - Đổi Job cho 1 application sang 1 Job thứ 3 (chưa có application nào) → xác nhận thành công, `job_title` hiển thị đúng job mới, applicant_count 2 job (cũ/mới) cập nhật đúng.
   - Dọn dẹp toàn bộ dữ liệu test.
4. `npm run build` → PASS 100% routes.

Báo cáo hoàn thành kèm `git status`, `git diff --stat`, kết quả `npm run build`, kết quả từng kịch bản test, migration verify. Nếu sai lệch so với spec, ghi theo mục 10.7 GEMINI.md.
