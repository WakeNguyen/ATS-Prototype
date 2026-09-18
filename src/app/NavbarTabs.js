"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Users, Briefcase, Search, Megaphone } from "lucide-react";

/**
 * Global Top Navbar Tabs Navigation Component.
 * 
 * Provides unified, single-click multi-page routing across the 5 core ATS modules:
 * - Action Menu (`/`)
 * - Candidates Hub (`/candidates`)
 * - Jobs & Clients CRM Workbench (`/jobs`)
 * - Campaigns & Auto-Post Hub (`/campaigns`)
 * - Global Multi-Entity Search Hub (`/search`)
 * 
 * @component
 * @returns {JSX.Element} The rendered Navbar navigation tabs.
 */
export default function NavbarTabs() {
  const pathname = usePathname();

  const isActionActive = pathname === "/";
  const isCandidateActive = pathname.startsWith("/candidates");
  const isJobsActive = pathname.startsWith("/jobs");
  const isCampaignsActive = pathname.startsWith("/campaigns");
  const isSearchActive = pathname.startsWith("/search");

  return (
    <div className="flex items-center space-x-1.5 text-xs font-bold">
      <Link
        href="/"
        title="Action Menu"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isActionActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <FileText size={13} />
        <span className="hidden lg:inline">Action Menu</span>
      </Link>

      <Link
        href="/candidates"
        title="Candidates"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isCandidateActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Users size={13} />
        <span className="hidden lg:inline">Candidates</span>
      </Link>

      <Link
        href="/jobs"
        title="Jobs & Clients"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isJobsActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Briefcase size={13} />
        <span className="hidden lg:inline">Jobs & Clients</span>
      </Link>

      <Link
        href="/campaigns"
        title="Campaigns"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isCampaignsActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Megaphone size={13} />
        <span className="hidden lg:inline">Campaigns</span>
      </Link>

      <Link
        href="/search"
        title="Search Menu"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isSearchActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Search size={13} />
        <span className="hidden lg:inline">Search Menu</span>
      </Link>
    </div>
  );
}
