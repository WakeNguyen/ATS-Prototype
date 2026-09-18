# Fix Spec — Phase 6/N: Migrate `jobs/page.js` sang ActivityLogPanel dùng chung — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Mức độ ưu tiên:** Cao — đây là phase CUỐI để hoàn tất mục tiêu Option C (1 component `ActivityLogPanel` dùng chung y hệt ở cả 3 nơi: Candidates, Action Menu, Jobs & Clients). Sau phase này không còn nơi nào tự viết lại UI timeline/log riêng.
**Phạm vi:** CHỈ `src/app/jobs/page.js`. Không đụng `ActivityLogPanel.js`, `candidates/page.js`, `page.js` (Action Menu), `actions.js` (các hàm `getActivityLogs`/`addActivityLog`/`updateActivityLog`/`deleteActivityLog` đã đúng, dùng lại nguyên trạng — KHÔNG cần đổi backend).

## Bối cảnh — vì sao phase này rủi ro/khác biệt hơn Phase 4-5

`jobs/page.js` có kiến trúc khác 2 nơi kia: đây KHÔNG phải trang "1 ứng viên được chọn, 1 panel chi tiết" như Candidates/Action Menu, mà là **danh sách nhiều applications trong 1 job, mỗi cái là 1 accordion tự expand/collapse** (`applications.map(app => ...)`, state `expandedAppIds[app.id]`). Vì vậy các state/handler hiện tại đều là **object map theo `appId`** (`appLogsMap`, `logsLoadingMap`, `newLogMap`, `editingLogMap`, `savingLogMap`) thay vì state đơn lẻ như 2 trang kia. Khi migrate, `<ActivityLogPanel />` sẽ được mount **1 instance riêng cho mỗi app đang expand** — form Add/Edit của chính nó đã tự quản lý state nội bộ (`newStage`/`newResult`/`editingLogId`/...), nên `newLogMap`/`editingLogMap`/`savingLogMap` ở cấp `jobs/page.js` **không còn cần thiết nữa, xoá hẳn** — đây là điểm khác biệt lớn nhất so với Phase 5.

**Phát hiện phụ (không phải lỗi cần vá riêng, sẽ tự hết sau khi migrate):** code hiện tại của `jobs/page.js` có 2 lỗ hổng đồng bộ mà Phase 2/4 đã vá ở Candidates/Action Menu nhưng CHƯA từng áp dụng ở đây, vì `jobs/page.js` tồn tại từ trước Phase 2 và dùng đường riêng:
- `handleSaveEditLog` (Edit Log) hiện **không hề đồng bộ lại `current_stage`/`result`/`reason_failed` cấp Application** sau khi sửa — nếu sửa log mới nhất, badge Stage ở Application vẫn hiện giá trị cũ.
- `handleDeleteLogFromApp` (Delete Log) chỉ đồng bộ lại `current_stage`, KHÔNG đồng bộ `result`/`reason_failed`/`note_failure_reason` — dữ liệu có thể lệch (VD: xoá log Fail mới nhất, còn lại log Pass, nhưng Application vẫn hiện "Failed").
- Form Add Log hiện tại **không có trường Result/Reason** (log mới luôn mặc định Pass phía server) — sau khi migrate, mỗi log sẽ có Result/Reason như 2 trang kia (đúng khả năng đã có sẵn ở backend, chỉ là UI Jobs chưa từng dùng tới).

Những điều trên sẽ được sửa đúng như một **hệ quả tự nhiên** của việc dùng chung `syncApplicationFromLogs` (refetch-rồi-đồng-bộ từ `logs[0]`, y hệt pattern Phase 5), không phải sửa vá riêng lẻ.

### ⚠️ Quyết định thiết kế cần xác nhận rõ: bỏ khối "Result/Reason/Note" chỉnh tay khi Closed

