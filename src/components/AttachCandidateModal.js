"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  X, 
  Search, 
  Check, 
  Briefcase, 
  Building2, 
  UserPlus, 
  UserCheck, 
  Loader2, 
  AlertCircle, 
  ChevronDown, 
  ExternalLink,
  ShieldAlert,
  Phone,
  Mail,
  FileText,
  Clock,
  Send
} from "lucide-react";
import { getJobs, getClients, assignCandidateToJob, searchCandidatesServer } from "../app/actions";
import { CANDIDATE_STAGES, CANDIDATE_STAGES_LIST, SOURCE_CHANNELS_LIST } from "../constants/enums";
import SearchableCandidateDropdown from "./SearchableCandidateDropdown";
import DateInputField from "./DateInputField";

/**
 * Attach Candidate To Job Order Pipeline Modal.
 * 
 * Allows recruiters to source/mass-import candidates first, then attach any
 * candidate profile to an active client job order pipeline on-demand.
 * 
 * @component
 * @param {Object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility flag.
 * @param {() => void} props.onClose - Close callback.
 * @param {(app: Object) => void} [props.onAttached] - Success callback with new application.
 * @param {string | null} [props.preselectedCandidateId] - Optional preselected candidate ID.
 * @param {string | null} [props.preselectedJobId] - Optional preselected job ID.
 * @returns {JSX.Element | null} The rendered modal or null.
 */
