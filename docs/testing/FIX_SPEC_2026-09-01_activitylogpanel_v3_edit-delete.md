# Fix Spec — Phase 4/N: Edit Log + Delete Log cho ActivityLogPanel (validate qua Candidates) — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Phạm vi:** CHỈ `src/components/ActivityLogPanel.js` + `src/app/candidates/page.js`. **TUYỆT ĐỐI KHÔNG đụng `src/app/page.js` hay `src/app/jobs/page.js` trong phase này.**

## Bối cảnh

`ActivityLogPanel` hiện tại (sau Phase 1-3) đã có: badge Stage header, danh sách log hiển thị Stage + Result + Reason (`LogResultBadge`), và form Add Log đầy đủ (Stage/Result/Reason/Note). Prop `allowEditLog` đã tồn tại trong signature nhưng **chưa hề được implement** — component chưa có Edit Log hay Delete Log ở bất kỳ đâu.

Trong khi đó, `src/app/page.js` (Action Menu — panel Timeline lớn bên dưới bảng chính) đã có sẵn Edit Log (sửa Stage/Date/Note qua `handleStartEditLog`/`handleSaveEditLog`, gọi `updateActivityLog`) và Delete Log (`handleDeleteLog`, gọi `deleteActivityLog`) từ trước — nhưng **chưa** truyền `result`/`reason_failed` khi edit (gap còn sót lại từ trước khi có Phase 2/3).

Trước khi có thể thay Timeline UI của `page.js` bằng `<ActivityLogPanel>` dùng chung (một thay đổi rủi ro cao vì UI hiện tại của `page.js` là dạng bảng ngang dày đặc, khác hẳn dạng card-stack của component), component phải có đủ năng lực Edit/Delete trước đã — nếu không sẽ làm mất chức năng người dùng đang dùng thật.

**Chiến lược phase này:** thêm Edit Log + Delete Log vào `ActivityLogPanel`, bật `allowEditLog={true}` ở Candidates trước (Candidates hiện **chưa có** Edit/Delete nào cả — đây là tính năng mới thuần, rủi ro thấp, không có behavior cũ nào để so sánh/regress). `page.js`/`jobs/page.js` để dành cho phase sau.

## Việc 1 — `src/components/ActivityLogPanel.js`: implement Edit Log + Delete Log

### 1a. Props mới

```js
export default function ActivityLogPanel({
  applicationId,
  currentStage,
  result = null,
  reasonFailed = null,
  logs = [],
  isLoadingLogs = false,
  onAddLog,
  onEditLog,      // MỚI: (applicationId, logId, {action_type, note, action_date, result, reason_failed}) => Promise<{success, ...}>
  onDeleteLog,    // MỚI: (applicationId, logId) => Promise<{success, ...}>
  outcomeMode = "readOnly",
  allowEditLog = false,
}) {
```

Giữ nguyên `applicationId`/`onAddLog` gọi theo đúng thứ tự tham số hiện có (`(applicationId, logData)`) để không phá vỡ Phase 1-3. `onEditLog`/`onDeleteLog` dùng cùng convention: `applicationId` trước, rồi đến các tham số riêng của hành động.

### 1b. State mới trong component

```js
const [editingLogId, setEditingLogId] = useState(null);
const [editingLogData, setEditingLogData] = useState({
  action_type: "Contact",
  note: "",
  action_date: "",
  result: "Pass",
  reason_failed: "",
});
const [savingEditLog, setSavingEditLog] = useState(false);
const [deletingLogId, setDeletingLogId] = useState(null);
```

### 1c. Handlers mới trong component

```js
function handleStartEditLog(log) {
  setEditingLogId(log.id);
  setEditingLogData({
    action_type: log.action_type || "Contact",
    note: log.note || "",
    // Giữ đúng convention ISO -> datetime-local đã dùng ở page.js
    action_date: log.action_date ? new Date(log.action_date).toISOString().substring(0, 16) : new Date().toISOString().substring(0, 16),
    result: log.result || "Pass",
    reason_failed: log.reason_failed || "",
  });
}

function handleCancelEditLog() {
  setEditingLogId(null);
}

async function handleSaveEditLog(logId) {
  if (!onEditLog) return;
  setSavingEditLog(true);
  try {
    const res = await onEditLog(applicationId, logId, {
      action_type: editingLogData.action_type,
      note: editingLogData.note,
      action_date: editingLogData.action_date,
      result: editingLogData.result,
      reason_failed: editingLogData.result === "Fail" ? (editingLogData.reason_failed || null) : null,
    });
    if (res && res.success !== false) {
      setEditingLogId(null);
    }
  } finally {
    setSavingEditLog(false);
  }
}

async function handleDeleteLogClick(logId) {
  if (!onDeleteLog) return;
  setDeletingLogId(logId);
  try {
    await onDeleteLog(applicationId, logId);
  } finally {
    setDeletingLogId(null);
  }
}
```

