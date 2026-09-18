# Fix Spec — 2026-09-01 (Phase 1/3): tạo shared `<ActivityLogPanel>` — wire vào `candidates/page.js`

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)

**Thứ tự thực hiện:** Spec này làm **sau** `FIX_SPEC_2026-09-01_stage-dropdown-cleanup-round3.md` (round 3). Round 3 sửa `page.js`/`jobs/page.js`, spec này chỉ đụng `candidates/page.js` + 1 file component mới — không đụng chung file nào với round 3, nhưng làm tuần tự theo đúng 1 spec/lượt như thường lệ.

## Bối cảnh

PO (Thức) phát hiện qua 5 ảnh chụp màn hình: mục Stage/Activity Log được cài đặt **hoàn toàn khác nhau** ở 3 trang Candidates / Action Menu / Jobs & Clients — không chỉ khác giá trị dropdown (đã vá dần ở round 1-3) mà còn khác cả:

1. **Màu badge Stage** — 3 hàm tính màu độc lập, cho ra 3 bảng màu khác nhau cho cùng 1 giá trị Stage:
   - `candidates/page.js` dùng `STAGE_COLOR_MAP` (enums.js) — **đã đầy đủ 15 giá trị, là nguồn chuẩn nhất vì được thêm cùng lúc với round 1 refactor**, nhưng chỉ mình file này dùng.
   - `page.js` có `getStageBadgeClass()` riêng (dòng ~268), dùng `.includes()` để đoán nhóm màu — "Offer" ra `emerald`.
   - `jobs/page.js` có `getStageBadgeClass()` riêng khác (dòng ~1074), cũng dùng `.includes()` nhưng bảng màu khác hẳn — "Offer" ra `green` (không phải `emerald`), "Onboard" cũng khác tông.
2. **Cấu trúc UI Result/Reason/Note** — 3 kiểu hoàn toàn khác nhau: cột trong bảng (`page.js`), khối "Quick Edit grid" (`jobs/page.js`), badge chỉ đọc (`candidates/page.js`).
3. **State + form Add/Edit Log** — viết tay riêng biệt ở cả 3 nơi dù backend (`addActivityLog`, `updateActivityLog`, `getActivityLogs` trong `actions.js`) đã dùng chung 100% — nghĩa là toàn bộ phần lệch nhau nằm ở tầng UI, không phải backend.

Quyết định: xây `src/components/ActivityLogPanel.js` làm nguồn UI/logic duy nhất cho Stage badge + Result/Reason badge + log list + Add/Edit Log form, dùng lại ở cả 3 trang qua 3 phase riêng (để cô lập rủi ro, có QA giữa mỗi phase):

- **Phase 1 (spec này):** tạo component, wire vào `candidates/page.js` — **chỉ refactor code, KHÔNG đổi hành vi/giao diện hiện tại của trang này dù chỉ 1 pixel.** Đây là phase rủi ro thấp nhất, dùng để kiểm chứng component hoạt động đúng với dữ liệu thật trước khi mở rộng.
- **Phase 2 (spec sau, sau khi Phase 1 được QA xác nhận):** wire vào `page.js`.
- **Phase 3 (spec sau, sau khi Phase 2 được QA xác nhận):** wire vào `jobs/page.js`.

**Spec này CHỈ làm Phase 1. Không tự ý làm Phase 2/3 dù thấy tiện — đợi spec riêng.**

---

## Việc 1 — Tạo file mới `src/components/ActivityLogPanel.js`

Component nhận toàn bộ dữ liệu qua props (không tự fetch, không tự gọi server action) — trang cha vẫn chịu trách nhiệm fetch logs / gọi `addActivityLog` / cập nhật state cục bộ, y hệt cách `candidates/page.js` đang làm, chỉ khác là JSX + state của form "thêm log mới" được chuyển vào trong component.

