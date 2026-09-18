"use client";

import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  ExternalLink,
  Clock,
  ShieldAlert,
  Layers
} from "lucide-react";

/**
 * Format ISO date string into readable Vietnam time.
 */
function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch (e) {
    return isoString;
  }
}

/**
 * Shared Run History Table with Expandable Rows for Campaign Runs & Warm/Join Runs.
 * 
 * @param {Object} props
 * @param {Array} props.runs - List of runs (campaign_runs or warm_join_runs)
 * @param {'campaign'|'warm_join'} [props.type='campaign'] - Type of run history
 * @param {Function} props.fetchRunDetail - Async function (runId) => Promise<{success: boolean, data?: Object}>
 * @param {boolean} [props.isLoading=false]
 */
export default function RunHistoryTable({ runs = [], type = "campaign", fetchRunDetail, isLoading = false }) {
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [runDetails, setRunDetails] = useState({});
  const [loadingDetailId, setLoadingDetailId] = useState(null);

  const toggleExpand = async (runId) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);

    // Fetch detail if not cached
    if (!runDetails[runId] && fetchRunDetail) {
      setLoadingDetailId(runId);
      try {
        const res = await fetchRunDetail(runId);
        if (res?.success && res?.data) {
          setRunDetails((prev) => ({ ...prev, [runId]: res.data }));
        }
      } catch (err) {
        console.error("Failed to load run detail:", err);
      } finally {
        setLoadingDetailId(null);
      }
    }
  };

  React.useEffect(() => {
    if (!expandedRunId || !fetchRunDetail) return;
    const expandedRun = runs.find((r) => r.id === expandedRunId);
    if (!expandedRun || expandedRun.status !== "Running") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetchRunDetail(expandedRunId);
        if (res?.success && res?.data) {
          setRunDetails((prev) => ({ ...prev, [expandedRunId]: res.data }));
        }
      } catch (err) {
        console.error("Failed to poll run detail:", err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [expandedRunId, runs, fetchRunDetail]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "Running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 size={11} className="animate-spin" />
            Running
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={11} />
            Completed
          </span>
        );
      case "Needs Review":
      case "NeedsReview":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={11} />
            Needs Review
          </span>
        );
      case "Failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={11} />
            Failed
          </span>
        );
      case "PartialSuccess":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={11} />
            Partial Success
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            {status || "Unknown"}
          </span>
        );
    }
  };

  const getItemStatusBadge = (itemStatus, item) => {
    switch (itemStatus) {
      case "Sent":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={10} />
            Sent
          </span>
        );
      case "Joined":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={10} />
            Joined
          </span>
        );
      case "Not Processed":
      case "NotProcessed":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700" title="Not yet processed in this run (dispatch batch capped or campaign ended)">
            <Clock size={10} />
            Not Processed
          </span>
        );
      case "Interrupted":
        const retryAt = item?.retry_eligible_at ? formatDateTime(item.retry_eligible_at) : null;
        return (
          <span 
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30"
            title={retryAt ? `Interrupted mid-run. Retry cooldown active until ${retryAt}` : "Interrupted mid-run. 3h cooldown applied before auto-retry."}
          >
            <AlertTriangle size={10} className="text-amber-400" />
            <span>Interrupted</span>
            {retryAt && <span className="text-[9px] opacity-75 font-mono">({retryAt})</span>}
          </span>
        );
      case "Join Requested":
      case "JoinRequested":
      case "Pending Approval":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
            <Clock size={10} className="text-amber-400" />
            Join Requested
          </span>
        );
      case "Needs Answer":
      case "Needs Custom Answer":
      case "AutoAnswered":
        const targetGroupId = item?.social_group_id || item?.socialGroupId;
        return (
          <a
            href={targetGroupId ? `/campaigns?tab=social-groups&group_id=${targetGroupId}` : '/campaigns?tab=social-groups'}
            title="Đã xử lý xong lượt này — bấm để vào tab Social Group URLs cập nhật câu trả lời"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <AlertTriangle size={10} className="text-amber-400" />
            <span>Needs Answer</span>
            <ExternalLink size={8} className="opacity-70" />
          </a>
        );
      case "Failed":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={10} />
            Failed
          </span>
        );
      case "Checkpoint":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600/20 text-red-300 border border-red-500/30">
            <ShieldAlert size={10} />
            Checkpoint
          </span>
        );
      case "Warmed":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Warmed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            {itemStatus || "Pending"}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400 text-xs gap-2">
        <Loader2 size={14} className="animate-spin text-emerald-400" />
        <span>Loading run history...</span>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-900/40 rounded-lg border border-slate-800/80 text-slate-500 text-xs">
        No execution history records found.
      </div>
    );
  }

  return (
    <div className="w-full border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 shadow-sm text-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3">Started At</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Summary</th>
              <th className="py-2.5 px-3">Completed At</th>
              <th className="py-2.5 px-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {runs.map((run, idx) => {
              const isExpanded = expandedRunId === run.id;
              const detail = runDetails[run.id];
              const droppedItems = run.stats?.droppedItems || detail?.stats?.droppedItems || [];

              return (
                <React.Fragment key={run.id || idx}>
                  <tr 
                    onClick={() => toggleExpand(run.id)}
                    className={`cursor-pointer transition-colors ${
                      isExpanded ? "bg-slate-800/40" : "hover:bg-slate-900/40"
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-mono whitespace-nowrap">
                      {formatDateTime(run.started_at)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getStatusBadge(run.status)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={run.summary || "No summary"}>
                      {run.summary || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">
                      {formatDateTime(run.completed_at)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(run.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Sub-table */}
                  {isExpanded && (
                    <tr className="bg-slate-900/90 border-b border-slate-800">
                      <td colSpan={6} className="p-4">
                        {loadingDetailId === run.id ? (
                          <div className="flex items-center justify-center py-4 text-slate-400 gap-2">
                            <Loader2 size={13} className="animate-spin text-emerald-400" />
                            <span>Loading run breakdown items...</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Dropped Items Alert Banner (PHẦN 3.1 Debug Report) */}
                            {droppedItems.length > 0 && (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] space-y-1.5">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <AlertTriangle size={13} />
                                  <span>⚠️ {droppedItems.length} Target Group(s) were skipped/dropped during pre-flight re-validation:</span>
                                </div>
                                <div className="divide-y divide-amber-500/20">
                                  {droppedItems.map((d, dIdx) => (
                                    <div key={dIdx} className="py-1 flex items-center justify-between text-[11px]">
                                      <span className="font-semibold text-amber-200">{d.groupName || d.socialGroupId}</span>
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                        Reason: {d.reason}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Run Items Table */}
                            {detail?.items && detail.items.length > 0 ? (
                              <div className="border border-slate-800 rounded bg-slate-950/80 overflow-x-auto">
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                                      <th className="py-2 px-3">#</th>
                                      <th className="py-2 px-3">Target Group</th>
                                      <th className="py-2 px-3">FB Account</th>
                                      <th className="py-2 px-3">Status / Action</th>
                                      <th className="py-2 px-3">Details / Result</th>
                                      <th className="py-2 px-3 text-right">Time</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40">
                                    {detail.items.map((item, itIdx) => (
                                      <tr key={item.id || itIdx} className="hover:bg-slate-900/30">
                                        <td className="py-2 px-3 text-slate-500 font-mono">{itIdx + 1}</td>
                                        <td className="py-2 px-3">
                                          <div className="font-medium text-slate-200">{item.group_name || "—"}</div>
                                          {item.group_url && (
                                            <a
                                              href={item.group_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[10px] text-emerald-400/80 hover:text-emerald-300 flex items-center gap-1 mt-0.5"
                                            >
                                              <span>Open Group</span>
                                              <ExternalLink size={9} />
                                            </a>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-300 font-mono">
                                          {item.fb_account_name || item.account_ref || item.fb_account_id || "—"}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          {getItemStatusBadge(item.status || item.action, item)}
                                        </td>
                                        <td className="py-2 px-3 text-slate-300 max-w-sm">
                                          {item.error_message && (
                                            <div className="text-rose-400 text-[10px] font-mono break-words">
                                              {item.error_message}
                                            </div>
                                          )}
                                          {item.post_url && (
                                            <a
                                              href={item.post_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-emerald-400 hover:underline flex items-center gap-1 text-[10px]"
                                            >
                                              <span>View Post</span>
                                              <ExternalLink size={9} />
                                            </a>
                                          )}
                                          {item.admin_questions && (
                                            <div className="text-slate-400 text-[10px]">
                                              <span className="text-slate-500">Q: </span>
                                              {JSON.stringify(item.admin_questions)}
                                            </div>
                                          )}
                                          {!item.error_message && !item.post_url && !item.admin_questions && "—"}
                                        </td>
                                        <td className="py-2 px-3 text-right text-slate-500 font-mono whitespace-nowrap">
                                          {formatDateTime(item.executed_at || item.created_at)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-slate-500 py-3 text-center text-[11px] bg-slate-950/40 rounded border border-slate-800/60">
                                No individual item breakdowns recorded for this run.
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