`jobs/page.js` hiện có 1 khối UI riêng (chỉ hiện khi `app.status === "Closed"`) cho phép **sửa tay trực tiếp** `result`/`reason_failed`/`note_failure_reason` cấp Application qua `handleUpdateAppField` — đây là đường ghi ĐÈ, hoàn toàn tách biệt khỏi cơ chế auto-sync-từ-log mà Candidates/Action Menu đang dùng (2 nơi đó KHÔNG có cách nào sửa tay Result cấp Application — luôn auto-derive từ log mới nhất). Vì mục tiêu của phase này là "cả 3 nơi giống hệt nhau", khối này sẽ được **XOÁ HẲN** — Result/Reason cấp Application ở Jobs sau migrate sẽ chỉ còn đến từ log mới nhất (giống Candidates/Action Menu), không còn sửa tay được nữa. Đây là thay đổi hành vi thật (không chỉ refactor code), đã được xác nhận đúng ý định người dùng ("đồng bộ hoá nốt... dùng chung y hệt 1 component").

## Việc cần làm

### Việc 1 — Đổi nguồn dữ liệu log: `getApplicationLogs` → `getActivityLogs`

Trong `toggleExpandApp`:
```js
// CŨ:
const res = await getApplicationLogs(appId);
if (res.success) {
  setAppLogsMap(prev => ({ ...prev, [appId]: res.actionLogs || [] }));
}
// MỚI:
const res = await getActivityLogs(appId);
if (res.success) {
  setAppLogsMap(prev => ({ ...prev, [appId]: res.data || [] }));
}
```
Lý do bắt buộc: `getApplicationLogs` (hàm cũ riêng của Jobs) KHÔNG trả về `reason_failed` và `created_time` — 2 trường `ActivityLogPanel` cần. `getActivityLogs` (hàm dùng chung, đã có sẵn từ Phase 2, đang dùng ở Candidates/Action Menu) trả đủ. Đổi import ở đầu file: bỏ `getApplicationLogs`, thêm `getActivityLogs`.

*(Hàm `getApplicationLogs` trong `actions.js` vẫn giữ nguyên, không xoá — có thể còn chỗ khác dùng, ngoài phạm vi phase này để kiểm tra.)*

### Việc 2 — Dọn state không còn cần

Xoá hẳn 3 state: `newLogMap`/`setNewLogMap`, `editingLogMap`/`setEditingLogMap`, `savingLogMap`/`setSavingLogMap` (dòng ~429-430). `ActivityLogPanel` tự quản lý toàn bộ state form Add/Edit nội bộ theo từng instance — không cần map ở cấp page nữa.

Giữ nguyên: `expandedAppIds`, `appLogsMap`, `logsLoadingMap` (vẫn cần — fetch theo lazy-load khi expand, y hệt hành vi hiện tại).

### Việc 3 — Thêm `syncApplicationFromLogs(appId, logs)` (giống hệt pattern Phase 5, đổi tên biến state cho khớp `jobs/page.js`)

```js
function syncApplicationFromLogs(appId, logs) {
  setApplications(prev => prev.map(a => {
    if (a.id !== appId) return a;
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
```

### Việc 4 — Thay 3 handler cũ bằng 3 handler mới, đúng chữ ký `ActivityLogPanel` cần

Xoá: `handleAddNewLogToApp`, `handleSaveEditLog`. Sửa lại `handleDeleteLogFromApp`. Cả 3 hàm mới đều theo pattern: gọi action → nếu thành công, `getActivityLogs(appId)` lấy lại danh sách mới nhất → `setAppLogsMap` → `syncApplicationFromLogs(appId, danh sách mới)`.

