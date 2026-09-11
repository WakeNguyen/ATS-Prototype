"use client";

import { Linkedin, Facebook, Github } from 'src/components/BrandIcons';
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getCandidateSearchData, 
  getClientSearchData, 
  getJobSearchData 
} from "../actions";
import { 
  Search, 
  Loader2, 
  ExternalLink, 
  Phone, 
  Mail, 
   
   
   
  Globe, 
  MessageSquare, 
  Copy, 
  Users, 
  Building, 
  Briefcase, 
  FileText, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Database
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "src/components/ui/popover";

export default function SearchMenuPage() {
  const router = useRouter();

  // Active Tab: 'candidate' | 'client' | 'job'
  const [activeTab, setActiveTab] = useState("candidate");

  // Search Query State
  const [searchTerm, setSearchTerm] = useState("");

  // Data States (Server-side paginated)
  const [candidates, setCandidates] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);

  // Total Matching Counts
  const [totalCounts, setTotalCounts] = useState({ candidate: 3377, client: 189, job: 307 });
  const [currentTotal, setCurrentTotal] = useState(3377);

  // Pagination State (Current Page per tab)
  const [page, setPage] = useState(1);
  const pageSize = 80;

  // Selected Row State
  const [selectedId, setSelectedId] = useState(null);

  // Active Popover State: { candidateId, type: 'phone'|'email'|'social' }
  const [activePopover, setActivePopover] = useState(null);

  // Loading & Toast States
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Debounced search trigger
  const debounceTimerRef = useRef(null);
  const searchSeqRef = useRef(0); // THEM: moc "phien ban" cho moi lan goi fetchData, chong response cu ghi de

  // Fetch data function
  const fetchData = useCallback(async (tab, term, targetPage = 1, isManualReload = false) => {
    const mySeq = ++searchSeqRef.current; // THEM: claim phien ban moi nhat cho lan goi nay
    if (isManualReload) setLoading(true);
    else setIsSearching(true);

    try {
      if (tab === "candidate") {
        const res = await getCandidateSearchData({ searchTerm: term, page: targetPage, pageSize });
        if (mySeq !== searchSeqRef.current) return; // THEM: co request moi hon da goi sau -> bo qua ket qua nay
        if (res.success) {
          setCandidates(res.data || []);
          setCurrentTotal(res.totalCount || 0);
          if (!term) setTotalCounts(prev => ({ ...prev, candidate: res.totalCount }));
          if (res.data?.length > 0) setSelectedId(res.data[0].candidate_id);
          else setSelectedId(null);
        }
      } else if (tab === "client") {
        const res = await getClientSearchData({ searchTerm: term, page: targetPage, pageSize });
        if (mySeq !== searchSeqRef.current) return; // THEM
        if (res.success) {
          setClients(res.data || []);
          setCurrentTotal(res.totalCount || 0);
          if (!term) setTotalCounts(prev => ({ ...prev, client: res.totalCount }));
          if (res.data?.length > 0) setSelectedId(res.data[0].client_id);
          else setSelectedId(null);
        }
      } else if (tab === "job") {
        const res = await getJobSearchData({ searchTerm: term, page: targetPage, pageSize });
        if (mySeq !== searchSeqRef.current) return; // THEM
        if (res.success) {
          setJobs(res.data || []);
          setCurrentTotal(res.totalCount || 0);
          if (!term) setTotalCounts(prev => ({ ...prev, job: res.totalCount }));
          if (res.data?.length > 0) setSelectedId(res.data[0].job_id);
          else setSelectedId(null);
        }
      }
    } catch (err) {
      console.error("Fetch search data failed:", err);
    } finally {
      if (mySeq === searchSeqRef.current) { // THEM: chi tat loading/isSearching neu van la request moi nhat
        setLoading(false);
        setIsSearching(false);
      }
    }
  }, [pageSize]);

  // Initial Load & Debounced Search Effect
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchData(activeTab, searchTerm, 1);
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchTerm, activeTab, fetchData]);

  // Page change handler
  function handlePageChange(newPage) {
    const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchData(activeTab, searchTerm, newPage);
  }

  // Toast notifier
  function notify(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  }

  // Clipboard copy helper
  function copyToClipboard(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    notify(`Copied ${label}: ${text}`);
  }

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest(".contact-popover-container")) {
        setActivePopover(null);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Active current list
  const currentList = activeTab === "candidate" ? candidates : activeTab === "client" ? clients : jobs;
  const currentIdKey = activeTab === "candidate" ? "candidate_id" : activeTab === "client" ? "client_id" : "job_id";

  const selectedIndex = useMemo(() => {
    return currentList.findIndex(item => item[currentIdKey] === selectedId);
  }, [currentList, selectedId, currentIdKey]);

  function navigateRecord(direction) {
    if (currentList.length === 0) return;
    let nextIdx = selectedIndex + direction;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= currentList.length) nextIdx = currentList.length - 1;
    setSelectedId(currentList[nextIdx][currentIdKey]);
  }

  // Total pages
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));

  // Social Icon Helper
  function renderSocialIcon(type, size = 11) {
    switch (type?.toLowerCase()) {
      case "linkedin":
        return <Linkedin size={size} className="text-sky-400 shrink-0" />;
      case "facebook":
        return <Facebook size={size} className="text-blue-500 shrink-0" />;
      case "github":
        return <Github size={size} className="text-slate-200 shrink-0" />;
      case "skype":
        return <MessageSquare size={size} className="text-cyan-400 shrink-0" />;
      case "personal website":
      case "personalwebsiteblog":
        return <Globe size={size} className="text-emerald-400 shrink-0" />;
      default:
        return <ExternalLink size={size} className="text-purple-400 shrink-0" />;
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full max-h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* TOAST ALERT */}
      {toastMsg && (
        <div className="fixed top-14 right-6 z-50 px-4 py-2 rounded-lg bg-slate-900 text-emerald-400 border border-emerald-500 shadow-2xl text-xs font-bold animate-bounce flex items-center space-x-2">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOOLBAR: SEARCH INPUT & 3 DATABASE TABS */}
      <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left: Reload + Search Input + Clear */}
        <div className="flex items-center space-x-2.5">
          <button 
            onClick={() => fetchData(activeTab, searchTerm, page, true)}
            disabled={loading || isSearching}
            className="px-2.5 py-1.5 rounded text-xs font-bold flex items-center space-x-1.5 shadow transition-all cursor-pointer border bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600 active:scale-95 disabled:opacity-50" 
            title="Reload from Database"
          >
            <RotateCw size={13} className={loading || isSearching ? "animate-spin text-emerald-300" : ""} />
            <span className="hidden sm:inline">Reload</span>
          </button>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-400">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  activeTab === "candidate" 
                    ? "Search name, ID, phone, email, link..." 
                    : activeTab === "client" 
                    ? "Search client name, industry, location, contacts..." 
                    : "Search job title, client name, location..."
                }
                className="w-72 sm:w-[440px] px-3 py-1 text-xs bg-slate-950 border border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-100 shadow-inner placeholder-slate-500"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400">
                  <Loader2 size={12} className="animate-spin" />
                </div>
              )}
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full shadow-sm transition-all cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Backend Status Indicator */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-0.5 bg-slate-950 border border-emerald-900/60 rounded-full text-[10px] text-emerald-400 font-mono">
            <Database size={10} className="text-emerald-400" />
            <span>Server SQL Engine</span>
          </div>
        </div>

        {/* Right: 3 DATABASE TABS (Candidate, Client, Job Order) */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
          {/* Tab 1: Candidate Database */}
          <button
            onClick={() => {
              setActiveTab("candidate");
              setSearchTerm("");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-md font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === "candidate"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Users size={13} />
            <span>Candidate Database</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({activeTab === "candidate" ? currentTotal : totalCounts.candidate})
            </span>
          </button>

          {/* Tab 2: Client Database */}
          <button
            onClick={() => {
              setActiveTab("client");
              setSearchTerm("");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-md font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === "client"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Building size={13} />
            <span>Client Database</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({activeTab === "client" ? currentTotal : totalCounts.client})
            </span>
          </button>

          {/* Tab 3: Job Order Database */}
          <button
            onClick={() => {
              setActiveTab("job");
              setSearchTerm("");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-md font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === "job"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Briefcase size={13} />
            <span>Job Order Database</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({activeTab === "job" ? currentTotal : totalCounts.job})
            </span>
          </button>
        </div>

      </div>

      {/* ======================================================== */}
      {/* MAIN DATA TABLE SECTION (FIXED VIEWPORT) */}
      {/* ======================================================== */}
      <div className="flex-1 min-h-0 flex flex-col bg-slate-950 overflow-hidden">
        
        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
          
          {/* ======================================================== */}
          {/* 1. CANDIDATE DATABASE TABLE (SMART GROUPED CONTACT HUB) */}
          {/* ======================================================== */}
          {activeTab === "candidate" && (
            <table className="w-full text-xs text-left border-collapse select-text">
              <thead className="bg-slate-900 text-slate-300 font-extrabold sticky top-0 z-10 border-b border-slate-800 text-center uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="w-8 p-1.5 border-r border-slate-800"></th>
                  <th className="w-12 p-1.5 border-r border-slate-800">ID</th>
                  <th className="w-14 p-1.5 border-r border-slate-800">Prefix</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[200px] text-emerald-400">Full Name</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[180px]">Phones</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[220px]">Emails</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[260px]">Social & Web Profiles</th>
                  <th className="w-14 p-1.5 text-center">CV</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400">
                      <Loader2 size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                      Querying PostgreSQL Database...
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-500 italic">
                      No candidates found matching "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => {
                    const isSelected = selectedId === c.candidate_id;
                    const isBlocked = !!c.blocked || (c.blacklist_note && c.blacklist_note.trim() !== "");
                    const phones = Array.isArray(c.phones) ? c.phones : [];
                    const emails = Array.isArray(c.emails) ? c.emails : [];
                    const socials = Array.isArray(c.socials) ? c.socials : [];

                    return (
                      <tr
                        key={c.candidate_id}
                        onClick={() => setSelectedId(c.candidate_id)}
                        className={`transition-colors cursor-pointer text-xs border-b ${
                          isBlocked
                            ? isSelected
                              ? "bg-rose-950/90 text-rose-100 font-semibold border-rose-800 shadow-inner"
                              : "bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border-rose-900/40"
                            : isSelected 
                            ? "bg-slate-800/90 text-slate-100 font-semibold border-slate-700" 
                            : "hover:bg-slate-900/80 text-slate-300 border-slate-800/80"
                        }`}
                      >
                        {/* Selector ▶ */}
                        <td className={`p-1 text-center border-r ${isBlocked ? "border-rose-900/50 bg-rose-950/60" : "border-slate-800 bg-slate-900/40"}`}>
                          {isSelected && (
                            <span className={isBlocked ? "text-rose-400 font-black text-xs" : "text-emerald-400 font-black text-xs"}>
                              ▶
                            </span>
                          )}
                        </td>

                        {/* ID */}
                        <td className={`p-1 text-center font-mono text-xs border-r ${isBlocked ? "border-rose-900/50 text-rose-400 font-bold" : "border-slate-800 text-slate-500"}`}>
                          {c.display_number || "—"}
                        </td>

                        {/* Prefix */}
                        <td className={`p-1 text-center border-r ${isBlocked ? "border-rose-900/50 text-rose-300 font-semibold" : "border-slate-800 text-slate-400 font-semibold"}`}>
                          {c.prefix || "—"}
                        </td>

                        {/* Full Name (Double click to open profile) */}
                        <td 
                          className={`p-1 border-r ${isBlocked ? "border-rose-900/50" : "border-slate-800"}`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            router.push(`/candidates/${c.candidate_id}`);
                          }}
                        >
                          <div 
                            className={`px-2 py-0.5 border font-extrabold rounded text-xs truncate transition-all shadow-xs flex items-center justify-between group cursor-pointer ${
                              isBlocked
                                ? "bg-rose-950/90 hover:bg-rose-900 border-rose-700/80 text-rose-300 ring-1 ring-rose-500/30"
                                : "bg-emerald-950/90 hover:bg-emerald-900 border-emerald-700/60 text-emerald-300"
                            }`}
                            title={
                              isBlocked 
                                ? `🚫 BLACKLISTED CANDIDATE${c.blacklist_note ? `: ${c.blacklist_note}` : ''} • Double-click to open profile` 
                                : "Click once to select • Double-click to open 360° Profile"
                            }
                          >
                            <div className="flex items-center space-x-1.5 truncate">
                              {isBlocked && <span className="text-[10px] text-rose-400">🚫</span>}
                              <span className="truncate">{c.full_name || "Untitled"}</span>
                            </div>
                            {isBlocked ? (
                              <span className="text-[9px] px-1 bg-rose-900 text-rose-200 rounded font-black shrink-0 ml-1 border border-rose-700">
                                BLACKLIST
                              </span>
                            ) : (
                              <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                            )}
                          </div>
                        </td>

                        {/* SMART PHONES HUB */}
                        <td className="p-1 border-r border-slate-800 relative contact-popover-container" onClick={(e) => e.stopPropagation()}>
                          {phones.length > 0 ? (
                            <div className="flex items-center space-x-1.5">
                              {/* Primary Phone */}
                              <button
                                onClick={() => copyToClipboard(phones[0], "Phone")}
                                className="hover:text-emerald-400 font-mono text-[11px] flex items-center space-x-1 truncate max-w-[110px] cursor-pointer"
                                title="Click to copy primary phone"
                              >
                                <Phone size={10} className="text-emerald-500 shrink-0" />
                                <span className="truncate">{phones[0]}</span>
                              </button>

                              {/* More Phones Badge */}
                              {phones.length > 1 && (
                                <Popover
                                  open={activePopover?.candidateId === c.candidate_id && activePopover?.type === 'phone'}
                                  onOpenChange={(open) => setActivePopover(open ? { candidateId: c.candidate_id, type: 'phone' } : null)}
                                >
                                  <PopoverTrigger
                                    type="button"
                                    className="px-1.5 py-0.2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-400 font-bold rounded text-[10px] cursor-pointer"
                                    title={`View all ${phones.length} phone numbers`}
                                  >
                                    +{phones.length - 1}
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-48 p-2 space-y-1 bg-slate-900 border border-slate-700 text-slate-200"
                                    align="start"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
                                      All Phone Numbers ({phones.length})
                                    </div>
                                    {phones.map((ph, idx) => (
                                      <div key={idx} className="flex items-center justify-between hover:bg-slate-800 p-1 rounded">
                                        <span className="font-mono text-[11px] text-slate-200">{ph}</span>
                                        <button
                                          onClick={() => copyToClipboard(ph, `Phone #${idx + 1}`)}
                                          className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                          title="Copy this phone"
                                        >
                                          <Copy size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* SMART EMAILS HUB */}
                        <td className="p-1 border-r border-slate-800 relative contact-popover-container" onClick={(e) => e.stopPropagation()}>
                          {emails.length > 0 ? (
                            <div className="flex items-center space-x-1.5">
                              {/* Primary Email */}
                              <button
                                onClick={() => copyToClipboard(emails[0], "Email")}
                                className="hover:text-emerald-400 font-mono text-[11px] flex items-center space-x-1 truncate max-w-[150px] cursor-pointer"
                                title="Click to copy primary email"
                              >
                                <Mail size={10} className="text-emerald-500 shrink-0" />
                                <span className="truncate">{emails[0]}</span>
                              </button>

                              {/* More Emails Badge */}
                              {emails.length > 1 && (
                                <Popover
                                  open={activePopover?.candidateId === c.candidate_id && activePopover?.type === 'email'}
                                  onOpenChange={(open) => setActivePopover(open ? { candidateId: c.candidate_id, type: 'email' } : null)}
                                >
                                  <PopoverTrigger
                                    type="button"
                                    className="px-1.5 py-0.2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-400 font-bold rounded text-[10px] cursor-pointer"
                                    title={`View all ${emails.length} emails`}
                                  >
                                    +{emails.length - 1}
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-56 p-2 space-y-1 bg-slate-900 border border-slate-700 text-slate-200"
                                    align="start"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
                                      All Email Addresses ({emails.length})
                                    </div>
                                    {emails.map((em, idx) => (
                                      <div key={idx} className="flex items-center justify-between hover:bg-slate-800 p-1 rounded">
                                        <span className="font-mono text-[11px] text-slate-200 truncate max-w-[170px]">{em}</span>
                                        <button
                                          onClick={() => copyToClipboard(em, `Email #${idx + 1}`)}
                                          className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                          title="Copy this email"
                                        >
                                          <Copy size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* SMART SOCIALS & WEB HUB */}
                        <td className="p-1 border-r border-slate-800" onClick={(e) => e.stopPropagation()}>
                          {socials.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
                              {socials.map((soc, idx) => {
                                let href = soc.value || "";
                                if (soc.type?.toLowerCase() === "skype") {
                                  href = `skype:${soc.value}?chat`;
                                } else if (!href.startsWith("http://") && !href.startsWith("https://")) {
                                  href = `https://${href}`;
                                }

                                const displayLabel = soc.value?.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^(linkedin\.com\/in\/|facebook\.com\/|github\.com\/)/i, '');

                                return (
                                  <a
                                    key={idx}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 rounded text-[10px] font-medium text-slate-200 flex items-center space-x-1 transition-all"
                                    title={`${soc.type}: ${soc.value} (Click to open)`}
                                  >
                                    {renderSocialIcon(soc.type)}
                                    <span className="truncate max-w-[90px]">{displayLabel}</span>
                                  </a>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* CV LINK */}
                        <td className="p-1 text-center">
                          {c.cv_url ? (
                            <a
                              href={c.cv_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-0.5 bg-slate-900 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 rounded text-[10px] font-bold inline-flex items-center space-x-1 transition-all"
                              title="Open CV Document"
                            >
                              <FileText size={10} />
                              <span>CV</span>
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ======================================================== */}
          {/* 2. CLIENT DATABASE TABLE */}
          {/* ======================================================== */}
          {activeTab === "client" && (
            <table className="w-full text-xs text-left border-collapse select-text">
              <thead className="bg-slate-900 text-slate-300 font-extrabold sticky top-0 z-10 border-b border-slate-800 text-center uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="w-8 p-1.5 border-r border-slate-800"></th>
                  <th className="w-16 p-1.5 border-r border-slate-800">ID</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[240px] text-emerald-400">Client Name</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[160px]">Industry</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[140px]">Location</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[200px]">Contact Persons</th>
                  <th className="w-20 p-1.5 text-center border-r border-slate-800">Active Jobs</th>
                  <th className="w-24 p-1.5 text-center border-r border-slate-800">Applications</th>
                  <th className="w-20 p-1.5 text-center">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-400">
                      <Loader2 size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                      Loading clients database...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-500 italic">
                      No clients found matching "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  clients.map((cl) => {
                    const isSelected = selectedId === cl.client_id;
                    return (
                      <tr
                        key={cl.client_id}
                        onClick={() => setSelectedId(cl.client_id)}
                        className={`transition-colors cursor-pointer text-xs ${
                          isSelected 
                            ? "bg-slate-800/90 text-slate-100 font-semibold" 
                            : "hover:bg-slate-900/80 text-slate-300"
                        }`}
                      >
                        {/* Selector ▶ */}
                        <td className="p-1 text-center border-r border-slate-800 bg-slate-900/40">
                          {isSelected && <span className="text-emerald-400 font-black text-xs">▶</span>}
                        </td>

                        {/* ID */}
                        <td className="p-1 text-center font-mono text-xs border-r border-slate-800 text-slate-500">
                          {cl.display_number || "—"}
                        </td>

                        {/* Client Name (Double click to open in Jobs & Clients Workbench) */}
                        <td 
                          className="p-1 border-r border-slate-800"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            router.push(`/jobs?client_id=${cl.client_id}`);
                          }}
                        >
                          <div 
                            className="px-2 py-0.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-extrabold rounded text-xs truncate transition-all shadow-xs flex items-center justify-between group cursor-pointer"
                            title="Click once to select • Double-click to open in Jobs & Clients Workbench"
                          >
                            <span className="truncate">{cl.client_name}</span>
                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                          </div>
                        </td>

                        {/* Industry */}
                        <td className="p-1 border-r border-slate-800 text-slate-300 truncate max-w-[160px]" title={cl.industry}>
                          {cl.industry}
                        </td>

                        {/* Location */}
                        <td className="p-1 border-r border-slate-800 text-slate-400 truncate max-w-[140px]" title={cl.location}>
                          {cl.location}
                        </td>

                        {/* Contacts */}
                        <td className="p-1 border-r border-slate-800 text-slate-300 truncate max-w-[200px]" title={cl.contacts}>
                          {cl.contacts}
                        </td>

                        {/* Job Count */}
                        <td className="p-1 text-center font-bold border-r border-slate-800 text-emerald-400">
                          {cl.job_count || 0}
                        </td>

                        {/* Candidate Count */}
                        <td className="p-1 text-center font-bold border-r border-slate-800 text-slate-300">
                          {cl.candidate_count || 0}
                        </td>

                        {/* Status */}
                        <td className="p-1 text-center">
                          <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded text-[10px] font-bold">
                            {cl.status || "Active"}
                          </span>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ======================================================== */}
          {/* 3. JOB ORDER DATABASE TABLE */}
          {/* ======================================================== */}
          {activeTab === "job" && (
            <table className="w-full text-xs text-left border-collapse select-text">
              <thead className="bg-slate-900 text-slate-300 font-extrabold sticky top-0 z-10 border-b border-slate-800 text-center uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="w-8 p-1.5 border-r border-slate-800"></th>
                  <th className="w-16 p-1.5 border-r border-slate-800">ID</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[240px] text-emerald-400">Job Order Title</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[200px]">Client Company</th>
                  <th className="p-1.5 border-r border-slate-800 w-24 text-center">Status</th>
                  <th className="p-1.5 border-r border-slate-800 min-w-[140px]">Location</th>
                  <th className="w-24 p-1.5 text-center border-r border-slate-800">Total Applicants</th>
                  <th className="w-28 p-1.5 text-center">Created Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400">
                      <Loader2 size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                      Loading job orders database...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-500 italic">
                      No job orders found matching "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => {
                    const isSelected = selectedId === j.job_id;
                    return (
                      <tr
                        key={j.job_id}
                        onClick={() => setSelectedId(j.job_id)}
                        className={`transition-colors cursor-pointer text-xs ${
                          isSelected 
                            ? "bg-slate-800/90 text-slate-100 font-semibold" 
                            : "hover:bg-slate-900/80 text-slate-300"
                        }`}
                      >
                        {/* Selector ▶ */}
                        <td className="p-1 text-center border-r border-slate-800 bg-slate-900/40">
                          {isSelected && <span className="text-emerald-400 font-black text-xs">▶</span>}
                        </td>

                        {/* ID */}
                        <td className="p-1 text-center font-mono text-xs border-r border-slate-800 text-slate-500">
                          {j.display_number || "—"}
                        </td>

                        {/* Job Title (Double click to open jobs page) */}
                        <td 
                          className="p-1 border-r border-slate-800"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            router.push(`/jobs?job_id=${j.job_id}`);
                          }}
                        >
                          <div 
                            className="px-2 py-0.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-extrabold rounded text-xs truncate transition-all shadow-xs flex items-center justify-between group cursor-pointer"
                            title="Click once to select • Double-click to open Job in Jobs & Clients Workbench"
                          >
                            <span className="truncate">{j.job_title}</span>
                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                          </div>
                        </td>

                        {/* Client Name */}
                        <td 
                          className="p-1 border-r border-slate-800 text-slate-200 truncate max-w-[200px] hover:text-emerald-400 hover:underline cursor-pointer" 
                          title={`${j.client_name} • Double-click to open Client in Jobs & Clients Workbench`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (j.client_id) {
                              router.push(`/jobs?client_id=${j.client_id}`);
                            } else if (j.client_name) {
                              router.push(`/jobs?client_name=${encodeURIComponent(j.client_name)}`);
                            }
                          }}
                        >
                          {j.client_name || "—"}
                        </td>

                        {/* Status */}
                        <td className="p-1 text-center border-r border-slate-800">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            j.status === "Open"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : j.status === "On Hold"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-slate-900 text-slate-400 border-slate-700"
                          }`}>
                            {j.status || "Open"}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="p-1 border-r border-slate-800 text-slate-400 truncate max-w-[140px]">
                          {j.location || "—"}
                        </td>

                        {/* Candidate Count */}
                        <td className="p-1 text-center font-bold border-r border-slate-800 text-emerald-400">
                          {j.candidate_count || 0}
                        </td>

                        {/* Created Date */}
                        <td className="p-1 text-center font-mono text-[11px] text-slate-400">
                          {j.created_date || "—"}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

        </div>

      </div>

      {/* ======================================================== */}
      {/* FOOTER BAR: RECORD NAVIGATOR & PAGE CONTROLS */}
      {/* ======================================================== */}
      <footer className="h-7 bg-slate-950 border-t border-slate-800 text-slate-400 px-3 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
        
        {/* Left: Record Navigator & Page Controls */}
        <div className="flex items-center space-x-3">
          {/* Record Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Record:</span>
            <button 
              onClick={() => navigateRecord(-1)}
              disabled={selectedIndex <= 0}
              className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 rounded text-xs text-slate-200 cursor-pointer border border-slate-800"
              title="Previous record on this page"
            >
              ◀
            </button>

            <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded font-bold text-emerald-400 text-[10px]">
              {selectedIndex >= 0 ? selectedIndex + 1 : 0} of {currentList.length}
            </span>

            <button 
              onClick={() => navigateRecord(1)}
              disabled={selectedIndex >= currentList.length - 1}
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
              ({currentTotal.toLocaleString()} total)
            </span>
          </div>
        </div>

        {/* Right: Selected Summary Info */}
        <div className="flex items-center space-x-4 text-slate-500 text-[10px]">
          {activeTab === "candidate" && selectedIndex >= 0 && (
            <>
              <span>Candidate: <strong className={candidates[selectedIndex]?.blocked ? "text-rose-400 font-bold" : "text-slate-300"}>{candidates[selectedIndex]?.full_name}</strong></span>
              <span>•</span>
              <span>ID: <strong className="text-slate-300 font-mono">{candidates[selectedIndex]?.display_number}</strong></span>
              <span>•</span>
              <span>Contacts: <strong className="text-emerald-400">{(candidates[selectedIndex]?.phones?.length || 0) + (candidates[selectedIndex]?.emails?.length || 0) + (candidates[selectedIndex]?.socials?.length || 0)}</strong></span>
              {candidates[selectedIndex]?.blocked && (
                <>
                  <span>•</span>
                  <span className="text-rose-400 font-bold">🚫 Blacklisted{candidates[selectedIndex]?.blacklist_note ? `: ${candidates[selectedIndex]?.blacklist_note}` : ''}</span>
                </>
              )}
            </>
          )}
          {activeTab === "client" && selectedIndex >= 0 && (
            <>
              <span>Client: <strong className="text-slate-300">{clients[selectedIndex]?.client_name}</strong></span>
              <span>•</span>
              <span>Jobs: <strong className="text-emerald-400">{clients[selectedIndex]?.job_count}</strong></span>
            </>
          )}
          {activeTab === "job" && selectedIndex >= 0 && (
            <>
              <span>Job Order: <strong className="text-slate-300">{jobs[selectedIndex]?.job_title}</strong></span>
              <span>•</span>
              <span>Client: <strong className="text-slate-300">{jobs[selectedIndex]?.client_name}</strong></span>
            </>
          )}
          <span className="text-emerald-500 font-semibold">● Ready</span>
        </div>

      </footer>

    </div>
  );
}