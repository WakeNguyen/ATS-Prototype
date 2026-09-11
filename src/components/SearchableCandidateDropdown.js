"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Check, Phone, Mail, ShieldAlert, Loader2, ChevronDown } from "lucide-react";
import { searchCandidatesServer } from "../app/actions";

/**
 * Pure Server-Side Searchable Candidate Dropdown Component with Infinite Scroll Pagination.
 * 
 * 100% Security & Stability: Never dumps candidate database into client RAM.
 * Queries Supabase PostgreSQL server-side with 280ms debounce and dynamic batch loading on mouse wheel scroll.
 * 
 * @component
 * @param {Object} props - Component properties.
 * @param {string | null} [props.selectedId=null] - Currently selected candidate ID.
 * @param {(candidate: Object) => void} props.onSelect - Callback fired when a candidate is picked.
 * @param {string} [props.placeholder="Search name, ID #, phone, email, LinkedIn..."] - Search placeholder.
 * @param {string} [props.className=""] - Extra CSS class names.
 * @param {boolean} [props.autoFocus=false] - Auto focus search input.
 * @returns {JSX.Element} The rendered server-side dropdown.
 */
export default function SearchableCandidateDropdown({
  selectedId = null,
  onSelect,
  placeholder = "Search name, ID #, phone, email, LinkedIn...",
  className = "",
  autoFocus = false
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const searchInputRef = useRef(null);
  const listContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Auto focus input on mount if requested
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [autoFocus]);

  // Initial load: Fetch top 50 recent candidates from server
  useEffect(() => {
    let isMounted = true;
    setIsSearching(true);
    searchCandidatesServer({ query: "", limit: 50, offset: 0 })
      .then(res => {
        if (isMounted && res.success) {
          setResults(res.data || []);
          setTotalCount(res.totalCount || 0);
          setActiveIndex(0);
        }
      })
      .catch(err => console.error("Initial candidate search error:", err))
      .finally(() => {
        if (isMounted) setIsSearching(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced Server-Side Search on SearchTerm change (280ms)
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setIsSearching(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchCandidatesServer({ query: val, limit: 50, offset: 0 });
        if (res.success) {
          setResults(res.data || []);
          setTotalCount(res.totalCount || 0);
          setActiveIndex(0);
          if (listContainerRef.current) {
            listContainerRef.current.scrollTop = 0;
          }
        }
      } catch (err) {
        console.error("Server candidate search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  // Load next batch from server on scroll, arrow navigation or click
  const loadNextBatch = useCallback(async () => {
    if (isLoadingMore || isSearching || results.length >= totalCount) return;
    setIsLoadingMore(true);
    try {
      const res = await searchCandidatesServer({
        query: searchTerm,
        limit: 50,
        offset: results.length
      });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setResults(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = res.data.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
    } catch (err) {
      console.error("Error loading more candidates from server:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isSearching, results.length, totalCount, searchTerm]);

  // Handle progressive mouse wheel scroll
  const handleListScroll = useCallback((e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 120) {
      loadNextBatch();
    }
  }, [loadNextBatch]);

  // Keyboard Navigation (ArrowUp, ArrowDown, PageDown, PageUp, Enter) - Clean side-effect free
  const handleKeyDown = useCallback((e) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const next = activeIndex < results.length - 1 ? activeIndex + 1 : activeIndex;
      setActiveIndex(next);
      if (next >= results.length - 5) {
        loadNextBatch();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const next = activeIndex > 0 ? activeIndex - 1 : 0;
      setActiveIndex(next);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      e.stopPropagation();
      const next = Math.min(activeIndex + 8, results.length - 1);
      setActiveIndex(next);
      if (next >= results.length - 5) {
        loadNextBatch();
      }
    } else if (e.key === "PageUp") {
      e.preventDefault();
      e.stopPropagation();
      const next = Math.max(activeIndex - 8, 0);
      setActiveIndex(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIndex >= 0 && activeIndex < results.length) {
        const picked = results[activeIndex];
        if (picked && onSelect) {
          onSelect(picked);
        }
      }
    }
  }, [results, activeIndex, onSelect, loadNextBatch]);

  // Auto scroll active item into view using data-candidate-item
  useEffect(() => {
    if (activeIndex >= 0 && listContainerRef.current) {
      const items = listContainerRef.current.querySelectorAll("button[data-candidate-item='true']");
      const activeEl = items[activeIndex];
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [activeIndex]);

  return (
    <div 
      onKeyDown={handleKeyDown}
      className={`flex flex-col bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden ${className}`}
      style={{
        maxHeight: "460px",
        height: "460px"
      }}
    >
      {/* Search Header */}
      <div className="p-2.5 border-b border-slate-800 bg-slate-950/95 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          {isSearching ? (
            <Loader2 size={14} className="absolute right-2.5 top-2.5 text-emerald-400 animate-spin" />
          ) : searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setIsSearching(true);
                searchCandidatesServer({ query: "", limit: 50, offset: 0 }).then(res => {
                  if (res.success) {
                    setResults(res.data || []);
                    setTotalCount(res.totalCount || 0);
                    setActiveIndex(0);
                  }
                  setIsSearching(false);
                });
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 p-0.5 rounded"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>

        {/* Server Match Counter Badge */}
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-emerald-400 font-mono">
              {totalCount.toLocaleString()}
            </span>
            <span>matches in database</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {isSearching ? (
              <span className="text-emerald-400 font-medium">Searching server...</span>
            ) : (
              <span>Showing <strong>1–{results.length}</strong> of {totalCount.toLocaleString()}</span>
            )}
          </span>
        </div>
      </div>

      {/* Candidates List with Fixed Scrollable Height and Scroll Handler */}
      <div
        ref={listContainerRef}
        onScroll={handleListScroll}
        onWheel={(e) => {
          e.stopPropagation();
        }}
        style={{
          height: "350px",
          maxHeight: "350px",
          overflowY: "scroll",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          scrollbarWidth: "thin",
          scrollbarColor: "#059669 #020617"
        }}
        className="w-full flex-1 overflow-y-scroll divide-y divide-slate-800/60 scrollbar-thin scrollbar-thumb-emerald-600/80 hover:scrollbar-thumb-emerald-500 scrollbar-track-slate-950"
      >
        {isSearching && results.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-emerald-500" />
            <span>Searching PostgreSQL database...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No candidates matching <span className="text-slate-300 font-semibold">"{searchTerm}"</span> in database.
          </div>
        ) : (
          <div className="flex flex-col">
            {results.map((c, idx) => {
              const isSelected = c.id === selectedId;
              const isActive = idx === activeIndex;

              const phoneList = Array.isArray(c.phones) ? c.phones : [];
              const emailList = Array.isArray(c.emails) ? c.emails : [];
              const primaryPhone = phoneList[0] || "";
              const primaryEmail = emailList[0] || "";

              return (
                <button
                  key={c.id}
                  data-candidate-item="true"
                  type="button"
                  onClick={() => onSelect && onSelect(c)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-emerald-950/60 text-emerald-300 border-l-4 border-l-emerald-500"
                      : isActive
                      ? "bg-slate-800/90 text-slate-100 border-l-4 border-l-emerald-500/40"
                      : "hover:bg-slate-800/50 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Prefix / Avatar Badge */}
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs ${
                        c.blocked
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : isSelected
                          ? "bg-emerald-500 text-slate-950 font-extrabold"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {c.prefix ? c.prefix.replace(".", "") : "C"}
                    </div>

                    {/* Candidate Name & Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-100 truncate">
                          {c.full_name || "Unnamed Candidate"}
                        </span>

                        <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0">
                          #{c.display_number || "?"}
                        </span>

                        {c.blocked && (
                          <span className="px-1.5 py-0.2 bg-rose-950 text-rose-400 border border-rose-800 rounded text-[9px] font-bold shrink-0 flex items-center gap-0.5">
                            <ShieldAlert size={9} />
                            BLACKLIST
                          </span>
                        )}
                      </div>

                      {/* Contact Snippets */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5 truncate">
                        {primaryPhone && (
                          <span className="flex items-center gap-1 font-mono text-emerald-300/80">
                            <Phone size={10} className="shrink-0 text-emerald-500" />
                            {primaryPhone}
                          </span>
                        )}
                        {primaryEmail && (
                          <span className="flex items-center gap-1 font-mono text-cyan-300/80 truncate max-w-[180px]">
                            <Mail size={10} className="shrink-0 text-cyan-500" />
                            {primaryEmail}
                          </span>
                        )}
                        {!primaryPhone && !primaryEmail && c.all_contacts_text && (
                          <span className="text-slate-500 text-[10px] truncate max-w-[220px]">
                            {c.all_contacts_text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Selection Indicator */}
                  {isSelected && (
                    <div className="ml-2 shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check size={13} className="font-bold" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Loading More Indicator */}
            {isLoadingMore && (
              <div className="p-3 text-center text-xs text-emerald-400 bg-slate-950/90 border-t border-slate-800 flex items-center justify-center gap-2 font-medium shrink-0">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
                <span>Loading next 50 candidates from PostgreSQL...</span>
              </div>
            )}

            {/* Click to Load More Button */}
            {!isLoadingMore && results.length < totalCount && (
              <button
                type="button"
                onClick={loadNextBatch}
                className="w-full py-2.5 px-3 text-center text-[11px] text-emerald-400 hover:text-emerald-300 bg-slate-950/80 hover:bg-slate-900 border-t border-slate-800 font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <ChevronDown size={13} />
                <span>Scroll down or click here to load next 50 candidates ({results.length} of {totalCount.toLocaleString()})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="px-3 py-1.5 bg-slate-950 text-[10px] text-slate-500 border-t border-slate-800 flex items-center justify-between shrink-0">
        <span>PostgreSQL Server Live</span>
        <span>Use ↑ / ↓ and Enter to select</span>
      </div>
    </div>
  );
}
