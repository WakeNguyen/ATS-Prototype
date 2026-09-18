# Fix Spec — Phase 5/N: Migrate `page.js` (Action Menu) sang dùng chung `ActivityLogPanel` — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Phạm vi:** CHỈ `src/app/page.js`. KHÔNG đụng `ActivityLogPanel.js`, `candidates/page.js`, `jobs/page.js`. Đây là phase RỦI RO CAO NHẤT từ đầu dự án tới giờ (thay UI đang dùng thật, layout khác hẳn) — làm đúng chính xác từng bước dưới đây, không tự ý sáng tạo cách khác.

## Bối cảnh

`ActivityLogPanel` đã được xây và kiểm chứng đầy đủ qua 4 phase (Phase 1-4 + hotfix timezone) trên Candidates: Add Log, Edit Log, Delete Log, per-log Stage/Result/Reason, tất cả đã test thật qua UI + Supabase, không còn lỗi biết được. Đây là phase cuối cùng để hoàn thành mục tiêu ban đầu của user (Option C — 1 component dùng chung y hệt ở cả 3 trang) và cũng để thực hiện yêu cầu cũ của user: **xoá 2 cột RESULT / REASON (FAILED) khỏi bảng chính** (user đã nói rõ: *"đối với user thì tôi không quan tâm cột này được thể hiện ở đây, có thể xóa đi để dành diện tích... Cái tôi quan tâm là nó hiện ở phần bên dưới nơi có Stage/ Action Type"*).

`page.js` có 1 panel Timeline lớn riêng cho **1 application đang được chọn** (`selectedApp`) — khác với Candidates/Jobs vốn là accordion lặp lại theo từng thẻ. Layout hiện tại là dạng bảng hàng ngang dày đặc (khác hẳn card-stack của `ActivityLogPanel`), có Edit/Delete riêng nhưng CHƯA hỗ trợ Result/Reason khi edit — đây chính xác là những gì `ActivityLogPanel` giờ đã làm tốt hơn.

## Việc 1 — Xoá cột RESULT và REASON (FAILED) khỏi bảng chính

### 1a. Header (dòng ~830-832)
Xoá 2 dòng:
```jsx
<th className="p-1.5 min-w-[120px]">RESULT</th>
<th className="p-1.5 min-w-[180px]">REASON (FAILED)</th>
```
Giữ nguyên dòng `<th className="p-1.5 min-w-[120px]">STAGE</th>` (không cần đổi class, đã đúng pattern cột cuối cùng không có `border-r`).

### 1b. Body cells (khối `{/* 11. RESULT */}` và `{/* 12. REASON (FAILED) */}`, ngay sau khối `{/* 10. CURRENT STAGE ... */}`)
Xoá TOÀN BỘ 2 khối `<td>` này (bao gồm cả comment JSX của chúng):
```jsx
{/* 11. RESULT */}
<td className="p-1 text-center" onClick={(e) => e.stopPropagation()}>
  {app.status === "Closed" ? (
    <select ...>...</select>
  ) : null}
</td>

{/* 12. REASON (FAILED) */}
<td className="p-1" onClick={(e) => e.stopPropagation()}>
  {app.status === "Closed" && app.result === "Failed" ? (
    <div className="flex flex-col gap-1">...</div>
  ) : null}
</td>
```
Giữ nguyên khối `{/* 10. CURRENT STAGE (Automatic Badge from Activity Log) */}` phía trên, không đổi gì.

**Lưu ý:** `handleInlineUpdate` vẫn còn dùng ở nhiều cột khác (vd SOURCING, CANDIDATE SOURCE) — KHÔNG xoá hàm này, chỉ xoá 3 lệnh gọi `handleInlineUpdate(app.application_id, "result", ...)` / `"reason_failed"` / `"note_failure_reason"` nằm trong 2 khối `<td>` vừa xoá ở trên.

## Việc 2 — Thay toàn bộ khối Timeline (Add/Edit/Delete Log) bằng `<ActivityLogPanel>`

### 2a. Import mới ở đầu file

