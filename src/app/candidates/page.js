"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateVN } from "src/lib/utils";
import DateInputField from "src/components/DateInputField";
import {
  getCandidateProfile,
  updateCandidateProfile,
  addContactPoint,
  updateContactPoint,
  deleteContactPoint,
  assignCandidateToJob,
  setApplicationActive,
  changeApplicationJob,
  getClientSearchData,
  getJobSearchData,
  getActivityLogs,
  addActivityLog,
  updateActivityLog,
  deleteActivityLog,
  updateApplicationAction,
  syncCandidatesToGoogleContacts,
  deleteCvVersion
} from "../actions";
import NewCandidateModal from "../../components/NewCandidateModal";
import CVUploadModal from "../../components/CVUploadModal";
import SearchableCandidateDropdown from "../../components/SearchableCandidateDropdown";
import ActivityLogPanel, { getStageBadgeClass } from "src/components/ActivityLogPanel";
import {
  CANDIDATE_STAGES,
  CANDIDATE_STAGES_LIST,
  STAGE_COLOR_MAP,
  CONTACT_TYPES,
  CONTACT_TYPES_LIST,
  PREFIXES_LIST,
  SOURCE_CHANNELS_LIST
} from "../../constants/enums";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MessageSquare,
  ExternalLink,
  Building,
  Briefcase,
  Calendar,
  MapPin,
  FileText,
  ShieldAlert,
  Plus,
  Save,
  Loader2,
  CheckCircle,
  Clock,
  Sparkles,
  Pencil,
  Trash2,
  Copy,
  Check,
  X,
  RotateCw,
  Tag,
  Star,
  Eye,
  Globe,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  UserPlus,
  Send,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  Contact
} from "lucide-react";

/**
 * Format Google Drive or external URL to embeddable preview link.
 * @param {string} url - Raw CV URL.
 * @returns {string} Embeddable iframe preview URL.
 */
function getEmbeddableCvUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  const driveIdMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
  }
  return trimmed;
}

/**
 * Pure Server-Side Searchable Candidate Switcher on Master Header.
 * 100% Security & Stability: Never dumps candidate database into client RAM.
 * Queries Supabase PostgreSQL server-side with 280ms debounce.
 */
