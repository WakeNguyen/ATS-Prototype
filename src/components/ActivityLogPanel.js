"use client";

import React, { useState } from "react";
import { Loader2, Send, Pencil, Trash2 } from "lucide-react";
import { formatDateVN, formatTimeVN } from "src/lib/utils";
import { CANDIDATE_STAGES_LIST, STAGE_COLOR_MAP, FAILURE_REASONS_LIST } from "src/constants/enums";

// Nguồn màu badge Stage DUY NHẤT cho toàn bộ app — dùng STAGE_COLOR_MAP
export function getStageBadgeClass(stage) {
  return STAGE_COLOR_MAP[stage] || "bg-slate-800 text-slate-300 border-slate-700";
}

// Quy đổi 1 timestamp UTC (từ DB) sang chuỗi "YYYY-MM-DDTHH:mm" ĐÚNG giờ địa phương
// của trình duyệt, để hiển thị đúng trong <input type="datetime-local">.
// Lưu ý: input datetime-local diễn giải giá trị là giờ địa phương thuần (naive),
// không tự quy đổi timezone — nên KHÔNG được dùng toISOString() trực tiếp (luôn ra giờ UTC).
export function toLocalDatetimeInputValue(utcDateStrOrDate) {
  if (!utcDateStrOrDate) return "";
  const d = new Date(utcDateStrOrDate);
  if (isNaN(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60000; // phút -> ms; dương nếu local chậm hơn UTC
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().substring(0, 16);
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
 * Shared Activity Log panel: Stage badge (header) + log list (Stage/Result/Reason mỗi dòng, Edit/Delete inline) + Add Log form.
 *
 * Props:
 * - applicationId (string, required)
 * - currentStage (string) — hiển thị ở badge header
 * - result (string|null) — "Passed"/"Failed" cấp Application (đã auto-sync từ log mới nhất, chỉ đọc ở header)
 * - reasonFailed (string|null) — cấp Application, chỉ đọc ở header
 * - logs (array<{id, action_type, note, action_date, result, reason_failed}>)
 * - isLoadingLogs (bool)
 * - onAddLog (applicationId, {action_type, note, result, reason_failed}) => Promise<{success, ...}>
 * - onEditLog (applicationId, logId, {action_type, note, action_date, result, reason_failed}) => Promise<{success, ...}>
 * - onDeleteLog (applicationId, logId) => Promise<{success, ...}>
 * - outcomeMode ("readOnly" | "editable") — điều khiển badge Failed ở HEADER (cấp Application)
 * - allowEditLog (bool) — cho phép hiển thị nút sửa/xóa dòng log
 * - logsMaxHeightClass (string) — Tailwind class điều khiển chiều cao tối đa của scroll list log (mặc định: "max-h-[220px]")
 */
export default function ActivityLogPanel({
  applicationId,
  currentStage,
  result = null,
  reasonFailed = null,
  logs = [],
  isLoadingLogs = false,
  onAddLog,
  onEditLog,
  onDeleteLog,
  outcomeMode = "readOnly",
  allowEditLog = false,
  logsMaxHeightClass = "max-h-[220px]",
}) {
  const [newStage, setNewStage] = useState("Contact");
  const [newResult, setNewResult] = useState("Pass");
  const [newReasonFailed, setNewReasonFailed] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit / Delete state
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

  function handleStartEditLog(log) {
    setEditingLogId(log.id);
    setEditingLogData({
      action_type: log.action_type || "Contact",
      note: log.note || "",
      action_date: log.action_date ? toLocalDatetimeInputValue(log.action_date) : toLocalDatetimeInputValue(new Date()),
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
        <div className={`space-y-2 ${logsMaxHeightClass} overflow-y-auto custom-scrollbar pr-1`}>
          {logs.map(log => {
            const isEditing = editingLogId === log.id;

            if (isEditing) {
              return (
                <div key={log.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/70 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={editingLogData.action_type}
                      onChange={e => setEditingLogData(d => ({ ...d, action_type: e.target.value }))}
                      className="px-2 py-1 text-xs bg-slate-950 border border-emerald-500/60 rounded-lg text-slate-200"
                    >
                      {CANDIDATE_STAGES_LIST.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
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
                        {FAILURE_REASONS_LIST.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
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
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEditLog(log.id);
                      } else if (e.key === "Escape") {
                        handleCancelEditLog();
                      }
                    }}
                    className="w-full text-xs p-1.5 bg-slate-950 border border-emerald-500/60 rounded-lg text-slate-100 resize-none"
                  />
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      disabled={savingEditLog}
                      onClick={() => handleSaveEditLog(log.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
                    >
                      {savingEditLog ? <Loader2 size={12} className="animate-spin" /> : null}
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditLog}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={log.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-emerald-400 whitespace-nowrap">{log.action_type || "Note"}</span>
                    <LogResultBadge result={log.result} reasonFailed={log.reason_failed} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-slate-400 font-mono whitespace-nowrap">{log.action_date ? formatDateVN(log.action_date) : ""}</span>
                      {log.created_time && (
                        <span
                          className="text-slate-600 font-mono whitespace-nowrap text-[10px]"
                          title={`Tạo lúc: ${formatDateVN(log.created_time)} ${formatTimeVN(log.created_time)}`}
                        >
                          tạo lúc {formatTimeVN(log.created_time)}
                        </span>
                      )}
                    </div>
                    {allowEditLog && (
                      <div className="flex items-center gap-1">
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
                  </div>
                </div>
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{log.note}</p>
              </div>
            );
          })}
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
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
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
