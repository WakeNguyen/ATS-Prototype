"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldX, 
  HelpCircle, 
  Save, 
  X, 
  Loader2,
  Users,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { updateSocialGroupJoinAnswer } from "../campaign_actions";

/**
 * Format ISO date string into readable Vietnam time.
 */
function formatShortDate(isoString) {
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
 * Enhanced Join Status & Accounts Joined Badge with interactive Popovers.
 * 
 * Supports:
 * 1. Multi-account joined ratio (e.g. 2/2, 1/2, 0/2) with popover listing accounts and joined dates.
 * 2. Question / Custom Answer interactive popover for groups in 'Needs Custom Answer' state.
 * 
 * @param {Object} props
 * @param {string} [props.status="Not Joined"] - The join status string
 * @param {string} [props.groupId=null] - Social Group UUID
 * @param {string|null} [props.customAnswer=""] - Current custom answer
 * @param {string|null} [props.adminQuestions=null] - Admin questions JSON/string
 * @param {number} [props.joinedCount] - Number of active accounts that joined
 * @param {number} [props.totalActiveAccounts] - Total active accounts in system
 * @param {Array} [props.joinedAccountsList=[]] - List of joined account objects { id, account_name, account_ref, joined_at }
 * @param {Function} [props.onAnswerUpdated] - Callback after answer is saved
 */
export default function JoinStatusBadge({
  status = "Not Joined",
  groupId = null,
  customAnswer = "",
  adminQuestions = null,
  joinedCount,
  totalActiveAccounts,
  joinedAccountsList = [],
  onAnswerUpdated
}) {
  const [showAnswerPopover, setShowAnswerPopover] = useState(false);
  const [showAccountsPopover, setShowAccountsPopover] = useState(false);
  const [answerInput, setAnswerInput] = useState(customAnswer || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowAnswerPopover(false);
        setShowAccountsPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveAnswer = async (e) => {
    e.stopPropagation();
    if (!groupId) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await updateSocialGroupJoinAnswer(groupId, answerInput.trim());
      if (res.success) {
        setShowAnswerPopover(false);
        if (onAnswerUpdated) onAnswerUpdated(answerInput.trim());
      } else {
        setSaveError(res.error || "Failed to save answer");
      }
    } catch (err) {
      setSaveError(err.message || "Error saving answer");
    } finally {
      setSaving(false);
    }
  };

  const hasRatio = joinedCount !== undefined && totalActiveAccounts !== undefined;
  const isAllJoined = hasRatio && totalActiveAccounts > 0 && joinedCount >= totalActiveAccounts;
  const isPartialJoined = hasRatio && joinedCount > 0 && joinedCount < totalActiveAccounts;
  const isNoneJoined = hasRatio && joinedCount === 0;

  const renderRatioBadge = () => {
    let badgeClass = "bg-slate-800/80 text-slate-400 border-slate-700/80 hover:bg-slate-800";
    let icon = <Users size={11} className="text-slate-500" />;

    if (isAllJoined) {
      badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20";
      icon = <CheckCircle2 size={11} className="text-emerald-400" />;
    } else if (isPartialJoined) {
      badgeClass = "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20";
      icon = <Clock size={11} className="text-amber-400" />;
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowAccountsPopover(!showAccountsPopover);
          setShowAnswerPopover(false);
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border transition-all cursor-pointer shadow-xs ${badgeClass}`}
        title="Click to view accounts joined breakdown"
      >
        {icon}
        <span>{joinedCount}/{totalActiveAccounts}</span>
      </button>
    );
  };

  const renderLegacyStatusBadge = () => {
    switch (status) {
      case "Joined":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={11} />
            Joined
          </span>
        );
      case "Pending Approval":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock size={11} />
            Pending Approval
          </span>
        );
      case "Needs Custom Answer":
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAnswerPopover(!showAnswerPopover);
              setShowAccountsPopover(false);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors shadow-xs animate-pulse cursor-pointer"
            title="Click to provide membership question answer"
          >
            <AlertTriangle size={12} className="text-amber-400" />
            <span>Needs Answer</span>
          </button>
        );
      case "Manual Join Only":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            <ShieldX size={11} />
            Manual Join Only
          </span>
        );
      case "Not Joined":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Not Joined
          </span>
        );
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1.5">
      {hasRatio ? renderRatioBadge() : renderLegacyStatusBadge()}

      {/* If group specifically needs an answer or has questions, show the question alert button alongside ratio */}
      {hasRatio && (status === "Needs Custom Answer" || customAnswer || adminQuestions) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAnswerPopover(!showAnswerPopover);
            setShowAccountsPopover(false);
          }}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer shadow-xs ${
            status === "Needs Custom Answer"
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 animate-pulse"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
          }`}
          title={customAnswer ? `Custom Answer: ${customAnswer}` : "Provide Custom Join Answer"}
        >
          <AlertTriangle size={11} className={status === "Needs Custom Answer" ? "text-amber-400" : "text-slate-400"} />
          <span>{status === "Needs Custom Answer" ? "Needs Answer" : (customAnswer ? "Has Answer" : "Questions")}</span>
        </button>
      )}

      {/* Popover 1: Accounts Joined Breakdown */}
      {showAccountsPopover && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 top-full mt-1.5 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-slate-200 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-100 text-[11px]">
              <Users size={13} className="text-emerald-400" />
              <span>Accounts Joined ({joinedCount}/{totalActiveAccounts})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAccountsPopover(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto divide-y divide-slate-800/60">
            {joinedAccountsList && joinedAccountsList.length > 0 ? (
              joinedAccountsList.map((acc, idx) => (
                <div key={acc.id || idx} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700 shrink-0">
                      {acc.account_ref || "—"}
                    </span>
                    <span className="font-medium text-slate-200 truncate text-[11px]">
                      {acc.account_name}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono shrink-0">
                    {formatShortDate(acc.joined_at)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3 text-center text-slate-500 text-[11px] italic">
                No active accounts have joined this group yet.
              </div>
            )}
          </div>

          {joinedCount < totalActiveAccounts && (
            <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="text-amber-400 font-semibold">{totalActiveAccounts - joinedCount} account(s)</span> still missing this group.
            </div>
          )}
        </div>
      )}

      {/* Popover 2: Answering Admin Questions */}
      {showAnswerPopover && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 right-0 top-full mt-1.5 w-80 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-slate-200 text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
              <HelpCircle size={13} />
              <span>Group Membership Questions</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAnswerPopover(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>

          {adminQuestions && (
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 max-h-24 overflow-y-auto">
              <span className="text-slate-500 font-semibold">Questions: </span>
              {typeof adminQuestions === "object"
                ? JSON.stringify(adminQuestions, null, 2)
                : adminQuestions}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400">
              Your Custom Answer:
            </label>
            <textarea
              rows={2}
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="Provide answer for the group admin..."
              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {saveError && (
            <div className="text-[10px] text-rose-400 font-mono">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAnswerPopover(false)}
              className="px-2.5 py-1 rounded text-slate-400 hover:text-slate-200 text-[11px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAnswer}
              disabled={saving || !answerInput.trim()}
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              <span>Save & Re-submit</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