function SearchableCandidateSwitcher({
  currentCandidate,
  currentIndex = 1,
  totalCount = 3377,
  prevCandidateId = null,
  nextCandidateId = null,
  onSelectCandidate,
  onNavigatePrev,
  onNavigateNext,
  isLoading = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* Navigator Prev Button */}
      <button
        onClick={onNavigatePrev}
        disabled={!prevCandidateId || isLoading}
        className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-700/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        title="Previous Candidate (◀)"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Main Searchable Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/90 shadow-sm transition-all text-left min-w-[260px] max-w-[340px] cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
            {currentCandidate?.prefix?.replace(".", "") || "C"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-100 truncate">
                {currentCandidate?.full_name || "Select Candidate"}
              </span>
              {currentCandidate?.blocked && (
                <span className="px-1 py-0.2 bg-rose-950 text-rose-400 border border-rose-800 rounded text-[9px] font-bold shrink-0">
                  BL
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2">
              <span className="text-emerald-400 font-mono font-bold">
                ID: #{currentCandidate?.display_number || "?"}
              </span>
              <span>•</span>
              <span>
                Record {currentIndex} of {totalCount}
              </span>
            </div>
          </div>

          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>

        {/* Server-Side Search Dropdown Popover */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-[420px] z-50 animate-in fade-in zoom-in-95 duration-100 shadow-2xl">
            <SearchableCandidateDropdown
              selectedId={currentCandidate?.id}
              autoFocus={true}
              onSelect={(candidate) => {
                onSelectCandidate(candidate.id);
                setIsOpen(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Navigator Next Button */}
      <button
        onClick={onNavigateNext}
        disabled={!nextCandidateId || isLoading}
        className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-700/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        title="Next Candidate (▶)"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/**
 * Assign Candidate to Job Order Pipeline Modal.
 * Reuses Search Menu server-side debounced search pattern for Client & Job fields.
 */
function AssignToJobModal({ candidate, isOpen, onClose, onAssigned }) {
  // Client selection state
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const clientDropdownRef = useRef(null);
  const clientDebounceRef = useRef(null);
  const clientSeqRef = useRef(0);

  // Job selection state
  const [jobSearchTerm, setJobSearchTerm] = useState("");
  const [jobOptions, setJobOptions] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedJobDisplay, setSelectedJobDisplay] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const jobDropdownRef = useRef(null);
  const jobDebounceRef = useRef(null);
  const jobSeqRef = useRef(0);

  // Pipeline form state
  const [stage, setStage] = useState("Talent Mapping");
  const [sourceChannel, setSourceChannel] = useState("Direct Sourcing (Headhunt)");
  const [planningDate, setPlanningDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Handle outside click for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setIsClientDropdownOpen(false);
      }
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target)) {
        setIsJobDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for clients
  const fetchClients = useCallback(async (term) => {
    const seq = ++clientSeqRef.current;
    setIsSearchingClients(true);
    try {
      const res = await getClientSearchData({ searchTerm: term, page: 1, pageSize: 20 });
      if (seq !== clientSeqRef.current) return;
      if (res.success) {
        setClientOptions(res.data || []);
      }
    } catch (err) {
      console.error("Fetch clients failed in AssignToJobModal:", err);
    } finally {
      if (seq === clientSeqRef.current) {
        setIsSearchingClients(false);
      }
    }
  }, []);

  // Debounced search for jobs (optionally filtered by client)
  const fetchJobs = useCallback(async (term, clientId) => {
    const seq = ++jobSeqRef.current;
    setIsSearchingJobs(true);
    try {
      const res = await getJobSearchData({ searchTerm: term, page: 1, pageSize: 30 });
      if (seq !== jobSeqRef.current) return;
      if (res.success) {
        let results = res.data || [];
        if (clientId && clientId !== "ALL") {
          results = results.filter(j => j.client_id === clientId);
        }
        setJobOptions(results);
      }
    } catch (err) {
      console.error("Fetch jobs failed in AssignToJobModal:", err);
    } finally {
      if (seq === jobSeqRef.current) {
        setIsSearchingJobs(false);
      }
    }
  }, []);

  // Reset form when modal opens & trigger initial load
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setClientSearchTerm("");
      setSelectedClientId("ALL");
      setSelectedClientName("");
      setIsClientDropdownOpen(false);
      setJobSearchTerm("");
      setSelectedJobId("");
      setSelectedJobDisplay("");
      setIsJobDropdownOpen(false);
      setStage("Talent Mapping");
      setSourceChannel("Direct Sourcing (Headhunt)");
      setPlanningDate(new Date().toLocaleDateString('en-CA'));
      setNote("");
      setIsSaving(false);

      // Initial fetch for top clients and jobs
      fetchClients("");
      fetchJobs("", "ALL");
    }
  }, [isOpen, fetchClients, fetchJobs]);

  useEffect(() => {
    if (!isOpen) return;
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    clientDebounceRef.current = setTimeout(() => {
      fetchClients(clientSearchTerm);
    }, 280);

    return () => {
      if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    };
  }, [clientSearchTerm, isOpen, fetchClients]);

  useEffect(() => {
    if (!isOpen) return;
    if (jobDebounceRef.current) clearTimeout(jobDebounceRef.current);
    jobDebounceRef.current = setTimeout(() => {
      fetchJobs(jobSearchTerm, selectedClientId);
    }, 280);

    return () => {
      if (jobDebounceRef.current) clearTimeout(jobDebounceRef.current);
    };
  }, [jobSearchTerm, selectedClientId, isOpen, fetchJobs]);

  function handleSelectClient(clientId, clientName) {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName || "");
    setIsClientDropdownOpen(false);
    setSelectedJobId("");
    setSelectedJobDisplay("");
    fetchJobs(jobSearchTerm, clientId);
  }

  function handleSelectJob(job) {
    setSelectedJobId(job.job_id);
    setSelectedJobDisplay(`#${job.display_number || "?"} ${job.job_title} (${job.client_name || "Unknown"})`);
    setIsJobDropdownOpen(false);
    setErrorMsg("");
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedJobId) {
      setErrorMsg("Please select a target Job Order position.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    try {
      const res = await assignCandidateToJob({
        candidateId: candidate.id,
        jobId: selectedJobId,
        sourceChannel,
        note,
        initialStage: stage,
        isPassive: true,
        planningDate
      });

      if (res.success) {
        onAssigned();
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to assign candidate to job order.");
      }
    } catch (err) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-sm">
              <Briefcase size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Assign Candidate to Job Pipeline
              </h3>
              <p className="text-xs text-slate-400">
                Candidate: <span className="text-emerald-400 font-semibold">{candidate?.full_name}</span> (#{candidate?.display_number})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Client Filter: Searchable Dropdown */}
          <div className="space-y-1" ref={clientDropdownRef}>
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building size={13} className="text-emerald-400" />
                <span>1. Filter by Client Company (Optional)</span>
              </span>
              {selectedClientId !== "ALL" && (
                <button
                  type="button"
                  onClick={() => handleSelectClient("ALL", "")}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsClientDropdownOpen(prev => !prev)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors text-left"
              >
                <span className={selectedClientId !== "ALL" ? "text-emerald-300 font-medium truncate pr-2" : "text-slate-400 truncate pr-2"}>
                  {selectedClientId !== "ALL" ? selectedClientName : "All Clients (No filter)"}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 shrink-0 transition-transform duration-150 ${isClientDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isClientDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-800 bg-slate-950">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={e => setClientSearchTerm(e.target.value)}
                        placeholder="Type to search client name, ID, industry..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                        autoFocus
                      />
                      {isSearchingClients && (
                        <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />
                      )}
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/60 p-1">
                    <div
                      onClick={() => handleSelectClient("ALL", "")}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedClientId === "ALL"
                          ? "bg-emerald-500/10 text-emerald-300 font-semibold"
                          : "hover:bg-slate-800/60 text-slate-300"
                      }`}
                    >
                      <span className="text-xs">All Clients (Show all positions)</span>
                      {selectedClientId === "ALL" && <Check size={13} className="text-emerald-400 shrink-0" />}
                    </div>

                    {clientOptions.length === 0 && !isSearchingClients ? (
                      <div className="p-3 text-center text-slate-500 text-xs">
                        No matching clients found.
                      </div>
                    ) : (
                      clientOptions.map(c => {
                        const isSelected = selectedClientId === c.client_id;
                        return (
                          <div
                            key={c.client_id}
                            onClick={() => handleSelectClient(c.client_id, `#${c.display_number || "?"} ${c.client_name}`)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-500/10 text-emerald-300 font-semibold"
                                : "hover:bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="font-mono text-[10px] text-slate-500 shrink-0">#{c.display_number}</span>
                              <span className="truncate text-xs">{c.client_name}</span>
                            </div>
                            {c.industry && c.industry !== "—" && (
                              <span className="text-[10px] text-slate-500 shrink-0 font-medium px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                {c.industry}
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
          </div>

          {/* Target Job Order: Searchable Dropdown */}
          <div className="space-y-1" ref={jobDropdownRef}>
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Briefcase size={13} className="text-emerald-400" />
                <span>2. Select Target Position <span className="text-rose-400">*</span></span>
              </span>
              {selectedJobId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJobId("");
                    setSelectedJobDisplay("");
                  }}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Clear selection
                </button>
              )}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsJobDropdownOpen(prev => !prev)}
                className={`w-full px-3 py-2 text-xs bg-slate-950 border rounded-xl focus:outline-none text-left flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors ${
                  !selectedJobId
                    ? "border-slate-700 text-slate-400"
                    : "border-emerald-500/60 text-slate-100 font-medium"
                }`}
              >
                <span className="truncate pr-2">
                  {selectedJobDisplay || "-- Choose Position (Type to search) * --"}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 shrink-0 transition-transform duration-150 ${isJobDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isJobDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-800 bg-slate-950">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={jobSearchTerm}
                        onChange={e => setJobSearchTerm(e.target.value)}
                        placeholder="Type position title, ID, client name..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                        autoFocus
                      />
                      {isSearchingJobs && (
                        <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />
                      )}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 p-1">
                    {jobOptions.length === 0 && !isSearchingJobs ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        {selectedClientId !== "ALL"
                          ? "No open positions found for the selected client."
                          : "No matching positions found."}
                      </div>
                    ) : (
                      jobOptions.map(j => {
                        const isSelected = selectedJobId === j.job_id;
                        return (
                          <div
                            key={j.job_id}
                            onClick={() => handleSelectJob(j)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-500/15 text-emerald-200 font-semibold"
                                : "hover:bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">#{j.display_number}</span>
                                <span className="truncate text-xs font-medium text-slate-100">{j.job_title}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate mt-0.5">
                                {j.client_name || "Unknown Client"}{j.location && j.location !== "—" ? ` • ${j.location}` : ""}
                              </span>
                            </div>
                            {isSelected && <Check size={14} className="text-emerald-400 shrink-0 ml-2" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Initial Stage, Source Channel & Planning Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Initial Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={e => setStage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {CANDIDATE_STAGES_LIST.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Source Channel
              </label>
              <select
                value={sourceChannel}
                onChange={e => setSourceChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {SOURCE_CHANNELS_LIST.map(sc => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Planning Date
              </label>
              <DateInputField
                value={planningDate}
                onChange={setPlanningDate}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Initial Note / Evaluation
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Add initial recruiter evaluation or context..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !selectedJobId}
              className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <Plus size={13} />
                  <span>Assign to Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Edit Job Assignment Modal.
 * Reuses Search Menu server-side debounced search pattern for Client & Job fields.
 */
function EditJobModal({ application, isOpen, onClose, onChanged }) {
  // Client selection state
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientOptions, setClientOptions] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const clientDropdownRef = useRef(null);
  const clientDebounceRef = useRef(null);
  const clientSeqRef = useRef(0);

  // Job selection state
  const [jobSearchTerm, setJobSearchTerm] = useState("");
  const [jobOptions, setJobOptions] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedJobDisplay, setSelectedJobDisplay] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);
  const jobDropdownRef = useRef(null);
  const jobDebounceRef = useRef(null);
  const jobSeqRef = useRef(0);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Handle outside click for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setIsClientDropdownOpen(false);
      }
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target)) {
        setIsJobDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for clients
  const fetchClients = useCallback(async (term) => {
    const seq = ++clientSeqRef.current;
    setIsSearchingClients(true);
    try {
      const res = await getClientSearchData({ searchTerm: term, page: 1, pageSize: 20 });
      if (seq !== clientSeqRef.current) return;
      if (res.success) {
        setClientOptions(res.data || []);
      }
    } catch (err) {
      console.error("Fetch clients failed in EditJobModal:", err);
    } finally {
      if (seq === clientSeqRef.current) {
        setIsSearchingClients(false);
      }
    }
  }, []);

  // Debounced search for jobs (optionally filtered by client)
  const fetchJobs = useCallback(async (term, clientId) => {
    const seq = ++jobSeqRef.current;
    setIsSearchingJobs(true);
    try {
      const res = await getJobSearchData({ searchTerm: term, page: 1, pageSize: 30 });
      if (seq !== jobSeqRef.current) return;
      if (res.success) {
        let results = res.data || [];
        if (clientId && clientId !== "ALL") {
          results = results.filter(j => j.client_id === clientId);
        }
        setJobOptions(results);
      }
    } catch (err) {
      console.error("Fetch jobs failed in EditJobModal:", err);
    } finally {
      if (seq === jobSeqRef.current) {
        setIsSearchingJobs(false);
      }
    }
  }, []);

  // Reset form when modal opens & trigger initial load
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setClientSearchTerm("");
      setSelectedClientId("ALL");
      setSelectedClientName("");
      setIsClientDropdownOpen(false);
      setJobSearchTerm("");
      setSelectedJobId("");
      setSelectedJobDisplay("");
      setIsJobDropdownOpen(false);
      setIsSaving(false);

      // Initial fetch for top clients and jobs
      fetchClients("");
      fetchJobs("", "ALL");
    }
  }, [isOpen, fetchClients, fetchJobs]);

  useEffect(() => {
    if (!isOpen) return;
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    clientDebounceRef.current = setTimeout(() => {
      fetchClients(clientSearchTerm);
    }, 280);

    return () => {
      if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    };
  }, [clientSearchTerm, isOpen, fetchClients]);

  useEffect(() => {
    if (!isOpen) return;
    if (jobDebounceRef.current) clearTimeout(jobDebounceRef.current);
    jobDebounceRef.current = setTimeout(() => {
      fetchJobs(jobSearchTerm, selectedClientId);
    }, 280);

    return () => {
      if (jobDebounceRef.current) clearTimeout(jobDebounceRef.current);
    };
  }, [jobSearchTerm, selectedClientId, isOpen, fetchJobs]);

  function handleSelectClient(clientId, clientName) {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName || "");
    setIsClientDropdownOpen(false);
    setSelectedJobId("");
    setSelectedJobDisplay("");
    fetchJobs(jobSearchTerm, clientId);
  }

  function handleSelectJob(job) {
    setSelectedJobId(job.job_id);
    setSelectedJobDisplay(`#${job.display_number || "?"} ${job.job_title} (${job.client_name || "Unknown"})`);
    setIsJobDropdownOpen(false);
    setErrorMsg("");
  }

  async function handleUpdateJob(e) {
    e.preventDefault();
    if (!selectedJobId) {
      setErrorMsg("Please select a target Job Order position.");
      return;
    }
    if (!application?.application_id) {
      setErrorMsg("Application ID not found.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    try {
      const res = await changeApplicationJob(application.application_id, selectedJobId);

      if (res.success) {
        onChanged();
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to update job order.");
      }
    } catch (err) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-sm">
              <Pencil size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Edit Job Assignment
              </h3>
              <p className="text-xs text-slate-400">
                Current Job: <span className="text-emerald-400 font-semibold">#{application?.display_number || "?"} {application?.job_title || "Untitled Position"}</span>
                {application?.client_name ? ` (${application.client_name})` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleUpdateJob} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Client Filter: Searchable Dropdown */}
          <div className="space-y-1" ref={clientDropdownRef}>
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building size={13} className="text-emerald-400" />
                <span>1. Filter by Client Company (Optional)</span>
              </span>
              {selectedClientId !== "ALL" && (
                <button
                  type="button"
                  onClick={() => handleSelectClient("ALL", "")}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsClientDropdownOpen(prev => !prev)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors text-left"
              >
                <span className={selectedClientId !== "ALL" ? "text-emerald-300 font-medium truncate pr-2" : "text-slate-400 truncate pr-2"}>
                  {selectedClientId !== "ALL" ? selectedClientName : "All Clients (No filter)"}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 shrink-0 transition-transform duration-150 ${isClientDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isClientDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-800 bg-slate-950">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={e => setClientSearchTerm(e.target.value)}
                        placeholder="Type to search client name, ID, industry..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                        autoFocus
                      />
                      {isSearchingClients && (
                        <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />
                      )}
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/60 p-1">
                    <div
                      onClick={() => handleSelectClient("ALL", "")}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedClientId === "ALL"
                          ? "bg-emerald-500/10 text-emerald-300 font-semibold"
                          : "hover:bg-slate-800/60 text-slate-300"
                      }`}
                    >
                      <span className="text-xs">All Clients (Show all positions)</span>
                      {selectedClientId === "ALL" && <Check size={13} className="text-emerald-400 shrink-0" />}
                    </div>

                    {clientOptions.length === 0 && !isSearchingClients ? (
                      <div className="p-3 text-center text-slate-500 text-xs">
                        No matching clients found.
                      </div>
                    ) : (
                      clientOptions.map(c => {
                        const isSelected = selectedClientId === c.client_id;
                        return (
                          <div
                            key={c.client_id}
                            onClick={() => handleSelectClient(c.client_id, `#${c.display_number || "?"} ${c.client_name}`)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-500/10 text-emerald-300 font-semibold"
                                : "hover:bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="font-mono text-[10px] text-slate-500 shrink-0">#{c.display_number}</span>
                              <span className="truncate text-xs">{c.client_name}</span>
                            </div>
                            {c.industry && c.industry !== "—" && (
                              <span className="text-[10px] text-slate-500 shrink-0 font-medium px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                {c.industry}
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
          </div>

          {/* Target Job Order: Searchable Dropdown */}
          <div className="space-y-1" ref={jobDropdownRef}>
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Briefcase size={13} className="text-emerald-400" />
                <span>2. Select New Target Position <span className="text-rose-400">*</span></span>
              </span>
              {selectedJobId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJobId("");
                    setSelectedJobDisplay("");
                  }}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Clear selection
                </button>
              )}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsJobDropdownOpen(prev => !prev)}
                className={`w-full px-3 py-2 text-xs bg-slate-950 border rounded-xl focus:outline-none text-left flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors ${
                  !selectedJobId
                    ? "border-slate-700 text-slate-400"
                    : "border-emerald-500/60 text-slate-100 font-medium"
                }`}
              >
                <span className="truncate pr-2">
                  {selectedJobDisplay || "-- Choose New Position (Type to search) * --"}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 shrink-0 transition-transform duration-150 ${isJobDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isJobDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-800 bg-slate-950">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={jobSearchTerm}
                        onChange={e => setJobSearchTerm(e.target.value)}
                        placeholder="Type position title, ID, client name..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                        autoFocus
                      />
                      {isSearchingJobs && (
                        <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />
                      )}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 p-1">
                    {jobOptions.length === 0 && !isSearchingJobs ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        {selectedClientId !== "ALL"
                          ? "No open positions found for the selected client."
                          : "No matching positions found."}
                      </div>
                    ) : (
                      jobOptions.map(j => {
                        const isSelected = selectedJobId === j.job_id;
                        return (
                          <div
                            key={j.job_id}
                            onClick={() => handleSelectJob(j)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-500/15 text-emerald-200 font-semibold"
                                : "hover:bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">#{j.display_number}</span>
                                <span className="truncate text-xs font-medium text-slate-100">{j.job_title}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate mt-0.5">
                                {j.client_name || "Unknown Client"}{j.location && j.location !== "—" ? ` • ${j.location}` : ""}
                              </span>
                            </div>
                            {isSelected && <Check size={14} className="text-emerald-400 shrink-0 ml-2" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !selectedJobId}
              className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Pencil size={13} />
                  <span>Update Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Candidate 360° Profile Inner Component (With Query Params Support).
 */
function Candidate360Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCandidateId = searchParams.get("id");

  // Main Candidate Data State
  const [candidate, setCandidate] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [applications, setApplications] = useState([]);

  // Switcher Navigation Metadata State
  const [switcherList, setSwitcherList] = useState([]);
  const [totalCount, setTotalCount] = useState(3377);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [prevCandidateId, setPrevCandidateId] = useState(null);
  const [nextCandidateId, setNextCandidateId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: "",
    prefix: "Mr.",
    dob: "",
    source: "",
    address: "",
    cv_url: "",
    blocked: false,
    blacklist_note: "",
    notes: ""
  });

  // UI States
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [activeTab, setActiveTab] = useState("applications"); // 'applications' | 'cv_viewer'
  const [isCvFullscreen, setIsCvFullscreen] = useState(false);

  // Modals State
  const [showNewCandidateModal, setShowNewCandidateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCvUploadModal, setShowCvUploadModal] = useState(false);
  const [isSyncingGoogleContacts, setIsSyncingGoogleContacts] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editJobTarget, setEditJobTarget] = useState(null);

  // Contact Points Hub State
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContactType, setEditContactType] = useState("Phone");
  const [editContactValue, setEditContactValue] = useState("");
  const [newContactType, setNewContactType] = useState("LinkedIn");
  const [newContactValue, setNewContactValue] = useState("");
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Timeline Accordion State (Key: applicationId)
  const [expandedTimelines, setExpandedTimelines] = useState({});
  const [timelineLogs, setTimelineLogs] = useState({});
  const [loadingLogs, setLoadingLogs] = useState({});

  const [editingLogId, setEditingLogId] = useState(null);
  const [editLogStage, setEditLogStage] = useState("");
  const [editLogNote, setEditLogNote] = useState("");

  const notify = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }, []);

  // Fetch Candidate Profile Data
  const loadCandidateData = useCallback(async (targetId = null) => {
    setLoading(true);
    setExpandedTimelines({}); // Clear accordion state for new candidate
    setTimelineLogs({}); // Clear timeline logs cache
    try {
      const res = await getCandidateProfile(targetId);
      if (res.success && res.data) {
        const {
          candidate: cand,
          contacts: conts,
          applications: apps,
          totalCount: tot,
          currentIndex: idx,
          prevCandidateId: prev,
          nextCandidateId: next
        } = res.data;

        setCandidate(cand);
        setContacts(conts || []);
        setApplications(apps || []);
        setTotalCount(tot || 3377);
        setCurrentIndex(idx || 1);
        setPrevCandidateId(prev);
        setNextCandidateId(next);

        setFormData({
          full_name: cand.full_name || "",
          prefix: cand.prefix || "Mr.",
          dob: cand.dob || "",
          source: cand.source || "",
          address: cand.address || "",
          cv_url: cand.cv_url || "",
          cv_urls: cand.cv_urls || [],
          blocked: Boolean(cand.blocked),
          blacklist_note: cand.blacklist_note || "",
          notes: cand.notes || ""
        });
      } else {
        notify("Failed to load candidate: " + (res.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error loading candidate:", err);
      notify("Error loading candidate profile.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  // Initial Load based on query parameter
  useEffect(() => {
    loadCandidateData(queryCandidateId || null);
  }, [queryCandidateId, loadCandidateData]);

  // Switch Candidate Handler
  function handleSelectCandidate(targetId) {
    if (!targetId || targetId === candidate?.id) return;
    router.push(`/candidates?id=${targetId}`);
  }

  // Save Candidate Profile
  async function handleSaveProfile(e) {
    if (e) e.preventDefault();
    if (!candidate?.id) return;

    setIsSaving(true);
    try {
      const res = await updateCandidateProfile(candidate.id, formData);
      if (res.success) {
        notify("✓ Candidate profile saved successfully!");
        loadCandidateData(candidate.id);
      } else {
        notify("Failed to save profile: " + res.error);
      }
    } catch (err) {
      notify("Error saving profile: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  // Delete a specific CV version by array index
  async function handleDeleteCvVersion(arrayIndex) {
    if (!candidate?.id || arrayIndex === null || arrayIndex === undefined) return;
    if (allCvUrls.length <= 1) {
      notify("Cannot delete the only remaining CV version.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this CV version? This cannot be undone.")) return;

    try {
      const res = await deleteCvVersion(candidate.id, arrayIndex);
      if (res.success) {
        notify("✓ CV version deleted.");
        setSelectedCvIndex(0);
        await loadCandidateData(candidate.id);
      } else {
        notify("Failed to delete CV version: " + (res.error || "Unknown error"));
      }
    } catch (err) {
      notify("Error deleting CV version: " + err.message);
    }
  }

  // Copy to clipboard helper
  function copyText(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    notify(`Copied ${label}: ${text}`);
  }

  // Contact Point Add
  async function handleAddContact(e) {
    e.preventDefault();
    if (!newContactValue.trim() || !candidate?.id) return;
    setIsAddingContact(true);
    try {
      const res = await addContactPoint(candidate.id, newContactType, newContactValue.trim());
      if (res.success) {
        setNewContactValue("");
        notify("✓ Contact point added.");
        loadCandidateData(candidate.id);
      } else {
        notify("Failed to add contact point: " + res.error);
      }
    } catch (err) {
      notify("Error adding contact point: " + err.message);
    } finally {
      setIsAddingContact(false);
    }
  }

  // Contact Point Update
  async function handleUpdateContact(contactId) {
    if (!editContactValue.trim() || !candidate?.id) return;
    try {
      const res = await updateContactPoint(contactId, candidate.id, editContactType, editContactValue.trim());
      if (res.success) {
        setEditingContactId(null);
        notify("✓ Contact point updated.");
        loadCandidateData(candidate.id);
      } else {
        notify("Failed to update contact: " + res.error);
      }
    } catch (err) {
      notify("Error updating contact: " + err.message);
    }
  }

  // Contact Point Delete
  async function handleDeleteContact(contactId) {
    if (!window.confirm("Are you sure you want to remove this contact point?")) return;
    try {
      const res = await deleteContactPoint(contactId, candidate.id);
      if (res.success) {
        notify("✓ Contact point removed.");
        loadCandidateData(candidate.id);
      } else {
        notify("Failed to remove contact: " + res.error);
      }
    } catch (err) {
      notify("Error removing contact: " + err.message);
    }
  }

  // Toggle Timeline Accordion for an Application
  async function toggleTimeline(applicationId) {
    const nextState = !expandedTimelines[applicationId];
    setExpandedTimelines(prev => ({ ...prev, [applicationId]: nextState }));

    if (nextState && !timelineLogs[applicationId]) {
      setLoadingLogs(prev => ({ ...prev, [applicationId]: true }));
      try {
        const res = await getActivityLogs(applicationId);
        if (res.success) {
          setTimelineLogs(prev => ({ ...prev, [applicationId]: res.data || [] }));
        }
      } catch (err) {
        console.error("Error loading timeline logs:", err);
      } finally {
        setLoadingLogs(prev => ({ ...prev, [applicationId]: false }));
      }
    }
  }

  // Add Log Entry to Timeline
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

  // Edit Log Entry in Timeline
  async function handleEditTimelineNote(applicationId, logId, logData) {
    try {
      const res = await updateActivityLog(logId, applicationId, logData);
      if (res.success) {
        notify("✓ Timeline note updated.");
        const logsRes = await getActivityLogs(applicationId);
        if (logsRes.success) {
          setTimelineLogs(prev => ({ ...prev, [applicationId]: logsRes.data || [] }));
        }
        loadCandidateData(candidate.id);
      } else {
        notify("Failed to update timeline note: " + res.error);
      }
      return res;
    } catch (err) {
      notify("Error updating timeline note: " + err.message);
      return { success: false, error: err.message };
    }
  }

  // Delete Log Entry from Timeline
  async function handleDeleteTimelineNote(applicationId, logId) {
    try {
      const res = await deleteActivityLog(logId, applicationId);
      if (res.success) {
        notify("✓ Timeline note deleted.");
        const logsRes = await getActivityLogs(applicationId);
        if (logsRes.success) {
          setTimelineLogs(prev => ({ ...prev, [applicationId]: logsRes.data || [] }));
        }
        loadCandidateData(candidate.id);
      } else {
        notify("Failed to delete timeline note: " + res.error);
      }
      return res;
    } catch (err) {
      notify("Error deleting timeline note: " + err.message);
      return { success: false, error: err.message };
    }
  }

  // Primary Contact Shortcuts on Header
  const primaryPhone = useMemo(() => {
    const cp = contacts.find(c => (c.type || "").toLowerCase().includes("phone"));
    return cp ? cp.value : null;
  }, [contacts]);

  const primaryEmail = useMemo(() => {
    const cp = contacts.find(c => (c.type || "").toLowerCase().includes("email") || (c.type || "").toLowerCase().includes("mail"));
    return cp ? cp.value : null;
  }, [contacts]);

  const primaryLinkedIn = useMemo(() => {
    const cp = contacts.find(c => (c.type || "").toLowerCase().includes("linkedin"));
    return cp ? cp.value : null;
  }, [contacts]);

  const [selectedCvIndex, setSelectedCvIndex] = useState(0);
  const allCvUrls = useMemo(() => {
    const list = [];
    if (Array.isArray(formData.cv_urls) && formData.cv_urls.length > 0) {
      formData.cv_urls.forEach((c, idx) => {
        const isLatest = idx === formData.cv_urls.length - 1;
        const dateStr = c.added_at ? ` (${formatDateVN(c.added_at)})` : '';
        const nameStr = c.filename || `CV v${idx + 1}`;
        list.push({
          url: c.url,
          label: `${nameStr}${isLatest ? ' • Latest' : ''}${dateStr}`,
          arrayIndex: idx,
          filename: c.filename || ''
        });
      });
      if (formData.cv_url && !formData.cv_urls.some(c => c.url === formData.cv_url)) {
        list.push({ url: formData.cv_url, label: 'Current CV (Direct Link)', arrayIndex: null, filename: '' });
      }
    } else if (formData.cv_url) {
      list.push({ url: formData.cv_url, label: 'Primary CV (v1)', arrayIndex: null, filename: '' });
    }
    return list;
  }, [formData.cv_url, formData.cv_urls]);

  const safeCvIndex = selectedCvIndex >= 0 && selectedCvIndex < allCvUrls.length ? selectedCvIndex : Math.max(0, allCvUrls.length - 1);
  const activeCvUrl = allCvUrls[safeCvIndex]?.url || formData.cv_url || '';

  const embeddableCvUrl = useMemo(() => {
    return getEmbeddableCvUrl(activeCvUrl);
  }, [activeCvUrl]);

  const activeApplications = useMemo(() => applications.filter(a => a.is_active !== false), [applications]);
  const archivedApplications = useMemo(() => applications.filter(a => a.is_active === false), [applications]);

  const renderApplicationCard = (app) => {
    const isExpanded = Boolean(expandedTimelines[app.application_id]);
    const logs = timelineLogs[app.application_id] || [];
    const isLoadingLog = Boolean(loadingLogs[app.application_id]);
    const stageColor = STAGE_COLOR_MAP[app.current_stage] || "bg-slate-800 text-slate-300 border-slate-700";

    return (
      <div
        key={app.application_id}
        className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col gap-3 transition-all hover:border-slate-700"
      >
        {/* Application Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-100 truncate">
                #{app.display_number || "?"} {app.job_title || "Untitled Position"}
              </span>
              <button
                type="button"
                onClick={() => setEditJobTarget(app)}
                className="text-slate-500 hover:text-emerald-400 cursor-pointer shrink-0"
                title="Edit Job (fix a wrong job assignment)"
              >
                <Pencil size={12} />
              </button>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Building size={12} className="text-slate-500" />
              <span>{app.client_name || "Unknown Client"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Status Dropdown (In Progress / Closed) */}
            <select
              value={app.status === "In progress" ? "In progress" : "Closed"}
              onChange={async (e) => {
                const newStatus = e.target.value;
                const res = await updateApplicationAction(app.application_id, { status: newStatus });
                if (res.success) {
                  notify(`✓ Application status updated to ${newStatus}`);
                  loadCandidateData(candidate.id);
                } else {
                  notify("Failed to update status: " + res.error);
                }
              }}
              className={`px-2 py-0.5 rounded-md text-xs font-bold border cursor-pointer ${
                app.status === "In progress"
                  ? "bg-blue-950 text-blue-300 border-blue-800"
                  : "bg-slate-900 text-slate-400 border-slate-700"
              }`}
              title="Update Application Status"
            >
              <option value="In progress" className="bg-slate-900 text-blue-300">In Progress</option>
              <option value="Closed" className="bg-slate-900 text-slate-400">Closed</option>
            </select>

            {/* 2. Stage Dropdown */}
            <select
              value={app.current_stage || "Talent Mapping"}
              onChange={async (e) => {
                const newStage = e.target.value;
                const res = await updateApplicationAction(app.application_id, { current_stage: newStage });
                if (res.success) {
                  notify(`✓ Stage updated to ${newStage}`);
                  loadCandidateData(candidate.id);
                } else {
                  notify("Failed to update stage: " + res.error);
                }
              }}
              className={`px-2 py-0.5 rounded-md text-xs font-bold border cursor-pointer ${stageColor}`}
              title="Update Pipeline Stage"
            >
              {CANDIDATE_STAGES_LIST.map(st => (
                <option key={st} value={st} className="bg-slate-900 text-slate-100">{st}</option>
              ))}
            </select>

            {app.result === "Failed" && (
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-rose-950 text-rose-300 border-rose-800 flex items-center gap-1 whitespace-nowrap">
                Failed {app.reason_failed ? `— ${app.reason_failed}` : ""}
              </span>
            )}

            {/* 3. Archive / Restore Button */}
            <button
              type="button"
              onClick={async () => {
                const willArchive = app.is_active !== false;
                if (willArchive && !window.confirm(`Archive application #${app.display_number}? It will be hidden from Action Menu, applicant counts, and this list by default — you can restore it anytime via "Show Archived".`)) {
                  return;
                }
                const res = await setApplicationActive(app.application_id, !willArchive);
                if (res.success) {
                  notify(willArchive ? "✓ Application archived" : "✓ Application restored");
                  loadCandidateData(candidate.id);
                } else {
                  notify("Failed: " + res.error);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={app.is_active === false ? "Restore this application" : "Archive this application (hide from all views, recoverable)"}
            >
              {app.is_active === false ? <ArchiveRestore size={12} /> : <Archive size={12} />}
              <span>{app.is_active === false ? "Restore" : "Archive"}</span>
            </button>

            {/* 4. Timeline Button */}
            <button
              type="button"
              onClick={() => toggleTimeline(app.application_id)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Clock size={12} className="text-emerald-400" />
              <span>Timeline</span>
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* Application Details */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            {app.source_channel && (
              <span>Source: <strong className="text-slate-300">{app.source_channel}</strong></span>
            )}
            <span className="flex items-center gap-1">
              <span>Planning:</span>
              <DateInputField
                value={app.planning_date || ""}
                onChange={async (newVal) => {
                  const res = await updateApplicationAction(app.application_id, { planning_date: newVal });
                  if (res.success) {
                    notify("✓ Planning date updated");
                    loadCandidateData(candidate.id);
                  }
                }}
                className="w-36 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] font-mono text-slate-200"
              />
            </span>
            <span className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-[10px] font-semibold text-slate-400">
              {app.acquisition_type || "Inbound Apply"}
            </span>
          </div>

          <Link
            href="/"
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>Open in Action Menu</span>
            <ExternalLink size={11} />
          </Link>
        </div>

        {/* Timeline Accordion Content */}
        {isExpanded && (
          <div className="mt-2 pt-3 border-t border-slate-800 flex flex-col gap-3 animate-in fade-in duration-150">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock size={13} className="text-emerald-400" />
              <span>Interview & Activity Timeline</span>
            </div>

            <ActivityLogPanel
              applicationId={app.application_id}
              currentStage={app.current_stage}
              result={app.result}
              reasonFailed={app.reason_failed}
              logs={logs}
              isLoadingLogs={isLoadingLog}
              onAddLog={handleAddTimelineNote}
              onEditLog={handleEditTimelineNote}
              onDeleteLog={handleDeleteTimelineNote}
              outcomeMode="readOnly"
              allowEditLog={true}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3 min-h-[calc(100vh-60px)]">
        <Loader2 size={32} className="animate-spin text-emerald-400" />
        <span className="text-xs font-semibold">Loading Candidate 360° Profile...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-[calc(100vh-60px)] overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-emerald-500 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle size={15} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ========================================================
          1. MASTER CANDIDATE WORKBENCH HEADER
      ======================================================== */}
      <header className="px-5 py-2.5 bg-slate-950 border-b border-slate-800/90 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Searchable Candidate Switcher */}
        <div className="flex items-center gap-3">
          <SearchableCandidateSwitcher
            currentCandidate={candidate}
            currentIndex={currentIndex}
            totalCount={totalCount}
            prevCandidateId={prevCandidateId}
            nextCandidateId={nextCandidateId}
            onSelectCandidate={handleSelectCandidate}
            onNavigatePrev={() => handleSelectCandidate(prevCandidateId)}
            onNavigateNext={() => handleSelectCandidate(nextCandidateId)}
            isLoading={loading}
          />
        </div>

        {/* Right: Quick Action Contact Pills & Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Call Pill */}
          {primaryPhone && (
            <button
              onClick={() => copyText(primaryPhone, "Phone")}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Click to copy phone number"
            >
              <Phone size={12} />
              <span>{primaryPhone}</span>
            </button>
          )}

          {/* Quick Zalo Pill */}
          {primaryPhone && (
            <a
              href={`https://zalo.me/${primaryPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare size={12} />
              <span>Zalo</span>
            </a>
          )}

          {/* Quick Email Pill */}
          {primaryEmail && (
            <a
              href={`mailto:${primaryEmail}`}
              className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Mail size={12} />
              <span>Email</span>
            </a>
          )}

          {/* Quick Preview CV Button */}
          {formData.cv_url && (
            <button
              onClick={() => setActiveTab("cv_viewer")}
              className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileText size={12} />
              <span>Preview CV</span>
            </button>
          )}

          {/* + Assign to Job Order Button */}
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
          >
            <Plus size={13} />
            <span>Assign to Job</span>
          </button>

          {/* + Parse CV (AI) Modal Button */}
          <button
            onClick={() => setShowCvUploadModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 border border-sky-600/60 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open CV upload modal for AI extraction & queue into CV Imports Queue"
          >
            <Sparkles size={13} />
            <span>+ Parse CV (AI)</span>
          </button>

          {/* Save to Google Contacts Button */}
          {candidate?.id && (
            <button
              onClick={async () => {
                if (isSyncingGoogleContacts) return;
                setIsSyncingGoogleContacts(true);
                try {
                  const res = await syncCandidatesToGoogleContacts([candidate.id]);
                  if (res.success) {
                    notify(`Đã gửi yêu cầu đồng bộ ${res.count} candidate tới Google Contacts`, 'success');
                  } else {
                    notify(`Lỗi: ${res.error}`);
                  }
                } finally {
                  setIsSyncingGoogleContacts(false);
                }
              }}
              disabled={isSyncingGoogleContacts}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-600/60 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save candidate to Google Contacts"
            >
              <Contact size={13} />
              <span>{isSyncingGoogleContacts ? 'Syncing...' : 'Save to Google Contacts'}</span>
            </button>
          )}

          {/* + New Candidate Button */}
          <button
            onClick={() => setShowNewCandidateModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-600/60 font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <UserPlus size={13} />
            <span>+ New Candidate</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          2. MAIN WORKSPACE CONTAINER (5:7 DUAL PANE LAYOUT)
      ======================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-4 gap-4">
        {/* ====================================================
            LEFT PANE: PERSONAL INFO & CONTACTS HUB (42% Width)
        ==================================================== */}
        <div className="w-full lg:w-[42%] shrink-0 lg:shrink flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
          {/* Card 1: Personal Information Form */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <User size={14} className="text-emerald-400" />
                <span>PERSONAL INFORMATION</span>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>

            {/* Prefix & Full Name */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Prefix
                </label>
                <select
                  value={formData.prefix}
                  onChange={e => setFormData({ ...formData, prefix: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {PREFIXES_LIST.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Pham Thi Cam Giang"
                />
              </div>
            </div>

            {/* DOB & Source Channel */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Date of Birth
                </label>
                <DateInputField
                  value={formData.dob}
                  onChange={newVal => setFormData({ ...formData, dob: newVal })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Source Channel
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. CV Parsing, LinkedIn..."
                />
              </div>
            </div>

            {/* Location / Address */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Location / Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="District, City, Country..."
              />
            </div>

            {/* CV URL & Versioning (read-only — moi thay doi CV phai qua "+ Parse CV (AI)") */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <span>CV Link (Google Drive / PDF)</span>
                  {allCvUrls.length > 1 && (
                    <span className="px-1.5 py-0.2 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded text-[9px] font-bold">
                      {allCvUrls.length} Versions
                    </span>
                  )}
                </label>
                {formData.cv_url && (
                  <a
                    href={activeCvUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
                  >
                    <span>Open direct</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <input
                type="url"
                value={formData.cv_url}
                readOnly
                disabled
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950/60 border border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                placeholder='No CV attached — use "+ Parse CV (AI)" above to add one'
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Read-only. To attach a new CV, use <strong className="text-sky-400">&quot;+ Parse CV (AI)&quot;</strong> above — it runs through AI extraction + review before updating this profile. Use the Delete button in the Embedded CV Viewer tab to remove a wrong/unwanted version.
              </p>
            </div>

            {/* Evaluation & Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Profile Evaluation & Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                placeholder="Recruiter evaluation, professional skills, highlights..."
              />
            </div>

            {/* Blacklist Status */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    size={15}
                    className={formData.blocked ? "text-rose-400" : "text-slate-500"}
                  />
                  <span
                    className={`text-xs font-bold ${
                      formData.blocked ? "text-rose-300" : "text-slate-400"
                    }`}
                  >
                    Blacklist Candidate
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.blocked}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      blocked: isChecked,
                      ...(isChecked ? {} : { blacklist_note: "" })
                    });
                  }}
                  className="rounded border-slate-700 text-rose-500 focus:ring-rose-500 bg-slate-900"
                />
              </label>

              {formData.blocked && (
                <input
                  type="text"
                  value={formData.blacklist_note}
                  onChange={e => setFormData({ ...formData, blacklist_note: e.target.value })}
                  placeholder="Reason for blacklisting..."
                  className="mt-2 w-full px-3 py-1.5 text-xs bg-rose-950/30 border border-rose-800 rounded-xl text-rose-200 placeholder-rose-700 focus:outline-none"
                />
              )}
            </div>
          </form>

          {/* Card 2: Contact Points Hub */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Phone size={14} className="text-emerald-400" />
                <span>CONTACT POINTS HUB ({contacts.length})</span>
              </div>
            </div>

            {/* Contact Points List */}
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                  No contact points registered yet.
                </div>
              ) : (
                contacts.map(c => {
                  const isEditing = editingContactId === c.id;
                  const isLink =
                    c.value.startsWith("http") ||
                    c.type === "LinkedIn" ||
                    c.type === "Facebook" ||
                    c.type === "Github" ||
                    c.type === "Personal Website";

                  if (isEditing) {
                    return (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-emerald-600/80 flex items-center gap-2"
                      >
                        <select
                          value={editContactType}
                          onChange={e => setEditContactType(e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                        >
                          {CONTACT_TYPES_LIST.map(ct => (
                            <option key={ct.value} value={ct.value}>
                              {ct.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editContactValue}
                          onChange={e => setEditContactValue(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                        />
                        <button
                          onClick={() => handleUpdateContact(c.id)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                          title="Save"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => setEditingContactId(null)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                          title="Cancel"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-2 group transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                          {c.type}
                        </span>
                        {isLink ? (
                          <a
                            href={c.value.startsWith("http") ? c.value : `https://${c.value}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate font-mono"
                          >
                            {c.value}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-200 truncate font-mono">
                            {c.value}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyText(c.value, c.type)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                          title="Copy"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingContactId(c.id);
                            setEditContactType(c.type || "Phone");
                            setEditContactValue(c.value || "");
                          }}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add New Contact Form */}
            <form
              onSubmit={handleAddContact}
              className="pt-2 border-t border-slate-800 flex items-center gap-2"
            >
              <select
                value={newContactType}
                onChange={e => setNewContactType(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 shrink-0"
              >
                {CONTACT_TYPES_LIST.map(ct => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newContactValue}
                onChange={e => setNewContactValue(e.target.value)}
                placeholder="Enter value or profile URL..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isAddingContact || !newContactValue.trim()}
                className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-50 transition-all shrink-0"
                title="Add Contact"
              >
                <Plus size={15} />
              </button>
            </form>
          </div>
        </div>

        {/* ====================================================
            RIGHT PANE: APPLICATIONS PIPELINE & CV VIEWER (58%)
        ==================================================== */}
        <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-w-0 min-h-[560px] lg:min-h-0">
          {/* Header Tabs */}
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("applications")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === "applications"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Briefcase size={14} />
                <span>Applications & Pipeline ({applications.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("cv_viewer")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === "cv_viewer"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <FileText size={14} />
                <span>Embedded CV Viewer</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              Candidate 360° View
            </div>
          </div>

          {/* Tab 1: Applications Pipeline */}
          {activeTab === "applications" && (
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
              {applications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 gap-3">
                  <Briefcase size={36} className="text-slate-600 stroke-[1.5]" />
                  <p className="text-xs font-semibold">
                    This candidate has not been assigned to any Job Orders yet.
                  </p>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                  >
                    <Plus size={14} />
                    <span>Assign to Job Order</span>
                  </button>
                </div>
              ) : (
                <>
                  {activeApplications.length === 0 && archivedApplications.length > 0 && (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No active applications. All {archivedApplications.length} application(s) are archived.
                    </div>
                  )}
                  {activeApplications.map(app => renderApplicationCard(app))}

                  {archivedApplications.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowArchived(prev => !prev)}
                        className="text-xs text-slate-500 hover:text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {showArchived ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span>{showArchived ? "Hide" : "Show"} Archived ({archivedApplications.length})</span>
                      </button>
                      {showArchived && (
                        <div className="mt-2 flex flex-col gap-3 opacity-70">
                          {archivedApplications.map(app => renderApplicationCard(app))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab 2: Embedded CV Viewer */}
          {activeTab === "cv_viewer" && (
            <div className="flex-1 flex flex-col bg-slate-950 p-2 overflow-hidden">
              {!embeddableCvUrl ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <FileText size={40} className="text-slate-600 stroke-[1.5]" />
                  <p className="text-xs font-semibold">
                    No valid Google Drive or PDF link attached to this profile.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm text-center">
                    Use the <strong className="text-sky-400">&quot;+ Parse CV (AI)&quot;</strong> button at the top of this page to attach a CV — it goes through AI extraction and review before updating this profile.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                  <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center flex-wrap gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      {allCvUrls.length > 0 && (
                        <select
                          value={safeCvIndex}
                          onChange={e => setSelectedCvIndex(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg px-2 py-1 outline-none focus:border-emerald-500"
                        >
                          {allCvUrls.map((cv, i) => (
                            <option key={i} value={i}>{cv.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                      {allCvUrls[safeCvIndex]?.arrayIndex !== null && allCvUrls[safeCvIndex]?.arrayIndex !== undefined && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCvVersion(allCvUrls[safeCvIndex].arrayIndex)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-[11px] flex items-center gap-1 font-semibold whitespace-nowrap transition-colors"
                          title="Delete this CV version"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      )}
                      <a
                        href={activeCvUrl || formData.cv_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 text-[11px] flex items-center gap-1 font-semibold whitespace-nowrap transition-colors"
                      >
                        <span>Open in New Tab</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                  <iframe
                    src={embeddableCvUrl}
                    className="flex-1 w-full h-full border-0 bg-white"
                    title="Embedded Candidate CV Viewer"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          3. MODALS
      ======================================================== */}
      {/* Assign to Job Order Modal */}
      <AssignToJobModal
        candidate={candidate}
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssigned={() => {
          notify("✓ Candidate successfully assigned to Job Order!");
          loadCandidateData(candidate.id);
        }}
      />

      {/* Edit Job Assignment Modal */}
      <EditJobModal
        application={editJobTarget}
        isOpen={!!editJobTarget}
        onClose={() => setEditJobTarget(null)}
        onChanged={() => {
          notify("✓ Job updated");
          loadCandidateData(candidate.id);
        }}
      />

      {/* New Candidate Sourcing Intake Modal */}
      <NewCandidateModal
        isOpen={showNewCandidateModal}
        onClose={() => setShowNewCandidateModal(false)}
        onCreated={newCand => {
          notify(`✓ Created candidate #${newCand.display_number} - ${newCand.full_name}`);
          handleSelectCandidate(newCand.id);
        }}
      />

      {/* CV Upload AI Extraction Modal */}
      <CVUploadModal
        isOpen={showCvUploadModal}
        onClose={() => setShowCvUploadModal(false)}
        onSuccess={count => {
          notify(`✓ Queued ${count} CV file(s) for AI processing!`);
        }}
      />

    </div>
  );
}

/**
 * Main Candidates Menu Page Component wrapped in React Suspense boundary.
 * 
 * @component
 * @returns {JSX.Element}
 */
export default function CandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 min-h-[calc(100vh-60px)]">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
        </div>
      }
    >
      <Candidate360Content />
    </Suspense>
  );
}
