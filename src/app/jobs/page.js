"use client";

import { Linkedin, Facebook, Github } from 'src/components/BrandIcons';
import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ActivityLogPanel from "src/components/ActivityLogPanel";
import DateInputField from "src/components/DateInputField";
import { stripAccents } from "src/lib/utils";
import { CANDIDATE_STAGES_LIST, CANDIDATE_STAGES } from "src/constants/enums";
import { 
  getClientWorkbenchData, 
  getJobWorkbenchDetails, 
  getActivityLogs, 
  updateClientField, 
  createClient, 
  updateJobField, 
  createJobForClient,
  updateApplicationAction,
  addActivityLog,
  updateActivityLog,
  deleteActivityLog,
  addClientPerson,
  updateClientPerson,
  deleteClientPerson,
  addPersonContactPoint,
  updatePersonContactPoint,
  deletePersonContactPoint,
  addClientBranch,
  updateClientBranch,
  deleteClientBranch,
  setHeadquarterBranch
} from "../actions";
import { 
  Building2, 
  Briefcase, 
  Users, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Loader2, 
  Lock, 
  User, 
  UserCheck, 
  Check, 
  X, 
  Building, 
  Phone, 
  Mail, 
  Globe, 
   
   
   
  MessageSquare, 
  Copy, 
  MapPin, 
  FileText, 
  ShieldAlert, 
  Maximize2, 
  Minimize2, 
  Search, 
  Save, 
} from "lucide-react";

// Helper function to resolve live Job Location from Client branches
function getJobLocationDisplay(job, branches) {
  if (job?.branch_id && Array.isArray(branches)) {
    const matchedBranch = branches.find(b => b.id === job.branch_id);
    if (matchedBranch) {
      if (matchedBranch.city && matchedBranch.address && matchedBranch.address !== matchedBranch.city) {
        return `${matchedBranch.city} — ${matchedBranch.address}`;
      }
      return matchedBranch.address || matchedBranch.city || "";
    }
  }
  return job?.location || "";
}