```js
async function handleAddLogToApp(appId, logData) {
  const res = await addActivityLog({
    application_id: appId,
    action_type: logData.action_type,
    note: logData.note,
    result: logData.result,
    reason_failed: logData.reason_failed,
    action_date: logData.action_date,
  });
  if (res.success) {
    const refreshed = await getActivityLogs(appId);
    if (refreshed.success) {
      setAppLogsMap(prev => ({ ...prev, [appId]: refreshed.data || [] }));
      syncApplicationFromLogs(appId, refreshed.data || []);
    }
  }
  return res;
}

async function handleEditLogInApp(appId, logId, logData) {
  const res = await updateActivityLog(logId, appId, logData);
  if (res.success) {
    const refreshed = await getActivityLogs(appId);
    if (refreshed.success) {
      setAppLogsMap(prev => ({ ...prev, [appId]: refreshed.data || [] }));
      syncApplicationFromLogs(appId, refreshed.data || []);
    }
  }
  return res;
}

async function handleDeleteLogFromApp(appId, logId) {
  const res = await deleteActivityLog(logId, appId);
  if (res.success) {
    const refreshed = await getActivityLogs(appId);
    if (refreshed.success) {
      setAppLogsMap(prev => ({ ...prev, [appId]: refreshed.data || [] }));
      syncApplicationFromLogs(appId, refreshed.data || []);
    }
  }
  return res;
}
```
Lưu ý: bỏ hẳn dialog `confirm("Delete this timeline action note?")` đang có trong bản cũ — 2 trang kia (Candidates/Action Menu) xoá log không có confirm dialog, giữ hành vi giống nhau cho cả 3 nơi (đúng tinh thần "y hệt 1 component"). Nếu bạn (AG) thấy rủi ro, có thể giữ lại confirm — nhưng ưu tiên đồng nhất hành vi UX theo yêu cầu của phase này.

### Việc 5 — Xoá khối "Result/Reason/Note chỉnh tay khi Closed" trong Quick Edit Fields

Xoá toàn bộ khối JSX `{app.status === "Closed" && (<>...Result select...Reason select...Note input...</>)}` (3 field: Result, Reason (if failed), Note (Failure Reason)) trong phần "Quick Edit Application Fields". Giữ nguyên các field còn lại (Status, Planning Date, Source Channel, Passive Sourcing) — không liên quan đến activity log, ngoài phạm vi.

Sau khi xoá khối này, import `APPLICATION_RESULTS_LIST`, `FAILURE_REASONS_LIST` từ `src/constants/enums` không còn dùng ở đâu khác trong file — grep xác nhận trước khi xoá import, xoá nếu đúng 0 usage còn lại.

### Việc 6 — Thay khối "Action Notes Timeline Sub-Table" (PINNED ADD ROW + rows list) bằng `<ActivityLogPanel />`

Giữ nguyên phần header hiện có ("Action Notes Timeline (N)" + icon Clock + spinner loading) — không bắt buộc đổi để giống chữ y hệt 2 trang kia, chỉ cần phần NỘI DUNG bên trong (form Add + danh sách log) chuyển sang dùng component chung.

Thay khối JSX từ `{/* PINNED QUICK ADD ROW (*) OR CLOSED LOCK BANNER */}` cho tới hết `{/* ACTION LOGS HISTORY LIST */}` bằng:

```jsx
{app.status === "Closed" && (
  <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center gap-1.5 text-[10px] text-slate-400 select-none">
    <Lock size={12} className="text-amber-400" />
    <span className="text-slate-300 font-semibold">
      Application is Closed. Adding action notes is locked.
    </span>
  </div>
)}
<div className="p-3">
  <ActivityLogPanel
    applicationId={app.id}
    currentStage={app.current_stage}
    result={app.result}
    reasonFailed={app.reason_failed}
    logs={logs}
    isLoadingLogs={isLogsLoading}
    onAddLog={app.status === "Closed" ? undefined : handleAddLogToApp}
    onEditLog={handleEditLogInApp}
    onDeleteLog={handleDeleteLogFromApp}
    outcomeMode="readOnly"
    allowEditLog={true}
  />
</div>
```
(`logs` và `isLogsLoading` là 2 biến local đã có sẵn trong scope `applications.map` — `const logs = appLogsMap[app.id] || []; const isLogsLoading = Boolean(logsLoadingMap[app.id]);` — giữ nguyên 2 dòng này, không đổi.)

