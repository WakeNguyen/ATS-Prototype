"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Rocket, 
  Flame, 
  Layers,
  Check
} from "lucide-react";
import { getCampaigns, bulkAssignSocialGroupsToCampaigns } from "../campaign_actions";
import { stripAccents } from "src/lib/utils";

/**
 * AssignGroupsToCampaignsModal
 * 
 * Allows users to bulk assign N selected social group URLs to one or more campaigns.
 * Features search, type filtering (Job Posting vs Warming), multi-select checkboxes,
 * and clear breakdown of newly created vs already existing associations.
 */
export default function AssignGroupsToCampaignsModal({
  isOpen,
  onClose,
  selectedGroupIds = [],
  onSuccess
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL"); // 'ALL' | 'Job Posting' | 'Warming'
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadAllCampaigns() {
      setLoading(true);
      setError(null);
      setSelectedCampaignIds(new Set());
      setSearch("");
      setTypeFilter("ALL");

      try {
        const res = await getCampaigns({});
        if (isMounted) {
          if (res.success) {
            setCampaigns(res.data || []);
          } else {
            setError(res.error || "Failed to load campaigns.");
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "An unexpected error occurred while loading campaigns.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAllCampaigns();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filtered campaigns based on search and type filter
  const filteredCampaigns = useMemo(() => {
    const q = stripAccents(search.trim());
    return campaigns.filter((c) => {
      const cName = c.campaign_name || c.name || "";
      const matchSearch =
        !q ||
        stripAccents(cName).includes(q) ||
        stripAccents(c.channel || "").includes(q) ||
        stripAccents(c.job_title || "").includes(q);

      const matchType =
        typeFilter === "ALL" || (c.campaign_type || "Job Posting") === typeFilter;

      return matchSearch && matchType;
    });
  }, [campaigns, search, typeFilter]);

  const toggleCampaign = (id) => {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      filteredCampaigns.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedCampaignIds(new Set());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedCampaignIds.size === 0 || selectedGroupIds.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await bulkAssignSocialGroupsToCampaigns(
        selectedGroupIds,
        Array.from(selectedCampaignIds)
      );

      if (res.success) {
        if (onSuccess) {
          onSuccess({
            ...res,
            campaignCount: selectedCampaignIds.size,
            groupCount: selectedGroupIds.length,
          });
        }
        onClose();
      } else {
        setError(res.error || "Failed to assign groups to campaigns.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Assign Groups to Campaigns
              </h3>
              <p className="text-[11px] text-slate-400">
                Assigning <span className="text-emerald-400 font-semibold">{selectedGroupIds.length}</span> selected social group(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter campaigns by name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setTypeFilter("ALL")}
              className={`px-2.5 py-1 rounded text-[11px] transition-all font-medium ${
                typeFilter === "ALL"
                  ? "bg-slate-800 text-emerald-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("Job Posting")}
              className={`px-2.5 py-1 rounded text-[11px] transition-all flex items-center gap-1 font-medium ${
                typeFilter === "Job Posting"
                  ? "bg-slate-800 text-sky-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Rocket size={10} />
              <span>Job Posting</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("Warming")}
              className={`px-2.5 py-1 rounded text-[11px] transition-all flex items-center gap-1 font-medium ${
                typeFilter === "Warming"
                  ? "bg-slate-800 text-amber-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Flame size={10} />
              <span>Warming</span>
            </button>
          </div>
        </div>

        {/* Quick Selection Toolbar */}
        <div className="px-6 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            {selectedCampaignIds.size} of {campaigns.length} campaign(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              Select All Visible ({filteredCampaigns.length})
            </button>
            {selectedCampaignIds.size > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Selection
                </button>
              </>
            )}
          </div>
        </div>

        {/* Campaign List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1.5 min-h-[200px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span className="text-xs">Loading campaigns...</span>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No campaigns found matching the filter criteria.
            </div>
          ) : (
            filteredCampaigns.map((c) => {
              const isChecked = selectedCampaignIds.has(c.id);
              const isWarming = c.campaign_type === "Warming";

              return (
                <div
                  key={c.id}
                  onClick={() => toggleCampaign(c.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? "bg-slate-800/80 border-emerald-500/50 shadow-sm"
                      : "bg-slate-950/40 border-slate-800/70 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCampaign(c.id)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-xs truncate">
                          {c.campaign_name || c.name}
                        </span>
                        {/* Type Badge */}
                        {isWarming ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                            <Flame size={9} />
                            <span>Warming</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                            <Rocket size={9} />
                            <span>Job Posting</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{c.channel || "Facebook Group"}</span>
                        <span>•</span>
                        <span>
                          Current Groups:{" "}
                          <span className="text-slate-300 font-mono">
                            {c.target_groups_count ?? c.target_group_count ?? 0}
                          </span>
                        </span>
                        {c.job_title && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[160px]">
                              Job: {c.job_title}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        c.status === "Running"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : c.status === "Ready"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {c.status || "Draft"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="text-[11px] text-slate-400">
            {selectedCampaignIds.size > 0 ? (
              <span>
                Assigning to{" "}
                <span className="text-emerald-400 font-bold">
                  {selectedCampaignIds.size}
                </span>{" "}
                campaign(s)
              </span>
            ) : (
              <span>Select at least 1 campaign to proceed</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedCampaignIds.size === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>
                    Assign to {selectedCampaignIds.size} Campaign{selectedCampaignIds.size > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
