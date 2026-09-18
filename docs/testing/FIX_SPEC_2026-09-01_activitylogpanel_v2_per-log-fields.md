# Fix Spec — 2026-09-01 (Phase 3/N): ActivityLogPanel v2 — 3 cột Stage/Result/Reason theo từng dòng log

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)

## Bối cảnh

Phase 2/N (backend, đã PASS) đã làm xong nền tảng: `activity_log` có cột `result`/`reason_failed` riêng cho từng dòng log, tự động đồng bộ lên `activity.result`/`reason_failed`/`note_failure_reason`. Phase này (3/N) làm phần UI thật: mỗi dòng trong Activity Log Timeline hiển thị **3 thông tin Stage - Result - Reason (if Failed)** đúng như PO mô tả, và form "Add Log" có thêm ô chọn Result (Pass/Fail) + Reason (nếu Fail).

**Phạm vi phase này: chỉ sửa `src/components/ActivityLogPanel.js` + wiring tại `src/app/candidates/page.js`** (trang duy nhất đang dùng component này, từ Phase 1). `src/app/page.js` và `src/app/jobs/page.js` vẫn đang dùng form Add/Edit Log viết tay riêng của chúng, CHƯA đụng tới trong phase này — sẽ có spec riêng (Phase 4, Phase 5) để chuyển 2 trang đó sang dùng component chung này sau khi phase này được QA xác nhận.

**Result trong `activity_log` dùng giá trị `'Pass'`/`'Fail'`** (không phải `'Passed'`/`'Failed'` như `APPLICATION_RESULTS_LIST` cấp Application) — đúng theo Phase 2 đã xây trong `actions.js`. Component KHÔNG được tái dùng `APPLICATION_RESULTS_LIST` cho ô chọn Result per-log, phải dùng đúng 2 giá trị `'Pass'`/`'Fail'`.

---

## Việc 1 — Viết lại toàn bộ `src/components/ActivityLogPanel.js`

Thay **toàn bộ nội dung file hiện tại** bằng:

```jsx
"use client";

import React, { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { formatDateVN } from "src/lib/utils";
import { CANDIDATE_STAGES_LIST, STAGE_COLOR_MAP, FAILURE_REASONS_LIST } from "src/constants/enums";

// Nguồn màu badge Stage DUY NHẤT cho toàn bộ app — dùng STAGE_COLOR_MAP
export function getStageBadgeClass(stage) {
  return STAGE_COLOR_MAP[stage] || "bg-slate-800 text-slate-300 border-slate-700";
}

// Badge nhỏ hiển thị Result (Pass/Fail) của 1 dòng log
function LogResultBadge({ result, reasonFailed }) {
  if (result === "Fail") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800 whitespace-nowrap">
        Fail{reasonFailed ? ` — ${reasonFailed}` : ""}
      </span>
    );
  }
  if (result === "Pass") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
        Pass
      </span>
    );
  }
  return null;
}

/**
 * Shared Activity Log panel: Stage badge (header) + log list (Stage/Result/Reason mỗi dòng) + Add Log form.
 *
 * Props:
 * - applicationId (string, required)
 * - currentStage (string) — hiển thị ở badge header
 * - result (string|null) — "Passed"/"Failed" cấp Application (đã auto-sync từ log mới nhất, chỉ đọc ở header)
 * - reasonFailed (string|null) — cấp Application, chỉ đọc ở header
 * - logs (array<{id, action_type, note, action_date, result, reason_failed}>)
 * - isLoadingLogs (bool)
 * - onAddLog (applicationId, {action_type, note, result, reason_failed}) => Promise<{success, ...}>
 * - outcomeMode ("readOnly" | "editable") — điều khiển badge Failed ở HEADER (cấp Application), không liên quan Result/Reason per-log
 * - allowEditLog (bool) — Phase này CHỈ dùng false, chưa implement Edit Log per-log trong component
 */
export default function ActivityLogPanel({
  applicationId,
  currentStage,
  result = null,
  reasonFailed = null,
  logs = [],
  isLoadingLogs = false,
  onAddLog,
  outcomeMode = "readOnly",
  allowEditLog = false,
}) {
  const [newStage, setNewStage] = useState("Contact");
  const [newResult, setNewResult] = useState("Pass");
  const [newReasonFailed, setNewReasonFailed] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSaveNewLog() {
    const trimmed = newNote.trim();
    if (!trimmed || !onAddLog) return;
    setSaving(true);
    try {
      const res = await onAddLog(applicationId, {
        action_type: newStage,
        note: trimmed,
        result: newResult,
        reason_failed: newResult === "Fail" ? (newReasonFailed || null) : null,
      });
      if (res && res.success !== false) {
        setNewNote("");
        setNewResult("Pass");
        setNewReasonFailed("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getStageBadgeClass(currentStage)}`}>
          {currentStage || "Talent Mapping"}
        </span>
        {outcomeMode === "readOnly" && result === "Failed" && (
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-rose-950 text-rose-300 border-rose-800 flex items-center gap-1 whitespace-nowrap">
            Failed {reasonFailed ? `— ${reasonFailed}` : ""}
          </span>
        )}
      </div>

      {isLoadingLogs ? (
        <div className="p-3 text-center text-xs text-slate-500">
          <Loader2 size={16} className="animate-spin inline mr-1 text-emerald-400" />
          Loading timeline history...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-2.5 text-center text-xs text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800/60">
          No activity notes recorded yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {logs.map(log => (
            <div key={log.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="font-bold text-emerald-400 whitespace-nowrap">{log.action_type || "Note"}</span>
                  <LogResultBadge result={log.result} reasonFailed={log.reason_failed} />
                </div>
                <span className="text-slate-400 font-mono whitespace-nowrap">{log.action_date ? formatDateVN(log.action_date) : ""}</span>
              </div>
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{log.note}</p>
            </div>
          ))}
        </div>
      )}

      {onAddLog && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newStage}
              onChange={e => setNewStage(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
            >
              {CANDIDATE_STAGES_LIST.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <select
              value={newResult}
              onChange={e => setNewResult(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
            >
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>
            {newResult === "Fail" && (
              <select
                value={newReasonFailed}
                onChange={e => setNewReasonFailed(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-950 border border-rose-800/60 rounded-lg text-slate-200"
              >
                <option value="">— (chưa chọn)</option>
                {FAILURE_REASONS_LIST.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
            <span className="text-[11px] text-slate-400">Enter note and click save:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveNewLog();
                }
              }}
              placeholder="e.g. Phone screened, candidate asked for 25M net..."
              className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSaveNewLog}
              disabled={!newNote.trim() || saving}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-all flex items-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              <span>Save</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Điểm khác so với bản Phase 1: thêm `LogResultBadge` (hiển thị Pass/Fail + Reason ngay trên mỗi dòng log), thêm 2 state `newResult`/`newReasonFailed` cho form Add Log (mặc định `newResult = "Pass"`, ô Reason chỉ hiện khi chọn `"Fail"` — đúng pattern `— (chưa chọn)` đã dùng ở Quick Edit `jobs/page.js` để nhất quán), gửi `result`/`reason_failed` trong object truyền cho `onAddLog`. **Đã bỏ import `APPLICATION_RESULTS_LIST`** (không dùng ở component này nữa vì Result per-log dùng `'Pass'`/`'Fail'` cố định, không phải danh sách enum "Passed"/"Failed").

## Việc 2 — `src/app/candidates/page.js`: forward `result`/`reason_failed` trong `handleAddTimelineNote`

Hiện tại (từ Phase 1):
```js
async function handleAddTimelineNote(applicationId, logData) {
  const note = (logData?.note || "").trim();
  const stage = logData?.action_type || "Contact";
  if (!note) return { success: false, error: "Empty note" };

  try {
    const res = await addActivityLog({
      application_id: applicationId,
      action_type: stage,
      note
    });
    ...
```

Thay bằng (chỉ thêm 2 field vào object gửi lên `addActivityLog`, giữ nguyên toàn bộ phần còn lại y hệt):
```js
async function handleAddTimelineNote(applicationId, logData) {
  const note = (logData?.note || "").trim();
  const stage = logData?.action_type || "Contact";
  if (!note) return { success: false, error: "Empty note" };

  try {
    const res = await addActivityLog({
      application_id: applicationId,
      action_type: stage,
      note,
      result: logData?.result,
      reason_failed: logData?.reason_failed
    });
    ...
```

Không cần sửa gì thêm ở JSX gọi `<ActivityLogPanel .../>` — props truyền vào không đổi (`applicationId`, `currentStage`, `result`, `reasonFailed`, `logs`, `isLoadingLogs`, `onAddLog={handleAddTimelineNote}`, `outcomeMode="readOnly"`, `allowEditLog={false}`), vì thay đổi hoàn toàn nằm bên trong component.

## KHÔNG được làm trong spec này

- Không đụng `src/app/page.js` hoặc `src/app/jobs/page.js` — Phase 4/5 riêng.
- Không thêm Edit Log (sửa 1 log đã có) — giữ `allowEditLog={false}`, chỉ làm Add Log.
- Không đổi badge Result/Reason ở header thẻ (cấp Application, `outcomeMode="readOnly"`) — giữ nguyên như Phase 1.

## Yêu cầu báo cáo

1. `git diff` đầy đủ cho `src/components/ActivityLogPanel.js` và `src/app/candidates/page.js`.
2. Thao tác tay trên `/candidates`: mở 1 ứng viên, mở Timeline → xác nhận mỗi dòng log cũ hiển thị đúng badge Pass (màu xanh) nếu `result` là `Pass`/không có badge nếu log cũ chưa có `result`. Thêm 1 log mới: chọn Stage bất kỳ, chọn Result = Fail → xác nhận ô Reason hiện ra, chọn 1 lý do, nhập note, Save → xác nhận log mới hiện đúng badge "Fail — <lý do>" màu đỏ trong danh sách ngay sau khi lưu. Thử lại 1 lần với Result = Pass → xác nhận không có ô Reason, badge hiện "Pass" màu xanh.
3. Query trực tiếp Supabase (hoặc nhờ tôi) xác nhận `activity_log.result`/`reason_failed` lưu đúng giá trị vừa chọn, và `activity.result`/`reason_failed` (cấp Application) tự động đồng bộ theo log Fail vừa thêm.
4. `/api/qa-test`, `/api/db-test`, `/api/biz-test` — dán JSON thô, không được có regression.
5. Cập nhật `DEVELOPMENT_LOG.md` theo template mục 10.3.
