"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  checkCandidateContactDuplicate,
  createCandidateWithStrictValidation,
  getJobs,
  getClients
} from "../app/actions";
import { SOURCE_CHANNELS_LIST, CANDIDATE_STAGES_LIST } from "../constants/enums";
import DateInputField from "./DateInputField";
import {
  UserPlus,
  X,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Phone,
  Mail,
  
  
  
  Globe,
  MessageSquare,
  FileText,
  Save,
  Clock,
  RotateCcw,
  Briefcase,
  Building,
  Check,
  Search,
  ChevronDown
} from "lucide-react";

const CONTACT_TYPES = [
  { value: "LinkedIn", label: "LinkedIn URL" },
  { value: "Phone", label: "Phone Number" },
  { value: "Email", label: "Email Address" },
  { value: "Facebook", label: "Facebook URL" },
  { value: "Zalo", label: "Zalo Phone/URL" },
  { value: "Github", label: "GitHub URL" },
  { value: "Skype", label: "Skype ID" },
  { value: "Personal Website", label: "Website/Blog" },
  { value: "Other", label: "Other Link/ID" }
];

// ========================================================
// REUSABLE SEARCHABLE SELECT (IDENTICAL UX TO ACTION MENU)
// ========================================================

/**
 * Reusable Searchable Select Dropdown Component.
 * 
 * Provides real-time query filtering, item count badges, active checkmark `✓`,
 * and quick clear `✕` button. Identical UX pattern to Action Menu comboboxes.
 * 
 * @component
 * @param {Object} props - Component properties.
 * @param {string} props.value - Selected option value.
 * @param {(val: string) => void} props.onChange - Selection change callback.
 * @param {Array<{value: string, label: string, count?: number, subLabel?: string}>} [props.options=[]] - List of selectable options.
 * @param {string} [props.placeholder="-- Select --"] - Placeholder label when nothing is selected.
 * @param {string} [props.searchPlaceholder="Type to search..."] - Search input placeholder text.
 * @param {string | null} [props.allLabel=null] - Optional label for 'ALL' option at top.
 * @param {boolean} [props.disabled=false] - Whether dropdown is disabled.
 * @returns {JSX.Element} The rendered searchable dropdown component.
 */