Lưu ý quan trọng: **component KHÔNG tự cập nhật mảng `logs`** (giống hệt cách `onAddLog` hoạt động hiện tại — component chỉ gọi callback và để parent tự refresh/re-render qua props). Không optimistic-update trong component này.

### 1d. UI — mỗi dòng log trong danh sách

Khi `allowEditLog === true` và dòng log đang KHÔNG ở chế độ edit, thêm 2 icon nút (Pencil / Trash2, từ `lucide-react`, đã có sẵn thư viện trong project — kiểm tra import) ở góc phải mỗi dòng log, cùng hàng với Stage + Result badge (hoặc dòng riêng bên dưới nếu chật, tuỳ ý miễn không vỡ layout card hiện có):

```jsx
{allowEditLog && (
  <div className="flex items-center gap-1 shrink-0">
    <button
      type="button"
      onClick={() => handleStartEditLog(log)}
      title="Edit this log"
      className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded transition-all cursor-pointer"
    >
      <Pencil size={12} />
    </button>
    <button
      type="button"
      onClick={() => handleDeleteLogClick(log.id)}
      disabled={deletingLogId === log.id}
      title="Delete this log"
      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded transition-all cursor-pointer disabled:opacity-50"
    >
      {deletingLogId === log.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
    </button>
  </div>
)}
```

Khi `editingLogId === log.id`, thay toàn bộ nội dung card của dòng đó (không chỉ note) bằng form edit inline, gồm đủ 5 trường — Stage, Result, Reason (chỉ hiện khi Result=Fail), Date, Note — theo đúng data model per-log đã có từ Phase 2/3:

```jsx
<div key={log.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/70 text-xs flex flex-col gap-2">
  <div className="flex items-center gap-2 flex-wrap">
    <select
      value={editingLogData.action_type}
      onChange={e => setEditingLogData(d => ({ ...d, action_type: e.target.value }))}
      className="px-2 py-1 text-xs bg-slate-950 border border-emerald-500/60 rounded-lg text-slate-200"
    >
      {CANDIDATE_STAGES_LIST.map(st => <option key={st} value={st}>{st}</option>)}
    </select>
    <select
      value={editingLogData.result}
      onChange={e => setEditingLogData(d => ({ ...d, result: e.target.value }))}
      className="px-2 py-1 text-xs bg-slate-950 border border-emerald-500/60 rounded-lg text-slate-200"
    >
      <option value="Pass">Pass</option>
      <option value="Fail">Fail</option>
    </select>
    {editingLogData.result === "Fail" && (
      <select
        value={editingLogData.reason_failed}
        onChange={e => setEditingLogData(d => ({ ...d, reason_failed: e.target.value }))}
        className="px-2 py-1 text-xs bg-slate-950 border border-rose-800/60 rounded-lg text-slate-200"
      >
        <option value="">— (chưa chọn)</option>
        {FAILURE_REASONS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    )}
    <input
      type="datetime-local"
      value={editingLogData.action_date}
      onChange={e => setEditingLogData(d => ({ ...d, action_date: e.target.value }))}
      className="px-2 py-1 text-xs bg-slate-950 border border-emerald-500/60 rounded-lg text-slate-200 font-mono"
    />
  </div>
  <textarea
    rows={2}
    value={editingLogData.note}
    onChange={e => setEditingLogData(d => ({ ...d, note: e.target.value }))}
    onKeyDown={e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEditLog(log.id); }
      else if (e.key === "Escape") { handleCancelEditLog(); }
    }}
    className="w-full text-xs p-1.5 bg-slate-950 border border-emerald-500/60 rounded-lg text-slate-100 resize-none"
  />
  <div className="flex items-center gap-1.5 justify-end">
    <button type="button" disabled={savingEditLog} onClick={() => handleSaveEditLog(log.id)}
      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-50">
      {savingEditLog ? <Loader2 size={12} className="animate-spin" /> : "Save"}
    </button>
    <button type="button" onClick={handleCancelEditLog}
      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold">
      Cancel
    </button>
  </div>
</div>
```

Ghi chú: dùng `<select>` phẳng (flat `CANDIDATE_STAGES_LIST.map`) thay vì 3 optgroup như `page.js` — đây là lựa chọn có chủ đích để nhất quán nội bộ với form Add Log hiện có ngay trong chính component này (form Add Log đang dùng flat list). KHÔNG bắt buộc phải giống hệt `page.js` ở điểm này vì đây là khác biệt UX/trình bày, không phải khác biệt dữ liệu.