Thêm:
```js
import ActivityLogPanel from "src/components/ActivityLogPanel";
```
Và thêm `Clock` vào danh sách import từ `lucide-react` (dùng cho label header timeline, đồng bộ style với Candidates/Jobs).

### 2b. Xoá state và handler cũ KHÔNG còn cần thiết (toàn bộ logic Add/Edit/Delete + state form giờ nằm bên trong `ActivityLogPanel`)

Xoá các state sau (không dùng ở đâu khác trong file):
- `isNoteExpanded`, `newLogData` (và setter tương ứng)
- `editingLogId`, `editingLogData`, `savingEditLog`
- `savingNewLog`

Xoá các hàm sau (thay bằng 3 hàm mới ở mục 2c):
- `handleAddNewLog` (hàm cũ, ký hiệu `(e)`)
- `handleStartEditLog`, `handleCancelEditLog`, `handleSaveEditLog`
- `handleDeleteLog` (hàm cũ, ký hiệu `(logId)`)

**Kiểm tra lại sau khi xoá:** `normalizeStage` và `stripHtml` (2 hàm định nghĩa ở đầu file, dòng ~210 và ~223) vẫn PHẢI giữ nguyên định nghĩa — `normalizeStage` vẫn được `getStageBadgeClass`/`getStageBadgeLabel` (dùng cho cột STAGE trong bảng chính, KHÔNG bị xoá) gọi nội bộ. `stripHtml` có thể không còn nơi nào gọi tới sau khi xoá — ĐỂ NGUYÊN định nghĩa của nó (không xoá), không sao nếu tạm thời không dùng tới.

Xoá 3 import không còn dùng tới nữa khỏi danh sách import `lucide-react` (chỉ dùng trong UI Edit/Delete cũ, không dùng ở đâu khác trong file — đã kiểm tra bằng grep): `Trash2`, `Pencil`, `X`. Xoá `formatDateTimeVN` khỏi import `src/lib/utils` (chỉ dùng trong dòng log cũ, không dùng ở đâu khác).

### 2c. Thêm 3 hàm mới (đặt ở vị trí các hàm cũ vừa xoá, cùng khu vực comment `// 5. Add New Action Note...` / `// 6. Edit...` / `// 7. Delete...`)

```js
// Đồng bộ lại current_stage/result/reason_failed/note_failure_reason ở state `applications`
// từ log MỚI NHẤT trong danh sách `logs` vừa refetch. `logs` phải đến từ getActivityLogs()
// (ORDER BY action_date DESC, created_time DESC) — CÙNG thứ tự server dùng để auto-sync
// (xem actions.js: addActivityLog/updateActivityLog/deleteActivityLog), nên logs[0] luôn khớp
// với những gì server vừa lưu vào bảng `activity`. Không tự đoán/optimistic — luôn refetch trước
// khi gọi hàm này.
function syncApplicationFromLogs(applicationId, logs) {
  setApplications(prev => prev.map(a => {
    if (a.application_id !== applicationId) return a;
    if (!logs || logs.length === 0) {
      return { ...a, current_stage: "Talent Mapping", result: null, reason_failed: null, note_failure_reason: null };
    }
    const latest = logs[0];
    return {
      ...a,
      current_stage: latest.action_type,
      result: latest.result === "Fail" ? "Failed" : "Passed",
      reason_failed: latest.result === "Fail" ? latest.reason_failed : null,
      note_failure_reason: latest.result === "Fail" ? latest.note : null,
    };
  }));
}

// 5. Add New Action Note (qua ActivityLogPanel dùng chung)
async function handleAddNewLog(applicationId, logData) {
  if (!applicationId) return { success: false, error: "Missing application" };
  const stage = logData?.action_type || "Contact";
  const note = (logData?.note || "").trim();
  if (!note) return { success: false, error: "Empty note" };
  setSavingNewLog(true);
  try {
    const res = await addActivityLog({
      application_id: applicationId,
      action_type: stage,
      note,
      result: logData?.result,
      reason_failed: logData?.reason_failed,
    });
    if (res.success) {
      notify("Đã lưu bước Action Note mới!");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        setActivityLogs(logsRes.data);
        syncApplicationFromLogs(applicationId, logsRes.data);
      }
    } else {
      notify("Lỗi: " + res.error);
    }
    return res;
  } finally {
    setSavingNewLog(false);
  }
}

// 6. Edit an Action Note (qua ActivityLogPanel dùng chung)
async function handleEditLog(applicationId, logId, logData) {
  if (!applicationId || !logId) return { success: false, error: "Missing IDs" };
  setSavingEditLog(true);
  try {
    const res = await updateActivityLog(logId, applicationId, logData);
    if (res.success) {
      notify("Đã cập nhật Action Note thành công!");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        setActivityLogs(logsRes.data);
        syncApplicationFromLogs(applicationId, logsRes.data);
      }
    } else {
      notify("Lỗi cập nhật: " + res.error);
    }
    return res;
  } finally {
    setSavingEditLog(false);
  }
}

// 7. Delete an Action Note (qua ActivityLogPanel dùng chung)
async function handleDeleteLog(applicationId, logId) {
  if (!applicationId || !logId) return { success: false, error: "Missing IDs" };
  const res = await deleteActivityLog(logId, applicationId);
  if (res.success) {
    notify("Đã xóa dòng Action Note");
    const logsRes = await getActivityLogs(applicationId);
    if (logsRes.success) {
      setActivityLogs(logsRes.data);
      syncApplicationFromLogs(applicationId, logsRes.data);
    }
  } else {
    notify("Lỗi xóa: " + res.error);
  }
  return res;
}
```