```jsx
"use client";

import React, { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { formatDateVN } from "src/lib/utils";
import { CANDIDATE_STAGES_LIST, STAGE_COLOR_MAP } from "src/constants/enums";

// Nguồn màu badge Stage DUY NHẤT cho toàn bộ app — dùng STAGE_COLOR_MAP
// (đã có sẵn, đủ 15 giá trị từ round 1 refactor). Export riêng để Phase 2/3
// có thể import dùng ngay cả ở những chỗ chưa kịp đổi sang cả panel.
export function getStageBadgeClass(stage) {
  return STAGE_COLOR_MAP[stage] || "bg-slate-800 text-slate-300 border-slate-700";
}

/**
 * Shared Activity Log panel: Stage badge + Result/Reason badge + log list + Add Log form.
 *
 * Props:
 * - applicationId (string, required)
 * - currentStage (string)
 * - result (string|null) — "Passed" | "Failed" | null
 * - reasonFailed (string|null)
 * - logs (array<{id, action_type, note, action_date}>)
 * - isLoadingLogs (bool)
 * - onAddLog (applicationId, {action_type, note}) => Promise<{success, ...}>  — bắt buộc nếu muốn cho thêm log
 * - outcomeMode ("readOnly" | "editable") — Phase 1 CHỈ dùng "readOnly". Không implement nhánh "editable"
 *   trong spec này — chỉ khai báo prop để Phase 2/3 mở rộng sau, không cần sửa lại chữ ký component.
 * - allowEditLog (bool) — Phase 1 CHỈ dùng false. Không implement UI edit-log trong spec này.
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
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSaveNewLog() {
    const trimmed = newNote.trim();
    if (!trimmed || !onAddLog) return;
    setSaving(true);
    try {
      const res = await onAddLog(applicationId, { action_type: newStage, note: trimmed });
      if (res && res.success !== false) {
        setNewNote("");
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
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-400">{log.action_type || "Note"}</span>
                <span className="text-slate-400 font-mono">{log.action_date ? formatDateVN(log.action_date) : ""}</span>
              </div>
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{log.note}</p>
            </div>
          ))}
        </div>
      )}

      {onAddLog && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <select
              value={newStage}
              onChange={e => setNewStage(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
            >
              {CANDIDATE_STAGES_LIST.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
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

Lưu ý bắt buộc: JSX/className bên trên copy **nguyên văn 100%** từ `candidates/page.js` hiện tại (dòng ~1246-1256 cho badge, ~1284-1330 cho log list, ~1332-1381 cho Add form) — không được "cải tiến" style hay đổi class trong lúc di chuyển. Mục tiêu Phase 1 là refactor thuần tuý, giao diện phải giống hệt pixel-for-pixel.

## Việc 2 — Wire vào `src/app/candidates/page.js`

### 2.1 — Import component

Thêm vào đầu file (cạnh các import khác):
```jsx
import ActivityLogPanel from "src/components/ActivityLogPanel";
```

### 2.2 — Xoá 2 state không còn cần

Xoá 2 dòng (~477-478):
```jsx
const [newLogStage, setNewLogStage] = useState({});
const [newLogNote, setNewLogNote] = useState({});
```
(Component tự quản lý state form "thêm log" bên trong nó, trang cha không cần giữ nữa.)

### 2.3 — Sửa chữ ký `handleAddTimelineNote` (~dòng 650)

Hiện tại:
```jsx
async function handleAddTimelineNote(applicationId) {
  const note = (newLogNote[applicationId] || "").trim();
  const stage = newLogStage[applicationId] || "Contact";
  if (!note) return;

  try {
    const res = await addActivityLog({
      application_id: applicationId,
      action_type: stage,
      note
    });
    if (res.success) {
      setNewLogNote(prev => ({ ...prev, [applicationId]: "" }));
      notify("✓ Timeline note recorded.");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        setTimelineLogs(prev => ({ ...prev, [applicationId]: logsRes.data || [] }));
      }
      loadCandidateData(candidate.id);
    } else {
      notify("Failed to add timeline note: " + res.error);
    }
  } catch (err) {
    notify("Error adding timeline note: " + err.message);
  }
}
```

Thay bằng (nhận `logData` trực tiếp từ component thay vì đọc từ state đã xoá; **giữ nguyên toàn bộ phần xử lý kết quả — chỉ đổi phần đọc input**):
```jsx
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
    if (res.success) {
      notify("✓ Timeline note recorded.");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        setTimelineLogs(prev => ({ ...prev, [applicationId]: logsRes.data || [] }));
      }
      loadCandidateData(candidate.id);
    } else {
      notify("Failed to add timeline note: " + res.error);
    }
    return res;
  } catch (err) {
    notify("Error adding timeline note: " + err.message);
    return { success: false, error: err.message };
  }
}
```

### 2.4 — Thay JSX badge + log list + Add form bằng `<ActivityLogPanel>`

Tìm khối JSX hiện tại (badge Stage + badge Failed ở phần header thẻ ứng viên, và toàn bộ "Log List" + "Quick Add Timeline Note Form" bên trong "Timeline Accordion Content"). **Giữ nguyên chỗ badge Stage/Failed đang nằm trong header thẻ (không di chuyển vị trí hiển thị)** — chỉ đổi cách render nội dung 2 badge đó sang gọi `getStageBadgeClass` từ component mới (import thêm `{ getStageBadgeClass }` từ `src/components/ActivityLogPanel` nếu muốn dùng lại ở header, hoặc đơn giản hơn: gọi luôn `<ActivityLogPanel>` cho toàn bộ khối "badge header + timeline accordion" nếu 2 vị trí đó nằm liền kề trong JSX — **AG tự xem code thực tế để quyết định cách ghép JSX tự nhiên nhất, miễn giữ đúng vị trí/giao diện hiển thị hiện tại**).

Phần "Timeline Accordion Content" (bên trong `{isExpanded && (...)}`) — thay đoạn "Log List" + "Quick Add Timeline Note Form" bằng:
```jsx
<ActivityLogPanel
  applicationId={app.application_id}
  currentStage={app.current_stage}
  result={app.result}
  reasonFailed={app.reason_failed}
  logs={logs}
  isLoadingLogs={isLoadingLog}
  onAddLog={handleAddTimelineNote}
  outcomeMode="readOnly"
  allowEditLog={false}