export default function AttachCandidateModal({
  isOpen,
  onClose,
  onAttached,
  preselectedCandidateId = null,
  preselectedJobId = null
}) {
  const [candidatesList, setCandidatesList] = useState([]);
  const [rawJobs, setRawJobs] = useState([]);
  const [rawClients, setRawClients] = useState([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Selected State
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isChangingCandidate, setIsChangingCandidate] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("ALL");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [initialStage, setInitialStage] = useState("Talent Mapping");
  const [sourceChannel, setSourceChannel] = useState("Direct Sourcing (Headhunt)");
  const [planningDate, setPlanningDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [isPassive, setIsPassive] = useState(true);
  const [note, setNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);

  const clientDropdownRef = useRef(null);
  const jobDropdownRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setIsClientDropdownOpen(false);
      }
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target)) {
        setIsJobDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch metadata when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingMetadata(true);
      setErrorMessage("");

      Promise.all([
        getJobs(),
        getClients(),
        preselectedCandidateId ? searchCandidatesServer({ query: preselectedCandidateId, limit: 1 }) : Promise.resolve(null)
      ])
        .then(([jobsRes, clientsRes, candRes]) => {
          if (candRes?.success && Array.isArray(candRes.data) && candRes.data.length > 0) {
            setSelectedCandidate(candRes.data[0]);
            setIsChangingCandidate(false);
          } else if (!preselectedCandidateId) {
            setSelectedCandidate(null);
            setIsChangingCandidate(true);
          }

          if (jobsRes?.success && Array.isArray(jobsRes.data)) {
            const openJobs = jobsRes.data.filter(j => j && j.status !== "Closed");
            setRawJobs(openJobs);
            if (preselectedJobId) {
              setSelectedJobId(preselectedJobId);
              const targetJob = openJobs.find(j => j.id === preselectedJobId || j.job_id === preselectedJobId);
              if (targetJob && targetJob.client_id) {
                setSelectedClientId(targetJob.client_id);
              }
            }
          }

          if (clientsRes?.success && Array.isArray(clientsRes.data)) {
            setRawClients(clientsRes.data);
          }
        })
        .catch(err => {
          console.error("Error loading attach modal metadata:", err);
          setErrorMessage("Failed to load jobs and clients metadata. Please retry.");
        })
        .finally(() => setIsLoadingMetadata(false));
    }
  }, [isOpen, preselectedCandidateId, preselectedJobId]);

  // Client Options
  const clientOptions = useMemo(() => {
    if (!Array.isArray(rawClients)) return [];
    return rawClients
      .filter(c => c && c.id)
      .map(c => ({
        value: c.id,
        label: c.name || "Client Company",
        count: Array.isArray(rawJobs) ? rawJobs.filter(j => j && j.client_id === c.id).length : 0
      }))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
  }, [rawClients, rawJobs]);

  // Filtered Client Options based on search
  const filteredClientOptions = useMemo(() => {
    if (!clientSearch.trim()) return clientOptions;
    const q = clientSearch.toLowerCase();
    return clientOptions.filter(c => c.label.toLowerCase().includes(q));
  }, [clientOptions, clientSearch]);

  // Job Options (Filtered by Selected Client)
  const filteredJobOptions = useMemo(() => {
    if (!Array.isArray(rawJobs)) return [];
    let list = rawJobs.filter(j => j && j.id);
    if (selectedClientId && selectedClientId !== "ALL") {
      list = list.filter(j => j.client_id === selectedClientId);
    }
    return list
      .map(j => ({
        value: j.id,
        label: j.job_title || j.title || "Job Position",
        clientName: j.client_name || j.client || "Client Company",
        location: j.location || "Ho Chi Minh",
        candidateCount: j.candidate_count || 0
      }))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
  }, [rawJobs, selectedClientId]);

  // Filtered Job Options based on search
  const searchedJobOptions = useMemo(() => {
    if (!jobSearch.trim()) return filteredJobOptions;
    const q = jobSearch.toLowerCase();
    return filteredJobOptions.filter(j => 
      j.label.toLowerCase().includes(q) || 
      j.clientName.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q)
    );
  }, [filteredJobOptions, jobSearch]);

  const selectedClientObj = clientOptions.find(c => c.value === selectedClientId);
  const selectedJobObj = filteredJobOptions.find(j => j.value === selectedJobId);

  // Handle Submit
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCandidate) {
      setErrorMessage("Please select a candidate profile from the database.");
      return;
    }
    if (!selectedJobId) {
      setErrorMessage("Please select a target Job Order to attach the candidate to.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await assignCandidateToJob({
        candidateId: selectedCandidate.id,
        jobId: selectedJobId,
        sourceChannel,
        note: note.trim() || `Attached to pipeline: ${selectedJobObj?.label || 'Job Order'}`,
        initialStage,
        isPassive,
        planningDate
      });

      if (res?.success) {
        if (onAttached) onAttached(res.data);
        onClose();
      } else {
        setErrorMessage(res?.error || "Failed to attach candidate to job.");
      }
    } catch (err) {
      console.error("Attach candidate error:", err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center shadow-inner">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                ATTACH CANDIDATE TO JOB ORDER PIPELINE
              </h2>
              <p className="text-[11px] text-slate-400">
                Attach an existing candidate profile to an active job order to create an Action tracking record.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 1: SELECT CANDIDATE */}
          {/* ======================================================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} />
                1. Selected Candidate Profile
              </label>
              {selectedCandidate && !preselectedCandidateId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCandidate(null);
                    setIsChangingCandidate(true);
                  }}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 underline transition-colors cursor-pointer"
                >
                  Change Candidate
                </button>
              )}
            </div>

            {selectedCandidate && !isChangingCandidate ? (
              <div className="p-4 bg-slate-950/80 border border-emerald-900/60 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {selectedCandidate.prefix || "C"}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{selectedCandidate.full_name}</span>
                      <span className="text-xs text-emerald-400 font-mono font-bold">#{selectedCandidate.display_number}</span>
                      {selectedCandidate.blocked && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold flex items-center gap-1">
                          <ShieldAlert size={10} /> Blacklist
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {selectedCandidate.phones && selectedCandidate.phones.length > 0 && (
                        <span className="flex items-center gap-1 text-slate-300 font-mono">
                          <Phone size={11} className="text-slate-500" />
                          {selectedCandidate.phones[0]}
                        </span>
                      )}
                      {selectedCandidate.emails && selectedCandidate.emails.length > 0 && (
                        <span className="flex items-center gap-1 text-slate-300 font-mono">
                          <Mail size={11} className="text-slate-500" />
                          {selectedCandidate.emails[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {selectedCandidate.cv_url && (
                  <a
                    href={selectedCandidate.cv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-700/80 transition-colors shrink-0"
                    title="View candidate CV"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <SearchableCandidateDropdown
                  selectedId={selectedCandidate?.id}
                  autoFocus={true}
                  onSelect={(cand) => {
                    setSelectedCandidate(cand);
                    setIsChangingCandidate(false);
                    setErrorMessage("");
                  }}
                />
                <p className="text-[11px] text-slate-500 italic">
                  Type candidate name, phone number, email or Candidate ID to search server-side.
                </p>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: TARGET JOB ORDER & CLIENT */}
          {/* ======================================================== */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase size={14} />
              2. Target Job Order &amp; Client
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Filter By Client Company */}
              <div className="space-y-1 relative" ref={clientDropdownRef}>
                <label className="text-[11px] font-bold text-slate-400">Client Company</label>
                <button
                  type="button"
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-left text-xs flex items-center justify-between shadow-inner ${
                    selectedClientId !== "ALL" ? "border-emerald-500 text-emerald-300 font-bold" : "border-slate-700 text-slate-300"
                  }`}
                >
                  <span className="truncate">
                    {selectedClientId === "ALL" ? "All Active Clients" : selectedClientObj?.label || "Select Client..."}
                  </span>
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                </button>

                {isClientDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                    <div className="p-2 border-b border-slate-800 bg-slate-950">
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                        placeholder="Search client..."
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId("ALL");
                          setIsClientDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between ${
                          selectedClientId === "ALL" ? "bg-emerald-950/50 text-emerald-300 font-bold" : "hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <span>All Clients</span>
                        {selectedClientId === "ALL" && <Check size={12} className="text-emerald-400" />}
                      </button>

                      {filteredClientOptions.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            setSelectedClientId(c.value);
                            setIsClientDropdownOpen(false);
                            // Clear job if not belonging to this client
                            if (selectedJobId) {
                              const targetJob = rawJobs.find(j => j.id === selectedJobId);
                              if (targetJob && targetJob.client_id !== c.value) {
                                setSelectedJobId("");
                              }
                            }
                          }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between ${
                            selectedClientId === c.value ? "bg-emerald-950/50 text-emerald-300 font-bold" : "hover:bg-slate-800 text-slate-300"
                          }`}
                        >
                          <span className="truncate">{c.label}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({c.count} jobs)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Target Job Order Dropdown */}
              <div className="space-y-1 relative" ref={jobDropdownRef}>
                <label className="text-[11px] font-bold text-slate-400">
                  Target Job Position <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsJobDropdownOpen(!isJobDropdownOpen)}
                  className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-left text-xs flex items-center justify-between shadow-inner ${
                    selectedJobId ? "border-emerald-500 text-emerald-300 font-bold" : "border-slate-700 text-slate-400"
                  }`}
                >
                  <span className="truncate">
                    {selectedJobObj ? `${selectedJobObj.label} (${selectedJobObj.clientName})` : "Select Target Position..."}
                  </span>
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                </button>

                {isJobDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                    <div className="p-2 border-b border-slate-800 bg-slate-950">
                      <input
                        type="text"
                        value={jobSearch}
                        onChange={e => setJobSearch(e.target.value)}
                        placeholder="Search position..."
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin">
                      {searchedJobOptions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No open jobs available.
                        </div>
                      ) : (
                        searchedJobOptions.map(j => (
                          <button
                            key={j.value}
                            type="button"
                            onClick={() => {
                              setSelectedJobId(j.value);
                              setIsJobDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between ${
                              selectedJobId === j.value ? "bg-emerald-950/50 text-emerald-300 font-bold" : "hover:bg-slate-800 text-slate-300"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold truncate">{j.label}</div>
                              <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                                <span>{j.clientName}</span>
                                <span>•</span>
                                <span className="text-slate-500">{j.location}</span>
                              </div>
                            </div>
                            {selectedJobId === j.value && <Check size={12} className="text-emerald-400 shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: PIPELINE SETTINGS */}
          {/* ======================================================== */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} />
              3. Initial Stage & Sourcing Details
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Initial Stage */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Initial Stage</label>
                <select
                  value={initialStage}
                  onChange={e => setInitialStage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                >
                  {CANDIDATE_STAGES_LIST.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Source Channel */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Sourcing Channel</label>
                <select
                  value={sourceChannel}
                  onChange={e => setSourceChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                >
                  {SOURCE_CHANNELS_LIST.map(sc => (
                    <option key={sc} value={sc}>{sc}</option>
                  ))}
                </select>
              </div>

              {/* Sourcing Mode (Passive vs Active) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Candidate Type</label>
                <select
                  value={isPassive ? "PASSIVE" : "ACTIVE"}
                  onChange={e => setIsPassive(e.target.value === "PASSIVE")}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="PASSIVE">🔍 Headhunted (Passive)</option>
                  <option value="ACTIVE">📥 Inbound (Active)</option>
                </select>
              </div>

              {/* Planning Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Planning Date</label>
                <DateInputField
                  value={planningDate}
                  onChange={setPlanningDate}
                  placeholder="YYYY-MM-DD"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sourcing / Assessment Note */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400">Initial Sourcing Notes / Assessment</label>
              <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Sourced via LinkedIn recruiter search. Senior backend engineer with 5+ years experience, open to new fintech challenges..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

        </form>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedCandidate || !selectedJobId}
            className="px-5 py-2 text-xs font-extrabold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Attaching to Job...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Attach & Create Action Record</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