`savingNewLog`/`savingEditLog` (2 state CŨ đã có sẵn, KHÔNG xoá — vẫn dùng để disable nút trong lúc gọi API, dù giờ `ActivityLogPanel` cũng có state saving riêng của nó; giữ lại 2 state này ở page.js chỉ dùng nội bộ cho logic hàm, không cần truyền prop nào xuống component).

### 2d. Thay JSX — khối "Sub-table Header" + "PINNED ADD NEW ROW" + "Sub-table Rows list"

Tìm khối bắt đầu từ comment `{/* 1. Sub-table Header */}` (trong `<div className="flex-1 flex flex-col min-h-0 bg-slate-950">`) cho tới hết `{/* 3. Sub-table Rows list */}` (kết thúc bằng `</div>` đóng của rows list, ngay trước `</div>` đóng của `<div className="flex-1 flex flex-col min-h-0 bg-slate-950">`).

Thay TOÀN BỘ khối đó bằng:

```jsx
{/* 1. Sub-table Header (đơn giản hoá — ActivityLogPanel tự quản lý layout dạng card) */}
<div className="bg-slate-900 text-slate-400 font-extrabold px-3 py-1.5 text-[10px] uppercase flex items-center justify-between gap-2 border-b border-slate-800 shrink-0">
  <span className="flex items-center gap-1.5 normal-case text-xs font-bold text-slate-300">
    <Clock size={13} className="text-emerald-400" />
    <span>Interview & Activity Timeline</span>
  </span>
  <button
    type="button"
    onClick={() => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      setIsDetailVisible(false);
    }}
    className="px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0"
    title="Collapse Action Timeline (or scroll above)"
  >
    <ChevronDown size={12} />
    <span>Hide</span>
  </button>
</div>

{/* 2. Shared ActivityLogPanel: Add / Edit / Delete + Stage/Result/Reason per log */}
<div className="flex-1 overflow-y-auto p-3">
  {selectedApp && (
    <>
      {selectedApp.status === "Closed" && (
        <div className="mb-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center space-x-2 text-xs text-slate-400 select-none">
          <span className="text-base text-amber-400">🔒</span>
          <span className="text-slate-300 font-semibold">
            Hồ sơ ứng tuyển này đang ở trạng thái <strong>Closed (Đã đóng)</strong>. Khóa chức năng thêm mới Action Note.
          </span>
        </div>
      )}
      <ActivityLogPanel
        applicationId={selectedApp.application_id}
        currentStage={selectedApp.current_stage}
        result={selectedApp.result}
        reasonFailed={selectedApp.reason_failed}
        logs={activityLogs}
        isLoadingLogs={logsLoading}
        onAddLog={selectedApp.status === "Closed" ? undefined : handleAddNewLog}
        onEditLog={handleEditLog}
        onDeleteLog={handleDeleteLog}
        outcomeMode="readOnly"
        allowEditLog={true}
      />
    </>
  )}
</div>
```

