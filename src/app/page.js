"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActivityLogPanel from "src/components/ActivityLogPanel";
import DateInputField from "src/components/DateInputField";
import { stripAccents } from "src/lib/utils";
import { CANDIDATE_STAGES_LIST, SOURCE_CHANNELS_LIST } from "src/constants/enums";
import { 
  getActionMenuData, 
  getActivityLogs, 
  updateApplicationAction, 
  addActivityLog,
  updateActivityLog,
  deleteActivityLog,
  getJobs,
  getClients 
} from "./actions";
import { 
  Search, 
  RotateCcw, 
  FileSpreadsheet, 
  Plus, 
  Loader2, 
  Check, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Save,
  MessageSquare,
  Send,
  Clock,
  UserPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  Pin,
  PinOff
} from "lucide-react";
import AttachCandidateModal from "../components/AttachCandidateModal";

// Searchable Combobox Dropdown with Real-time Search Input & Persistent Typing
function SearchableFilterDropdown({
  value,
  options,
  onChange,
  allLabel = "All",
  placeholder = "Search...",
  maxWidth = "max-w-[200px]"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Filter options based on typed query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = stripAccents(search);
    return options.filter(opt => stripAccents(opt.label || "").includes(q));
  }, [options, search]);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = value === "ALL" || !selectedOption 
    ? allLabel 
    : selectedOption.label;

  const isSelected = value !== "ALL";

  return (
    <div className={`relative ${maxWidth}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={`w-full px-2.5 py-1 text-xs font-semibold rounded border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
          isSelected 
            ? "bg-slate-900 border-emerald-500 text-emerald-300 shadow-xs ring-1 ring-emerald-500/50" 
            : "bg-slate-950 hover:bg-slate-900 border-slate-700 text-slate-200"
        }`}
        title={displayLabel}
      >
        <span className="truncate text-left flex-1">{displayLabel}</span>
        {isSelected ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("ALL");
            }}
            className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded p-0.5"
            title="Clear filter"
          >
            ✕
          </span>
        ) : (
          <ChevronDown size={13} className="text-slate-400 shrink-0" />
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden text-xs">
          {/* Search Input Bar (Real-time typed query) */}
          <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-500 hover:text-slate-300 text-[11px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto scrollbar-thin p-1 space-y-0.5">
            {!search && (
              <div
                onClick={() => {
                  onChange("ALL");
                  setIsOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded cursor-pointer flex items-center justify-between transition-colors ${
                  value === "ALL" 
                    ? "bg-emerald-950 text-emerald-300 font-bold" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{allLabel}</span>
                {value === "ALL" && <Check size={12} className="text-emerald-400" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-slate-500 italic text-[11px]">
                No matching results found for "{search}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const active = value === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`px-2.5 py-1.5 rounded cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      active 
                        ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-950/80 px-1.5 py-0.2 rounded border border-slate-800">
                          {opt.count}
                        </span>
                      )}
                      {active && <Check size={12} className="text-emerald-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer stats */}
          <div className="px-2.5 py-1 bg-slate-950 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between">
            <span>{filteredOptions.length} of {options.length} options</span>
            {search && <span className="text-emerald-400">Filtering</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to strip HTML tags from notes
function stripHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/<(br|br\/|\/p|\/div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Stage normalization & UI helpers
function normalizeStage(stage) {
  if (!stage) return "Talent Mapping";
  const s = String(stage).trim();
  
  const standard = [
    "Received CV", "Talent Mapping", "Contact", "Waiting for CV",
    "Send CV To AH/Client", "Sending Test", "Submit Test", "1st Interview", 
    "2nd Interview", "Additional Interview", "Final Interview", "Feedback", "Chasing Feedback", "Offer", "Onboard", 
    "Rejected", "Failed Interview", "Reject Offer", "Withdraw Interview Process"
  ];

  if (standard.includes(s)) return s;

  const lower = s.toLowerCase();
  if (lower.includes("chasing")) return "Chasing Feedback";
  if (lower.includes("additional")) return "Additional Interview";
  if (lower.includes("call") || lower.includes("reach") || lower.includes("touch") || lower.includes("screen") || lower.includes("data") || lower.includes("contact")) {
    return "Contact";
  }
  if (lower.includes("1st")) return "1st Interview";
  if (lower.includes("2nd")) return "2nd Interview";
  if (lower.includes("final")) return "Final Interview";
  if (lower.includes("offer") && lower.includes("reject")) return "Reject Offer";
  if (lower.includes("offer")) return "Offer";
  if (lower.includes("reject")) return "Rejected";
  if (lower.includes("fail")) return "Failed Interview";
  if (lower.includes("withdraw")) return "Withdraw Interview Process";
  if (lower.includes("send cv") || lower.includes("client") || lower.includes("lead")) return "Send CV To AH/Client";
  if (lower.includes("test")) return "Sending Test";
  if (lower.includes("feedback")) return "Feedback";
  if (lower.includes("onboard")) return "Onboard";
  if (lower.includes("wait")) return "Waiting for CV";
  if (lower.includes("received")) return "Received CV";

  return "Contact";
}

function getStageBadgeLabel(stage) {
  const norm = normalizeStage(stage);
  if (norm === "Contact") return "Contact / Reach Out";
  if (norm === "Send CV To AH/Client") return "Send CV to Client";
  if (norm === "Withdraw Interview Process") return "Withdraw Process";
  return norm;
}

function getStageBadgeClass(stage) {
  const norm = normalizeStage(stage);
  if (norm.includes("Offer") || norm.includes("Onboard")) {
    return "bg-emerald-950/90 text-emerald-300 border-emerald-800";
  }
  if (norm.includes("Interview") || norm.includes("interview")) {
    return "bg-amber-950/90 text-amber-300 border-amber-800";
  }
  if (norm.includes("Test")) {
    return "bg-purple-950/90 text-purple-300 border-purple-800";
  }
  if (norm.includes("Feedback") || norm.includes("Chasing")) {
    return "bg-cyan-950/90 text-cyan-300 border-cyan-800";
  }
  if (norm.includes("Reject") || norm.includes("Failed")) {
    return "bg-rose-950/90 text-rose-300 border-rose-800";
  }
  if (norm.includes("Contact") || norm.includes("Reach") || norm.includes("Received") || norm.includes("Send CV") || norm.includes("Waiting")) {
    return "bg-blue-950/90 text-blue-300 border-blue-800";
  }
  return "bg-slate-900 text-slate-300 border-slate-700";
}

export default function ActionMenuPage() {
  const router = useRouter();

  // Main Data States
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);

  // Race condition guard for selecting rows
  const selectRowSequenceRef = useRef(0);

  // Auto-slide Action Notes Detail on Scroll
  const [isDetailVisible, setIsDetailVisible] = useState(true);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [autoSlideEnabled, setAutoSlideEnabled] = useState(true);
  const scrollTimeoutRef = useRef(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("In progress");
  const [passiveFilter, setPassiveFilter] = useState("ALL");
  const [jobFilter, setJobFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [planningDateSort, setPlanningDateSort] = useState('desc'); // null | 'desc' | 'asc' — default: mới nhất trước

  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 80;
  const [totalApps, setTotalApps] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Loading & Saving States
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [savingField, setSavingField] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [savingNewLog, setSavingNewLog] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Large Note State for Selected App
  const [currentNote, setCurrentNote] = useState("");


  const [savingEditLog, setSavingEditLog] = useState(false);

  // Attach Candidate Modal state
  const [isAttachCandidateOpen, setIsAttachCandidateOpen] = useState(false);

  function handleCandidateAttached(newApp) {
    notify("Đã gán ứng viên vào Job Order thành công!");
    fetchApplications();
  }

  function toggleAutoSlide() {
    setAutoSlideEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("ats_action_menu_auto_slide_enabled", String(next));
      return next;
    });
  }

  // Tự động kéo xuống khi người dùng chủ động lăn chuột & trồi lên sau 1.8s dừng lăn (Ngăn chặn vòng lặp resize-scroll)
  function handleMasterWheel(e) {
    if (Math.abs(e.deltaY) < 6) return;
    
    setIsDetailVisible(false);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (autoSlideEnabled) setIsDetailVisible(true);
    }, 1800);
  }

  // Load saved Auto-slide preference
  useEffect(() => {
    const saved = localStorage.getItem("ats_action_menu_auto_slide_enabled");
    if (saved === "false") setAutoSlideEnabled(false);
  }, []);

  // 1. Initial Dropdowns Load
  useEffect(() => {
    async function loadDropdowns() {
      const [jobsRes, clientsRes] = await Promise.all([
        getJobs(),
        getClients()
      ]);
      if (jobsRes.success) setJobs(jobsRes.data);
      if (clientsRes.success) setClients(clientsRes.data);
    }
    loadDropdowns();
  }, []);

  async function fetchApplications() {
    const res = await getActionMenuData({
      searchTerm,
      status: statusFilter,
      isPassive: passiveFilter,
      client: clientFilter,
      jobId: jobFilter,
      page,
      pageSize,
      sortBy: planningDateSort ? "planning_date" : null,
      sortDir: planningDateSort || "desc"
    });

    if (res.success) {
      setApplications(res.data || []);
      setTotalApps(res.totalCount || 0);
      if (res.data?.length > 0) {
        selectRow(res.data[0]);
      } else {
        selectRowSequenceRef.current++;
        setSelectedAppId(null);
        setActivityLogs([]);
      }
    }
    setLoading(false);
    setIsSearching(false);
  }

  // 2. Debounced Backend Search & Filter with Pagination
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(fetchApplications, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, passiveFilter, clientFilter, jobFilter, page, planningDateSort]);

  // 2. Select a row in the master table
  async function selectRow(app) {
    setSelectedAppId(app.application_id);
    
    // Increment sequence guard
    const currentSeq = ++selectRowSequenceRef.current;
    
    // Load Activity Logs
    setLogsLoading(true);
    const res = await getActivityLogs(app.application_id);
    
    // Ignore stale requests
    if (currentSeq !== selectRowSequenceRef.current) return;
    
    if (res.success) {
      setActivityLogs(res.data);
    }
    setLogsLoading(false);
  }

  // Currently selected application object
  const selectedApp = useMemo(() => {
    return applications.find(a => a.application_id === selectedAppId) || applications[0] || null;
  }, [applications, selectedAppId]);

  // Selected Row Index
  const selectedIndex = useMemo(() => {
    return applications.findIndex(a => a.application_id === selectedAppId);
  }, [applications, selectedAppId]);

  function notify(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  // 3. Inline Update for Master Row Fields
  async function handleInlineUpdate(applicationId, field, value) {
    setSavingField(`${applicationId}-${field}`);
    
    // Store snapshot for rollback
    const prevApps = applications;
    
    // Optimistic Update
    setApplications(prev => prev.map(a => {
      if (a.application_id === applicationId) {
        return { ...a, [field]: value };
      }
      return a;
    }));

    const updatePayload = { [field]: value };
    const res = await updateApplicationAction(applicationId, updatePayload);
    
    if (res.success) {
      notify(`Đã cập nhật ${field}`);
      if (field === "status") {
        if (statusFilter !== "ALL" && value !== statusFilter) {
          setApplications(prev => prev.filter(a => a.application_id !== applicationId));
        }
        // Luôn chuyển Interview & Activity Timeline sang đúng dòng vừa đổi status ("theo con trỏ"),
        // bất kể dòng đó trước đó có đang được chọn hay không.
        setTimeout(() => {
          selectRow({ application_id: applicationId });
        }, 0);
      } else if (field === "planning_date") {
        setApplications(prev => {
          const dir = planningDateSort || "desc";
          return [...prev].sort((a, b) => {
            const ta = a.planning_date ? new Date(a.planning_date).getTime() : null;
            const tb = b.planning_date ? new Date(b.planning_date).getTime() : null;
            if (ta === null && tb === null) return 0;
            if (ta === null) return 1;
            if (tb === null) return -1;
            return dir === "asc" ? ta - tb : tb - ta;
          });
        });
      }
    } else {
      notify("Lỗi: " + res.error);
      // Rollback
      setApplications(prevApps);
    }
    setSavingField(null);
  }

  // 4. Save Large Note
  async function handleSaveNote() {
    if (!selectedApp) return;
    setSavingNote(true);
    const res = await updateApplicationAction(selectedApp.application_id, {
      note: currentNote
    });
    if (res.success) {
      notify("Đã lưu ghi chú thành công!");
      setApplications(prev => prev.map(a => 
        a.application_id === selectedApp.application_id ? { ...a, application_note: currentNote } : a
      ));
    } else {
      notify("Lỗi lưu ghi chú: " + res.error);
    }
    setSavingNote(false);
  }

  // Đồng bộ lại current_stage/result/reason_failed/note_failure_reason ở state `applications`
  // từ log MỚI NHẤT trong danh sách `logs` vừa refetch. `logs` phải đến từ getActivityLogs()
  // (ORDER BY action_date DESC, created_time DESC) — CÙNG thứ tự server dùng để auto-sync
  // (xem actions.js: addActivityLog/updateActivityLog/deleteActivityLog), nên logs[0] luôn khớp
  // với những gì server vừa lưu vào bảng `activity`. Không tự đoán/optimistic — luôn refetch trước
  // khi gọi hàm này.
  function syncApplicationFromLogs(applicationId, logs) {
    setApplications(prev => prev.map(a => {
      if (a.application_id !== applicationId) return a;
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

  // 5. Add New Action Note (qua ActivityLogPanel dùng chung)
  async function handleAddNewLog(applicationId, logData) {
    if (!applicationId) return { success: false, error: "Missing application" };
    const stage = logData?.action_type || "Contact";
    const note = (logData?.note || "").trim();
    if (!note) return { success: false, error: "Empty note" };

    const seqAtStart = selectRowSequenceRef.current;

    setSavingNewLog(true);
    try {
      const res = await addActivityLog({
        application_id: applicationId,
        action_type: stage,
        note,
        result: logData?.result,
        reason_failed: logData?.reason_failed,
      });
      if (res.success) {
        notify("Đã lưu bước Action Note mới!");
        const logsRes = await getActivityLogs(applicationId);
        if (logsRes.success) {
          if (seqAtStart === selectRowSequenceRef.current) {
            setActivityLogs(logsRes.data);
          }
          syncApplicationFromLogs(applicationId, logsRes.data);
        }
      } else {
        notify("Lỗi: " + res.error);
      }
      return res;
    } finally {
      setSavingNewLog(false);
    }
  }

  // 6. Edit an Action Note (qua ActivityLogPanel dùng chung)
  async function handleEditLog(applicationId, logId, logData) {
    if (!applicationId || !logId) return { success: false, error: "Missing IDs" };

    const seqAtStart = selectRowSequenceRef.current;

    setSavingEditLog(true);
    try {
      const res = await updateActivityLog(logId, applicationId, logData);
      if (res.success) {
        notify("Đã cập nhật Action Note thành công!");
        const logsRes = await getActivityLogs(applicationId);
        if (logsRes.success) {
          if (seqAtStart === selectRowSequenceRef.current) {
            setActivityLogs(logsRes.data);
          }
          syncApplicationFromLogs(applicationId, logsRes.data);
        }
      } else {
        notify("Lỗi cập nhật: " + res.error);
      }
      return res;
    } finally {
      setSavingEditLog(false);
    }
  }

  // 7. Delete an Action Note (qua ActivityLogPanel dùng chung)
  async function handleDeleteLog(applicationId, logId) {
    if (!applicationId || !logId) return { success: false, error: "Missing IDs" };

    const seqAtStart = selectRowSequenceRef.current;

    const res = await deleteActivityLog(logId, applicationId);
    if (res.success) {
      notify("Đã xóa dòng Action Note");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        if (seqAtStart === selectRowSequenceRef.current) {
          setActivityLogs(logsRes.data);
        }
        syncApplicationFromLogs(applicationId, logsRes.data);
      }
    } else {
      notify("Lỗi xóa: " + res.error);
    }
    return res;
  }

  // 7. Navigate Records via Footer Arrows
  function navigateRecord(direction) {
    if (applications.length === 0) return;
    let newIndex = selectedIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= applications.length) newIndex = applications.length - 1;
    selectRow(applications[newIndex]);
  }

  // Pagination Helpers
  const totalPages = Math.max(1, Math.ceil(totalApps / pageSize));

  function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function handlePlanningDateSortToggle() {
    setPage(1);
    setPlanningDateSort(prev => {
      if (prev === null) return "desc";
      if (prev === "desc") return "asc";
      return null;
    });
  }

  // 7. Clear Filters
  function handleClear() {
    setSearchTerm("");
    setStatusFilter("In progress");
    setPassiveFilter("ALL");
    setJobFilter("ALL");
    setClientFilter("ALL");
    setPlanningDateSort(null);
    setPage(1);
  }

  // Searchable Options for Dropdowns
  const clientOptions = useMemo(() => {
    return clients.map(c => ({
      value: c.client_name,
      label: c.client_name,
    }));
  }, [clients]);

  // Positions/Jobs dynamically filtered by selected Client
  const availableJobs = useMemo(() => {
    if (clientFilter === "ALL") return jobs;
    return jobs.filter(j => j.client_name === clientFilter);
  }, [jobs, clientFilter]);

  const jobOptions = useMemo(() => {
    return availableJobs.map(j => ({
      value: j.job_id,
      label: j.job_title,
      count: j.candidate_count
    }));
  }, [availableJobs]);

  // Cascading Client Filter change with automatic Position validation
  function handleClientFilterChange(newClient) {
    setClientFilter(newClient);
    if (newClient !== "ALL" && jobFilter !== "ALL") {
      const currentJob = jobs.find(j => j.job_id === jobFilter);
      if (currentJob && currentJob.client_name !== newClient) {
        setJobFilter("ALL");
      }
    }
    setPage(1);
  }

  function handleJobFilterChange(newJob) {
    setJobFilter(newJob);
    setPage(1);
  }

  function handleStatusFilterChange(newStatus) {
    setStatusFilter(newStatus);
    setPage(1);
  }

  function handlePassiveFilterChange(newPassive) {
    setPassiveFilter(newPassive);
    setPage(1);
  }

  function handleSearchChange(e) {
    setSearchTerm(e.target.value);
    setPage(1);
  }

  // Filtered Applications (Directly from backend search)
  const filteredApps = applications;

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full max-h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* TOAST ALERT */}
      {toastMsg && (
        <div className="fixed top-14 right-6 z-50 px-4 py-2 rounded-lg bg-slate-900 text-emerald-400 border border-emerald-500 shadow-2xl text-xs font-bold animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* TOOLBAR: SEARCH & FILTERS (DARK MODE & ENGLISH) */}
      <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left: Excel icon + Search Field + Clear Button */}
        <div className="flex items-center space-x-3">
          <button 
            className="w-8 h-8 rounded bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center shadow transition-all cursor-pointer" 
            title="Export / Refresh"
          >
            <FileSpreadsheet size={16} />
          </button>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-400">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search candidate, job, client, source..."
                className="w-72 sm:w-96 px-3 py-1 text-xs bg-slate-950 border border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-100 shadow-inner placeholder-slate-500"
              />
            </div>
            <button
              onClick={handleClear}
              className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full shadow-sm transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Right: Status, Sourcing, Client & Job Filters */}
        <div className="flex items-center space-x-2 text-xs">
          {/* 1. Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="In progress">🔵 In Progress</option>
            <option value="Closed">⚪ Closed</option>
          </select>

          {/* 2. Sourcing Filter */}
          <select
            value={passiveFilter}
            onChange={(e) => handlePassiveFilterChange(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Sources (Sourcing & Inbound)</option>
            <option value="SOURCING">🔍 Sourcing (Passive)</option>
            <option value="APPLY">📥 Inbound (Active Apply)</option>
          </select>

          {/* 3. Searchable Client Filter */}
          <SearchableFilterDropdown
            value={clientFilter}
            options={clientOptions}
            onChange={handleClientFilterChange}
            allLabel={`All Clients (${clients.length})`}
            placeholder="Search client (e.g. Smilegate)..."
            maxWidth="max-w-[200px]"
          />

          {/* 4. Searchable Position/Job Filter (Cascading by Selected Client) */}
          <SearchableFilterDropdown
            value={jobFilter}
            options={jobOptions}
            onChange={handleJobFilterChange}
            allLabel={clientFilter === "ALL" ? `All Positions (${jobs.length})` : `All Positions (${availableJobs.length})`}
            placeholder="Search position (e.g. Java, Nurse)..."
            maxWidth="max-w-[220px]"
          />

          {/* 5. + Attach Candidate Button */}
          <button
            type="button"
            onClick={() => setIsAttachCandidateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg shadow-sm hover:shadow-emerald-950/40 transition-all cursor-pointer shrink-0 ml-1"
            title="Attach an existing candidate from database to an active job order"
          >
            <UserPlus size={14} className="stroke-[2.5]" />
            <span>+ ATTACH CANDIDATE</span>
          </button>
        </div>

      </div>

      {/* ======================================================== */}
      {/* MASTER SECTION: APPLICATION / ACTION TABLE (TOP HALF) */}
      {/* ======================================================== */}
      <div className="flex-1 min-h-[140px] flex flex-col bg-slate-950 border-b-2 border-slate-800 overflow-hidden">
        
        {/* Scrollable Master Table (Listens to onWheel to prevent resize scroll loops) */}
        <div 
          onWheel={handleMasterWheel}
          className="flex-1 min-h-0 overflow-auto scrollbar-thin"
        >
          <table className="w-full text-xs text-left border-collapse select-text">
            
            {/* TABLE HEADER */}
            <thead className="bg-slate-900 text-slate-300 font-extrabold sticky top-0 z-10 border-b border-slate-800 text-center uppercase text-[10px] tracking-wider">
              <tr>
                <th className="w-8 p-1.5 border-r border-slate-800"></th>
                <th className="p-1.5 border-r border-slate-800 min-w-[110px]">STATUS</th>
                <th className="p-1.5 border-r border-slate-800 min-w-[80px]" title="Checked: Sourcing (Passive) / Unchecked: Inbound Apply">SOURCING</th>
                <th 
                  onClick={handlePlanningDateSortToggle}
                  className="p-1.5 border-r border-slate-800 min-w-[125px] cursor-pointer hover:bg-slate-800/90 transition-colors select-none group"
                  title="Click to sort by Planning Date (Newest First → Oldest First → Default)"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>PLANNING DATE</span>
                    {planningDateSort === "desc" ? (
                      <ArrowDown size={12} className="text-emerald-400 stroke-[2.5]" />
                    ) : planningDateSort === "asc" ? (
                      <ArrowUp size={12} className="text-emerald-400 stroke-[2.5]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-slate-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="p-1.5 border-r border-slate-800 min-w-[90px]">ID CANDIDATE</th>
                <th className="p-1.5 border-r border-slate-800 min-w-[180px] text-emerald-400">FULL NAME</th>
                <th className="p-1.5 border-r border-slate-800 min-w-[220px]">ORDER NAME</th>
                <th className="p-1.5 border-r border-slate-800 min-w-[160px]">CLIENT</th>
                <th className="p-1.5 border-r border-slate-800 min-w-[80px]">ID ORDER</th>
                <th className="p-1.5 border-r border-slate-800 min-w-[120px]">CANDIDATE SOURCE</th>
                <th className="p-1.5 min-w-[120px]">STAGE</th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                    Loading action pipeline from Neon Postgres...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-500 italic">
                    No records found matching filters
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => {
                  const isSelected = selectedAppId === app.application_id;

                  return (
                    <tr
                      key={app.application_id}
                      onClick={() => selectRow(app)}
                      className={`transition-colors cursor-pointer text-xs ${
                        isSelected 
                          ? "bg-slate-800/90 text-slate-100 font-semibold" 
                          : "hover:bg-slate-900/80 text-slate-300"
                      }`}
                    >
                      {/* Row Selector Arrow ▶ */}
                      <td className="p-1 text-center border-r border-slate-800 bg-slate-900/40">
                        {isSelected && <span className="text-emerald-400 font-black text-xs">▶</span>}
                      </td>

                      {/* 1. STATUS Dropdown (In Progress / Closed) */}
                      <td className="p-1 border-r border-slate-800" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={app.status === "In progress" ? "In progress" : "Closed"}
                          onChange={(e) => handleInlineUpdate(app.application_id, "status", e.target.value)}
                          className={`w-full px-1.5 py-0.5 text-xs font-bold border rounded focus:outline-none cursor-pointer ${
                            app.status === "In progress"
                              ? "bg-blue-950 text-blue-300 border-blue-800"
                              : "bg-slate-900 text-slate-400 border-slate-700"
                          }`}
                        >
                          <option value="In progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>

                      {/* 2. SOURCING Checkbox (is_passive) */}
                      <td className="p-1 border-r border-slate-800 text-center" onClick={(e) => e.stopPropagation()}>
                        <label className="inline-flex items-center justify-center cursor-pointer" title="Checked: Sourcing (Passive) / Unchecked: Inbound Apply">
                          <input
                            type="checkbox"
                            checked={Boolean(app.is_passive)}
                            onChange={(e) => handleInlineUpdate(app.application_id, "is_passive", e.target.checked)}
                            className="w-4 h-4 text-emerald-500 bg-slate-900 rounded border-slate-700 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                          />
                        </label>
                      </td>

                      {/* 3. Planning Date */}
                      <td className="p-1 border-r border-slate-800 text-center" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const todayStr = new Date().toLocaleDateString('en-CA');
                          const isOverdue = app.planning_date && app.planning_date < todayStr;
                          const isToday = app.planning_date && app.planning_date === todayStr;
                          return (
                            <DateInputField
                              value={app.planning_date || ""}
                              onChange={(newVal) => handleInlineUpdate(app.application_id, "planning_date", newVal)}
                              className={`w-full px-1.5 py-0.5 text-xs text-center font-bold rounded focus:outline-none ${
                                !app.planning_date
                                  ? "bg-slate-900 text-slate-500 border border-slate-800"
                                  : isOverdue
                                  ? "bg-red-950 text-red-200 border border-red-800"
                                  : isToday
                                  ? "bg-amber-950/60 text-amber-200 border border-amber-700/80"
                                  : "bg-slate-900 text-slate-200 border border-slate-700"
                              }`}
                            />
                          );
                        })()}
                      </td>

                      {/* 4. ID CANDIDATE */}
                      <td className="p-1 text-center font-mono text-xs border-r border-slate-800 text-slate-500">
                        {app.candidate_number || app.candidate_id?.substring(0, 6)}
                      </td>

                      {/* 5. Full Name (DOUBLE CLICK TO OPEN CANDIDATE PROFILE) */}
                      <td 
                        className="p-1 border-r border-slate-800"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          router.push(`/candidates/${app.candidate_id}`);
                        }}
                      >
                        <div
                          className="px-2 py-0.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-extrabold rounded text-xs truncate transition-all shadow-xs flex items-center justify-between group cursor-pointer select-none"
                          title="Click once to select • Double-click to open Candidate Profile"
                        >
                          <span className="truncate">{app.candidate_name || "Untitled"}</span>
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                        </div>
                      </td>

                      {/* 6. ORDER NAME (DOUBLE CLICK TO OPEN JOB DETAILS) */}
                      <td 
                        className="p-1 border-r border-slate-800 text-xs font-semibold text-slate-200 truncate max-w-[220px] hover:text-emerald-400 hover:underline cursor-pointer select-none"
                        title="Click once to select • Double-click to open Job Details"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          router.push(`/jobs?job_id=${app.job_id}`);
                        }}
                      >
                        {app.order_name || "N/A"}
                      </td>

                      {/* 7. CLIENT (DOUBLE CLICK TO FILTER BY THIS CLIENT) */}
                      <td 
                        className="p-1 border-r border-slate-800 text-xs text-slate-400 truncate max-w-[160px] hover:text-emerald-400 hover:underline cursor-pointer select-none"
                        title="Click once to select • Double-click to filter by this Client"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleClientFilterChange(app.client_name);
                        }}
                      >
                        {app.client_name || "N/A"}
                      </td>

                      {/* 8. ID ORDER */}
                      <td className="p-1 text-center font-mono text-xs border-r border-slate-800 text-slate-500">
                        {app.job_display_number || "—"}
                      </td>

                      {/* 9. CANDIDATE SOURCE */}
                      <td className="p-1 border-r border-slate-800 text-xs" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={app.source_channel || ""}
                          onChange={(e) => handleInlineUpdate(app.application_id, "source_channel", e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">— Select source —</option>
                          {app.source_channel && !SOURCE_CHANNELS_LIST.includes(app.source_channel) && (
                            <option value={app.source_channel}>{app.source_channel} (legacy)</option>
                          )}
                          {SOURCE_CHANNELS_LIST.map((sc) => (
                            <option key={sc} value={sc}>{sc}</option>
                          ))}
                        </select>
                      </td>

                      {/* 10. CURRENT STAGE (Automatic Badge from Activity Log) */}
                      <td className="p-1 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border truncate max-w-[130px] shadow-sm ${
                          getStageBadgeClass(app.current_stage)
                        }`}>
                          {getStageBadgeLabel(app.current_stage)}
                        </span>
                      </td>


                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

        </div>

      </div>

      {/* ======================================================== */}
      {/* DETAIL SECTION: ACTION TIMELINE / ACTIVITY LOG (FULL WIDTH) */}
      {/* ======================================================== */}
      <div 
        onMouseEnter={() => {
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          setIsDetailVisible(true);
        }}
        className={`transition-all duration-300 ease-in-out bg-slate-950 flex flex-col overflow-hidden shrink-0 ${
          isDetailVisible 
            ? isDetailExpanded
              ? "h-[clamp(380px,60vh,680px)] border-t-2 border-slate-800 opacity-100"
              : "h-[260px] border-t-2 border-slate-800 opacity-100" 
            : "h-0 border-t-0 opacity-0 pointer-events-none"
        }`}
      >
        
        {/* SUB-TABLE: ACTION NOTES / ACTIVITY LOG */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
          
          {/* 1. Sub-table Header (đơn giản hoá — ActivityLogPanel tự quản lý layout dạng card) */}
          <div className="bg-slate-900 text-slate-400 font-extrabold px-3 py-1.5 text-[10px] uppercase flex items-center justify-between gap-2 border-b border-slate-800 shrink-0">
            <span className="flex items-center gap-1.5 normal-case text-xs font-bold text-slate-300">
              <Clock size={13} className="text-emerald-400" />
              <span>Interview & Activity Timeline</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleAutoSlide}
                title={
                  autoSlideEnabled
                    ? "Auto-show Timeline: ON — click to switch to Manual (won't auto-reopen after scrolling)"
                    : "Auto-show Timeline: OFF (Manual) — use the floating Quick Peek button to reopen"
                }
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                  autoSlideEnabled
                    ? "text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-transparent"
                    : "bg-amber-950 text-amber-300 border border-amber-600"
                }`}
              >
                {autoSlideEnabled ? <Pin size={12} /> : <PinOff size={12} />}
                <span>{autoSlideEnabled ? "Auto" : "Manual"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDetailExpanded(prev => !prev)}
                title={isDetailExpanded ? "Collapse Timeline" : "Expand Timeline"}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                  isDetailExpanded
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-600"
                    : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-transparent"
                }`}
              >
                {isDetailExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isDetailExpanded ? "Collapse" : "Expand"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
                  setIsDetailExpanded(false);
                  setIsDetailVisible(false);
                }}
                className="px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                title="Collapse Action Timeline (or scroll above)"
              >
                <ChevronDown size={12} />
                <span>Hide</span>
              </button>
            </div>
          </div>

          {/* 2. Shared ActivityLogPanel: Add / Edit / Delete + Stage/Result/Reason per log */}
          <div className="flex-1 overflow-y-auto p-3">
            {selectedApp && (
              <>
                {selectedApp.status === "Closed" && (
                  <div className="mb-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center space-x-2 text-xs text-slate-400 select-none">
                    <span className="text-base text-amber-400">🔒</span>
                    <span className="text-slate-300 font-semibold">
                      Hồ sơ ứng tuyển này đang ở trạng thái <strong>Closed (Đã đóng)</strong>. Khóa chức năng thêm mới Action Note.
                    </span>
                  </div>
                )}
                <ActivityLogPanel
                  applicationId={selectedApp.application_id}
                  currentStage={selectedApp.current_stage}
                  result={selectedApp.result}
                  reasonFailed={selectedApp.reason_failed}
                  logs={activityLogs}
                  isLoadingLogs={logsLoading}
                  onAddLog={selectedApp.status === "Closed" ? undefined : handleAddNewLog}
                  onEditLog={handleEditLog}
                  onDeleteLog={handleDeleteLog}
                  outcomeMode="readOnly"
                  allowEditLog={true}
                  logsMaxHeightClass={isDetailExpanded ? "max-h-[clamp(300px,50vh,580px)]" : "max-h-[220px]"}
                />
              </>
            )}
          </div>

        </div>

      </div>

      {/* MANUAL QUICK PEEK BUTTON */}
      {!isDetailVisible && (
        <button
          onClick={() => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            setIsDetailVisible(true);
          }}
          className="fixed bottom-9 right-6 z-30 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/50 rounded-full shadow-2xl text-[11px] font-bold flex items-center space-x-1.5 backdrop-blur-xs transition-all cursor-pointer animate-pulse"
        >
          <ChevronUp size={14} />
          <span>Action Timeline ({activityLogs.length})</span>
        </button>
      )}

      {/* ======================================================== */}
      {/* FOOTER BAR: RECORD NAVIGATOR & PAGINATION */}
      {/* ======================================================== */}
      <footer className="h-7 bg-slate-950 border-t border-slate-800 text-slate-400 px-3 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
        
        {/* Left: Record Navigator & Page Pagination */}
        <div className="flex items-center space-x-3">
          {/* Record Navigator ◀ 1 of 80 ▶ */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 text-[10px]">Record:</span>
            <button 
              onClick={() => navigateRecord(-1)}
              disabled={selectedIndex <= 0}
              className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded text-xs text-slate-200 cursor-pointer border border-slate-800"
              title="Previous record on this page"
            >
              ◀
            </button>

            <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded font-bold text-emerald-400 text-[10px]">
              {selectedIndex >= 0 ? selectedIndex + 1 : 0} of {applications.length}
            </span>

            <button 
              onClick={() => navigateRecord(1)}
              disabled={selectedIndex >= applications.length - 1}
              className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded text-xs text-slate-200 cursor-pointer border border-slate-800"
              title="Next record on this page"
            >
              ▶
            </button>
          </div>

          <span className="text-slate-700">|</span>

          {/* Page Pagination Controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={page <= 1}
              className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
              title="First Page"
            >
              <ChevronsLeft size={12} />
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
              title="Previous Page"
            >
              <ChevronLeft size={12} />
            </button>

            <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-300 text-[10px] font-bold">
              Page <span className="text-emerald-400">{page}</span> of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
              title="Next Page"
            >
              <ChevronRight size={12} />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages}
              className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
              title="Last Page"
            >
              <ChevronsRight size={12} />
            </button>

            <span className="text-slate-500 text-[10px] ml-1">
              ({totalApps.toLocaleString()} total applications)
            </span>
          </div>
        </div>

        {/* Selected Candidate Quick Summary */}
        <div className="flex items-center space-x-4 text-slate-500 text-[10px]">
          {isSearching && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Loader2 size={11} className="animate-spin" /> Loading...
            </span>
          )}
          {selectedApp && (
            <>
              <span>Candidate: <strong className={selectedApp.blocked ? "text-rose-400 font-bold" : "text-slate-300"}>{selectedApp.candidate_name}</strong></span>
              <span>•</span>
              <span>ID: <strong className="text-slate-300 font-mono">{selectedApp.candidate_number || selectedApp.candidate_id?.substring(0, 8)}</strong></span>
              <span>•</span>
              <span className="text-emerald-500 font-semibold">● Ready</span>
            </>
          )}
        </div>

      </footer>

      {/* ATTACH CANDIDATE MODAL */}
      <AttachCandidateModal
        isOpen={isAttachCandidateOpen}
        onClose={() => setIsAttachCandidateOpen(false)}
        onAttached={handleCandidateAttached}
      />

    </div>
  );
}