/>
```
(`logs` và `isLoadingLog` là biến cục bộ đã tồn tại sẵn trong scope `.map()` hiện tại — dùng lại nguyên, không đổi tên.)

Nếu badge Stage/Failed ở header thẻ nằm tách biệt (ngoài `isExpanded` block) thì **giữ nguyên JSX 2 badge đó y hệt hiện tại, không bắt buộc phải đổi sang gọi qua component** — phần bắt buộc đổi chỉ là Việc 2.4 (log list + add form). Đây là lựa chọn để giảm rủi ro, không phải yêu cầu cứng.

## KHÔNG được làm trong spec này

- Không thêm khả năng Edit Log (sửa 1 log đã có) vào `candidates/page.js` — trang này hiện chưa có, Phase 1 không thêm tính năng mới, chỉ refactor code.
- Không đổi badge Result/Reason từ "chỉ đọc" sang "có thể sửa" — giữ nguyên `outcomeMode="readOnly"`.
- Không đụng `src/app/page.js` hoặc `src/app/jobs/page.js` — đó là Phase 2/3, spec riêng.
- Không đổi màu sắc/class Tailwind của bất kỳ badge nào so với hiện tại.

## Yêu cầu báo cáo

1. `git diff` đầy đủ cho file mới `src/components/ActivityLogPanel.js` và file sửa `src/app/candidates/page.js`.
2. Xác nhận bằng cách chạy `npm run build` (hoặc `next build`) không lỗi — component mới phải compile sạch.
3. Thao tác tay trên `/candidates`: mở 1 ứng viên có ít nhất 1 application `Closed`/`Failed` → xác nhận badge Stage, badge "Failed — reason" hiển thị y hệt trước khi sửa. Mở Timeline → xác nhận log list hiển thị đúng thứ tự/nội dung như trước. Thêm 1 log mới → xác nhận lưu thành công, hiện đúng trong danh sách, note ô nhập bị xoá sau khi lưu (giống hành vi cũ).
4. `/api/qa-test`, `/api/db-test`, `/api/biz-test` — dán JSON thô, không được có regression.
5. Cập nhật `DEVELOPMENT_LOG.md` theo template mục 10.3 — ghi rõ đây là Phase 1/3 của refactor shared component, nêu tên 2 file thay đổi.