function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "-- Select --",
  searchPlaceholder = "Type to search...",
  allLabel = null,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

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

  const filteredOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(opt =>
      String(opt?.label || "").toLowerCase().includes(q) ||
      String(opt?.subLabel || "").toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectedOption = Array.isArray(options) ? options.find(o => o && o.value === value) : null;
  const displayLabel = selectedOption ? selectedOption.label : (allLabel && (value === "ALL" || !value) ? allLabel : placeholder);
  const isSelected = Boolean(value && value !== "ALL");

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearch("");
          }
        }}
        className={`w-full h-8 px-2.5 text-xs font-semibold rounded border flex items-center justify-between gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
              onChange(allLabel ? "ALL" : "");
            }}
            className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded p-0.5 shrink-0"
            title="Clear selection"
          >
            ✕
          </span>
        ) : (
          <ChevronDown size={13} className="text-slate-400 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden text-xs max-h-64">
          <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2 shrink-0">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
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

          <div className="overflow-y-auto scrollbar-thin p-1 space-y-0.5 flex-1">
            {allLabel && !search && (
              <div
                onClick={() => {
                  onChange("ALL");
                  setIsOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded cursor-pointer flex items-center justify-between transition-colors ${
                  value === "ALL" || !value
                    ? "bg-emerald-950 text-emerald-300 font-bold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{allLabel}</span>
                {(value === "ALL" || !value) && <Check size={12} className="text-emerald-400" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-slate-500 italic text-[11px]">
                No matching options found for "{search}"
              </div>
            ) : (
              filteredOptions.map((opt, optIdx) => {
                const active = value === opt.value;
                return (
                  <div
                    key={opt.value || `opt-${optIdx}`}
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
                    <div className="truncate flex-1">
                      <div className="truncate font-semibold">{opt.label}</div>
                      {opt.subLabel && <div className="text-[10px] text-slate-400 truncate">{opt.subLabel}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-950/80 px-1.5 py-0.2 rounded border border-slate-800">
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

          <div className="px-2.5 py-1 bg-slate-950 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between shrink-0">
            <span>{filteredOptions.length} of {options.length} options</span>
            {search && <span className="text-emerald-400">Filtering</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const INITIAL_FORM = {
  full_name: "",
  prefix: "Mr.",
  dob: "",
  address: "",
  cv_url: "",
  notes: "",
  contactPoints: [
    { type: "LinkedIn", value: "" }
  ],
  assignToJob: false,
  selectedClientId: "ALL",
  assignToJobId: "",
  initialStage: "Talent Mapping",
  sourceChannel: "LinkedIn"
};

/**
 * New Candidate Sourcing Intake Modal Component.
 * 
 * Enforces zero duplicate tolerance across all phone, email, and social profiles.
 * Features live debounced duplicate checking, direct conflict link `[↗ Open Profile]`,
 * automatic draft caching in `localStorage`, and linked Client-Job assignment dropdowns.
 * 
 * @component
 * @param {Object} props - Component properties.
 * @param {boolean} props.isOpen - Controls modal visibility.
 * @param {() => void} props.onClose - Callback triggered when modal is closed.
 * @param {(candidate: Object) => void} [props.onCreated] - Callback fired after candidate is successfully created.
 * @returns {JSX.Element | null} The rendered intake modal or null when closed.
 */
export default function NewCandidateModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [duplicateStatus, setDuplicateStatus] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  const [rawJobs, setRawJobs] = useState([]);
  const [rawClients, setRawClients] = useState([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const debounceCheckTimer = useRef(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem("ats_draft_new_candidate");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed && typeof parsed === "object") {
            setFormData(prev => ({
              ...prev,
              ...parsed,
              selectedClientId: parsed.selectedClientId || "ALL",
              contactPoints: parsed.contactPoints?.length > 0
                ? parsed.contactPoints
                : [{ type: "LinkedIn", value: "" }]
            }));
          }
        }
      } catch (err) {
        console.error("Failed to restore draft:", err);
      }

      setLoadingMetadata(true);
      Promise.all([getJobs(), getClients()])
        .then(([jobsRes, clientsRes]) => {
          if (jobsRes?.success && Array.isArray(jobsRes.data)) {
            setRawJobs(jobsRes.data.filter(j => j && j.status !== "Closed"));
          }
          if (clientsRes?.success && Array.isArray(clientsRes.data)) {
            setRawClients(clientsRes.data.filter(c => c && c.id));
          }
        })
        .catch(e => console.error("Error loading jobs/clients metadata:", e))
        .finally(() => setLoadingMetadata(false));
    }
  }, [isOpen]);

  const saveDraftLocally = useCallback((newData) => {
    try {
      localStorage.setItem("ats_draft_new_candidate", JSON.stringify(newData));
    } catch (e) {
      console.error("Local draft save failed:", e);
    }
  }, []);

  function handleFormChange(field, value) {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      saveDraftLocally(updated);
      return updated;
    });
    setErrorMessage("");
  }

  function handleContactChange(index, field, value) {
    setFormData(prev => {
      const newContacts = [...prev.contactPoints];
      newContacts[index] = { ...newContacts[index], [field]: value };
      const updated = { ...prev, contactPoints: newContacts };
      saveDraftLocally(updated);
      return updated;
    });
    setErrorMessage("");

    if (debounceCheckTimer.current) clearTimeout(debounceCheckTimer.current);
    debounceCheckTimer.current = setTimeout(() => {
      performSingleContactCheck(
        index,
        field === "type" ? value : formData.contactPoints[index]?.type,
        field === "value" ? value : formData.contactPoints[index]?.value
      );
    }, 350);
  }

  async function performSingleContactCheck(index, type, value) {
    const trimmed = (value || "").trim();
    if (!trimmed) {
      setDuplicateStatus(prev => ({
        ...prev,
        [index]: { isChecking: false, isDuplicate: false, matchInfo: null }
      }));
      return;
    }

    setDuplicateStatus(prev => ({
      ...prev,
      [index]: { isChecking: true, isDuplicate: false, matchInfo: null }
    }));

    try {
      const res = await checkCandidateContactDuplicate([{ type, value: trimmed }]);
      if (res.success && res.hasDuplicate && res.duplicates.length > 0) {
        setDuplicateStatus(prev => ({
          ...prev,
          [index]: {
            isChecking: false,
            isDuplicate: true,
            matchInfo: res.duplicates[0].matchedCandidate
          }
        }));
      } else {
        setDuplicateStatus(prev => ({
          ...prev,
          [index]: { isChecking: false, isDuplicate: false, matchInfo: null }
        }));
      }
    } catch (err) {
      console.error("Check duplicate failed:", err);
      setDuplicateStatus(prev => ({
        ...prev,
        [index]: { isChecking: false, isDuplicate: false, matchInfo: null }
      }));
    }
  }

  function handleAddContactPoint() {
    setFormData(prev => {
      const updated = {
        ...prev,
        contactPoints: [...prev.contactPoints, { type: "Phone", value: "" }]
      };
      saveDraftLocally(updated);
      return updated;
    });
  }

  function handleRemoveContactPoint(index) {
    if (formData.contactPoints.length <= 1) return;
    setFormData(prev => {
      const updatedContacts = prev.contactPoints.filter((_, i) => i !== index);
      const updated = { ...prev, contactPoints: updatedContacts };
      saveDraftLocally(updated);
      return updated;
    });
    setDuplicateStatus(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  }

  function handleClearDraft() {
    if (typeof window !== "undefined" && window.confirm("Are you sure you want to clear the candidate draft?")) {
      localStorage.removeItem("ats_draft_new_candidate");
      setFormData(INITIAL_FORM);
      setDuplicateStatus({});
      setErrorMessage("");
    }
  }

  // Client Options for Dropdown 1
  const clientMap = useMemo(() => {
    const map = {};
    if (Array.isArray(rawClients)) {
      rawClients.forEach(c => {
        if (c && c.id) map[c.id] = c.name || "Client Company";
      });
    }
    return map;
  }, [rawClients]);

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

  // Job Options for Dropdown 2 (Filtered by Client)
  const filteredJobOptions = useMemo(() => {
    if (!Array.isArray(rawJobs)) return [];
    const selectedClient = formData.selectedClientId;
    let list = rawJobs.filter(j => j && j.id);
    if (selectedClient && selectedClient !== "ALL") {
      list = list.filter(j => j.client_id === selectedClient);
    }
    return list
      .map(j => ({
        value: j.id,
        label: j.job_title || "Untitled Position",
        subLabel: selectedClient === "ALL" || !selectedClient ? (clientMap[j.client_id] || "Client Company") : null,
        status: j.status
      }))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
  }, [rawJobs, formData.selectedClientId, clientMap]);

  const validContactsCount = formData.contactPoints.filter(cp => cp && cp.value?.trim()).length;
  const hasAnyDuplicate = Object.values(duplicateStatus).some(st => st?.isDuplicate);
  const isAnyChecking = Object.values(duplicateStatus).some(st => st?.isChecking);
  const canSave = Boolean(formData.full_name?.trim()) && validContactsCount > 0 && !hasAnyDuplicate && !isAnyChecking && !isSaving;

  async function handleSaveCandidate(e) {
    if (e) e.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const res = await createCandidateWithStrictValidation({
        full_name: formData.full_name.trim(),
        prefix: formData.prefix,
        dob: formData.dob || null,
        address: formData.address || "",
        cv_url: formData.cv_url || "",
        notes: formData.notes || "",
        contactPoints: formData.contactPoints.filter(cp => cp && cp.value?.trim()),
        assignToJobId: formData.assignToJob ? formData.assignToJobId : null,
        initialStage: formData.initialStage,
        sourceChannel: formData.sourceChannel
      });

      if (res.success) {
        setSuccessMessage("Candidate created successfully!");
        localStorage.removeItem("ats_draft_new_candidate");
        setTimeout(() => {
          setSuccessMessage("");
          if (onCreated) onCreated(res.candidate);
          onClose();
        }, 600);
      } else {
        setErrorMessage(res.error || "Failed to create candidate.");
      }
    } catch (err) {
      console.error("Save candidate error:", err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0b1322] border border-emerald-800/80 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="bg-[#0e1a2f] px-5 py-3.5 border-b border-emerald-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-950 border border-emerald-600 rounded-lg text-emerald-400">
              <UserPlus size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">
                  New Candidate Sourcing Intake
                </h3>
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700/80 rounded text-emerald-400 font-mono text-[9px] font-bold">
                  Zero Duplicate Guard
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Live cross-database verification against 3,377+ profiles and all contact points
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-[10px] text-slate-400 hover:text-rose-400 px-2 py-1 bg-slate-900 hover:bg-rose-950/50 border border-slate-800 rounded flex items-center space-x-1 transition-colors cursor-pointer"
              title="Reset all fields"
            >
              <RotateCcw size={10} />
              <span>Clear Draft</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Close modal (Draft remains cached)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <form onSubmit={handleSaveCandidate} className="p-5 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
          
          {/* ERROR ALERT BANNER */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/90 border border-rose-600 rounded-lg text-rose-200 text-xs font-semibold flex items-start space-x-2">
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* SUCCESS BANNER */}
          {successMessage && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500 rounded-lg text-emerald-300 text-xs font-bold flex items-center space-x-2">
              <CheckCircle size={16} className="text-emerald-400 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* SECTION 1: PRIMARY IDENTITY */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                <span>1. Candidate Identification</span>
                <span className="text-rose-400 font-bold">*</span>
              </span>
              <span className="text-[10px] text-slate-500 italic">Prefix & Full Name</span>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3 sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Prefix</label>
                <select
                  value={formData.prefix}
                  onChange={(e) => handleFormChange("prefix", e.target.value)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 font-semibold focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Dr.">Dr.</option>
                </select>
              </div>

              <div className="col-span-9 sm:col-span-6">
                <label className="block text-[10px] font-bold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400 font-black">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nguyen Van An"
                  value={formData.full_name}
                  onChange={(e) => handleFormChange("full_name", e.target.value)}
                  className="w-full h-8 px-3 bg-slate-950 border border-slate-700 rounded text-slate-100 font-bold focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                />
              </div>

              <div className="col-span-12 sm:col-span-4">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Date of Birth</label>
                <DateInputField
                  value={formData.dob}
                  onChange={(newVal) => handleFormChange("dob", newVal)}
                  placeholder="Select DOB..."
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 focus:ring-1 focus:ring-emerald-500 text-[11px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Current Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. District 7, Ho Chi Minh City"
                  value={formData.address}
                  onChange={(e) => handleFormChange("address", e.target.value)}
                  className="w-full h-8 px-3 bg-slate-950 border border-slate-700 rounded text-slate-100 focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">CV / Portfolio Link</label>
                <input
                  type="url"
                  placeholder="e.g. https://drive.google.com/file/d/..."
                  value={formData.cv_url}
                  onChange={(e) => handleFormChange("cv_url", e.target.value)}
                  className="w-full h-8 px-3 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-[11px] focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CONTACT POINTS & STRICT ANTI-DUPLICATE ENGINE */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider">
                  2. Contact Points & Channels
                </span>
                <span className="px-1.5 py-0.2 bg-rose-950 border border-rose-700/80 rounded text-rose-300 font-bold text-[9px]">
                  At least 1 unique contact required
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddContactPoint}
                className="px-2 py-0.5 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Plus size={11} />
                <span>+ Add Channel</span>
              </button>
            </div>

            {/* CONTACT POINTS LIST */}
            <div className="space-y-2">
              {formData.contactPoints.map((cp, idx) => {
                const dupInfo = duplicateStatus[idx];
                const isChecking = dupInfo?.isChecking;
                const isDup = dupInfo?.isDuplicate;
                const match = dupInfo?.matchInfo;

                return (
                  <div key={`cp-${idx}`} className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <div className="flex items-center space-x-2">
                      {/* Contact Type Selector */}
                      <select
                        value={cp.type}
                        onChange={(e) => handleContactChange(idx, "type", e.target.value)}
                        className="w-36 h-8 px-2 bg-slate-900 border border-slate-700 rounded text-slate-200 font-semibold text-[11px] focus:ring-1 focus:ring-emerald-500 shrink-0"
                      >
                        {CONTACT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      {/* Contact Value Input */}
                      <div className="relative flex-1">
                        <input
                          type="text"
                          required
                          placeholder={
                            cp.type === "LinkedIn" ? "https://linkedin.com/in/username..." :
                            cp.type === "Phone" ? "0901234567 or +84..." :
                            cp.type === "Email" ? "name@domain.com" :
                            "Enter profile link or contact value..."
                          }
                          value={cp.value}
                          onChange={(e) => handleContactChange(idx, "value", e.target.value)}
                          className={`w-full h-8 pl-3 pr-8 bg-slate-900 border rounded text-slate-100 font-mono text-[11px] focus:ring-1 ${
                            isDup
                              ? "border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/50"
                              : cp.value?.trim() && !isChecking
                              ? "border-emerald-600 bg-emerald-950/20"
                              : "border-slate-700 focus:ring-emerald-500"
                          }`}
                        />

                        {/* Status Icon Indicator */}
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          {isChecking ? (
                            <Loader2 size={12} className="animate-spin text-amber-400" />
                          ) : isDup ? (
                            <AlertTriangle size={13} className="text-rose-400" />
                          ) : cp.value?.trim() ? (
                            <Check size={13} className="text-emerald-400" />
                          ) : null}
                        </div>
                      </div>

                      {/* Remove Button */}
                      {formData.contactPoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContactPoint(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer shrink-0"
                          title="Remove this contact point"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* DUPLICATE WARNING CARD */}
                    {isDup && match && (
                      <div className="p-2 bg-rose-950/90 border border-rose-700 rounded text-rose-200 text-[11px] flex items-center justify-between shadow-md">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                          <div>
                            <span className="font-bold text-rose-300">Conflict Detected:</span> Already belongs to Candidate{" "}
                            <strong className="text-white font-mono">#{match.display_number} - {match.full_name}</strong>
                          </div>
                        </div>

                        <Link
                          href={`/candidates/${match.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 bg-rose-900 hover:bg-rose-800 text-white font-bold rounded text-[10px] flex items-center space-x-1 shrink-0 ml-2 shadow-xs transition-colors"
                          title="Open existing candidate profile in new tab (Your draft remains saved)"
                        >
                          <span>↗ Open Profile</span>
                          <ExternalLink size={10} />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: SOURCING PIPELINE & LINKED CLIENT-JOB ASSIGNMENT */}
          <div className="space-y-2.5 pt-2 bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.assignToJob}
                  onChange={(e) => handleFormChange("assignToJob", e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wide flex items-center space-x-1.5">
                  <Briefcase size={12} className="text-emerald-400" />
                  <span>3. Attach Directly to Active Job Order Pipeline</span>
                </span>
              </label>

              <span className="text-[10px] text-slate-500">Auto-creates Action Menu tracking row</span>
            </div>

            {formData.assignToJob && (
              <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                {/* DUAL LINKED SELECTORS: CLIENT FIRST -> JOB POSITION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Dropdown 1: Select Client Company */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1 flex items-center space-x-1">
                      <Building size={11} className="text-emerald-400" />
                      <span>1. Select Client Company (Filter)</span>
                    </label>
                    <SearchableSelect
                      value={formData.selectedClientId}
                      onChange={(newClientId) => {
                        handleFormChange("selectedClientId", newClientId);
                        if (newClientId && newClientId !== "ALL") {
                          const matching = rawJobs.filter(j => j && j.client_id === newClientId);
                          if (!matching.some(j => j && j.id === formData.assignToJobId)) {
                            handleFormChange("assignToJobId", "");
                          }
                        }
                      }}
                      options={clientOptions}
                      allLabel={`All Clients (${clientOptions.length})`}
                      placeholder="-- Choose Client Company --"
                      searchPlaceholder="Search client (e.g. Beauty, Shopee)..."
                    />
                  </div>

                  {/* Dropdown 2: Select Job Order (Filtered) */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1 flex items-center space-x-1">
                      <Briefcase size={11} className="text-emerald-400" />
                      <span>2. Target Position</span>
                      <span className="text-emerald-400 font-bold">*</span>
                    </label>
                    <SearchableSelect
                      value={formData.assignToJobId}
                      onChange={(newJobId) => handleFormChange("assignToJobId", newJobId)}
                      options={filteredJobOptions}
                      placeholder={filteredJobOptions.length === 0 ? "No open jobs for this client" : "-- Choose Job Position --"}
                      searchPlaceholder="Search position (e.g. Java, Nurse, Marketing)..."
                      disabled={filteredJobOptions.length === 0}
                    />
                  </div>
                </div>

                {/* Stage and Source Channel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Initial Stage</label>
                    <select
                      value={formData.initialStage}
                      onChange={(e) => handleFormChange("initialStage", e.target.value)}
                      className="w-full h-8 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      {CANDIDATE_STAGES_LIST.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Source Channel</label>
                    <select
                      value={formData.sourceChannel}
                      onChange={(e) => handleFormChange("sourceChannel", e.target.value)}
                      className="w-full h-8 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      {SOURCE_CHANNELS_LIST.map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Sourcing Notes */}
            <div className="pt-1">
              <label className="block text-[10px] font-bold text-slate-400 mb-1">Initial Sourcing Notes & Background</label>
              <textarea
                rows={2}
                placeholder="e.g. Sourced via LinkedIn recruiter search. Currently Senior Backend Engineer (5 YoE, Golang/Python). Open to new opportunities."
                value={formData.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-[11px] focus:ring-1 focus:ring-emerald-500 placeholder-slate-600 resize-none"
              />
            </div>
          </div>

        </form>

        {/* MODAL FOOTER CONTROLS */}
        <div className="bg-[#0e1a2f] px-5 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          
          {/* Auto-Cache Notice */}
          <div className="flex items-center space-x-1 text-[10px] text-amber-400/80 font-mono">
            <Clock size={11} />
            <span>Draft automatically cached in browser</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveCandidate}
              disabled={!canSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-lg flex items-center space-x-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Validating & Creating...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save Candidate</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