Thêm import `ActivityLogPanel` ở đầu file: `import ActivityLogPanel from "src/components/ActivityLogPanel";`

### Việc 7 — Dọn import/hàm không còn dùng

Sau khi làm xong Việc 1-6, grep xác nhận rồi xoá nếu đúng 0 usage còn lại: `Check`, `X` (lucide-react, nếu chỉ dùng trong form Edit cũ vừa xoá — LƯU Ý: `X` có thể còn dùng chỗ khác trong file 3261 dòng này, PHẢI grep kỹ toàn file trước khi xoá, không suy đoán); `formatDateTimeVN` (từ `src/lib/utils`, nếu chỉ dùng trong `handleAddNewLogToApp`/`handleSaveEditLog` vừa xoá — cũng grep kỹ vì file này lớn, có thể còn dùng ở chỗ khác như phần Client Detail).

`getStageBadgeClass` cục bộ (dòng ~1074) — GIỮ NGUYÊN, không xoá — vẫn được dùng ở badge Stage trong header mỗi app card (dòng ~2764, nằm ngoài phạm vi `ActivityLogPanel`), chỉ mất đi lượt dùng trong rows-list cũ (đã bị thay bằng component chung).

## Yêu cầu test trước khi báo hoàn thành (bắt buộc — đây là phase rủi ro cao nhất còn lại)

Test qua UI thật (`localhost:3000/jobs`) + đối chiếu Supabase trực tiếp, chọn 1 job có sẵn nhiều applications:

1. Mở 1 job, expand 1 application → xác nhận danh sách log cũ hiển thị đúng (Stage/Result/Reason/Note/ngày), khớp dữ liệu Supabase.
2. Add Log mới (chọn Result=Fail + Reason) → xác nhận log mới lưu đúng, Application-level `current_stage/result/reason_failed/note_failure_reason` tự đồng bộ đúng theo log mới (badge trên header app card cũng phải cập nhật ngay).
3. Edit 1 log CŨ hơn (không phải log mới nhất) → sửa Result → Save → xác nhận Application-level KHÔNG bị nhảy sai theo log cũ này (vẫn giữ đúng log mới nhất thật sự) — đây chính là lỗi đã có sẵn trong code cũ của Jobs, phải xác nhận đã hết.
4. Delete log mới nhất → xác nhận Application-level fallback đúng về log mới nhất còn lại (cả `result`/`reason_failed`, không chỉ `current_stage` — đây là lỗ hổng thứ 2 đã có sẵn, phải xác nhận đã hết).
5. Xoá hết log → xác nhận reset đúng về `Talent Mapping`/`null` như 2 trang kia.
6. Đổi Status ứng dụng sang "Closed" → xác nhận banner khoá hiện, form Add ẩn, lịch sử log vẫn xem được; xác nhận khối Result/Reason/Note chỉnh tay CŨ đã biến mất hoàn toàn khỏi Quick Edit Fields.
7. Expand ĐỒNG THỜI... — thực ra do `toggleExpandApp` giới hạn chỉ 1 app expand tại 1 thời điểm (`setExpandedAppIds(nextState ? { [appId]: true } : {})`), không cần test đa-instance đồng thời — nhưng cần test: expand app A → thao tác gì đó → collapse → expand app B khác → xác nhận đúng dữ liệu của app B (không bị dính state/log của app A).
8. Test `next build` không lỗi (production build), soi console dev không có lỗi parse mới (khác với lỗi cũ đã xác nhận là stale ở QA report Phase 5 — nếu thấy lỗi mới, phải kiểm tra kỹ có thật hay không, không được mặc định coi là stale).
9. Cập nhật `DEVELOPMENT_LOG.md`.

Sau phase này, gửi báo cáo để tôi (Architect/QA) tự thẩm định độc lập lại như các phase trước — test tay qua UI thật + đối chiếu Supabase, không chỉ tin vào báo cáo.