// Helper function to format Google Drive / Google Docs / PDF URL for direct iframe preview
function getEmbeddableJdUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();

  // Google Drive File Match (id between /d/ and /)
  const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Google Docs Document Match (id between /document/d/ and /)
  const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) {
    return `https://docs.google.com/document/d/${docMatch[1]}/preview`;
  }

  // Google Drive Open id match (?id=...)
  const driveIdMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`;
  }

  return trimmed;
}

// Custom Searchable Dropdown for Jobs Page Client Header
function SearchableClientDropdown({ clients, selectedClientId, onSelectClient }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Close when clicking outside
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

  // Filter clients by search query (matches display number or name)
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = stripAccents(search.trim());
    return clients.filter((c, i) => {
      const dispNum = String(c.display_number || i + 1);
      const name = stripAccents(c.name || "");
      return name.includes(q) || dispNum.includes(q);
    });
  }, [clients, search]);

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const selectedIndex = clients.findIndex(c => c.id === selectedClientId);
  const displayLabel = selectedClient 
    ? `#${selectedClient.display_number || (selectedIndex !== -1 ? selectedIndex + 1 : 1)} - ${selectedClient.name}` 
    : "Select Client...";

  // Sync active index when dropdown opens or filter changes
  useEffect(() => {
    if (isOpen) {
      const currentIdx = filteredClients.findIndex(c => c.id === selectedClientId);
      setActiveIndex(currentIdx !== -1 ? currentIdx : 0);
    }
  }, [isOpen, search, filteredClients, selectedClientId]);

  // Keyboard navigation (ArrowDown, ArrowUp, PageDown, PageUp, Enter, Escape)
  const handleKeyDown = (e) => {
    if (!isOpen || filteredClients.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(prev => Math.min(prev + 6, filteredClients.length - 1));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(prev => Math.max(prev - 6, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIndex >= 0 && activeIndex < filteredClients.length) {
        const picked = filteredClients[activeIndex];
        if (picked) {
          const originalIdx = clients.findIndex(item => item.id === picked.id);
          onSelectClient(originalIdx !== -1 ? originalIdx : 0);
          setIsOpen(false);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Auto scroll active item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("div[data-client-item='true']");
      const activeEl = items[activeIndex];
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [activeIndex, isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="h-7 px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-slate-600 rounded text-[11px] text-slate-200 font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer min-w-[200px] max-w-[260px] shadow-xs"
        title={displayLabel}
      >
        <span className="truncate text-left flex-1 font-mono text-[10px] sm:text-[11px]">
          {displayLabel}
        </span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div 
          onKeyDown={handleKeyDown}
          className="absolute right-0 top-full mt-1 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100"
          style={{ maxHeight: "360px" }}
        >
          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2 shrink-0">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client (e.g. Smilegate)..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-[11px] focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-500 hover:text-slate-300 text-[11px] p-0.5 rounded cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Options List with High-Contrast Scrollbar and Wheel Handler */}
          <div 
            ref={listRef}
            onWheel={(e) => e.stopPropagation()}
            style={{
              height: "260px",
              maxHeight: "260px",
              overflowY: "scroll",
              overflowX: "hidden",
              overscrollBehavior: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: "#059669 #020617"
            }}
            className="w-full overflow-y-scroll divide-y divide-slate-800/60 p-1 scrollbar-thin scrollbar-thumb-emerald-600/80 hover:scrollbar-thumb-emerald-500 scrollbar-track-slate-950"
          >
            {filteredClients.length === 0 ? (
              <div className="py-8 text-center text-slate-500 italic text-[11px]">
                No matching clients found for "{search}"
              </div>
            ) : (
              filteredClients.map((c, idx) => {
                const isCurrent = c.id === selectedClientId;
                const isActive = idx === activeIndex;
                const originalIndex = clients.findIndex(item => item.id === c.id);
                return (
                  <div
                    key={c.id}
                    data-client-item="true"
                    onClick={() => {
                      onSelectClient(originalIndex !== -1 ? originalIndex : 0);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`px-2.5 py-1.5 rounded cursor-pointer flex items-center justify-between gap-2 transition-colors shrink-0 ${
                      isCurrent
                        ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/80"
                        : isActive
                        ? "bg-slate-800/90 text-slate-100 border-l-2 border-l-emerald-500/50"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="truncate font-mono text-[11px]">
                      #{c.display_number || originalIndex + 1} - {c.name}
                    </span>
                    {isCurrent && <Check size={12} className="text-emerald-400 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer stats */}
          <div className="px-2.5 py-1 bg-slate-950 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between items-center shrink-0">
            <span>{filteredClients.length} of {clients.length} options</span>
            <span className="text-slate-500">Use ↑ / ↓ to select</span>
          </div>
        </div>
      )}
    </div>
  );
}

function JobsClientsWorkbenchContent() {
  const searchParams = useSearchParams();
  const jobIdParam = searchParams ? searchParams.get("job_id") : null;
  const clientIdParam = searchParams ? searchParams.get("client_id") : null;
  const clientNameParam = searchParams ? (searchParams.get("client_name") || searchParams.get("client")) : null;

  // Master Client State
  const [clients, setClients] = useState([]);
  const [currentClientIndex, setCurrentClientIndex] = useState(0);
  const [clientForm, setClientForm] = useState({
    id: "",
    display_number: "",
    name: "",
    location: "Ho Chi Minh",
    status: "Active",
    tax_code: "",
    address: "",
    branches: []
  });
  
  // Create New Client Draft State (Cached in LocalStorage)
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientDraft, setNewClientDraft] = useState({
    name: "",
    location: "Ho Chi Minh",
    status: "Active",
    tax_code: "",
    address: ""
  });
  const [savingNewClient, setSavingNewClient] = useState(false);

  // Client Branches State (On-Demand Branches & Locations Hub)
  const [showBranchesModal, setShowBranchesModal] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState({
    branch_name: "",
    city: "Ho Chi Minh",
    address: "",
    is_headquarter: false,
    phone: "",
    notes: ""
  });
  const [addingBranch, setAddingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [editingBranchData, setEditingBranchData] = useState({
    branch_name: "",
    city: "Ho Chi Minh",
    address: "",
    is_headquarter: false,
    phone: "",
    notes: ""
  });
  const [savingBranchEdit, setSavingBranchEdit] = useState(false);

  // Client Persons & Contact Points State (On-Demand Stakeholder Hub)
  const [clientPersons, setClientPersons] = useState([]);
  const [showContactsModal, setShowContactsModal] = useState(false);
  
  // Add new Person Form
  const [newPersonForm, setNewPersonForm] = useState({
    full_name: "",
    job_title: "HR",
    department: "",
    is_primary: false,
    initial_type: "Phone",
    initial_value: ""
  });
  const [addingPerson, setAddingPerson] = useState(false);

  // Edit Person Form
  const [editingPersonId, setEditingPersonId] = useState(null);
  const [editingPersonData, setEditingPersonData] = useState({
    full_name: "",
    job_title: "HR",
    department: "",
    is_primary: false,
    notes: ""
  });
  const [savingPersonEdit, setSavingPersonEdit] = useState(false);

  // Add Contact Point to specific Person
  const [activeAddPointPersonId, setActiveAddPointPersonId] = useState(null);
  const [newPointData, setNewPointData] = useState({
    type: "Phone",
    value: "",
    is_primary: false
  });
  const [savingNewPoint, setSavingNewPoint] = useState(false);

  // Edit specific Contact Point inside a Person
  const [editingPointKey, setEditingPointKey] = useState(null); // `${personId}___${pointId}`
  const [editingPointData, setEditingPointData] = useState({
    type: "Phone",
    value: "",
    is_primary: false
  });
  const [savingPointEdit, setSavingPointEdit] = useState(false);

  // Clipboard feedback
  const [copiedText, setCopiedText] = useState(null);

  // Jobs State (Left Column)
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [addingJob, setAddingJob] = useState(false);
  const [activeWorkingModeJobId, setActiveWorkingModeJobId] = useState(null);
  const [showJdLinkInput, setShowJdLinkInput] = useState(false);

  // Job Inline Editing States (Double-click to edit)
  const [editingJobTitleId, setEditingJobTitleId] = useState(null);
  const [tempJobTitle, setTempJobTitle] = useState("");
  const [editingLocationJobId, setEditingLocationJobId] = useState(null);
  const [tempLocation, setTempLocation] = useState("");

  // Applications & Right Tab State: 'applications' | 'jd_viewer'
  const [activeRightTab, setActiveRightTab] = useState("applications");
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [isAppsMaximized, setIsAppsMaximized] = useState(false);

  // Timeline Accordion States per Application (Single-focus by default for airy feel)
  const [expandedAppIds, setExpandedAppIds] = useState({});
  const [appLogsMap, setAppLogsMap] = useState({});
  const [logsLoadingMap, setLogsLoadingMap] = useState({});

  // Global Page Loading
  const [pageLoading, setPageLoading] = useState(true);

  // Sequence-guard chong stale-overwrite khi chuyen Client/Job nhanh (cung nguyen ly selectRowSequenceRef o page.js)
  const clientSeqRef = useRef(0); // bump moi khi CLIENT context doi
  const jobSeqRef = useRef(0);    // bump moi khi JOB context doi (bao gom ca khi Client doi, vi Job cung doi theo)

  // Initial & Param-based Load
  useEffect(() => {
    loadInitialWorkbench();
  }, [jobIdParam, clientIdParam, clientNameParam]);

  async function loadInitialWorkbench() {
    const mySeq = ++clientSeqRef.current;
    ++jobSeqRef.current;
    setPageLoading(true);
    const res = await getClientWorkbenchData({ 
      jobId: jobIdParam || null,
      clientId: clientIdParam || null,
      clientName: clientNameParam || null,
      clientIndex: 0 
    });
    if (mySeq !== clientSeqRef.current) return;
    if (res.success) {
      setClients(res.clients || []);
      setCurrentClientIndex(res.currentIndex || 0);
      if (res.currentClient) setClientForm(res.currentClient);
      setClientPersons(res.clientPersons || []);
      setJobs(res.jobs || []);
      if (res.selectedJob) {
        setSelectedJobId(res.selectedJob.id);
        setSelectedJob(res.selectedJob);
      } else {
        setSelectedJobId(null);
        setSelectedJob(null);
      }
      setApplications(res.applications || []);
      setExpandedAppIds({}); // Clean & collapsed by default
      setAppLogsMap({});
    }
    setPageLoading(false);
  }

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("ats_draft_new_client");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.name || parsed.tax_code || parsed.address)) {
          setNewClientDraft(parsed);
          setIsCreatingClient(true);
        }
      }
    } catch (e) {
      console.error("Error loading cached new client draft:", e);
    }
  }, []);

  // Client Navigator
  async function navigateClient(targetIndex) {
    if (targetIndex < 0 || targetIndex >= clients.length) return;
    const targetClient = clients[targetIndex];
    if (!targetClient) return;

    if (isCreatingClient) {
      setIsCreatingClient(false);
    }

    const mySeq = ++clientSeqRef.current;
    ++jobSeqRef.current;

    setCurrentClientIndex(targetIndex);
    setClientForm(targetClient);
    setEditingPersonId(null);
    setActiveAddPointPersonId(null);
    setEditingPointKey(null);
    setLoadingApps(true);

    const res = await getClientWorkbenchData({ clientId: targetClient.id, clientIndex: targetIndex });
    if (mySeq !== clientSeqRef.current) return;
    if (res.success) {
      setClientPersons(res.clientPersons || []);
      setJobs(res.jobs || []);
      const firstJob = res.selectedJob || null;
      setSelectedJobId(firstJob ? firstJob.id : null);
      setSelectedJob(firstJob);
      setApplications(res.applications || []);
      setExpandedAppIds({});
      setAppLogsMap({});
    }
    setLoadingApps(false);
  }

  // Update Client Field Inline (For Existing Client)
  async function handleClientFieldChange(field, value) {
    if (field === 'name' && (!value || (typeof value === 'string' && value.trim() === ""))) {
      alert("Tên Client không được để trống");
      const prevName = clients[currentClientIndex]?.name || "";
      setClientForm(prev => ({ ...prev, name: prevName }));
      return;
    }

    const finalValue = (typeof value === 'string') ? value.trim() : value;
    setClientForm(prev => ({ ...prev, [field]: value }));
    if (clientForm.id) {
      await updateClientField(clientForm.id, field, finalValue);
      setClients(prev => prev.map((c, i) => i === currentClientIndex ? { ...c, [field]: finalValue } : c));
    }
  }

  // Update New Client Draft (Auto-cache to localStorage)
  function handleUpdateNewClientDraft(field, value) {
    setNewClientDraft(prev => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem("ats_draft_new_client", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }

  // Start creating new client (Draft Mode)
  function handleStartCreateNewClient() {
    setIsCreatingClient(true);
    setShowBranchesModal(false);
    setShowContactsModal(false);
    try {
      const cached = localStorage.getItem("ats_draft_new_client");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.name || parsed.tax_code || parsed.address)) {
          setNewClientDraft(parsed);
          return;
        }
      }
    } catch (e) {}
    setNewClientDraft({
      name: "",
      location: "Ho Chi Minh",
      status: "Active",
      tax_code: "",
      address: ""
    });
  }

  // Cancel creating new client
  function handleCancelCreateNewClient() {
    setIsCreatingClient(false);
    setNewClientDraft({
      name: "",
      location: "Ho Chi Minh",
      status: "Active",
      tax_code: "",
      address: ""
    });
    try {
      localStorage.removeItem("ats_draft_new_client");
    } catch (e) {}
  }

  // Save New Client to Database
  async function handleSaveNewClient() {
    if (!newClientDraft.name || !newClientDraft.name.trim()) {
      alert("Please enter a Client / Company Name before saving.");
      return;
    }
    setSavingNewClient(true);
    const res = await createClient({
      name: newClientDraft.name.trim(),
      location: newClientDraft.location || "Ho Chi Minh",
      status: newClientDraft.status || "Active",
      tax_code: newClientDraft.tax_code ? newClientDraft.tax_code.trim() : "",
      address: newClientDraft.address ? newClientDraft.address.trim() : ""
    });

    if (res.success && res.client) {
      ++clientSeqRef.current;
      ++jobSeqRef.current;
      const createdCl = { ...res.client, branches: [] };
      const updatedList = [createdCl, ...clients];
      setClients(updatedList);
      setCurrentClientIndex(0);
      setClientForm(createdCl);
      setClientPersons([]);
      setJobs([]);
      setSelectedJobId(null);
      setSelectedJob(null);
      setApplications([]);
      setExpandedAppIds({});
      setAppLogsMap({});
      setIsCreatingClient(false);
      try {
        localStorage.removeItem("ats_draft_new_client");
      } catch (e) {}
    } else {
      alert("Failed to create client: " + (res.error || "Unknown error"));
    }
    setSavingNewClient(false);
  }

  // Branch Handlers
  async function handleAddBranch() {
    if (!clientForm.id || !newBranchForm.branch_name.trim()) return;
    const mySeq = clientSeqRef.current;
    setAddingBranch(true);
    const res = await addClientBranch(clientForm.id, {
      branchName: newBranchForm.branch_name.trim(),
      city: newBranchForm.city,
      address: newBranchForm.address.trim(),
      isHeadquarter: newBranchForm.is_headquarter,
      phone: newBranchForm.phone.trim(),
      notes: newBranchForm.notes.trim()
    });
    if (mySeq !== clientSeqRef.current) { setAddingBranch(false); return; }
    if (res.success) {
      setClientForm(prev => ({
        ...prev,
        branches: res.branches,
        ...(newBranchForm.is_headquarter ? { location: newBranchForm.city, address: newBranchForm.address.trim() } : {})
      }));
      setClients(prev => prev.map(c => c.id === clientForm.id ? {
        ...c,
        branches: res.branches,
        ...(newBranchForm.is_headquarter ? { location: newBranchForm.city, address: newBranchForm.address.trim() } : {})
      } : c));
      setNewBranchForm({
        branch_name: "",
        city: "Ho Chi Minh",
        address: "",
        is_headquarter: false,
        phone: "",
        notes: ""
      });
    }
    setAddingBranch(false);
  }

  async function handleSaveEditBranch(branchId) {
    if (!clientForm.id || !branchId || !editingBranchData.branch_name.trim()) return;
    const mySeq = clientSeqRef.current;
    setSavingBranchEdit(true);
    const res = await updateClientBranch(clientForm.id, branchId, {
      branchName: editingBranchData.branch_name.trim(),
      city: editingBranchData.city,
      address: editingBranchData.address.trim(),
      isHeadquarter: editingBranchData.is_headquarter,
      phone: editingBranchData.phone.trim(),
      notes: editingBranchData.notes.trim()
    });
    if (mySeq !== clientSeqRef.current) { setSavingBranchEdit(false); return; }
    if (res.success) {
      setClientForm(prev => ({
        ...prev,
        branches: res.branches,
        ...(editingBranchData.is_headquarter ? { location: editingBranchData.city, address: editingBranchData.address.trim() } : {})
      }));
      setClients(prev => prev.map(c => c.id === clientForm.id ? {
        ...c,
        branches: res.branches,
        ...(editingBranchData.is_headquarter ? { location: editingBranchData.city, address: editingBranchData.address.trim() } : {})
      } : c));
      setEditingBranchId(null);
    }
    setSavingBranchEdit(false);
  }

  async function handleDeleteBranch(branchId) {
    if (!clientForm.id || !branchId) return;
    if (!confirm("Are you sure you want to delete this branch?")) return;
    if (branchId === 'default_hq') {
      await handleClientFieldChange("address", "");
      return;
    }
    const mySeq = clientSeqRef.current;
    const res = await deleteClientBranch(clientForm.id, branchId);
    if (mySeq !== clientSeqRef.current) return;
    if (res.success) {
      setClientForm(prev => {
        const updated = { ...prev, branches: res.branches };
        const hq = res.branches.find(b => b.is_headquarter);
        if (hq) {
          updated.location = hq.city;
          updated.address = hq.address;
        }
        return updated;
      });
      setClients(prev => prev.map(c => {
        if (c.id === clientForm.id) {
          const updated = { ...c, branches: res.branches };
          const hq = res.branches.find(b => b.is_headquarter);
          if (hq) {
            updated.location = hq.city;
            updated.address = hq.address;
          }
          return updated;
        }
        return c;
      }));
    }
  }

  async function handleSetHeadquarter(branchId) {
    if (!clientForm.id || !branchId) return;
    const mySeq = clientSeqRef.current;
    const res = await setHeadquarterBranch(clientForm.id, branchId);
    if (mySeq !== clientSeqRef.current) return;
    if (res.success) {
      setClientForm(prev => ({
        ...prev,
        branches: res.branches,
        location: res.headquarter.city,
        address: res.headquarter.address
      }));
      setClients(prev => prev.map(c => c.id === clientForm.id ? {
        ...c,
        branches: res.branches,
        location: res.headquarter.city,
        address: res.headquarter.address
      } : c));
    }
  }

  // Copy to clipboard helper
  function copyToClipboard(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(label || text);
    setTimeout(() => setCopiedText(null), 2000);
  }

  // Contact icon helper
  function renderContactIcon(type) {
    const t = String(type || '').toLowerCase();
    if (t.includes("phone") || t.includes("tel")) return <Phone size={12} className="text-emerald-400" />;
    if (t.includes("email") || t.includes("mail")) return <Mail size={12} className="text-blue-400" />;
    if (t.includes("zalo")) return <MessageSquare size={12} className="text-cyan-400" />;
    if (t.includes("linkedin")) return <Linkedin size={12} className="text-sky-400" />;
    if (t.includes("facebook")) return <Facebook size={12} className="text-blue-500" />;
    if (t.includes("github") || t.includes("gitlab")) return <Github size={12} className="text-slate-200" />;
    if (t.includes("skype")) return <MessageSquare size={12} className="text-sky-300" />;
    if (t.includes("website") || t.includes("blog")) return <Globe size={12} className="text-emerald-300" />;
    return <Globe size={12} className="text-purple-400" />;
  }

  // Helper to parse contact points
  function parsePoints(points) {
    if (Array.isArray(points)) return points;
    if (typeof points === 'string') {
      try { return JSON.parse(points); } catch(e) { return []; }
    }
    return [];
  }

  // Count total contact channels across all persons
  const totalChannelsCount = clientPersons.reduce((acc, p) => acc + parsePoints(p.contact_points).length, 0);

  // Additional non-HQ branches list
  const additionalBranches = (clientForm.branches || []).filter(b => !b.is_headquarter);

  // 1. Add Person (Họ tên + Chức vụ + Điểm liên lạc ban đầu)
  async function handleAddPerson(e) {
    e?.preventDefault();
    if (!clientForm.id || !newPersonForm.full_name.trim()) return;
    const mySeq = clientSeqRef.current;
    setAddingPerson(true);
    const res = await addClientPerson({
      clientId: clientForm.id,
      fullName: newPersonForm.full_name.trim(),
      jobTitle: newPersonForm.job_title || "HR",
      department: newPersonForm.department || "",
      isPrimary: newPersonForm.is_primary || false,
      initialContactType: newPersonForm.initial_type || "Phone",
      initialContactValue: newPersonForm.initial_value || ""
    });
    if (mySeq !== clientSeqRef.current) { setAddingPerson(false); return; }
    if (res.success && res.person) {
      setClientPersons(prev => [...prev, res.person]);
      setNewPersonForm({
        full_name: "",
        job_title: "HR",
        department: "",
        is_primary: false,
        initial_type: "Phone",
        initial_value: ""
      });
    }
    setAddingPerson(false);
  }

  // 2. Edit Person Info
  function handleStartEditPerson(person) {
    setEditingPersonId(person.id);
    setEditingPersonData({
      full_name: person.full_name || "",
      job_title: person.job_title || "HR",
      department: person.department || "",
      is_primary: Boolean(person.is_primary),
      notes: person.notes || ""
    });
  }

  async function handleSaveEditPerson(personId) {
    if (!editingPersonData) return;
    setSavingPersonEdit(true);
    const res = await updateClientPerson(personId, {
      fullName: editingPersonData.full_name,
      jobTitle: editingPersonData.job_title,
      department: editingPersonData.department,
      isPrimary: editingPersonData.is_primary,
      notes: editingPersonData.notes
    });
    if (res.success && res.person) {
      setClientPersons(prev => prev.map(p => p.id === personId ? { ...p, ...res.person } : p));
      setEditingPersonId(null);
    }
    setSavingPersonEdit(false);
  }

  // 3. Delete Person
  async function handleDeletePerson(personId) {
    if (!confirm("Delete this person and all their contact channels from this client?")) return;
    const res = await deleteClientPerson(personId);
    if (res.success) {
      setClientPersons(prev => prev.filter(p => p.id !== personId));
    }
  }

  // 4. Add Contact Point to a Person
  async function handleSaveNewContactPoint(personId) {
    if (!personId || !newPointData.value.trim()) return;
    setSavingNewPoint(true);
    const res = await addPersonContactPoint(personId, {
      type: newPointData.type || "Phone",
      value: newPointData.value.trim(),
      isPrimary: newPointData.is_primary || false
    });
    if (res.success && res.person) {
      setClientPersons(prev => prev.map(p => p.id === personId ? { ...p, contact_points: res.person.contact_points } : p));
      setActiveAddPointPersonId(null);
      setNewPointData({ type: "Phone", value: "", is_primary: false });
    }
    setSavingNewPoint(false);
  }

  // 5. Edit specific Contact Point inside a Person
  function handleStartEditPoint(personId, cp) {
    setEditingPointKey(`${personId}___${cp.id}`);
    setEditingPointData({
      type: cp.type || "Phone",
      value: cp.value || "",
      is_primary: Boolean(cp.is_primary)
    });
  }

  async function handleSaveEditPoint(personId, contactPointId) {
    if (!personId || !contactPointId || !editingPointData.value.trim()) return;
    setSavingPointEdit(true);
    const res = await updatePersonContactPoint(personId, contactPointId, {
      type: editingPointData.type,
      value: editingPointData.value.trim(),
      isPrimary: editingPointData.is_primary
    });
    if (res.success && res.person) {
      setClientPersons(prev => prev.map(p => p.id === personId ? { ...p, contact_points: res.person.contact_points } : p));
      setEditingPointKey(null);
    }
    setSavingPointEdit(false);
  }

  // 6. Delete Contact Point from a Person
  async function handleDeleteContactPoint(personId, contactPointId) {
    if (!confirm("Delete this contact channel from this person?")) return;
    const res = await deletePersonContactPoint(personId, contactPointId);
    if (res.success && res.person) {
      setClientPersons(prev => prev.map(p => p.id === personId ? { ...p, contact_points: res.person.contact_points } : p));
    }
  }

  // Select Job Handler
  async function handleSelectJob(job) {
    if (job.id === selectedJobId) return;
    const mySeq = ++jobSeqRef.current;
    setSelectedJobId(job.id);
    setSelectedJob(job);
    setLoadingApps(true);

    const res = await getJobWorkbenchDetails(job.id);
    if (mySeq !== jobSeqRef.current) return;
    if (res.success) {
      setApplications(res.applications || []);
      setExpandedAppIds({});
      setAppLogsMap({});
    }
    setLoadingApps(false);
  }

  // Update Job Field
  async function handleUpdateJobField(jobId, field, value) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, [field]: value } : j));
    if (selectedJob && selectedJob.id === jobId) {
      setSelectedJob(prev => ({ ...prev, [field]: value }));
    }
    await updateJobField(jobId, field, value);
  }

  // Update Multiple Job Fields
  async function handleUpdateJobFields(jobId, fieldsObj) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...fieldsObj } : j));
    if (selectedJob && selectedJob.id === jobId) {
      setSelectedJob(prev => ({ ...prev, ...fieldsObj }));
    }
    for (const [field, value] of Object.entries(fieldsObj)) {
      await updateJobField(jobId, field, value);
    }
  }

  // Toggle Working Mode for a Job (Multiple select)
  function handleToggleWorkingMode(jobId, mode) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const currentModes = Array.isArray(job.working_mode) ? job.working_mode : [];
    let nextModes;
    if (currentModes.includes(mode)) {
      nextModes = currentModes.filter(m => m !== mode);
    } else {
      nextModes = [...currentModes, mode];
    }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, working_mode: nextModes } : j));
    if (selectedJob?.id === jobId) {
      setSelectedJob(prev => ({ ...prev, working_mode: nextModes }));
    }
    handleUpdateJobField(jobId, "working_mode", nextModes);
  }

  // Add Job for Client
  async function handleAddJob(e) {
    e?.preventDefault();
    if (!newJobTitle.trim()) {
      alert("Vui lòng nhập tên Job Order trước khi tạo.");
      return;
    }
    if (!clientForm.id) return;
    const mySeq = clientSeqRef.current;
    setAddingJob(true);
    const res = await createJobForClient(clientForm.id, {
      job_title: newJobTitle.trim(),
      location: clientForm.location || "Ho Chi Minh",
      status: "Open",
      working_mode: ["On-site"]
    });
    if (mySeq !== clientSeqRef.current) { setAddingJob(false); return; }
    if (res.success && res.job) {
      ++jobSeqRef.current;
      setJobs(prev => [res.job, ...prev]);
      setSelectedJobId(res.job.id);
      setSelectedJob(res.job);
      setApplications([]);
      setExpandedAppIds({});
      setAppLogsMap({});
      setNewJobTitle("");
    }
    setAddingJob(false);
  }

  // Toggle Expand Timeline for an Application (Focus single active candidate for clean layout)
  async function toggleExpandApp(appId) {
    const isCurrentlyExpanded = Boolean(expandedAppIds[appId]);
    const nextState = !isCurrentlyExpanded;
    
    // Focus single candidate accordion to maximize screen breathing room
    setExpandedAppIds(nextState ? { [appId]: true } : {});

    // If expanding and logs not fetched yet, fetch now
    if (nextState && !appLogsMap[appId]) {
      setLogsLoadingMap(prev => ({ ...prev, [appId]: true }));
      const res = await getActivityLogs(appId);
      if (res.success) {
        setAppLogsMap(prev => ({ ...prev, [appId]: res.data || [] }));
      }
      setLogsLoadingMap(prev => ({ ...prev, [appId]: false }));
    }
  }

  // Update Application Field
  async function handleUpdateAppField(appId, field, value) {
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, [field]: value } : a));
    await updateApplicationAction(appId, { [field]: value });
  }

  // Đồng bộ lại current_stage/result/reason_failed/note_failure_reason ở state `applications`
  function syncApplicationFromLogs(appId, logs) {
    setApplications(prev => prev.map(a => {
      if (a.id !== appId) return a;
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

  // Add Action Log to Application
  async function handleAddLogToApp(appId, logData) {
    const res = await addActivityLog({
      application_id: appId,
      action_type: logData.action_type,
      note: logData.note,
      result: logData.result,
      reason_failed: logData.reason_failed,
      action_date: logData.action_date,
    });
    if (res.success) {
      const refreshed = await getActivityLogs(appId);
      if (refreshed.success) {
        setAppLogsMap(prev => ({ ...prev, [appId]: refreshed.data || [] }));
        syncApplicationFromLogs(appId, refreshed.data || []);
      }
    }
    return res;
  }

  // Save Edit Log
  async function handleEditLogInApp(appId, logId, logData) {
    const res = await updateActivityLog(logId, appId, logData);
    if (res.success) {
      const refreshed = await getActivityLogs(appId);
      if (refreshed.success) {
        setAppLogsMap(prev => ({ ...prev, [appId]: refreshed.data || [] }));
        syncApplicationFromLogs(appId, refreshed.data || []);
      }
    }
    return res;
  }

  // Delete Action Log from Application
  async function handleDeleteLogFromApp(appId, logId) {
    const res = await deleteActivityLog(logId, appId);
    if (res.success) {
      const refreshed = await getActivityLogs(appId);
      if (refreshed.success) {
        setAppLogsMap(prev => ({ ...prev, [appId]: refreshed.data || [] }));
        syncApplicationFromLogs(appId, refreshed.data || []);
      }
    }
    return res;
  }

  // Stage Badge Colors
  function getStageBadgeClass(stage) {
    const s = String(stage || '').toLowerCase();
    if (s.includes('onboard')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
    if (s.includes('offer')) return 'bg-green-500/20 text-green-300 border-green-500/50';
    if (s.includes('interview')) return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
    if (s.includes('send cv') || s.includes('client')) return 'bg-pink-500/20 text-pink-300 border-pink-500/50';
    if (s.includes('mapping')) return 'bg-slate-700 text-slate-300 border-slate-600';
    if (s.includes('received') || s.includes('cv')) return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
    if (s.includes('fail') || s.includes('reject')) return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
    return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
  }

  if (pageLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#070b14] text-slate-100 h-full">
        <Loader2 size={32} className="animate-spin text-emerald-500 mb-2" />
        <p className="text-xs font-semibold text-slate-400">Loading Jobs & Clients Workbench...</p>
      </div>
    );
  }

  const currentJobIndex = jobs.findIndex(j => j.id === selectedJobId);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070b14] text-slate-200 overflow-hidden select-none font-sans text-[11px]">

      {/* ======================================================== */}
      {/* TIER 1: AIRY, COMPACT MASTER CLIENT TOOLBAR (1-ROW PRO)  */}
      {/* ======================================================== */}
      <div className="bg-[#0e1626] border-b border-slate-800/90 px-3.5 py-2.5 shrink-0 shadow-sm flex flex-col space-y-2">
        
        {/* ROW 1: PRIMARY CLIENT ATTRIBUTES & ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {isCreatingClient ? (
            <>
              {/* Draft Client Name & Status */}
              <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
                <span className="px-2 py-0.5 bg-amber-950/90 border border-amber-500/80 rounded text-amber-300 font-mono font-bold text-[10px] uppercase shrink-0 shadow-inner flex items-center space-x-1 animate-pulse">
                  <span>✨ DRAFT</span>
                </span>
                <input
                  type="text"
                  autoFocus
                  value={newClientDraft.name}
                  onChange={(e) => handleUpdateNewClientDraft("name", e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNewClient()}
                  placeholder="Enter Company / Client Name (Required)..."
                  className="flex-1 max-w-[340px] h-7 px-2.5 bg-slate-950 border border-amber-500 rounded text-slate-100 font-bold text-xs focus:ring-1 focus:ring-amber-500 shadow-inner placeholder-slate-500"
                />
                
                {/* Status Selector */}
                <select
                  value={newClientDraft.status || "Active"}
                  onChange={(e) => handleUpdateNewClientDraft("status", e.target.value)}
                  className="h-7 px-2 bg-slate-950 border border-slate-700/90 rounded text-slate-200 text-[10px] font-bold cursor-pointer shrink-0"
                >
                  <option value="Active">🟢 Active</option>
                  <option value="Inactive">⚪ Inactive</option>
                  <option value="Lead">🔵 Lead</option>
                  <option value="Pending">🟡 Pending</option>
                  <option value="Closed">🔴 Closed</option>
                </select>
              </div>

              {/* Middle: Tax ID */}
              <div className="flex items-center space-x-2 shrink-0">
                <div className="flex items-center space-x-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  <span className="font-mono text-[9px] text-slate-400 uppercase font-bold">Tax ID:</span>
                  <input
                    type="text"
                    value={newClientDraft.tax_code || ""}
                    onChange={(e) => handleUpdateNewClientDraft("tax_code", e.target.value)}
                    placeholder="N/A"
                    className="w-20 bg-transparent border-none text-slate-300 font-mono text-[10px] focus:outline-none p-0"
                  />
                </div>
              </div>

              {/* Right: Save & Cancel Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveNewClient}
                  disabled={savingNewClient}
                  className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center space-x-1.5 cursor-pointer text-[11px] shadow-sm transition-all shrink-0"
                  title="Save new client to database"
                >
                  {savingNewClient ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Client</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelCreateNewClient}
                  className="h-7 px-2.5 bg-slate-800 hover:bg-rose-950 hover:border-rose-700 hover:text-rose-200 border border-slate-700 text-slate-300 font-semibold rounded flex items-center space-x-1 cursor-pointer text-[10px] transition-all shrink-0"
                  title="Discard draft and return to previous client"
                >
                  <X size={12} />
                  <span>Cancel</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Left: Client Name & ID */}
              <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
                <span className="w-12 h-6 flex items-center justify-center bg-slate-900 border border-slate-700 rounded text-emerald-400 font-mono font-bold text-xs shrink-0 shadow-inner">
                  #{clientForm.display_number || currentClientIndex + 1}
                </span>
                <input
                  type="text"
                  value={clientForm.name || ""}
                  onChange={(e) => handleClientFieldChange("name", e.target.value)}
                  placeholder="Company / Client Name..."
                  className="flex-1 max-w-[320px] h-7 px-2.5 bg-slate-950 border border-slate-700/90 rounded text-slate-100 font-bold text-xs focus:ring-1 focus:ring-emerald-500 shadow-inner"
                />
                
                {/* Status Selector */}
                <select
                  value={clientForm.status || "Active"}
                  onChange={(e) => handleClientFieldChange("status", e.target.value)}
                  className="h-7 px-2 bg-slate-950 border border-slate-700/90 rounded text-slate-200 text-[10px] font-bold cursor-pointer shrink-0"
                >
                  <option value="Active">🟢 Active</option>
                  <option value="Inactive">⚪ Inactive</option>
                  <option value="Lead">🔵 Lead</option>
                  <option value="Pending">🟡 Pending</option>
                  <option value="Closed">🔴 Closed</option>
                </select>
              </div>

              {/* Middle: Tax ID */}
              <div className="flex items-center space-x-2 shrink-0">
                <div className="flex items-center space-x-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  <span className="font-mono text-[9px] text-slate-400 uppercase font-bold">Tax ID:</span>
                  <input
                    type="text"
                    value={clientForm.tax_code || ""}
                    onChange={(e) => handleClientFieldChange("tax_code", e.target.value)}
                    placeholder="N/A"
                    className="w-20 bg-transparent border-none text-slate-300 font-mono text-[10px] focus:outline-none p-0"
                  />
                </div>
              </div>

              {/* Right: ON-DEMAND CLIENT CONTACTS BUTTON & ACCESS NAVIGATION */}
              <div className="flex items-center space-x-2 shrink-0">
                
                {/* ON-DEMAND TRIGGER FOR BRANCHES & LOCATIONS */}
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchesModal(prev => !prev);
                    if (!showBranchesModal && showContactsModal) setShowContactsModal(false);
                  }}
                  className={`h-7 px-2.5 rounded text-[11px] font-bold flex items-center space-x-1.5 border transition-all cursor-pointer shadow-xs ${
                    showBranchesModal
                      ? "bg-blue-950 text-blue-300 border-blue-600 ring-1 ring-blue-500/50"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600"
                  }`}
                  title="Manage Client Branches & Office Locations"
                >
                  <MapPin size={13} className={additionalBranches.length > 0 ? "text-blue-400" : "text-slate-400"} />
                  <span>Branches</span>
                  <span className="px-1.5 py-0.2 bg-slate-950 text-blue-400 rounded-full font-mono text-[10px] font-bold border border-slate-800">
                    {additionalBranches.length}
                  </span>
                  {showBranchesModal ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {/* ON-DEMAND TRIGGER FOR STAKEHOLDERS & CONTACT PERSONS */}
                <button
                  type="button"
                  onClick={() => {
                    setShowContactsModal(prev => !prev);
                    if (!showContactsModal && showBranchesModal) setShowBranchesModal(false);
                  }}
                  className={`h-7 px-2.5 rounded text-[11px] font-bold flex items-center space-x-1.5 border transition-all cursor-pointer shadow-xs ${
                    showContactsModal
                      ? "bg-emerald-950 text-emerald-300 border-emerald-600 ring-1 ring-emerald-500/50"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600"
                  }`}
                  title="Toggle Client Contacts & Stakeholders Drawer"
                >
                  <UserCheck size={13} className={clientPersons.length > 0 ? "text-emerald-400" : "text-slate-400"} />
                  <span>Contacts</span>
                  <span className="px-1.5 py-0.2 bg-slate-950 text-emerald-400 rounded-full font-mono text-[10px] font-bold border border-slate-800">
                    {clientPersons.length}
                  </span>
                  {showContactsModal ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {/* Searchable Client Selector */}
                <SearchableClientDropdown 
                  clients={clients} 
                  selectedClientId={clientForm.id} 
                  onSelectClient={navigateClient} 
                />

                {/* New Client Button */}
                <button
                  type="button"
                  onClick={handleStartCreateNewClient}
                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center space-x-1 cursor-pointer text-[10px] shadow-sm transition-all shrink-0"
                  title="Create New Client"
                >
                  <Plus size={12} />
                  <span>New Client</span>
                </button>

              </div>
            </>
          )}
        </div>

        {/* ROW 2: HEADQUARTERS & BRANCHES OVERVIEW SUB-LINE */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded border border-slate-900">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span className="font-bold text-slate-400 uppercase tracking-wide shrink-0 flex items-center space-x-1">
                <Building size={11} className={isCreatingClient ? "text-amber-400" : "text-emerald-400"} />
                <span>HQ Address:</span>
              </span>
              {isCreatingClient ? (
                <input
                  type="text"
                  value={newClientDraft.address || ""}
                  onChange={(e) => handleUpdateNewClientDraft("address", e.target.value)}
                  placeholder="Headquarters street address (optional)..."
                  className="flex-1 bg-transparent border-none text-amber-200 text-[10px] focus:outline-none p-0 placeholder-slate-600 font-medium"
                />
              ) : (
                <input
                  type="text"
                  value={clientForm.address || ""}
                  onChange={(e) => handleClientFieldChange("address", e.target.value)}
                  placeholder="Headquarters street address (optional)..."
                  className="flex-1 bg-transparent border-none text-slate-200 text-[10px] focus:outline-none p-0 placeholder-slate-600 font-medium"
                />
              )}
            </div>

            {/* Quick Branch Overview Badge / Local Cache Indicator */}
            <div className="flex items-center space-x-2 shrink-0 pl-2">
              {isCreatingClient ? (
                <span className="text-[9px] text-amber-400/80 italic font-mono flex items-center space-x-1">
                  <Clock size={10} />
                  <span>Draft auto-saved locally</span>
                </span>
              ) : additionalBranches.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchesModal(true);
                    if (showContactsModal) setShowContactsModal(false);
                  }}
                  className="flex items-center space-x-1 text-[10px] text-blue-300 bg-blue-950/80 hover:bg-blue-900 border border-blue-800/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  title="Click to view and manage all branches"
                >
                  <MapPin size={10} className="text-blue-400" />
                  <span className="font-bold">{additionalBranches.length} {additionalBranches.length === 1 ? "Branch" : "Branches"}</span>
                  <span className="text-slate-400 text-[9px]">
                    ({additionalBranches.map(b => b.city).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(", ")})
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchesModal(true);
                    if (showContactsModal) setShowContactsModal(false);
                  }}
                  className="text-[9px] text-slate-500 hover:text-blue-400 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <Plus size={10} />
                  <span>+ Add Branch</span>
                </button>
              )}
            </div>
          </div>

          {/* DYNAMIC ADDITIONAL BRANCH ADDRESS ROWS (Visible directly without clicking drawer) */}
          {!isCreatingClient && additionalBranches
            .filter(b => b.address && b.address.trim().toLowerCase() !== (clientForm.address || "").trim().toLowerCase())
            .map((branch) => (
              <div 
                key={branch.id} 
                className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-950/40 px-2.5 py-0.5 rounded border border-slate-900/80 hover:border-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="font-bold text-blue-400 uppercase tracking-wide shrink-0 flex items-center space-x-1">
                    <Building size={10} className="text-blue-400" />
                    <span>{branch.branch_name || "Branch"}:</span>
                  </span>
                  <span className="text-blue-300 font-semibold shrink-0 text-[9px] px-1 py-0.2 bg-blue-950/60 border border-blue-800/40 rounded">
                    {branch.city}
                  </span>
                  <span className="text-slate-200 truncate flex-1 font-medium">
                    {branch.address || "No detailed address"}
                  </span>
                  {branch.phone && (
                    <span className="text-slate-400 font-mono text-[9px] shrink-0 pl-1 flex items-center space-x-0.5">
                      <Phone size={9} />
                      <span>{branch.phone}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0 pl-2">
                  {branch.address && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(branch.address, `hdr_${branch.id}`)}
                      className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer"
                      title="Copy Branch Address"
                    >
                      {copiedText === `hdr_${branch.id}` ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowBranchesModal(true);
                      setEditingBranchId(branch.id);
                      setEditingBranchData({
                        branch_name: branch.branch_name || "",
                        city: branch.city || "Ho Chi Minh",
                        address: branch.address || "",
                        is_headquarter: Boolean(branch.is_headquarter),
                        phone: branch.phone || "",
                        notes: branch.notes || ""
                      });
                    }}
                    className="p-0.5 text-slate-500 hover:text-blue-300 rounded cursor-pointer"
                    title="Edit Branch Information"
                  >
                    <Edit3 size={10} />
                  </button>
                </div>
              </div>
          ))}
        </div>

      </div>

      {/* ======================================================== */}
      {/* ON-DEMAND STAKEHOLDER CARDS HUB (PERSON + CONTACT POINTS) */}
      {/* ======================================================== */}
      {showContactsModal && (
        <div className="bg-[#09101f] border-b border-emerald-900/60 px-4 py-3 shrink-0 shadow-lg animate-in slide-in-from-top-2 duration-200 flex flex-col space-y-2.5">
          
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Users size={14} className="text-emerald-400" />
              <span className="font-bold text-slate-100 text-xs uppercase tracking-wide">
                Stakeholders & Client Contacts Hub — <span className="text-emerald-300 normal-case">{clientForm.name}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                {clientPersons.length} Persons • {totalChannelsCount} Channels
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                HR Managers • Talent Acquisition • CTO / Hiring Leads • Decision Makers
              </span>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer transition-colors"
                title="Close Contacts Panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* STAKEHOLDER PERSON CARDS (List of distinct people, each with their own contact channels) */}
          <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-2.5 pr-1">
            {clientPersons.length === 0 ? (
              <div className="text-center py-4 text-slate-500 italic text-[11px]">
                No contact persons recorded for this client yet. Add one using the form below.
              </div>
            ) : (
              clientPersons.map((person) => {
                const isEditingPerson = editingPersonId === person.id;
                const contactPoints = parsePoints(person.contact_points);
                const isAddingPoint = activeAddPointPersonId === person.id;

                return (
                  <div 
                    key={person.id}
                    className="bg-slate-950/90 border border-slate-800/90 hover:border-slate-700 rounded-xl p-2.5 space-y-2 shadow-xs transition-colors group"
                  >
                    {/* Person Header / Edit Row */}
                    {isEditingPerson ? (
                      <div className="p-2 bg-slate-900 border border-emerald-500/80 rounded-lg flex flex-wrap items-center gap-2 text-[10px]">
                        <input
                          type="text"
                          value={editingPersonData.full_name}
                          onChange={(e) => setEditingPersonData({ ...editingPersonData, full_name: e.target.value })}
                          placeholder="Full Name (e.g. Ms. Lan Anh)..."
                          className="w-44 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 font-bold focus:ring-1 focus:ring-emerald-500"
                        />
                        <input
                          type="text"
                          value={editingPersonData.job_title}
                          onChange={(e) => setEditingPersonData({ ...editingPersonData, job_title: e.target.value })}
                          placeholder="Job Title (e.g. HR Manager)..."
                          className="w-40 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:ring-1 focus:ring-emerald-500"
                        />
                        <input
                          type="text"
                          value={editingPersonData.department}
                          onChange={(e) => setEditingPersonData({ ...editingPersonData, department: e.target.value })}
                          placeholder="Department (optional)..."
                          className="w-36 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:ring-1 focus:ring-emerald-500"
                        />
                        <label className="inline-flex items-center space-x-1 cursor-pointer bg-slate-950 px-2 py-1 rounded border border-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(editingPersonData.is_primary)}
                            onChange={(e) => setEditingPersonData({ ...editingPersonData, is_primary: e.target.checked })}
                            className="w-3 h-3 text-emerald-500 rounded accent-emerald-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-bold text-amber-300">⭐ Primary</span>
                        </label>

                        <button
                          type="button"
                          disabled={savingPersonEdit || !editingPersonData.full_name.trim()}
                          onClick={() => handleSaveEditPerson(person.id)}
                          className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded font-bold cursor-pointer flex items-center space-x-1"
                        >
                          {savingPersonEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />}
                          <span>Save Person</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPersonId(null)}
                          className="h-6 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        
                        {/* Left: Avatar + Full Name + Role Badge + Primary Tag */}
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                            <User size={12} />
                          </div>
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="font-bold text-slate-100 text-xs">{person.full_name}</span>
                            {person.job_title && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-emerald-400 font-semibold rounded">
                                {person.job_title}
                              </span>
                            )}
                            {person.department && (
                              <span className="text-[9px] text-slate-400 font-mono">
                                • {person.department}
                              </span>
                            )}
                            {person.is_primary && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold rounded">
                                ⭐ Primary Contact
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Actions on this Person */}
                        <div className="flex items-center space-x-1 shrink-0">
                          {/* Add Contact Channel Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAddPointPersonId(isAddingPoint ? null : person.id);
                              setNewPointData({ type: "Phone", value: "", is_primary: false });
                            }}
                            className={`h-6 px-2 rounded text-[10px] font-bold flex items-center space-x-1 border transition-all cursor-pointer ${
                              isAddingPoint
                                ? "bg-emerald-600 text-white border-emerald-500"
                                : "bg-slate-900 hover:bg-slate-800 text-emerald-300 border-slate-700"
                            }`}
                            title="Add phone, email, zalo, or URL for this person"
                          >
                            <Plus size={11} />
                            <span>Add Channel</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEditPerson(person)}
                            className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-900 rounded cursor-pointer"
                            title="Edit Person Name & Role"
                          >
                            <Edit3 size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePerson(person.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded cursor-pointer"
                            title="Delete Person"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                      </div>
                    )}

                    {/* Inline Add Contact Channel Form for this Person */}
                    {isAddingPoint && (
                      <div className="p-2 bg-slate-900/95 rounded-lg border border-emerald-600/70 flex flex-wrap sm:flex-nowrap items-center gap-1.5 text-[10px] animate-in fade-in duration-150">
                        <span className="text-emerald-400 font-bold px-1">+</span>
                        <select
                          value={newPointData.type}
                          onChange={(e) => setNewPointData({ ...newPointData, type: e.target.value })}
                          className="h-6 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 text-[10px] font-semibold cursor-pointer shrink-0"
                        >
                          <option value="Phone">Phone</option>
                          <option value="Email">Email</option>
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="Zalo">Zalo</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Website">Website</option>
                          <option value="Skype">Skype</option>
                          <option value="Telegram">Telegram</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          value={newPointData.value}
                          onChange={(e) => setNewPointData({ ...newPointData, value: e.target.value })}
                          placeholder="Phone number, Email address, or Profile URL..."
                          className="flex-1 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-[10px] focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          disabled={savingNewPoint || !newPointData.value.trim()}
                          onClick={() => handleSaveNewContactPoint(person.id)}
                          className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded font-bold cursor-pointer flex items-center space-x-1 shrink-0"
                        >
                          {savingNewPoint ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />}
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAddPointPersonId(null)}
                          className="h-6 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer shrink-0"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}

                    {/* Person Contact Channels (Pills / Badges with Direct Inline Edit) */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {contactPoints.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic pl-1">
                          No contact channels recorded yet. Click <strong>Add Channel</strong> to add phone/email.
                        </span>
                      ) : (
                        contactPoints.map((cp) => {
                          const isEditingThisPoint = editingPointKey === `${person.id}___${cp.id}`;

                          if (isEditingThisPoint) {
                            return (
                              <div key={cp.id} className="flex items-center gap-1.5 p-1 bg-slate-900 border border-emerald-500 rounded-lg text-[10px] animate-in fade-in duration-100">
                                <select
                                  value={editingPointData.type}
                                  onChange={(e) => setEditingPointData({ ...editingPointData, type: e.target.value })}
                                  className="h-5 px-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-[10px] font-semibold cursor-pointer"
                                >
                                  <option value="Phone">Phone</option>
                                  <option value="Email">Email</option>
                                  <option value="LinkedIn">LinkedIn</option>
                                  <option value="Zalo">Zalo</option>
                                  <option value="Facebook">Facebook</option>
                                  <option value="Website">Website</option>
                                  <option value="Skype">Skype</option>
                                  <option value="Telegram">Telegram</option>
                                  <option value="Other">Other</option>
                                </select>
                                <input
                                  type="text"
                                  value={editingPointData.value}
                                  onChange={(e) => setEditingPointData({ ...editingPointData, value: e.target.value })}
                                  placeholder="Phone, email or URL..."
                                  className="h-5 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-[10px] w-44 focus:ring-1 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  disabled={savingPointEdit || !editingPointData.value.trim()}
                                  onClick={() => handleSaveEditPoint(person.id, cp.id)}
                                  className="h-5 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded font-bold cursor-pointer flex items-center space-x-1"
                                  title="Save Channel Changes"
                                >
                                  {savingPointEdit ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPointKey(null)}
                                  className="h-5 px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                                  title="Cancel"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={cp.id}
                              className="flex items-center space-x-1.5 px-2 py-1 bg-slate-900/90 border border-slate-800 rounded-lg hover:border-slate-700 text-[10px] group/cp transition-colors"
                            >
                              <span className="shrink-0">{renderContactIcon(cp.type)}</span>
                              <span className="font-bold text-[9px] text-slate-400 uppercase font-mono">{cp.type}</span>
                              <span className="font-mono text-emerald-300 font-semibold select-all">{cp.value}</span>
                              
                              {/* Actions on this channel */}
                              <div className="flex items-center space-x-1 pl-1 border-l border-slate-800">
                                {cp.type === "Phone" && (
                                  <a href={`tel:${cp.value}`} className="text-emerald-400 hover:text-emerald-300 p-0.5" title="Call">
                                    <Phone size={10} />
                                  </a>
                                )}
                                {cp.type === "Email" && (
                                  <a href={`mailto:${cp.value}`} className="text-blue-400 hover:text-blue-300 p-0.5" title="Send Email">
                                    <Mail size={10} />
                                  </a>
                                )}
                                {(cp.type === "LinkedIn" || cp.type === "Facebook" || cp.type === "Website") && (
                                  <a href={cp.value.startsWith("http") ? cp.value : `https://${cp.value}`} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 p-0.5" title="Open Link">
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(cp.value, cp.type)}
                                  className="text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                                  title="Copy"
                                >
                                  {copiedText === cp.type ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPoint(person.id, cp)}
                                  className="text-slate-500 hover:text-amber-300 cursor-pointer p-0.5"
                                  title="Edit this channel"
                                >
                                  <Edit3 size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteContactPoint(person.id, cp.id)}
                                  className="text-slate-600 hover:text-rose-400 cursor-pointer p-0.5"
                                  title="Delete Channel"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Quick Add Person Form (*) */}
          <form onSubmit={handleAddPerson} className="pt-2 flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 border-t border-slate-800">
            <span className="text-emerald-400 font-bold text-xs shrink-0 w-3 text-center">*</span>
            
            <input
              type="text"
              value={newPersonForm.full_name}
              onChange={(e) => setNewPersonForm({ ...newPersonForm, full_name: e.target.value })}
              placeholder="Person Full Name (e.g. Ms. Lan Anh)..."
              className="w-48 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-100 font-bold placeholder-slate-600 focus:ring-1 focus:ring-emerald-500"
            />

            <input
              type="text"
              value={newPersonForm.job_title}
              onChange={(e) => setNewPersonForm({ ...newPersonForm, job_title: e.target.value })}
              placeholder="Role (e.g. HR Manager / CTO)..."
              className="w-44 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500"
            />

            <select
              value={newPersonForm.initial_type}
              onChange={(e) => setNewPersonForm({ ...newPersonForm, initial_type: e.target.value })}
              className="h-6 px-2 bg-slate-950 border border-slate-700 rounded text-slate-200 text-[10px] font-semibold cursor-pointer shrink-0"
            >
              <option value="Phone">Phone</option>
              <option value="Email">Email</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Zalo">Zalo</option>
              <option value="Facebook">Facebook</option>
              <option value="Website">Website</option>
              <option value="Skype">Skype</option>
              <option value="Telegram">Telegram</option>
            </select>

            <input
              type="text"
              value={newPersonForm.initial_value}
              onChange={(e) => setNewPersonForm({ ...newPersonForm, initial_value: e.target.value })}
              placeholder="Initial Phone / Email / URL (optional)..."
              className="flex-1 h-6 px-2 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-100 font-mono placeholder-slate-600 focus:ring-1 focus:ring-emerald-500"
            />

            <button
              type="submit"
              disabled={addingPerson || !newPersonForm.full_name.trim()}
              className="h-6 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded text-[10px] cursor-pointer flex items-center space-x-1 transition-all shrink-0 shadow-sm"
            >
              {addingPerson ? <Loader2 size={11} className="animate-spin" /> : <Plus size={12} />}
              <span>Add Person</span>
            </button>
          </form>

        </div>
      )}

      {/* ======================================================== */}
      {/* ON-DEMAND CLIENT BRANCHES & OFFICES DRAWER               */}
      {/* ======================================================== */}
      {showBranchesModal && (
        <div className="bg-[#09101f] border-b border-blue-900/60 px-4 py-3 shrink-0 shadow-lg animate-in slide-in-from-top-2 duration-200 flex flex-col space-y-3">
          
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <MapPin size={14} className="text-blue-400" />
              <span className="font-bold text-slate-100 text-xs uppercase tracking-wide">
                Client Branches & Office Locations — <span className="text-blue-300 normal-case">{clientForm.name}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                {(clientForm.branches || []).length} Locations Registered
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Headquarters • Regional Branches • Factories • Warehouses • Overseas Offices
              </span>
              <button
                type="button"
                onClick={() => setShowBranchesModal(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer transition-colors"
                title="Close Branches Panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Branches Cards Grid */}
          {(() => {
            const hasRegisteredBranches = Array.isArray(clientForm.branches) && clientForm.branches.length > 0;
            const branchesList = hasRegisteredBranches
              ? clientForm.branches
              : [
                  {
                    id: "default_hq",
                    branch_name: "Main Headquarters",
                    city: clientForm.location || "Ho Chi Minh",
                    address: clientForm.address || "",
                    is_headquarter: true,
                    phone: "",
                    notes: "Primary billing & legal address"
                  }
                ];

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                {branchesList.map((branch) => {
                  const isEditing = editingBranchId === branch.id;
                  if (isEditing) {
                    return (
                      <div key={branch.id} className="bg-slate-950 border border-blue-500 rounded-lg p-2.5 flex flex-col space-y-2 shadow-lg col-span-1 md:col-span-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                          <span className="font-bold text-blue-300 text-xs flex items-center space-x-1">
                            <Edit3 size={12} />
                            <span>Edit Branch: {branch.branch_name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingBranchId(null)}
                            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editingBranchData.branch_name}
                            onChange={(e) => setEditingBranchData(prev => ({ ...prev, branch_name: e.target.value }))}
                            placeholder="Branch Name (e.g. Hanoi Branch)..."
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                          />
                          <select
                            value={editingBranchData.city}
                            onChange={(e) => setEditingBranchData(prev => ({ ...prev, city: e.target.value }))}
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="Ho Chi Minh">Ho Chi Minh</option>
                            <option value="Ha Noi">Ha Noi</option>
                            <option value="Da Nang">Da Nang</option>
                            <option value="Binh Duong">Binh Duong</option>
                            <option value="Dong Nai">Dong Nai</option>
                            <option value="Hai Phong">Hai Phong</option>
                            <option value="Can Tho">Can Tho</option>
                            <option value="Bac Ninh">Bac Ninh</option>
                            <option value="Remote">Remote</option>
                            <option value="Overseas">Overseas</option>
                          </select>
                          <input
                            type="text"
                            value={editingBranchData.phone}
                            onChange={(e) => setEditingBranchData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Phone / Hotline (optional)..."
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <input
                          type="text"
                          value={editingBranchData.address}
                          onChange={(e) => setEditingBranchData(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Detailed Street Address (Building, Street, District)..."
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                        />

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center space-x-1.5 text-[11px] text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editingBranchData.is_headquarter}
                              onChange={(e) => setEditingBranchData(prev => ({ ...prev, is_headquarter: e.target.checked }))}
                              className="rounded text-blue-600 bg-slate-900 border-slate-700"
                            />
                            <span>Set as Main Headquarter</span>
                          </label>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingBranchId(null)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditBranch(branch.id)}
                              disabled={savingBranchEdit || !editingBranchData.branch_name.trim()}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center space-x-1 cursor-pointer"
                            >
                              {savingBranchEdit && <Loader2 size={11} className="animate-spin" />}
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={branch.id} 
                      className={`bg-slate-950/80 border rounded-lg p-2.5 flex flex-col justify-between space-y-2 shadow-sm transition-all hover:border-slate-700 ${
                        branch.is_headquarter ? "border-emerald-800/80 ring-1 ring-emerald-500/20" : "border-slate-800"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <Building size={13} className={branch.is_headquarter ? "text-emerald-400" : "text-blue-400"} />
                            <span className="font-bold text-slate-100 text-xs">{branch.branch_name}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            {branch.is_headquarter ? (
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[9px] font-extrabold rounded-full flex items-center space-x-1 shadow-xs">
                                <span>⭐ HQ</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetHeadquarter(branch.id)}
                                className="text-[9px] text-slate-400 hover:text-amber-300 px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded cursor-pointer transition-colors"
                                title="Set this branch as Main Headquarters"
                              >
                                Set as HQ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBranchId(branch.id);
                                setEditingBranchData({
                                  branch_name: branch.branch_name || "",
                                  city: branch.city || "Ho Chi Minh",
                                  address: branch.address || "",
                                  is_headquarter: Boolean(branch.is_headquarter),
                                  phone: branch.phone || "",
                                  notes: branch.notes || ""
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-blue-400 rounded cursor-pointer"
                              title="Edit Branch Information"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBranch(branch.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                              title="Delete Branch"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-1.5 space-y-1">
                          <div className="flex items-center space-x-1 text-[11px] font-semibold">
                            <MapPin size={11} className="shrink-0 text-slate-400" />
                            <span className={branch.is_headquarter ? "text-emerald-300 font-bold" : "text-blue-300 font-semibold"}>
                              {branch.city}
                            </span>
                            {branch.phone && (
                              <span className="text-[10px] text-slate-400 font-mono pl-2 flex items-center space-x-1">
                                <Phone size={9} />
                                <span>{branch.phone}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-300 flex items-start justify-between group">
                            <span className="break-words flex-1 pr-1">{branch.address || "No address provided"}</span>
                            {branch.address && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(branch.address, `br_${branch.id}`)}
                                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer shrink-0"
                                title="Copy Address"
                              >
                                {copiedText === `br_${branch.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-500 italic pt-1 border-t border-slate-900 flex justify-between items-center">
                        <span>{branch.notes || (branch.is_headquarter ? "Primary billing & legal address" : "Regional office / facility")}</span>
                        {branch.is_headquarter && (
                          <span className="text-emerald-400/80 font-mono">Tax ID: {clientForm.tax_code || "N/A"}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Add New Branch Inline Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200 shrink-0">
              <Plus size={13} className="text-blue-400" />
              <span>Add Branch:</span>
            </div>

            <input
              type="text"
              value={newBranchForm.branch_name}
              onChange={(e) => setNewBranchForm(prev => ({ ...prev, branch_name: e.target.value }))}
              placeholder="Branch Name (e.g. Hanoi Office, Factory 1)..."
              className="flex-1 min-w-[150px] h-7 px-2.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-semibold"
            />

            <select
              value={newBranchForm.city}
              onChange={(e) => setNewBranchForm(prev => ({ ...prev, city: e.target.value }))}
              className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shrink-0"
            >
              <option value="Ho Chi Minh">Ho Chi Minh</option>
              <option value="Ha Noi">Ha Noi</option>
              <option value="Da Nang">Da Nang</option>
              <option value="Binh Duong">Binh Duong</option>
              <option value="Dong Nai">Dong Nai</option>
              <option value="Hai Phong">Hai Phong</option>
              <option value="Can Tho">Can Tho</option>
              <option value="Bac Ninh">Bac Ninh</option>
              <option value="Remote">Remote</option>
              <option value="Overseas">Overseas</option>
            </select>

            <input
              type="text"
              value={newBranchForm.address}
              onChange={(e) => setNewBranchForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Detailed Street Address..."
              className="flex-1 min-w-[180px] h-7 px-2.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />

            <input
              type="text"
              value={newBranchForm.phone}
              onChange={(e) => setNewBranchForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone / Hotline..."
              className="w-24 h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />

            <button
              type="button"
              onClick={handleAddBranch}
              disabled={addingBranch || !newBranchForm.branch_name.trim()}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded text-xs flex items-center space-x-1 cursor-pointer shadow-sm transition-all shrink-0"
            >
              {addingBranch ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              <span>Add Branch</span>
            </button>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN WORKBENCH BODY: RESPONSIVE AIRY COLUMNS             */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0 overflow-y-auto lg:overflow-hidden w-full">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: JOB ORDERS & JOB NOTES (45% width or Hidden)*/}
        {/* ======================================================== */}
        <div className={`${isAppsMaximized ? "hidden" : "w-full lg:w-[45%] lg:min-w-[460px] max-w-full lg:max-w-[50%]"} flex flex-col h-auto lg:h-full min-h-[420px] lg:min-h-0 bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner lg:shrink-0`}>
          
          {/* Header */}
          <div className="bg-[#0f172a] px-3.5 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Briefcase size={14} className="text-emerald-400" />
              <span className="font-bold text-slate-100 text-xs">Job Orders ({jobs.length})</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
              Client: <strong className={isCreatingClient ? "text-amber-300" : "text-emerald-300"}>{isCreatingClient ? (newClientDraft.name || "Draft Client") : clientForm.name}</strong>
            </span>
          </div>

          {/* Jobs Table */}
          <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin min-h-0 bg-slate-950/40">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="sticky top-0 bg-[#0f172a] border-b border-slate-800 text-slate-400 font-bold z-10 text-[10px]">
                <tr>
                  <th className="w-6 px-1 py-1.5 text-center"></th>
                  <th className="w-14 px-2 py-1.5 border-r border-slate-800 font-mono">ID_Order</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-800">Job Title</th>
                  <th className="w-24 px-2 py-1.5 border-r border-slate-800">Location</th>
                  <th className="w-28 px-2 py-1.5 border-r border-slate-800">Working Mode</th>
                  <th className="w-20 px-2 py-1.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isCreatingClient ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      <div className="flex flex-col items-center justify-center space-y-2 px-4">
                        <Building size={28} className="text-amber-400/60" />
                        <span className="font-bold text-slate-200">Client in Draft Mode</span>
                        <span className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                          Fill in Company Name and details on the top toolbar, then click <strong className="text-emerald-400 font-bold">Save Client</strong> to save to database and start adding Job Orders.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 italic text-[11px]">
                      No job orders found for this client.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => {
                    const isSelected = j.id === selectedJobId;
                    const modes = Array.isArray(j.working_mode) ? j.working_mode : [];
                    return (
                      <tr
                        key={j.id}
                        onClick={() => handleSelectJob(j)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-950/80 text-emerald-100 font-semibold border-l-4 border-l-emerald-500"
                            : "hover:bg-slate-800/50 text-slate-300"
                        }`}
                      >
                        <td className="px-1 py-1.5 text-center font-bold text-emerald-400 text-xs">
                          {isSelected ? "▶" : ""}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-slate-400 border-r border-slate-800/60 text-[10px]">
                          #{j.display_number || j.id.substring(0, 4)}
                        </td>
                        {/* Job Title (Single-click selects job, Double-click to edit) */}
                        <td 
                          className="px-2.5 py-1.5 border-r border-slate-800/60 font-medium truncate max-w-[150px]"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingJobTitleId(j.id);
                            setTempJobTitle(j.title || "");
                          }}
                          title="Single-click to select Job • Double-click to edit Title"
                        >
                          {editingJobTitleId === j.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={tempJobTitle}
                              onChange={(e) => setTempJobTitle(e.target.value)}
                              onBlur={() => {
                                if (tempJobTitle.trim() && tempJobTitle !== j.title) {
                                  handleUpdateJobField(j.id, "title", tempJobTitle.trim());
                                }
                                setEditingJobTitleId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (tempJobTitle.trim() && tempJobTitle !== j.title) {
                                    handleUpdateJobField(j.id, "title", tempJobTitle.trim());
                                  }
                                  setEditingJobTitleId(null);
                                } else if (e.key === "Escape") {
                                  setEditingJobTitleId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-900 border border-emerald-500 p-0.5 text-[11px] text-white focus:outline-none rounded px-1 font-semibold shadow-inner"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-200 font-semibold truncate block select-none group-hover:text-white">
                              {j.title || "Untitled Job"}
                            </span>
                          )}
                        </td>

                        {/* Location / Address (Single click or Double click to open Popover) */}
                        <td 
                          className="px-2 py-1 border-r border-slate-800/60 relative" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            onClick={() => {
                              setEditingLocationJobId(editingLocationJobId === j.id ? null : j.id);
                              setTempLocation(j.location || "");
                            }}
                            className="flex items-center justify-between space-x-1 cursor-pointer select-none group min-h-[22px] max-w-[140px] px-1 py-0.5 rounded hover:bg-slate-900/80 transition-colors"
                            title="Click to select Job Location / Branch Address"
                          >
                            <span className="text-[10px] text-slate-300 truncate font-medium group-hover:text-emerald-300 transition-colors">
                              {getJobLocationDisplay(j, clientForm.branches) ? (
                                getJobLocationDisplay(j, clientForm.branches)
                              ) : (
                                <span className="text-slate-500 italic">—</span>
                              )}
                            </span>
                            <ChevronDown size={10} className="text-slate-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                          </div>

                          {/* Interactive Location Selection Popover */}
                          {editingLocationJobId === j.id && (
                            <div 
                              className="absolute left-0 top-full mt-1 z-50 w-72 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl p-2.5 space-y-2 text-[11px] animate-in fade-in zoom-in-95 duration-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-extrabold uppercase text-slate-400">
                                <span className="flex items-center space-x-1">
                                  <MapPin size={11} className="text-emerald-400" />
                                  <span>Job Location / Address</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingLocationJobId(null)}
                                  className="text-slate-500 hover:text-white cursor-pointer p-0.5 rounded hover:bg-slate-800"
                                >
                                  <X size={11} />
                                </button>
                              </div>

                              {/* 1. Client Registered Addresses */}
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                                  Client Registered Addresses:
                                </span>

                                {/* Main HQ Address Option */}
                                {clientForm.address && (() => {
                                  const hqBranch = (clientForm.branches || []).find(b => b.is_headquarter);
                                  const isHqSelected = j.branch_id
                                    ? (hqBranch && j.branch_id === hqBranch.id)
                                    : ((j.location || "").trim() === clientForm.address.trim());

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateJobFields(j.id, {
                                          location: clientForm.address,
                                          branch_id: hqBranch ? hqBranch.id : null
                                        });
                                        setEditingLocationJobId(null);
                                      }}
                                      className={`w-full text-left p-1.5 rounded border transition-colors cursor-pointer flex flex-col space-y-0.5 ${
                                        isHqSelected
                                          ? "bg-emerald-950/80 border-emerald-600 text-emerald-100 font-semibold"
                                          : "bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-emerald-400 flex items-center space-x-1">
                                          <span>🏢 Main Headquarters</span>
                                          <span className="text-slate-400 font-normal text-[9px]">({clientForm.location || "Ho Chi Minh"})</span>
                                        </span>
                                        {isHqSelected && (
                                          <Check size={11} className="text-emerald-400 shrink-0" />
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-300 truncate font-mono">
                                        {clientForm.address}
                                      </span>
                                    </button>
                                  );
                                })()}

                                {/* Registered Branches Options */}
                                {(clientForm.branches || [])
                                  .filter(b => {
                                    if (b.is_headquarter) return false;
                                    const branchAddr = (b.address || b.city || "").trim();
                                    if (!branchAddr) return false;
                                    if (clientForm.address && branchAddr === clientForm.address.trim()) return false;
                                    return true;
                                  })
                                  .map((branch) => {
                                    const branchVal = branch.city && branch.address && branch.address !== branch.city
                                      ? `${branch.city} — ${branch.address}`
                                      : (branch.address || branch.city);
                                    const isSelected = j.branch_id
                                      ? j.branch_id === branch.id
                                      : ((j.location || "").trim() === branchVal.trim());
                                    return (
                                      <button
                                        key={branch.id}
                                        type="button"
                                        onClick={() => {
                                          handleUpdateJobFields(j.id, {
                                            location: branchVal,
                                            branch_id: branch.id
                                          });
                                          setEditingLocationJobId(null);
                                        }}
                                        className={`w-full text-left p-1.5 rounded border transition-colors cursor-pointer flex flex-col space-y-0.5 ${
                                          isSelected
                                            ? "bg-emerald-950/80 border-emerald-600 text-emerald-100 font-semibold"
                                            : "bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-200"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-blue-400 flex items-center space-x-1">
                                            <span>📍 {branch.branch_name || "Branch"}</span>
                                            <span className="text-slate-400 font-normal text-[9px]">({branch.city})</span>
                                          </span>
                                          {isSelected && <Check size={11} className="text-emerald-400 shrink-0" />}
                                        </div>
                                        <span className="text-[10px] text-slate-300 truncate font-mono">
                                          {branchVal}
                                        </span>
                                      </button>
                                    );
                                  })}

                                {/* Option: Clear / None (e.g. Remote Job) */}
                                {(() => {
                                  const isNoneSelected = !j.branch_id && (!j.location || j.location.trim() === "");
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateJobFields(j.id, {
                                          location: "",
                                          branch_id: null
                                        });
                                        setEditingLocationJobId(null);
                                      }}
                                      className={`w-full text-left p-1.5 rounded border transition-colors cursor-pointer flex items-center justify-between ${
                                        isNoneSelected
                                          ? "bg-slate-900 border-slate-700 text-slate-200 font-semibold"
                                          : "bg-slate-950/60 hover:bg-slate-900/80 border-slate-800/80 text-slate-400"
                                      }`}
                                    >
                                      <span className="text-[10px] italic">
                                        ⚪ None / Unspecified (e.g. Remote)
                                      </span>
                                      {isNoneSelected && (
                                        <Check size={11} className="text-slate-400 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })()}
                              </div>

                              {/* 2. Custom Address */}
                              <div className="pt-1.5 border-t border-slate-800 space-y-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                                  Custom Address:
                                </span>
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    value={tempLocation}
                                    onChange={(e) => setTempLocation(e.target.value)}
                                    placeholder="Type street address..."
                                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleUpdateJobFields(j.id, {
                                          location: tempLocation.trim(),
                                          branch_id: null
                                        });
                                        setEditingLocationJobId(null);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateJobFields(j.id, {
                                        location: tempLocation.trim(),
                                        branch_id: null
                                      });
                                      setEditingLocationJobId(null);
                                    }}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>

                            </div>
                          )}
                        </td>

                        {/* Working Mode Multi-Select Cell */}
                        <td className="px-2 py-1 border-r border-slate-800/60 relative" onClick={(e) => e.stopPropagation()}>
                          <div
                            onClick={() => setActiveWorkingModeJobId(activeWorkingModeJobId === j.id ? null : j.id)}
                            className="flex items-center space-x-1 cursor-pointer select-none group min-h-[22px]"
                            title="Click to select Working Modes (Multiple select)"
                          >
                            {modes.length > 0 ? (
                              <div className="flex flex-wrap gap-1 items-center">
                                {modes.map(mode => (
                                  <span
                                    key={mode}
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shadow-2xs ${
                                      mode === "On-site"
                                        ? "bg-slate-900 text-slate-200 border-slate-700"
                                        : mode === "Hybrid"
                                        ? "bg-purple-950/90 text-purple-200 border-purple-800"
                                        : "bg-sky-950/90 text-sky-200 border-sky-800"
                                    }`}
                                  >
                                    {mode}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic group-hover:text-slate-300 transition-colors">
                                + Mode
                              </span>
                            )}
                          </div>

                          {/* Multiple Select Dropdown Popover */}
                          {activeWorkingModeJobId === j.id && (
                            <div className="absolute left-0 top-full mt-1 z-50 w-44 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl p-2 space-y-1.5 text-[11px] animate-in fade-in zoom-in-95 duration-100">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-extrabold uppercase text-slate-400">
                                <span>Working Mode</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveWorkingModeJobId(null)}
                                  className="text-slate-500 hover:text-white cursor-pointer"
                                >
                                  <X size={11} />
                                </button>
                              </div>

                              {["On-site", "Hybrid", "Remote"].map((mode) => {
                                const isChecked = modes.includes(mode);
                                return (
                                  <label
                                    key={mode}
                                    className={`flex items-center space-x-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                                      isChecked
                                        ? "bg-emerald-950/70 text-emerald-200 font-bold border border-emerald-800/60"
                                        : "hover:bg-slate-900 text-slate-300"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleWorkingMode(j.id, mode)}
                                      className="w-3.5 h-3.5 text-emerald-500 bg-slate-900 rounded border-slate-700 accent-emerald-500 cursor-pointer"
                                    />
                                    <span>
                                      {mode === "On-site" ? "🏢 On-site" : mode === "Hybrid" ? "⚡ Hybrid" : "🌐 Remote"}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-1.5 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={j.status || "Open"}
                            onChange={(e) => handleUpdateJobField(j.id, "status", e.target.value)}
                            className="text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200 font-bold cursor-pointer"
                          >
                            <option value="Open">Open</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Add Job */}
          <form onSubmit={handleAddJob} className="p-2 bg-[#0f172a] border-t border-slate-800 flex items-center space-x-2 shrink-0">
            <span className="text-emerald-400 font-bold px-1 text-xs">*</span>
            <input
              type="text"
              disabled={isCreatingClient}
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              placeholder={isCreatingClient ? "Save client first to add Job Orders..." : "New Job Title..."}
              className="flex-1 h-6 px-2 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-100 focus:ring-1 focus:ring-emerald-500 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={isCreatingClient || addingJob}
              className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold disabled:opacity-40 cursor-pointer flex items-center space-x-1"
            >
              {addingJob ? <Loader2 size={10} className="animate-spin" /> : <Plus size={11} />}
              <span>Add Job</span>
            </button>
          </form>

          {/* Job JD Link & Requirements Notes Box */}
          <div className="p-2.5 bg-[#0e1626] border-t border-slate-800 shrink-0 flex flex-col space-y-1.5">
            
            {/* JD Document URL Collapsible Row (On-Demand Clean UX) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowJdLinkInput(!showJdLinkInput)}
                  className="text-[9px] font-bold text-slate-400 hover:text-purple-300 uppercase flex items-center space-x-1.5 cursor-pointer transition-colors group select-none"
                  title="Click to expand/collapse JD Link input"
                >
                  <FileText size={11} className="text-purple-400 group-hover:scale-110 transition-transform" />
                  <span>Job Description (JD Link)</span>
                  {showJdLinkInput ? (
                    <ChevronUp size={11} className="text-slate-500 group-hover:text-purple-300" />
                  ) : (
                    <ChevronDown size={11} className="text-slate-500 group-hover:text-purple-300" />
                  )}
                  {selectedJob?.jd_url && !showJdLinkInput && (
                    <span className="text-[8px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.2 rounded font-normal truncate max-w-[130px]">
                      Link Attached
                    </span>
                  )}
                </button>
                
                <div className="flex items-center space-x-2">
                  {selectedJob?.jd_url && (
                    <button
                      type="button"
                      onClick={() => setActiveRightTab("jd_viewer")}
                      className="text-[9px] text-purple-400 hover:text-purple-300 font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <span>Preview JD ↗</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowJdLinkInput(!showJdLinkInput)}
                    className="text-[9px] text-slate-500 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    {showJdLinkInput ? "Hide" : "Edit Link"}
                  </button>
                </div>
              </div>

              {showJdLinkInput && (
                <div className="flex items-center space-x-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    type="text"
                    value={selectedJob?.jd_url || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedJob) {
                        setSelectedJob(prev => ({ ...prev, jd_url: val }));
                        handleUpdateJobField(selectedJob.id, "jd_url", val);
                      }
                    }}
                    placeholder="Paste Google Drive / Google Docs / PDF URL..."
                    disabled={!selectedJob}
                    className="flex-1 h-6 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] focus:ring-1 focus:ring-purple-500 font-mono disabled:opacity-30 placeholder-slate-600 shadow-inner"
                  />
                  {selectedJob?.jd_url && (
                    <a
                      href={selectedJob.jd_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-300 rounded text-[10px] cursor-pointer shrink-0 transition-colors"
                      title="Open original JD URL in new tab"
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Job Requirements & Notes */}
            <div className="space-y-1 pt-0.5">
              <label className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                <span>Job Notes: <strong className="text-emerald-300">{selectedJob?.title || "None"}</strong></span>
                {selectedJob && <span className="text-slate-500 font-mono text-[9px]">ID: #{selectedJob.display_number}</span>}
              </label>
              <textarea
                rows={2}
                value={selectedJob?.notes || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (selectedJob) {
                    setSelectedJob(prev => ({ ...prev, notes: val }));
                    handleUpdateJobField(selectedJob.id, "notes", val);
                  }
                }}
                placeholder="Requirement summary, budget range, bonus notes..."
                disabled={!selectedJob}
                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-[10px] resize-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-30 shadow-inner"
              />
            </div>

          </div>

          {/* Record Navigator Bar */}
          <div className="bg-[#0f172a] px-3 py-1.5 border-t border-slate-800 text-[9px] font-mono text-slate-400 flex items-center justify-between shrink-0">
            <span>Record: <strong className="text-emerald-400">{currentJobIndex >= 0 ? currentJobIndex + 1 : 0}</strong> of <strong className="text-slate-300">{jobs.length}</strong></span>
            <span className="text-slate-500">No Filter</span>
          </div>

        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: APPLICATIONS & PIPELINE ACCORDION          */}
        {/* (Takes remaining width: ~55% or Full width when expanded) */}
        {/* ======================================================== */}
        <div className="flex-1 min-w-0 flex flex-col h-auto lg:h-full min-h-[420px] lg:min-h-0 bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner transition-all duration-200">
          
          {/* Header with 2-Tab Switcher & Maximize / Expand Toggle */}
          <div className="bg-[#0f172a] px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            
            {/* Left: Tab Switcher (Applications vs Embedded JD Viewer) */}
            <div className="flex items-center space-x-1.5">
              {/* Tab 1: Applications */}
              <button
                type="button"
                onClick={() => setActiveRightTab("applications")}
                className={`h-7 px-3 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeRightTab === "applications"
                    ? "bg-slate-800 text-white border border-slate-700 shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Users size={13} className={activeRightTab === "applications" ? "text-cyan-400" : "text-slate-500"} />
                <span>Applications & Pipeline ({applications.length})</span>
              </button>

              {/* Tab 2: Embedded JD Viewer */}
              <button
                type="button"
                onClick={() => setActiveRightTab("jd_viewer")}
                className={`h-7 px-3 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeRightTab === "jd_viewer"
                    ? "bg-purple-950 text-purple-200 border border-purple-700 shadow-xs"
                    : "text-slate-400 hover:text-purple-300 hover:bg-purple-950/40"
                }`}
              >
                <FileText size={13} className={activeRightTab === "jd_viewer" ? "text-purple-300" : "text-purple-400"} />
                <span>Embedded JD Viewer</span>
                {selectedJob?.jd_url && (
                  <span className="w-2 h-2 rounded-full bg-purple-400 shadow-xs" title="JD URL is attached"></span>
                )}
              </button>
            </div>

            {/* Right: Selected Job Name + Expand Pipeline Button */}
            <div className="flex items-center space-x-2.5">
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px] hidden md:inline">
                Job: <strong className="text-cyan-300">{selectedJob?.title || "None selected"}</strong>
              </span>

              {/* Expand / Maximize Pipeline Toggle Button */}
              <button
                type="button"
                onClick={() => setIsAppsMaximized(prev => !prev)}
                className={`h-6 px-2.5 rounded text-[10px] font-bold flex items-center space-x-1 border transition-all cursor-pointer shadow-xs ${
                  isAppsMaximized
                    ? "bg-cyan-950 text-cyan-300 border-cyan-600 ring-1 ring-cyan-500/50"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600"
                }`}
                title={isAppsMaximized ? "Restore Split View (5:7)" : "Maximize Pipeline to Full Screen"}
              >
                {isAppsMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                <span>{isAppsMaximized ? "Split View" : "Expand Pipeline"}</span>
              </button>
            </div>

          </div>

          {/* TAB 1: APPLICATIONS & PIPELINE LIST */}
          {activeRightTab === "applications" && (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3 bg-slate-950/40 min-h-0">
              {loadingApps ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Loader2 size={24} className="animate-spin text-cyan-500 mb-2" />
                  <p className="text-xs font-semibold">Loading candidates in pipeline...</p>
                </div>
              ) : applications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                  <Users size={32} className="text-slate-700" />
                  <p className="text-xs italic">
                    {selectedJob ? "No candidates in this job pipeline yet." : "Please select a Job Order on the left panel."}
                  </p>
                  {selectedJob && (
                    <p className="text-[10px] text-slate-600">
                      You can assign candidates to this job from the <strong>Search Menu</strong>.
                    </p>
                  )}
                </div>
              ) : (
                applications.map((app) => {
                  const isExpanded = Boolean(expandedAppIds[app.id]);
                  const logs = appLogsMap[app.id] || [];
                  const isLogsLoading = Boolean(logsLoadingMap[app.id]);

                  return (
                    <div
                      key={app.id}
                      className={`border rounded-xl transition-all shadow-sm overflow-hidden ${
                        isExpanded 
                          ? "bg-slate-950 border-emerald-800/80 ring-1 ring-emerald-600/30" 
                          : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* 1. Header Card (Summary & Timeline Button) */}
                      <div 
                        onClick={() => toggleExpandApp(app.id)}
                        className="p-3 flex justify-between items-start cursor-pointer hover:bg-slate-900/40 transition-colors select-none"
                      >
                        {/* Candidate Name & Info */}
                        <div className="space-y-1 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              #{app.candidate_display_number || app.candidate_id?.substring(0, 4)}
                            </span>
                            <Link
                              href={`/candidates/${app.candidate_id}`}
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-bold text-white hover:text-emerald-300 transition-colors flex items-center space-x-1"
                              title="Open Candidate 360 in new tab"
                            >
                              <span>{app.candidate_name}</span>
                              <ExternalLink size={10} className="text-slate-500 hover:text-emerald-400" />
                            </Link>
                          </div>
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Building size={11} className="text-slate-500" />
                            <span>Job: {selectedJob?.title || "N/A"}</span>
                          </p>
                        </div>

                        {/* Right Stage Badge, Status & Timeline Toggle */}
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="text-right space-y-0.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold border shadow-xs ${
                              getStageBadgeClass(app.current_stage)
                            }`}>
                              {app.current_stage || "New"}
                            </span>
                            <div className="text-[9px] font-mono text-slate-400">
                              Status: <strong className={app.status === "In progress" ? "text-blue-400" : "text-slate-400"}>{app.status || "In progress"}</strong>
                            </div>
                          </div>

                          {/* Expand / Collapse Timeline Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandApp(app.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1.5 border transition-all cursor-pointer ${
                              isExpanded
                                ? "bg-emerald-950 text-emerald-300 border-emerald-700 shadow-xs"
                               : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                            }`}
                            title="Toggle Action Notes Timeline"
                          >
                            <Clock size={12} className={isExpanded ? "text-emerald-400" : "text-slate-400"} />
                            <span>Timeline</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* 2. Top Summary Details (Visible always) */}
                      <div className="px-3 pb-2 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 bg-slate-950/60 pt-1.5 font-mono">
                        <div className="flex items-center space-x-2">
                          <span>Source: <strong className="text-slate-200">{app.candidate_source || "Direct"}</strong></span>
                          <span>•</span>
                          <span>Planning: <strong className="text-slate-200">{app.planning_date || "Not set"}</strong></span>
                          <span>•</span>
                          <span className={app.is_passive ? "text-cyan-400 font-bold" : "text-emerald-400"}>
                            {app.is_passive ? "🔍 Sourcing (Passive)" : "📥 Inbound Apply"}
                          </span>
                        </div>
                        <Link
                          href={`/candidates/${app.candidate_id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center space-x-1 text-[10px]"
                        >
                          <span>Open Candidate 360</span>
                          <ExternalLink size={9} />
                        </Link>
                      </div>

                      {/* 3. EXPANDED INTERACTIVE TIMELINE ACCORDION (With Responsive Flexible Height) */}
                      {isExpanded && (
                        <div className="border-t border-emerald-900/60 bg-slate-950 p-3 space-y-3 animate-in fade-in duration-150">
                          
                          {/* Quick Edit Application Fields */}
                          <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 grid grid-cols-12 gap-2.5 items-center text-[10px]">
                            {/* Status */}
                            <div className={app.status === "Closed" ? "col-span-12" : "col-span-12 sm:col-span-3"}>
                              <label className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Status</label>
                              <select
                                value={app.status || "In progress"}
                                onChange={(e) => handleUpdateAppField(app.id, "status", e.target.value)}
                                className="w-full h-6 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-semibold cursor-pointer focus:ring-1 focus:ring-emerald-500"
                              >
                                <option value="In progress">🔵 In Progress</option>
                                <option value="Closed">⚪ Closed</option>
                              </select>
                            </div>

                            {/* Non-closed fields (Hidden when Closed to maximize clean space) */}
                            {app.status !== "Closed" && (
                              <>
                                {/* Planning Date */}
                                <div className="col-span-12 sm:col-span-3">
                                  <label className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Planning Date</label>
                                  <DateInputField
                                    value={app.raw_planning_date ? new Date(app.raw_planning_date).toISOString().substring(0, 10) : ""}
                                    onChange={(newVal) => handleUpdateAppField(app.id, "planning_date", newVal)}
                                    className="w-full h-6 px-1 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-center focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>

                                {/* Sourcing Channel */}
                                <div className="col-span-12 sm:col-span-3">
                                  <label className="text-[9px] text-slate-400 font-bold uppercase block mb-0.5">Source Channel</label>
                                  <input
                                    type="text"
                                    value={app.candidate_source || ""}
                                    onChange={(e) => handleUpdateAppField(app.id, "source_channel", e.target.value)}
                                    placeholder="e.g. LinkedIn, FB..."
                                    className="w-full h-6 px-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>

                                {/* Passive Sourcing Checkbox */}
                                <div className="col-span-12 sm:col-span-3 flex items-center pt-2 sm:pt-3">
                                  <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none bg-slate-950 px-2 py-1 rounded border border-slate-800 w-full h-6">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(app.is_passive)}
                                      onChange={(e) => handleUpdateAppField(app.id, "is_passive", e.target.checked)}
                                      className="w-3 h-3 text-emerald-500 bg-slate-900 rounded border-slate-700 accent-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-bold text-slate-200">Passive Sourcing</span>
                                  </label>
                                </div>
                              </>
                            )}


                          </div>

                          {/* Action Notes Timeline Sub-Table (Flexible Generous Height) */}
                          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60 shadow-inner">
                            <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400">
                              <span className="flex items-center space-x-1.5">
                                <Clock size={12} className="text-pink-400" />
                                <span>Action Notes Timeline ({logs.length})</span>
                              </span>
                              {isLogsLoading && (
                                <span className="flex items-center space-x-1 text-emerald-400 normal-case font-normal">
                                  <Loader2 size={10} className="animate-spin" />
                                  <span>Loading history...</span>
                                </span>
                              )}
                            </div>

                            {app.status === "Closed" && (
                              <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center gap-1.5 text-[10px] text-slate-400 select-none">
                                <Lock size={12} className="text-amber-400" />
                                <span className="text-slate-300 font-semibold">
                                  Application is Closed. Adding action notes is locked.
                                </span>
                              </div>
                            )}
                            <div className="p-3">
                              <ActivityLogPanel
                                applicationId={app.id}
                                currentStage={app.current_stage}
                                result={app.result}
                                reasonFailed={app.reason_failed}
                                logs={logs}
                                isLoadingLogs={isLogsLoading}
                                onAddLog={app.status === "Closed" ? undefined : handleAddLogToApp}
                                onEditLog={handleEditLogInApp}
                                onDeleteLog={handleDeleteLogFromApp}
                                outcomeMode="readOnly"
                                allowEditLog={true}
                              />
                            </div>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: EMBEDDED JD VIEWER (Google Drive / Docs / PDF direct iframe) */}
          {activeRightTab === "jd_viewer" && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950 p-2">
              {selectedJob?.jd_url ? (
                <div className="flex-1 flex flex-col min-h-0 border border-slate-800 rounded-lg overflow-hidden bg-slate-900 shadow-inner">
                  
                  {/* Top Control Bar of JD Viewer */}
                  <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
                    
                    <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                      <FileText size={14} className="text-purple-400 shrink-0" />
                      <span className="font-bold text-slate-200 truncate max-w-[280px]">
                        {selectedJob?.title || "Job Description"}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-xs">
                        {selectedJob?.jd_url}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Direct Open in Fullscreen */}
                      <a
                        href={selectedJob.jd_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 rounded font-bold text-[11px] flex items-center space-x-1.5 transition-all shadow-xs"
                      >
                        <span>Open Fullscreen</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                  </div>

                  {/* Embedded Iframe */}
                  <iframe
                    src={getEmbeddableJdUrl(selectedJob.jd_url)}
                    title={`Job Description - ${selectedJob.title}`}
                    className="w-full flex-1 border-0 bg-white"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-900/60 flex items-center justify-center text-purple-400 mb-1">
                    <FileText size={28} />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-sm font-bold text-slate-200">
                      No JD Document Linked for <span className="text-purple-300">{selectedJob?.title || "this Job Order"}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Paste a Google Drive, Google Docs, or PDF document link below to view the Job Description directly in this workspace.
                    </p>
                  </div>

                  {/* Quick Link Input */}
                  {selectedJob ? (
                    <div className="w-full max-w-md flex items-center space-x-2 pt-2">
                      <input
                        type="text"
                        placeholder="Paste Google Drive / Google Docs / PDF URL..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            const val = e.target.value.trim();
                            setSelectedJob(prev => ({ ...prev, jd_url: val }));
                            handleUpdateJobField(selectedJob.id, "jd_url", val);
                          }
                        }}
                        id="empty-jd-input"
                        className="flex-1 h-8 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-purple-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const inputEl = document.getElementById("empty-jd-input");
                          if (inputEl && inputEl.value.trim()) {
                            const val = inputEl.value.trim();
                            setSelectedJob(prev => ({ ...prev, jd_url: val }));
                            handleUpdateJobField(selectedJob.id, "jd_url", val);
                          }
                        }}
                        className="h-8 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
                      >
                        <Plus size={13} />
                        <span>Save & View JD</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">Please select a Job Order on the left to attach a JD.</p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default function JobsClientsWorkbenchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-[#070b14] text-slate-100 h-full">
          <Loader2 size={32} className="animate-spin text-emerald-500 mb-2" />
          <p className="text-xs font-semibold text-slate-400">Loading Jobs & Clients Workbench...</p>
        </div>
      }
    >
      <JobsClientsWorkbenchContent />
    </Suspense>
  );
}