Import `Pencil`, `Trash2` từ `lucide-react` vào đầu file (cùng dòng với `Loader2, Send` đã có).

## Việc 2 — `src/app/candidates/page.js`: thêm 2 handler mới + bật `allowEditLog`

### 2a. Handler mới (đặt ngay sau `handleAddTimelineNote`, dùng đúng pattern refresh đã có — KHÔNG optimistic update phía page.js, refresh lại từ server sau khi thành công, giống `handleAddTimelineNote`):

```js
// Edit Log Entry in Timeline
async function handleEditTimelineNote(applicationId, logId, logData) {
  try {
    const res = await updateActivityLog(logId, applicationId, logData);
    if (res.success) {
      notify("✓ Timeline note updated.");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        setTimelineLogs(prev => ({ ...prev, [applicationId]: logsRes.data || [] }));
      }
      loadCandidateData(candidate.id);
    } else {
      notify("Failed to update timeline note: " + res.error);
    }
    return res;
  } catch (err) {
    notify("Error updating timeline note: " + err.message);
    return { success: false, error: err.message };
  }
}

// Delete Log Entry from Timeline
async function handleDeleteTimelineNote(applicationId, logId) {
  try {
    const res = await deleteActivityLog(logId, applicationId);
    if (res.success) {
      notify("✓ Timeline note deleted.");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        setTimelineLogs(prev => ({ ...prev, [applicationId]: logsRes.data || [] }));
      }
      loadCandidateData(candidate.id);
    } else {
      notify("Failed to delete timeline note: " + res.error);
    }
    return res;
  } catch (err) {
    notify("Error deleting timeline note: " + err.message);
    return { success: false, error: err.message };
  }
}
```

`updateActivityLog`/`deleteActivityLog` phải đã được import ở đầu file từ `src/app/actions.js` — kiểm tra, thêm vào import nếu còn thiếu (`addActivityLog`, `getActivityLogs` chắc chắn đã có sẵn từ trước).

### 2b. Truyền props mới vào `<ActivityLogPanel>` (dòng ~1301)

```jsx
<ActivityLogPanel
  applicationId={app.application_id}
  currentStage={app.current_stage}
  result={app.result}
  reasonFailed={app.reason_failed}
  logs={logs}
  isLoadingLogs={isLoadingLog}
  onAddLog={handleAddTimelineNote}
  onEditLog={handleEditTimelineNote}
  onDeleteLog={handleDeleteTimelineNote}
  outcomeMode="readOnly"
  allowEditLog={true}
/>
```

Đây là thay đổi DUY NHẤT trong khối JSX này — không đổi bất kỳ prop nào khác.

## Việc KHÔNG được làm trong phase này

- KHÔNG đụng `src/app/page.js` (Action Menu) — Edit/Delete hiện có ở đó giữ nguyên 100%, kể cả gap chưa truyền `result`/`reason_failed` khi edit (sẽ xử lý ở phase migrate `page.js` sau, không xử lý ở đây).
- KHÔNG đụng `src/app/jobs/page.js`.
- KHÔNG đổi behavior của Add Log (Việc 1/2 của Phase 1-3) — chỉ thêm mới Edit/Delete bên cạnh.
- KHÔNG cần optimistic UI update trong `ActivityLogPanel` hay trong 2 handler mới — refresh lại từ server sau khi thành công là đủ, đúng pattern đã dùng cho Add Log.

## Yêu cầu test trước khi báo hoàn thành

Test qua UI thật (`localhost:3000/candidates`) với 1 ứng viên có ít nhất 1 log sẵn có, tối thiểu các case:
1. Click Edit trên 1 dòng log → form edit hiện đủ 5 trường, prefill đúng giá trị hiện tại của dòng đó.
2. Đổi Result từ Pass → Fail → xác nhận ô Reason xuất hiện. Chọn Reason, Save → xác nhận dòng log cập nhật đúng, và nếu đây là dòng log **mới nhất** của Application, badge header (Failed — lý do) cũng tự cập nhật theo (do auto-sync ở tầng server đã có từ Phase 2).
3. Delete 1 dòng log → xác nhận dòng biến mất khỏi danh sách, và nếu vừa xoá dòng mới nhất, badge header + current_stage cập nhật đúng theo dòng còn lại mới nhất (hoặc reset về mặc định nếu xoá hết log).
4. Escape khi đang edit → huỷ, không lưu gì.
5. Xác nhận Add Log (chức năng cũ) vẫn hoạt động y hệt trước — không bị ảnh hưởng.

Cập nhật `DEVELOPMENT_LOG.md` với commit hash + mô tả đúng diff thật, như các round trước.
