"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  X, 
  Save, 
  Loader2, 
  AlertTriangle, 
  Shield, 
  Lock, 
  Check, 
  Layers, 
  ExternalLink,
  Users,
  Search,
  ListChecks,
  Filter,
  CheckCircle2,
  Tag
} from "lucide-react";
import { 
  createFbAccount, 
  updateFbAccount, 
  getFbAccountDetail, 
  setFbAccountGroups,
  getSocialGroups,
  getSocialGroupIdsMatchingFilter,
  getAllTagOptions
} from "../campaign_actions";
import GroupTypeTagEditor from "./GroupTypeTagEditor";
import JoinStatusBadge from "./JoinStatusBadge";
import { stripAccents } from "src/lib/utils";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "Cooldown", label: "Cooldown", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  { value: "Restricted", label: "Restricted", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "Checkpoint", label: "Checkpoint", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  { value: "Inactive", label: "Inactive", color: "text-slate-400 bg-slate-800 border-slate-700" }
];

function formatMemberCount(num) {
  if (!num || isNaN(num)) return null;
  const n = Number(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

/**
 * Modal dialog for Creating or Editing Facebook Accounts with encrypted credentials
 * and advanced joined group management.
 * 
 * @param {Object} props
 * @param {string|null} props.accountId - ID to edit, or null for new account
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 */
export default function FbAccountEditModal({
  accountId = null,
  isOpen,
  onClose,
  onSuccess
}) {
  const isEdit = Boolean(accountId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [name, setName] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [fbProfileUrl, setFbProfileUrl] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [dailyQuota, setDailyQuota] = useState(5);
  const [status, setStatus] = useState("Active");
  const [allowPostWithoutJoin, setAllowPostWithoutJoin] = useState(false);
  const [notes, setNotes] = useState("");

  // Joined Groups multi-select & filter state
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [groupTotalCount, setGroupTotalCount] = useState(0);
  const [allKnownTags, setAllKnownTags] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  const groupDebounceRef = useRef(null);
  const knownGroupsRef = useRef(new Map()); // id -> full group object

  function mergeKnownGroups(newBatch) {
    (newBatch || []).forEach((g) => {
      if (g && g.id) {
        knownGroupsRef.current.set(g.id, {
          ...(knownGroupsRef.current.get(g.id) || {}),
          ...g
        });
      }
    });
    return Array.from(knownGroupsRef.current.values());
  }

  // Fetch groups based on current search and tag filters
  const fetchGroups = useCallback(async (searchVal, tagFilters, onlySelected) => {
    setLoadingGroups(true);
    try {
      if (onlySelected) {
        const selIds = Array.from(selectedGroupIds);
        if (selIds.length === 0) {
          setAvailableGroups([]);
          setGroupTotalCount(0);
          return;
        }
        const res = await getSocialGroups({
          ids: selIds,
          search: searchVal,
          tagFilters: Array.from(tagFilters),
          pageSize: 200
        });
        if (res?.success) {
          setAvailableGroups(res.data || []);
          setGroupTotalCount(res.totalCount || (res.data || []).length);
        }
      } else {
        const res = await getSocialGroups({
          search: searchVal,
          tagFilters: Array.from(tagFilters),
          pageSize: 150
        });
        if (res?.success) {
          setAvailableGroups(mergeKnownGroups(res.data || []));
          setGroupTotalCount(res.totalCount || (res.data || []).length);
        }
      }
    } catch (err) {
      console.error("Error fetching social groups for account modal:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, [selectedGroupIds]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);
    knownGroupsRef.current.clear();
    setShowOnlySelected(false);
    setSelectedTagFilters(new Set());
    setGroupSearch("");

    async function loadData() {
      try {
        const [groupsRes, tagsRes] = await Promise.all([
          getSocialGroups({ pageSize: 150 }),
          getAllTagOptions()
        ]);

        if (isMounted) {
          if (tagsRes?.success && tagsRes.data) {
            setAllKnownTags(tagsRes.data);
          }
          if (groupsRes?.success && groupsRes.data) {
            setAvailableGroups(mergeKnownGroups(groupsRes.data));
            setGroupTotalCount(groupsRes.totalCount || groupsRes.data.length);
          }
        }

        if (isEdit && accountId) {
          const detailRes = await getFbAccountDetail(accountId);
          if (!isMounted) return;

          if (detailRes.success && detailRes.data) {
            const acc = detailRes.data;
            setName(acc.account_name || acc.name || "");
            setAccountRef(acc.account_ref || "");
            setFbProfileUrl(acc.fb_profile_url || "");
            setProxyUrl(acc.proxy_url || "");
            setDailyQuota(acc.daily_quota || 5);
            setStatus(acc.status || "Active");
            setAllowPostWithoutJoin(Boolean(acc.allow_post_without_join));
            setNotes(acc.notes || "");

            const joinedGroups = acc.joinedGroups || [];
            const joinedIds = new Set(joinedGroups.map((g) => g.id));
            setSelectedGroupIds(joinedIds);
            setAvailableGroups(mergeKnownGroups(joinedGroups));
          } else {
            setErrorMessage(detailRes.error || "Failed to load account details.");
          }
        } else {
          setName("");
          setAccountRef(`acc_${Date.now().toString().slice(-4)}`);
          setFbProfileUrl("");
          setProxyUrl("");
          setDailyQuota(5);
          setStatus("Active");
          setAllowPostWithoutJoin(false);
          setNotes("");
          setSelectedGroupIds(new Set());
        }
      } catch (err) {
        if (isMounted) setErrorMessage(err.message || "Failed to load data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, accountId, isEdit]);

  // Debounced search & tag filter effect
  useEffect(() => {
    if (!isOpen || loading) return;
    if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    groupDebounceRef.current = setTimeout(() => {
      fetchGroups(groupSearch, selectedTagFilters, showOnlySelected);
    }, 250);
    return () => clearTimeout(groupDebounceRef.current);
  }, [groupSearch, selectedTagFilters, showOnlySelected, isOpen, loading, fetchGroups]);

  const toggleGroup = (groupId) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleTagFilter = (tag) => {
    setSelectedTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearAllTagFilters = () => {
    setSelectedTagFilters(new Set());
  };

  const handleSelectAllFiltered = async () => {
    try {
      const res = await getSocialGroupIdsMatchingFilter({
        search: groupSearch,
        tagFilters: Array.from(selectedTagFilters)
      });
      if (res.success && Array.isArray(res.ids)) {
        setSelectedGroupIds((prev) => {
          const next = new Set(prev);
          res.ids.forEach((id) => next.add(id));
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to select all filtered groups:", err);
    }
  };

  const handleDeselectAllFiltered = async () => {
    try {
      const res = await getSocialGroupIdsMatchingFilter({
        search: groupSearch,
        tagFilters: Array.from(selectedTagFilters)
      });
      if (res.success && Array.isArray(res.ids)) {
        setSelectedGroupIds((prev) => {
          const next = new Set(prev);
          res.ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to deselect all filtered groups:", err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Account Name is required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        account_name: name.trim(),
        name: name.trim(),
        account_ref: accountRef.trim() || undefined,
        fb_profile_url: fbProfileUrl.trim() || "",
        proxy_url: proxyUrl.trim() || "",
        daily_quota: parseInt(dailyQuota, 10) || 5,
        status,
        allow_post_without_join: Boolean(allowPostWithoutJoin),
        notes: notes.trim() || "",
        joinedGroupIds: Array.from(selectedGroupIds)
      };

      let currentAccountId = accountId;

      if (isEdit) {
        const updateRes = await updateFbAccount(accountId, payload);
        if (!updateRes.success) throw new Error(updateRes.error || "Failed to update account.");
      } else {
        const createRes = await createFbAccount(payload);
        if (!createRes.success) throw new Error(createRes.error || "Failed to create account.");
        currentAccountId = createRes.data?.id;
      }

      // Update joined groups mapping
      if (currentAccountId) {
        await setFbAccountGroups(currentAccountId, Array.from(selectedGroupIds));
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Failed to save Facebook account.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Visible groups filter for rendering
  const visibleGroups = showOnlySelected
    ? availableGroups.filter((g) => selectedGroupIds.has(g.id))
    : availableGroups;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{isEdit ? "Edit Facebook Account" : "Add Facebook Account"}</span>
                {isEdit && accountRef && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-normal">
                    {accountRef}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure account credentials, proxies, daily quota, and joined Facebook groups pool.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
              <span>Loading account configuration...</span>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2.5">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Section 1: Account Core Credentials */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={13} className="text-emerald-400" />
                  <span>Account Identity & Status</span>
                </div>

                {/* Row 1: Name & Ref */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Account Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Account Nick 01"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Account Ref (Code)
                      </label>
                      {isEdit && (
                        <span className="text-[10px] text-amber-400 font-mono">
                          Locked (VPS Session Folder)
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={accountRef}
                      onChange={(e) => !isEdit && setAccountRef(e.target.value)}
                      readOnly={isEdit}
                      placeholder="e.g. acc_01"
                      className={`w-full px-3 py-2 rounded-lg border font-mono text-xs transition-colors ${
                        isEdit
                          ? "bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed select-none"
                          : "bg-slate-900 border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500"
                      }`}
                    />
                    {isEdit && (
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Corresponds to the physical Playwright session directory on VPS.
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2: Status & Quota */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Account Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Daily Post Quota (Max posts/day)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Recommended: 5 - 20 / day
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={dailyQuota}
                      onChange={(e) => setDailyQuota(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* FB Profile URL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Facebook Profile URL
                  </label>
                  <input
                    type="url"
                    value={fbProfileUrl}
                    onChange={(e) => setFbProfileUrl(e.target.value)}
                    placeholder="https://facebook.com/profile.php?id=..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                  />
                </div>

                {/* Proxy URL */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>4G / Rotating Proxy URL</span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-normal bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <Lock size={10} />
                        AES-256-GCM Encrypted
                      </span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="http://username:password@ip.mproxy.vn:12167"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    Proxy credentials are encrypted at rest in Supabase and decrypted strictly on-demand during batch execution.
                  </p>
                </div>

                {/* Allow Post Without Join Toggle Card */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    id="allow_post_without_join_acc"
                    checked={allowPostWithoutJoin}
                    onChange={(e) => setAllowPostWithoutJoin(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                  />
                  <label htmlFor="allow_post_without_join_acc" className="cursor-pointer space-y-1 select-none flex-1">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <span>Allow posting without joining group (at own risk)</span>
                      {allowPostWithoutJoin && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Direct Post Enabled
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      When enabled, this account will attempt to post directly to target groups even if it has not joined them yet. Public groups allow direct posting; closed groups may reject or require membership approval.
                    </p>
                  </label>
                </div>

                {/* Notes / 2FA / Password */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Account Notes &amp; 2FA Seed</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-normal bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <Lock size={10} />
                      AES-256-GCM Encrypted
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Password, 2FA secret key, UID, or session notes..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Section 2: Joined Facebook Groups Table */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-emerald-400" />
                    <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                      Joined Facebook Groups
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {selectedGroupIds.size} Selected
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Showing {visibleGroups.length} of {groupTotalCount} matching groups
                  </div>
                </div>

                {/* Search & Tag Filter Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                      <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
                      <input
                        type="text"
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        placeholder="Search by group name or URL..."
                        className="w-full pl-8 pr-3 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-[11px] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Toggle: Only Selected */}
                    <button
                      type="button"
                      onClick={() => setShowOnlySelected((v) => !v)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors shrink-0 cursor-pointer ${
                        showOnlySelected
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                      title="Show only groups assigned to this account"
                    >
                      <ListChecks size={12} />
                      <span>Only Selected ({selectedGroupIds.size})</span>
                    </button>

                    {/* Tag Filter Bar */}
                    {allKnownTags.length > 0 && (
                      <div className="overflow-x-auto max-w-md">
                        <GroupTypeTagEditor
                          mode="filter"
                          allKnownTags={allKnownTags}
                          selectedTags={selectedTagFilters}
                          onToggleTag={toggleTagFilter}
                          onClearAll={clearAllTagFilters}
                        />
                      </div>
                    )}
                  </div>

                  {/* Bulk Select Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      disabled={showOnlySelected}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                      title="Select all groups matching current filters"
                    >
                      Select All ({groupTotalCount})
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAllFiltered}
                      className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] border border-slate-800 transition-colors cursor-pointer"
                      title="Deselect all groups matching current filters"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Rich Groups Table */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3">Group Name</th>
                        <th className="py-2.5 px-3 text-center">Members</th>
                        <th className="py-2.5 px-3">Tags</th>
                        <th className="py-2.5 px-3">Join Status</th>
                        <th className="py-2.5 px-3 text-right">Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {loadingGroups ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-500">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 size={15} className="animate-spin text-emerald-400" />
                              <span>Loading groups...</span>
                            </div>
                          </td>
                        </tr>
                      ) : visibleGroups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No social groups matched the current search or filters.
                          </td>
                        </tr>
                      ) : (
                        visibleGroups.map((g) => {
                          const isChecked = selectedGroupIds.has(g.id);
                          const tags = Array.isArray(g.group_type)
                            ? g.group_type
                            : typeof g.group_type === "string"
                            ? g.group_type.split(",").map((t) => t.trim()).filter(Boolean)
                            : [];

                          return (
                            <tr
                              key={g.id}
                              onClick={() => toggleGroup(g.id)}
                              className={`cursor-pointer transition-colors ${
                                isChecked ? "bg-emerald-500/10 text-emerald-200" : "hover:bg-slate-900/60 text-slate-300"
                              }`}
                            >
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleGroup(g.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                                />
                              </td>
                              <td className="py-2 px-3 font-medium">
                                <div className="flex flex-col">
                                  <span className="text-slate-100 text-xs font-semibold">{g.name || g.url}</span>
                                  {g.url && (
                                    <span className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                                      {g.url}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                {g.member_count ? (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                    👥 {formatMemberCount(g.member_count)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {tags.length > 0 ? (
                                    tags.map((t) => (
                                      <span
                                        key={t}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
                                      >
                                        {t}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-600 text-[10px]">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  g.join_status === 'Joined'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : g.join_status === 'Pending'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {g.join_status || "Not Joined"}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                {g.url && (
                                  <a
                                    href={g.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-emerald-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                                    title="Open Facebook group URL in new tab"
                                  >
                                    <span>Open</span>
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || saving}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                loading || saving
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 active:scale-98"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving Account...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{isEdit ? "Update Account" : "Create Account"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