**Giải thích quyết định thiết kế (để AG hiểu, không tự ý đổi khác):**
- Log list (xem lịch sử) LUÔN hiển thị kể cả khi Closed — chỉ ẩn form Add (`onAddLog={undefined}` khi Closed → `ActivityLogPanel` tự ẩn form Add vì JSX của nó có điều kiện `{onAddLog && (...)}`) — giữ đúng hành vi UX gốc: khoá thêm mới, KHÔNG khoá xem lịch sử.
- Edit/Delete KHÔNG bị khoá khi Closed ở UI (giữ đúng hành vi hiện có của `page.js` từ trước — Edit/Delete vốn không có điều kiện Closed nào ở bản gốc). Đây là điểm chưa nhất quán có sẵn từ trước (backend `updateActivityLog` cũng không có guard Closed), KHÔNG sửa trong phase này — ngoài phạm vi.
- `outcomeMode="readOnly"` — đúng pattern đã dùng ở Candidates/Jobs, badge Failed ở header chỉ hiển thị (không cho sửa trực tiếp Application-level Result nữa, đúng tinh thần "Result là per-log, không phải field tự set thủ công cấp Application" mà user đã chốt).

## Việc KHÔNG được làm

- KHÔNG đụng `ActivityLogPanel.js`, `candidates/page.js`, `jobs/page.js`.
- KHÔNG thêm guard Closed cho Edit/Delete (ngoài phạm vi, xem giải thích ở Việc 2d).
- KHÔNG xoá `handleInlineUpdate` hay bất kỳ cột nào khác ngoài RESULT/REASON (FAILED).
- KHÔNG đổi cơ chế `selectedApp` (vẫn là `useMemo` derive từ `applications`, không đổi thành state riêng).

## Yêu cầu test trước khi báo hoàn thành (BẮT BUỘC — phase rủi ro cao nhất, test kỹ)

Test qua UI thật (`localhost:3000`, Action Menu) với ít nhất 1 application có sẵn nhiều log:
1. Xác nhận bảng chính KHÔNG còn 2 cột RESULT/REASON (FAILED) — chỉ còn STAGE là cột cuối.
2. Chọn 1 application → panel Timeline dưới cùng hiển thị đúng `ActivityLogPanel` (card-stack, không phải bảng ngang cũ).
3. Test Add Log mới (Stage/Result/Reason-nếu-Fail/Note) → lưu thành công, badge header cập nhật đúng.
4. Test Edit Log (đổi Result, đổi Stage) → lưu thành công, badge header + `current_stage` cập nhật đúng theo log mới nhất thật sự (dùng đúng `syncApplicationFromLogs`, không bị lệch do vấn đề timezone — vì `ActivityLogPanel` đã có hotfix, chỉ cần xác nhận page.js không phá vỡ nó).
5. Test Delete Log — cả xoá 1 dòng lẫn xoá hết — xác nhận fallback đúng (log mới nhất còn lại, hoặc reset về `Talent Mapping`/null nếu hết log).
6. Test application có `status = "Closed"` → xác nhận: banner khoá hiện ra, form Add ẩn, nhưng log list VẪN hiển thị đầy đủ lịch sử.
7. Đối chiếu Supabase trực tiếp sau mỗi bước, không chỉ tin UI.
8. Xác nhận `next build` không lỗi do import thừa/thiếu (đặc biệt: `Clock`, `ActivityLogPanel`, và các import bị xoá `Trash2`/`Pencil`/`X`/`formatDateTimeVN` không còn được tham chiếu ở đâu khác).

Cập nhật `DEVELOPMENT_LOG.md` với commit hash + mô tả đúng diff thật.
