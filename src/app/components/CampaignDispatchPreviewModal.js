"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Rocket, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Info,
  ShieldCheck,
  Facebook,
  Image as ImageIcon
} from "lucide-react";
import { computeCampaignDispatchPreview, triggerCampaignRun } from "../campaign_actions";

/**
 * Modal Preview & Smart Dispatch Breakdown for Campaign Execution.
 * 
 * Replaces Telegram confirmation by providing an interactive in-app review
 * and approval dialog where recruiters inspect assigned FB accounts,
 * toggle specific target groups, and trigger the auto-post batch.
 * 
 * @param {Object} props
 * @param {string} props.campaignId
 * @param {string} props.campaignName
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess - Callback triggered after run starts successfully
 */
export default function CampaignDispatchPreviewModal({
  campaignId,
  campaignName,
  isOpen,
  onClose,
  onSuccess
}) {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!isOpen || !campaignId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    async function loadPreview() {
      try {
        const res = await computeCampaignDispatchPreview(campaignId);
        if (!isMounted) return;

        if (res.success) {
          const data = res.data || res;
          setPreviewData(data);
          // Default: all dispatched groups are checked
          const initialSet = new Set((data.dispatch || []).map((d) => d.socialGroupId));
          setSelectedGroupIds(initialSet);
        } else {
          setErrorMessage(res.error || "Failed to calculate dispatch preview.");
        }
      } catch (err) {
        if (isMounted) setErrorMessage(err.message || "Unexpected error calculating preview.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, campaignId]);

  if (!isOpen) return null;

  const toggleGroup = (socialGroupId) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(socialGroupId)) {
        next.delete(socialGroupId);
      } else {
        next.add(socialGroupId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!previewData?.dispatch) return;
    if (selectedGroupIds.size === previewData.dispatch.length) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(previewData.dispatch.map((d) => d.socialGroupId)));
    }
  };

  const handleConfirmRun = async () => {
    if (selectedGroupIds.size === 0) {
      setErrorMessage("Please select at least 1 target group to dispatch.");
      return;
    }

    setTriggering(true);
    setErrorMessage(null);

    try {
      // Filter dispatch array down to only user-selected groups
      const confirmedDispatch = (previewData.dispatch || []).filter((d) =>
        selectedGroupIds.has(d.socialGroupId)
      );

      const res = await triggerCampaignRun(campaignId, confirmedDispatch);

      if (res.success) {
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        setErrorMessage(res.error || "Failed to trigger campaign run.");
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setTriggering(false);
    }
  };

  const stats = previewData?.stats;
  const dispatchList = previewData?.dispatch || [];
  const campaign = previewData?.campaign;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Rocket size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Preview & Dispatch Breakdown</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {campaignName || campaign?.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review assigned Facebook accounts, anti-spam cooldowns, and confirm batch execution.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={triggering}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
              <p className="text-xs">Calculating smart dispatch & checking account quotas...</p>
            </div>
          ) : errorMessage && !previewData ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-rose-200">Cannot Generate Dispatch Preview</div>
                <p>{errorMessage}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Error Banner if trigger failed */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold text-rose-200">Execution Error: </span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Stats Bar */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[11px]">Ready to Dispatch</div>
                    <div className="text-base font-bold text-emerald-400 font-mono">
                      {selectedGroupIds.size} / {dispatchList.length}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[11px]">24h Cooldown Skipped</div>
                    <div className="text-base font-bold text-amber-400 font-mono">
                      {stats.skippedRecentlyCount || 0}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[11px]">No Active Account</div>
                    <div className="text-base font-bold text-slate-300 font-mono">
                      {stats.skippedNoAccountAvailable || 0}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[11px]">Dispatched This Run</div>
                    <div className="text-base font-bold text-sky-400 font-mono">
                      {stats.eligibleCount || 0} groups
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Content Preview */}
              {campaign && (
                <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Post Content Preview</span>
                    {campaign.post_image_url && (
                      <span className="text-emerald-400 flex items-center gap-1 font-normal lowercase">
                        <ImageIcon size={12} />
                        1 Image Attached
                      </span>
                    )}
                  </div>
                  <div className="text-slate-300 bg-slate-900/80 p-3 rounded border border-slate-800 font-sans text-xs whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {campaign.content || "No post text provided."}
                  </div>
                  {campaign.post_image_url && (
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      Image: <a href={campaign.post_image_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{campaign.post_image_url}</a>
                    </div>
                  )}
                </div>
              )}

              {/* Dispatch Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-xs">
                    Target Groups & Assigned Accounts Breakdown
                  </span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    {selectedGroupIds.size === dispatchList.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                {dispatchList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/40 rounded-lg border border-slate-800 text-slate-500 space-y-2">
                    <div>No target groups are currently eligible for dispatch. (All target groups may be in 24h cooldown or lack active FB accounts).</div>
                    {stats?.circuitBreakerRemovedAccounts?.length > 0 && (
                      <div className="text-amber-400 text-[11px]">
                        ⚠️ Auto-removed due to repeated failures: {stats.circuitBreakerRemovedAccounts.map(a => `${a.account_name} (${a.failed_count} failed)`).join(', ')} — add a different account to resume.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 max-h-64 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.size === dispatchList.length && dispatchList.length > 0}
                              onChange={toggleAll}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-3">Target Group</th>
                          <th className="py-2.5 px-3">Assigned FB Account</th>
                          <th className="py-2.5 px-3">Proxy / Node</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {dispatchList.map((item, idx) => {
                          const isChecked = selectedGroupIds.has(item.socialGroupId);
                          return (
                            <tr
                              key={item.socialGroupId || idx}
                              onClick={() => toggleGroup(item.socialGroupId)}
                              className={`cursor-pointer transition-colors ${
                                isChecked ? "bg-slate-900/40 hover:bg-slate-800/40" : "opacity-40 hover:opacity-75"
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleGroup(item.socialGroupId)}
                                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-200">{item.groupName || item.socialGroupId}</div>
                                {item.groupUrl && (
                                  <a
                                    href={item.groupUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-emerald-400/80 hover:text-emerald-300 inline-flex items-center gap-1 mt-0.5"
                                  >
                                    <span>Visit Group</span>
                                    <ExternalLink size={9} />
                                  </a>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-300">
                                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-[11px]">
                                  {item.accountName || item.accountId}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] truncate max-w-xs">
                                {item.proxyUrl || "Direct IP (Host)"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <button
            type="button"
            onClick={onClose}
            disabled={triggering}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmRun}
            disabled={loading || triggering || selectedGroupIds.size === 0}
            className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              loading || triggering || selectedGroupIds.size === 0
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 active:scale-98"
            }`}
          >
            {triggering ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Launching Campaign Run...</span>
              </>
            ) : (
              <>
                <Rocket size={14} />
                <span>Confirm & Start Posting ({selectedGroupIds.size})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
