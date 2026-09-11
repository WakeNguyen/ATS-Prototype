"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Save, 
  Loader2, 
  AlertTriangle, 
  Megaphone, 
  Briefcase, 
  Calendar, 
  Layers, 
  Image as ImageIcon,
  Flame,
  Users,
  Search,
  ChevronDown,
  Zap
} from "lucide-react";
import { 
  createCampaign, 
  updateCampaign, 
  getCampaignDetail, 
  setCampaignTargetGroups,
  setCampaignAssignedAccounts,
  getSocialGroups,
  getFbAccounts
} from "../campaign_actions";
import { getJobs } from "../actions";
import DateInputField from "src/components/DateInputField";

const CAMPAIGN_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Ready", label: "Ready" },
  { value: "Running", label: "Running" },
  { value: "Paused", label: "Paused" },
  { value: "Completed", label: "Completed" },
  { value: "Failed", label: "Failed" },
  { value: "Archived", label: "Archived" }
];

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function TimeSelectInput({ value, onChange, defaultTime = "00:00" }) {
  const raw = (value || defaultTime).trim();
  const parts = raw.split(":");
  let currentHour = parts[0] ? parts[0].padStart(2, "0") : "00";
  let currentMinute = parts[1] ? parts[1].padStart(2, "0") : "00";

  if (!HOURS_24.includes(currentHour)) currentHour = "00";
  if (!MINUTES_60.includes(currentMinute)) currentMinute = "00";

  const selectClass = "px-2 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono cursor-pointer";

  return (
    <div className="flex items-center gap-1 shrink-0">
      <select
        value={currentHour}
        onChange={(e) => onChange(`${e.target.value}:${currentMinute}`)}
        className={selectClass}
        aria-label="Hour"
      >
        {HOURS_24.map((h) => (
          <option key={h} value={h} className="bg-slate-950 text-slate-200">
            {h}
          </option>
        ))}
      </select>
      <span className="text-slate-500 font-bold text-xs">:</span>
      <select
        value={currentMinute}
        onChange={(e) => onChange(`${currentHour}:${e.target.value}`)}
        className={selectClass}
        aria-label="Minute"
      >
        {MINUTES_60.map((m) => (
          <option key={m} value={m} className="bg-slate-950 text-slate-200">
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Modal dialog for Creating or Editing Campaigns (Job Posting & Warming).
 * 
 * @param {Object} props
 * @param {string|null} props.campaignId - ID to edit or null to create
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSuccess
 */
export default function CampaignEditModal({
  campaignId = null,
  isOpen,
  onClose,
  onSuccess
}) {
  const isEdit = Boolean(campaignId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [campaignType, setCampaignType] = useState("Job Posting");
  const [hasRuns, setHasRuns] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("Facebook Group");
  const [selectedJobIds, setSelectedJobIds] = useState(new Set());
  const [jobSearch, setJobSearch] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const jobDropdownRef = useRef(null);
  const [status, setStatus] = useState("Draft");
  const [content, setContent] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [targetCriteria, setTargetCriteria] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [autoRunEnabled, setAutoRunEnabled] = useState(false);
  const [autoSpinContent, setAutoSpinContent] = useState(true);
  const [allowPostWithoutJoin, setAllowPostWithoutJoin] = useState(false);
  const [targetQuota, setTargetQuota] = useState(20);

  // Dropdown options
  const [jobs, setJobs] = useState([]);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState(new Set());
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [groupSearch, setGroupSearch] = useState("");
  const [groupTotalCount, setGroupTotalCount] = useState(0);
  const groupDebounceRef = useRef(null);
  const knownGroupsRef = useRef(new Map()); // id -> full group object, tích luỹ mọi group đã từng thấy (tải mặc định + search + đã gán sẵn)

  // Union theo id: giữ object mới nhất nếu trùng, luôn giữ mọi id đã biết trước đó.
  function mergeKnownGroups(newBatch) {
    (newBatch || []).forEach((g) => knownGroupsRef.current.set(g.id, g));
    return Array.from(knownGroupsRef.current.values());
  }

  // Handle click outside to close job dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target)) {
        setIsJobDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);
    knownGroupsRef.current.clear();

    async function loadInitialData() {
      try {
        // 1. Load jobs list, available groups, and available FB accounts
        const [jobsRes, groupsRes, accountsRes] = await Promise.all([
          getJobs(),
          getSocialGroups({ pageSize: 100 }),
          getFbAccounts()
        ]);

        if (isMounted) {
          if (jobsRes?.data) setJobs(jobsRes.data);
          else if (Array.isArray(jobsRes)) setJobs(jobsRes);

          if (groupsRes?.success && groupsRes.data) {
            setAvailableGroups(mergeKnownGroups(groupsRes.data));
            setGroupTotalCount(groupsRes.totalCount || groupsRes.data.length);
          }

          if (accountsRes?.success && Array.isArray(accountsRes.data)) {
            setAvailableAccounts(accountsRes.data.filter(a => a.status === 'Active'));
          }
        }

        // 2. If edit mode, load campaign detail
        if (isEdit && campaignId) {
          const detailRes = await getCampaignDetail(campaignId);
          if (!isMounted) return;

          if (detailRes.success && detailRes.data) {
            const c = detailRes.data.campaign || detailRes.data;
            const targetGroups = detailRes.data.targetGroups || c.targetGroups || [];
            const assignedAccs = detailRes.data.assignedAccounts || c.assignedAccounts || [];
            const runs = detailRes.data.runs || [];

            setCampaignType(c.campaign_type || "Job Posting");
            setHasRuns(Array.isArray(runs) && runs.length > 0);
            setName(c.campaign_name || c.name || "");
            setChannel(c.channel || "Facebook Group");
            
            const linkedJobs = detailRes.data.campaign?.linkedJobs || detailRes.data.linkedJobs || c.linkedJobs || [];
            if (Array.isArray(linkedJobs) && linkedJobs.length > 0) {
              setSelectedJobIds(new Set(linkedJobs.map((j) => j.id)));
            } else if (c.job_ids && Array.isArray(c.job_ids) && c.job_ids.length > 0) {
              setSelectedJobIds(new Set(c.job_ids));
            } else if (c.job_id) {
              setSelectedJobIds(new Set([c.job_id]));
            } else {
              setSelectedJobIds(new Set());
            }

            setStatus(c.status || "Draft");
            setContent(c.content || "");
            setPostImageUrl(c.post_image_url || "");
            setTargetCriteria(c.target_criteria || "");
            const toDateString = (d) => {
              if (!d) return "";
              if (typeof d === "string") return d.substring(0, 10);
              if (d instanceof Date) return d.toISOString().substring(0, 10);
              return "";
            };
            setStartDate(toDateString(c.start_date));
            setEndDate(toDateString(c.end_date));
            setStartTime(c.start_time ? String(c.start_time).substring(0, 5) : "00:00");
            setEndTime(c.end_time ? String(c.end_time).substring(0, 5) : "23:59");
            setAutoRunEnabled(Boolean(c.auto_run_enabled));
            setAutoSpinContent(c.auto_spin_content !== false);
            setAllowPostWithoutJoin(Boolean(c.allow_post_without_join));
            setTargetQuota(c.target_quota || c.max_posts_per_day || 20);

            const targetIds = new Set(targetGroups.map((g) => g.id));
            setSelectedGroupIds(targetIds);
            setAvailableGroups(mergeKnownGroups(targetGroups)); // đảm bảo nhóm đã gán sẵn luôn hiện, kể cả ngoài top 100
            setSelectedAccountIds(new Set(assignedAccs.map((a) => a.id)));
          } else {
            setErrorMessage(detailRes.error || "Failed to load campaign.");
          }
        } else {
          // Reset form
          setCampaignType("Job Posting");
          setHasRuns(false);
          setName("");
          setChannel("Facebook Group");
          setSelectedJobIds(new Set());
          setJobSearch("");
          setIsJobDropdownOpen(false);
          setStatus("Draft");
          setContent("");
          setPostImageUrl("");
          setTargetCriteria("");
          setStartDate(new Date().toISOString().substring(0, 10));
          setEndDate("");
          setStartTime("00:00");
          setEndTime("23:59");
          setAutoRunEnabled(false);
          setAutoSpinContent(true);
          setAllowPostWithoutJoin(false);
          setTargetQuota(20);
          setSelectedGroupIds(new Set());
          setSelectedAccountIds(new Set());
          setGroupSearch("");
        }
      } catch (err) {
        if (isMounted) setErrorMessage(err.message || "Failed to load data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, campaignId]);

  const toggleJob = (id) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeJob = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleGroup = (id) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAccount = (id) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Campaign name is required.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const isJobPosting = campaignType === "Job Posting";
      const effectiveJobIds = isJobPosting ? Array.from(selectedJobIds) : [];

      const payload = {
        campaign_name: name.trim(),
        name: name.trim(),
        campaign_type: campaignType,
        channel: isJobPosting ? (channel.trim() || "Facebook Group") : "Facebook Group",
        job_ids: effectiveJobIds,
        job_id: effectiveJobIds[0] || null,
        status,
        content: isJobPosting ? (content.trim() || "") : "",
        post_language: "vi",
        post_image_url: isJobPosting ? (postImageUrl.trim() || null) : null,
        target_criteria: isJobPosting ? (targetCriteria.trim() || null) : null,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        start_time: isJobPosting ? (startTime || "00:00") : "00:00",
        end_time: isJobPosting ? (endTime || "23:59") : "23:59",
        auto_run_enabled: isJobPosting ? Boolean(autoRunEnabled) : false,
        is_active: status !== "Archived",
        auto_spin_content: isJobPosting ? Boolean(autoSpinContent) : false,
        allow_post_without_join: isJobPosting ? Boolean(allowPostWithoutJoin) : false,
        target_quota: isJobPosting ? (parseInt(targetQuota, 10) || 20) : null,
        max_posts_per_day: isJobPosting ? (parseInt(targetQuota, 10) || 20) : null,
        targetGroupIds: Array.from(selectedGroupIds),
        assignedAccountIds: Array.from(selectedAccountIds)
      };

      let currentCampaignId = campaignId;

      if (isEdit) {
        const updateRes = await updateCampaign(campaignId, payload);
        if (!updateRes.success) throw new Error(updateRes.error || "Failed to update campaign.");
      } else {
        const createRes = await createCampaign(payload);
        if (!createRes.success) throw new Error(createRes.error || "Failed to create campaign.");
        currentCampaignId = createRes.id || createRes.data?.id;
      }

      // Update target groups & accounts association
      if (currentCampaignId) {
        await setCampaignTargetGroups(currentCampaignId, Array.from(selectedGroupIds));
        await setCampaignAssignedAccounts(currentCampaignId, Array.from(selectedAccountIds));
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Failed to save campaign.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    groupDebounceRef.current = setTimeout(async () => {
      const res = await getSocialGroups({ search: groupSearch, pageSize: 100 });
      if (res?.success) {
        setAvailableGroups(mergeKnownGroups(res.data));
        setGroupTotalCount(res.totalCount || 0);
      }
    }, 300);
    return () => clearTimeout(groupDebounceRef.current);
  }, [groupSearch, isOpen]);

  const filteredJobs = jobs.filter((j) => {
    const title = (j.title || j.name || j.job_title || "").toLowerCase();
    const client = (j.client_name || "").toLowerCase();
    const query = jobSearch.toLowerCase().trim();
    return !query || title.includes(query) || client.includes(query);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Megaphone size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {isEdit ? "Edit Campaign" : "Create New Campaign"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure auto-post content, target Facebook groups, and job linkages.
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 size={20} className="animate-spin text-emerald-400" />
              <span>Loading campaign details...</span>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Field 1: Campaign Type Selector (FIRST FIELD) */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-950 border border-slate-800">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} className="text-emerald-400" />
                    <span>Campaign Type <span className="text-rose-400">*</span></span>
                  </span>
                  {hasRuns && (
                    <span className="text-[10px] text-amber-400 font-normal">
                      Cannot change type after runs have been executed
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      campaignType === "Job Posting"
                        ? "bg-blue-500/15 border-blue-500/50 text-blue-300 font-semibold shadow-xs"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850"
                    } ${hasRuns ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="campaign_type"
                      value="Job Posting"
                      checked={campaignType === "Job Posting"}
                      disabled={hasRuns}
                      onChange={() => setCampaignType("Job Posting")}
                      className="w-3.5 h-3.5 text-blue-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div>
                      <div className="text-xs flex items-center gap-1.5">
                        <Megaphone size={12} className="text-blue-400" />
                        <span>Job Posting</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">Publish job openings to groups</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      campaignType === "Warming"
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold shadow-xs"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850"
                    } ${hasRuns ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="campaign_type"
                      value="Warming"
                      checked={campaignType === "Warming"}
                      disabled={hasRuns}
                      onChange={() => setCampaignType("Warming")}
                      className="w-3.5 h-3.5 text-amber-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div>
                      <div className="text-xs flex items-center gap-1.5">
                        <Flame size={12} className="text-amber-400" />
                        <span>Warming &amp; Auto-Join</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">Nurture accounts &amp; join groups</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Grid Row 1: Name & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Campaign Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={campaignType === "Warming" ? "e.g. Q3 HR Account Warming & IT Groups Join" : "e.g. Senior Backend Dev Hiring Q3"}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Campaign Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs cursor-pointer"
                  >
                    {CAMPAIGN_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date/Time & End Date/Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Start Schedule</span>
                  </label>
                  <div className="flex gap-2">
                    <DateInputField
                      value={startDate}
                      onChange={(newVal) => setStartDate(newVal)}
                      placeholder="Start date..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <TimeSelectInput
                      value={startTime}
                      onChange={setStartTime}
                      defaultTime="00:00"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <Calendar size={12} />
                    <span>End Schedule</span>
                  </label>
                  <div className="flex gap-2">
                    <DateInputField
                      value={endDate}
                      onChange={(newVal) => setEndDate(newVal)}
                      placeholder="End date..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <TimeSelectInput
                      value={endTime}
                      onChange={setEndTime}
                      defaultTime="23:59"
                    />
                  </div>
                </div>
              </div>

              {/* JOB POSTING ONLY FIELDS */}
              {campaignType === "Job Posting" && (
                <>
                  {/* Grid Row: Linked Jobs & Channel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Briefcase size={12} className="text-emerald-400" />
                          <span>Linked Jobs ({selectedJobIds.size} selected)</span>
                        </span>
                        {selectedJobIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedJobIds(new Set())}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear all
                          </button>
                        )}
                      </label>

                      {/* Multi-Select Combobox Trigger */}
                      <div className="relative" ref={jobDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsJobDropdownOpen((prev) => !prev)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition-colors text-left"
                        >
                          <span className={selectedJobIds.size > 0 ? "text-slate-200 font-medium truncate pr-2" : "text-slate-500"}>
                            {selectedJobIds.size === 0
                              ? "-- Select Jobs to Link --"
                              : `${selectedJobIds.size} job${selectedJobIds.size > 1 ? "s" : ""} linked`}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-slate-400 shrink-0 transition-transform duration-150 ${
                              isJobDropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Searchable Dropdown Popover */}
                        {isJobDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/80 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <div className="p-2 border-b border-slate-800 bg-slate-950">
                              <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                  type="text"
                                  value={jobSearch}
                                  onChange={(e) => setJobSearch(e.target.value)}
                                  placeholder="Search jobs or clients..."
                                  className="w-full pl-8 pr-2.5 py-1.5 rounded bg-slate-900 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/40 p-1">
                              {filteredJobs.length === 0 ? (
                                <div className="p-3 text-center text-slate-500 text-xs">
                                  No matching jobs found.
                                </div>
                              ) : (
                                filteredJobs.map((j) => {
                                  const isChecked = selectedJobIds.has(j.id);
                                  const title = j.title || j.name || j.job_title;
                                  return (
                                    <div
                                      key={j.id}
                                      onClick={() => toggleJob(j.id)}
                                      className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer transition-colors ${
                                        isChecked
                                          ? "bg-emerald-500/10 text-emerald-300"
                                          : "hover:bg-slate-800/60 text-slate-300"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          readOnly
                                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 pointer-events-none"
                                        />
                                        <span className="truncate text-xs font-medium">{title}</span>
                                      </div>
                                      {j.client_name && (
                                        <span className="text-[10px] text-slate-500 shrink-0 font-medium ml-2 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                          {j.client_name}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Removable Selected Job Chips */}
                      {selectedJobIds.size > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Array.from(selectedJobIds).map((jid) => {
                            const jobObj = jobs.find((j) => j.id === jid);
                            const title = jobObj ? (jobObj.title || jobObj.name || jobObj.job_title) : "Job";
                            const client = jobObj?.client_name;
                            return (
                              <span
                                key={jid}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-emerald-500/30 text-emerald-300 text-[11px]"
                              >
                                <span className="truncate max-w-[180px]">
                                  {title}
                                  {client ? ` (${client})` : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => removeJob(jid, e)}
                                  className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                                  title="Remove job"
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Channel
                      </label>
                      <input
                        type="text"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        placeholder="e.g. Facebook Group"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Grid Row: Target Criteria & Max Posts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Target Criteria / Keywords
                      </label>
                      <input
                        type="text"
                        value={targetCriteria}
                        onChange={(e) => setTargetCriteria(e.target.value)}
                        placeholder="e.g. IT, Frontend, ReactJS Hanoi"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Target Quota (Tổng số nhóm mục tiêu)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={targetQuota}
                        onChange={(e) => setTargetQuota(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Tổng số nhóm campaign cần đạt. Hệ thống tự động giới hạn tối đa 18 nhóm mỗi lượt dispatch.
                      </span>
                    </div>
                  </div>

                  {/* Auto-Scheduler Recurring Dispatch Toggle */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="autoRunEnabled"
                      checked={autoRunEnabled}
                      onChange={(e) => setAutoRunEnabled(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="autoRunEnabled" className="text-[11px] text-slate-300 cursor-pointer leading-tight select-none">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <Zap size={12} />
                        Enable Auto-Scheduler (Tự động kích hoạt các lượt chạy định kỳ)
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Tự động điều phối các đợt đăng bài ngẫu nhiên cho đến khi hoàn tất Target Quota hoặc kết thúc thời gian hiệu lực.
                      </span>
                    </label>
                  </div>

                  {/* Post Content */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Post Content / JD Body
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoSpinContent}
                          onChange={(e) => setAutoSpinContent(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span>Auto-Spin Content (AI Variations)</span>
                      </label>
                    </div>
                    <textarea
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Paste the recruitment post caption or message here..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-sans"
                    />
                  </div>

                  {/* Image URL */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <ImageIcon size={12} />
                      <span>Post Image URL (Optional)</span>
                    </label>
                    <input
                      type="url"
                      value={postImageUrl}
                      onChange={(e) => setPostImageUrl(e.target.value)}
                      placeholder="https://drive.google.com/... or https://i.imgur.com/..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                    />
                  </div>

                  {/* Allow Post Without Joining Group Option */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="allowPostWithoutJoin"
                      checked={allowPostWithoutJoin}
                      onChange={(e) => setAllowPostWithoutJoin(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="allowPostWithoutJoin" className="text-[11px] text-slate-300 cursor-pointer leading-tight select-none">
                      <span className="font-semibold text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Allow posting without joining group (at own risk)
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Bypasses Facebook group membership pre-check during auto-posting. Posts directly if group allows public posting.
                      </span>
                    </label>
                  </div>
                </>
              )}

              {/* Target FB Accounts Pool (Applies to both types) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users size={12} className="text-emerald-400" />
                    <span>Target FB Accounts Pool ({selectedAccountIds.size} selected)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {selectedAccountIds.size === 0 ? "Default: All Active accounts" : `${selectedAccountIds.size} specific account(s)`}
                  </span>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 max-h-32 overflow-y-auto divide-y divide-slate-800/40">
                  {availableAccounts.length === 0 ? (
                    <div className="p-3 text-center text-slate-500 text-[11px]">
                      No active Facebook accounts available.
                    </div>
                  ) : (
                    availableAccounts.map((acc) => {
                      const isChecked = selectedAccountIds.has(acc.id);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => toggleAccount(acc.id)}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                            isChecked ? "bg-emerald-500/10 text-emerald-300" : "hover:bg-slate-900 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 pointer-events-none"
                            />
                            <span className="truncate text-xs font-medium">{acc.account_name}</span>
                            <span className="text-[10px] font-mono text-slate-500">({acc.account_ref || acc.id.slice(0, 8)})</span>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                            acc.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {acc.status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Target Groups Multi-select */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Target Social Groups ({selectedGroupIds.size} selected)
                    </label>
                    <input
                      type="text"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Search groups..."
                      className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-[11px] w-48 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Showing {availableGroups.length} of {groupTotalCount} matching groups — type to search for more.
                  </span>
                </div>

                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 max-h-40 overflow-y-auto divide-y divide-slate-800/40">
                  {availableGroups.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-[11px]">
                      No matching social groups found.
                    </div>
                  ) : (
                    availableGroups.map((g) => {
                      const isChecked = selectedGroupIds.has(g.id);
                      return (
                        <div
                          key={g.id}
                          onClick={() => toggleGroup(g.id)}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                            isChecked ? "bg-emerald-500/10 text-emerald-300" : "hover:bg-slate-900 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 pointer-events-none"
                            />
                            <span className="truncate text-xs font-medium">{g.name || g.url}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono ml-2">
                            {g.join_status || "Not Joined"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || saving}
              className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                loading || saving
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Campaign...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>{isEdit ? "Update Campaign" : "Create Campaign"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
