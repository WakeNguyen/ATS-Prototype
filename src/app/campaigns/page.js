"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Megaphone, 
  Users, 
  Rocket, 
  Plus, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Briefcase, 
  Calendar, 
  Clock, 
  Edit3, 
  Edit2,
  Check, 
  X, 
  Layers, 
  Sparkles,
  Shield,
  HelpCircle,
  Play,
  Flame,
  Globe,
  Link2,
  Upload,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  Info,
  Zap,
  Maximize2,
  Minimize2
} from "lucide-react";

import { 
  getCampaigns, 
  getCampaignDetail, 
  getCampaignRunDetail, 
  setCampaignTargetGroups,
  getFbAccounts, 
  updateFbAccount,
  getWarmJoinRunDetail,
  getActiveWarmJoinRun,
  triggerWarmJoinRun,
  getSocialGroups,
  getSocialGroupsLibrary,
  getSocialGroupIdsMatchingFilter,
  createSocialGroup,
  updateSocialGroupDetails,
  toggleSocialGroupActive,
  getAllTagOptions,
  bulkAssignSocialGroupsToCampaigns,
  getSocialGroupsLibraryIdsMatchingFilter
} from "../campaign_actions";

import { stripAccents } from "src/lib/utils";
import AssignGroupsToCampaignsModal from "../components/AssignGroupsToCampaignsModal";

import RunHistoryTable from "../components/RunHistoryTable";
import CampaignDispatchPreviewModal from "../components/CampaignDispatchPreviewModal";
import FbAccountEditModal from "../components/FbAccountEditModal";
import CampaignEditModal from "../components/CampaignEditModal";
import JoinStatusBadge from "../components/JoinStatusBadge";
import GroupTypeTagEditor from "../components/GroupTypeTagEditor";
import SocialGroupCreateModal from "../components/SocialGroupCreateModal";
import SocialGroupBulkImportModal from "../components/SocialGroupBulkImportModal";

/**
 * Format relative time (e.g., "2h ago", "yesterday", "3 days ago")
 */
function formatRelativeTime(dateString) {
  if (!dateString) return "Never";
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString("vi-VN");
  } catch (e) {
    return dateString;
  }
}

function formatCampaignDate(d) {
  if (!d) return "Open";
  try {
    if (typeof d === "string") return d.substring(0, 10);
    return new Date(d).toISOString().substring(0, 10);
  } catch {
    return String(d).substring(0, 10);
  }
}

/**
 * Determine warming health badge and status indicators for an FB account.
 */
function getWarmingHealth(account) {
  const status = account?.status || "Active";
  if (status === "Checkpoint") {
    return {
      label: "Checkpoint",
      color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      dotColor: "bg-rose-500",
      icon: AlertTriangle,
      description: "Requires manual checkpoint resolution on Facebook"
    };
  }
  if (status === "Restricted") {
    return {
      label: "Restricted",
      color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      dotColor: "bg-orange-500",
      icon: ShieldAlert,
      description: "Posting restriction active on Facebook"
    };
  }
  if (status !== "Active") {
    return {
      label: status,
      color: "bg-slate-800 text-slate-400 border-slate-700",
      dotColor: "bg-slate-500",
      icon: Shield,
      description: "Account inactive"
    };
  }

  const isRecentlyWarmed = account.last_warmed_at && (Date.now() - new Date(account.last_warmed_at).getTime() < 24 * 3600 * 1000);
  const hasSufficientGroups = (account.joined_groups_count || 0) >= 10;

  if (isRecentlyWarmed && hasSufficientGroups) {
    return {
      label: "Ready to Post",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      dotColor: "bg-emerald-400 animate-pulse",
      icon: CheckCircle2,
      description: "Warmed < 24h ago with 10+ groups joined"
    };
  }

  return {
    label: "Warming Active",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400",
    icon: Flame,
    description: "Account in warm-up & group accumulation cycle"
  };
}

/**
 * Format Last Warmed timestamp with colored status dot.
 */
function getLastWarmedDisplay(dateString) {
  if (!dateString) {
    return {
      text: "Never",
      dotClass: "bg-slate-600"
    };
  }
  try {
    const d = new Date(dateString);
    const diffMs = Date.now() - d.getTime();
    const diffHours = diffMs / (3600 * 1000);

    let dotClass = "bg-emerald-400"; // < 24h
    if (diffHours >= 24 && diffHours < 168) {
      dotClass = "bg-amber-400"; // 24h - 7d
    } else if (diffHours >= 168) {
      dotClass = "bg-slate-500"; // > 7d
    }

    return {
      text: formatRelativeTime(dateString),
      dotClass
    };
  } catch {
    return {
      text: "Never",
      dotClass: "bg-slate-600"
    };
  }
}

function CampaignsContent() {
  const searchParams = useSearchParams();
  // Top Navigation Tab: 'campaigns' | 'fb_accounts' | 'social_groups'
  const [activeTab, setActiveTab] = useState("campaigns");

  // Deep linking via URL query params
  useEffect(() => {
    if (!searchParams) return;
    const tabParam = searchParams.get("tab");
    const groupIdParam = searchParams.get("group_id");
    if (tabParam === "social_groups" || tabParam === "social-groups" || tabParam === "groups") {
      setActiveTab("social_groups");
      if (groupIdParam) {
        setFocusGroupId(groupIdParam);
      }
    }
  }, [searchParams]);

  // ==========================================
  // 1. CAMPAIGNS TAB STATE
  // ==========================================
  const [campaignTypeFilter, setCampaignTypeFilter] = useState("ALL"); // 'ALL' | 'Job Posting' | 'Warming'
  const [warmCampaignTarget, setWarmCampaignTarget] = useState(null); // Campaign target for Warm & Join
  const [campaigns, setCampaigns] = useState([]);
  const [hasRunningCampaign, setHasRunningCampaign] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("HIDE_ARCHIVED");
  const [campaignToast, setCampaignToast] = useState(null);
  const [expandedJobsRowIds, setExpandedJobsRowIds] = useState(new Set());
  const LINKED_JOB_BADGES_VISIBLE_LIMIT = 2;

  const toggleJobsRowExpanded = (campaignId) => {
    setExpandedJobsRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSubTab, setDetailSubTab] = useState("overview"); // 'overview' | 'run_history'
  const [isDetailPanelExpanded, setIsDetailPanelExpanded] = useState(false);

  // Target Groups editor in Campaign Overview
  const [allSocialGroups, setAllSocialGroups] = useState([]);
  const [targetGroupIds, setTargetGroupIds] = useState(new Set());
  const [savingTargetGroups, setSavingTargetGroups] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState(new Set());
  const [showOnlySelectedGroups, setShowOnlySelectedGroups] = useState(false);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize] = useState(30);
  const [groupTotalCount, setGroupTotalCount] = useState(0);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const groupDebounceRef = useRef(null);

  // Modals for Campaigns
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState(null);

  // ==========================================
  // 2. FB ACCOUNTS TAB STATE
  // ==========================================
  const [fbAccounts, setFbAccounts] = useState([]);
  const [loadingFbAccounts, setLoadingFbAccounts] = useState(true);
  const [fbAccountSearch, setFbAccountSearch] = useState("");

  // Warm & Join State
  const [isWarmingRunning, setIsWarmingRunning] = useState(false);
  const [confirmWarmModalOpen, setConfirmWarmModalOpen] = useState(false);
  const [maxGroupsPerAccount, setMaxGroupsPerAccount] = useState(2);
  const [customMaxGroups, setCustomMaxGroups] = useState("");
  const [triggeringWarm, setTriggeringWarm] = useState(false);
  const [warmFeedback, setWarmFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Modals for FB Accounts
  const [fbAccountModalOpen, setFbAccountModalOpen] = useState(false);
  const [editingFbAccountId, setEditingFbAccountId] = useState(null);

  // ==========================================
  // 3. SOCIAL GROUPS LIBRARY TAB STATE
  // ==========================================
  const [socialGroupsLibrary, setSocialGroupsLibrary] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [focusGroupId, setFocusGroupId] = useState(null);
  const [librarySelectedTagFilters, setLibrarySelectedTagFilters] = useState(new Set());
  const [libraryMinMembers, setLibraryMinMembers] = useState("");
  const [libraryMaxMembers, setLibraryMaxMembers] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [selectedLibraryGroupIds, setSelectedLibraryGroupIds] = useState(new Set());
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [isSelectingAllFiltered, setIsSelectingAllFiltered] = useState(false);
  const [libraryToast, setLibraryToast] = useState(null);
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryPageSize] = useState(50);
  const [libraryTotalCount, setLibraryTotalCount] = useState(0);
  const [libraryInactiveTotalCount, setLibraryInactiveTotalCount] = useState(0);
  const libraryDebounceRef = useRef(null);

  // Inline editing for group name, URL & member count in library
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editMemberCount, setEditMemberCount] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Tag registry state (PHẦN 5.4 - persistent tag registry)
  const [allTagOptions, setAllTagOptions] = useState([]);

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const loadAllTagOptions = useCallback(async () => {
    try {
      const res = await getAllTagOptions();
      if (res.success && res.data) {
        setAllTagOptions(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch all tag options:", err);
    }
  }, []);

  const loadCampaignsList = useCallback(async (silent = false) => {
    const isSilent = silent === true;
    if (!isSilent) setLoadingCampaigns(true);
    try {
      const filters = {};
      if (campaignStatusFilter !== "ALL") filters.status = campaignStatusFilter;
      if (campaignTypeFilter !== "ALL") filters.campaign_type = campaignTypeFilter;
      if (campaignSearch.trim()) filters.search = campaignSearch.trim();

      const res = await getCampaigns(filters);
      if (res.success) {
        setCampaigns(res.data || []);
        setHasRunningCampaign((res.data || []).some((c) => c.latest_run_status === "Running"));
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      if (!isSilent) setLoadingCampaigns(false);
    }
  }, [campaignStatusFilter, campaignTypeFilter, campaignSearch]);

  const loadFbAccountsList = useCallback(async () => {
    setLoadingFbAccounts(true);
    try {
      const res = await getFbAccounts();
      if (res.success) {
        setFbAccounts(res.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch FB accounts:", err);
    } finally {
      setLoadingFbAccounts(false);
    }
  }, []);

  const fetchSocialGroupsLibrary = useCallback(
    async (
      targetPage = 1,
      searchVal = "",
      tags = new Set(),
      incInactive = false,
      minM = "",
      maxM = "",
      focusId = null
    ) => {
      setLoadingLibrary(true);
      try {
        const res = await getSocialGroupsLibrary({
          includeInactive: incInactive,
          search: searchVal,
          tagFilters: Array.from(tags),
          minMembers: minM,
          maxMembers: maxM,
          page: targetPage,
          pageSize: libraryPageSize,
          focusGroupId: focusId,
        });
        if (res.success) {
          setSocialGroupsLibrary(res.data || []);
          setLibraryTotalCount(res.totalCount || 0);
          setLibraryInactiveTotalCount(res.inactiveTotalCount || 0);
        }
      } catch (err) {
        console.error("Failed to fetch social groups library:", err);
      } finally {
        setLoadingLibrary(false);
      }
    },
    [libraryPageSize]
  );

  const loadSocialGroupsLibrary = useCallback(() => {
    fetchSocialGroupsLibrary(
      libraryPage,
      librarySearch,
      librarySelectedTagFilters,
      showInactive,
      libraryMinMembers,
      libraryMaxMembers,
      focusGroupId
    );
  }, [
    fetchSocialGroupsLibrary,
    libraryPage,
    librarySearch,
    librarySelectedTagFilters,
    showInactive,
    libraryMinMembers,
    libraryMaxMembers,
    focusGroupId,
  ]);

  // Initial Load & Debounced Search Effect for Library
  useEffect(() => {
    if (activeTab !== "social_groups") return;
    if (libraryDebounceRef.current) clearTimeout(libraryDebounceRef.current);
    libraryDebounceRef.current = setTimeout(() => {
      setLibraryPage(1);
      fetchSocialGroupsLibrary(
        1,
        librarySearch,
        librarySelectedTagFilters,
        showInactive,
        libraryMinMembers,
        libraryMaxMembers,
        focusGroupId
      );
    }, 300);

    return () => {
      if (libraryDebounceRef.current) clearTimeout(libraryDebounceRef.current);
    };
  }, [
    librarySearch,
    librarySelectedTagFilters,
    showInactive,
    libraryMinMembers,
    libraryMaxMembers,
    activeTab,
    fetchSocialGroupsLibrary,
    focusGroupId,
  ]);

  function handleLibraryPageChange(newPage) {
    const totalPages = Math.max(1, Math.ceil(libraryTotalCount / libraryPageSize));
    if (newPage < 1 || newPage > totalPages) return;
    setLibraryPage(newPage);
    fetchSocialGroupsLibrary(
      newPage,
      librarySearch,
      librarySelectedTagFilters,
      showInactive,
      libraryMinMembers,
      libraryMaxMembers,
      focusGroupId
    );
  }

  // Target Groups fetcher
  const fetchTargetGroups = useCallback(
    async (targetPage = 1, searchVal = "", tags = new Set(), onlySelected = false) => {
      setLoadingGroups(true);
      try {
        const res = await getSocialGroups({
          search: searchVal,
          tagFilters: Array.from(tags),
          page: targetPage,
          pageSize: groupPageSize,
          ids: onlySelected ? Array.from(targetGroupIds) : null,
        });
        if (res.success) {
          setAllSocialGroups(res.data || []);
          setGroupTotalCount(res.totalCount || 0);
        }
      } catch (err) {
        console.error("Failed to fetch target groups:", err);
      } finally {
        setLoadingGroups(false);
      }
    },
    [groupPageSize, targetGroupIds]
  );

  // Fetch campaign detail when selected
  const loadCampaignDetailData = useCallback(
    async (id, silent = false) => {
      if (!id) return;
      const isSilent = silent === true;
      if (!isSilent) setLoadingDetail(true);
      try {
        const detailRes = await getCampaignDetail(id);
        if (detailRes.success && detailRes.data) {
          const cData = detailRes.data.campaign || detailRes.data;
          const flattened = {
            ...cData,
            name: cData.campaign_name || cData.name,
            targetGroups: detailRes.data.targetGroups || [],
            fbAccounts: detailRes.data.assignedAccounts || [],
            runs: detailRes.data.runs || []
          };
          setCampaignDetail(flattened);
          if (!isSilent) {
            const tIds = new Set((detailRes.data.targetGroups || []).map((g) => g.id));
            setTargetGroupIds(tIds);
          }
        }
        if (!isSilent) {
          setShowOnlySelectedGroups(false);
          setGroupPage(1);
          await fetchTargetGroups(1, groupSearchTerm, selectedTagFilters, false);
        }
      } catch (err) {
        console.error("Failed to load campaign detail:", err);
      } finally {
        if (!isSilent) setLoadingDetail(false);
      }
    },
    [fetchTargetGroups, groupSearchTerm, selectedTagFilters]
  );

  // Debounced search for Target Groups
  useEffect(() => {
    if (!selectedCampaignId) return;
    if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    groupDebounceRef.current = setTimeout(() => {
      setGroupPage(1);
      fetchTargetGroups(1, groupSearchTerm, selectedTagFilters, showOnlySelectedGroups);
    }, 300);

    return () => {
      if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    };
  }, [groupSearchTerm, selectedTagFilters, selectedCampaignId, showOnlySelectedGroups, fetchTargetGroups]);

  function handleGroupPageChange(newPage) {
    const totalPages = Math.max(1, Math.ceil(groupTotalCount / groupPageSize));
    if (newPage < 1 || newPage > totalPages) return;
    setGroupPage(newPage);
    fetchTargetGroups(newPage, groupSearchTerm, selectedTagFilters, showOnlySelectedGroups);
  }

  useEffect(() => {
    loadCampaignsList();
    loadAllTagOptions();
  }, [loadCampaignsList, loadAllTagOptions]);

  const checkActiveWarmRun = useCallback(async () => {
    try {
      const res = await getActiveWarmJoinRun();
      if (res.success) {
        setIsWarmingRunning(!!res.activeRun);
      }
    } catch (e) {
      console.error("Failed to check active warm run:", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "fb_accounts") {
      loadFbAccountsList();
      checkActiveWarmRun();
    }
  }, [activeTab, loadFbAccountsList, checkActiveWarmRun]);

  useEffect(() => {
    if (!isWarmingRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await getActiveWarmJoinRun();
        if (res.success && !res.activeRun) {
          setIsWarmingRunning(false);
          loadFbAccountsList();
          if (selectedCampaignId) {
            loadCampaignDetailData(selectedCampaignId);
          }
        }
      } catch (e) {
        console.error("Polling error for warm join status:", e);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isWarmingRunning, loadFbAccountsList, selectedCampaignId, loadCampaignDetailData]);

  useEffect(() => {
    if (!hasRunningCampaign) return;
    const interval = setInterval(() => {
      loadCampaignsList(true);
      const viewedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
      if (selectedCampaignId && viewedCampaign?.latest_run_status === "Running") {
        loadCampaignDetailData(selectedCampaignId, true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [hasRunningCampaign, selectedCampaignId, campaigns, loadCampaignsList, loadCampaignDetailData]);

  const handleRunWarmJoin = async () => {
    const targetId = warmCampaignTarget?.id || selectedCampaignId;
    if (!targetId) {
      setWarmFeedback({
        type: "error",
        message: "Please select a Warming Campaign first."
      });
      return;
    }

    const resolvedMax = maxGroupsPerAccount === "custom"
      ? Math.max(1, parseInt(customMaxGroups, 10) || 2)
      : Number(maxGroupsPerAccount) || 2;

    setTriggeringWarm(true);
    setWarmFeedback(null);
    try {
      const res = await triggerWarmJoinRun(targetId, { maxGroupsPerAccount: resolvedMax });
      if (res.success) {
        setIsWarmingRunning(true);
        setConfirmWarmModalOpen(false);
        setWarmFeedback({
          type: "success",
          message: `Warm & Join session dispatched successfully (max ${resolvedMax} group(s)/account).`
        });
        loadFbAccountsList();
        loadCampaignsList();
        if (selectedCampaignId === targetId) {
          loadCampaignDetailData(targetId);
        }
      } else {
        setWarmFeedback({
          type: "error",
          message: res.error || "Failed to trigger Warm & Join run."
        });
      }
    } catch (err) {
      setWarmFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred."
      });
    } finally {
      setTriggeringWarm(false);
    }
  };

  const handleSelectAllFilteredLibrary = async () => {
    setIsSelectingAllFiltered(true);
    try {
      const res = await getSocialGroupsLibraryIdsMatchingFilter({
        includeInactive: showInactive,
        search: librarySearch,
        tagFilters: Array.from(librarySelectedTagFilters),
        minMembers: libraryMinMembers,
        maxMembers: libraryMaxMembers,
      });
      if (res.success && res.ids) {
        setSelectedLibraryGroupIds(new Set(res.ids));
      }
    } catch (err) {
      console.error("Failed to select all filtered library groups:", err);
    } finally {
      setIsSelectingAllFiltered(false);
    }
  };

  const toggleSelectLibraryGroup = (groupId) => {
    setSelectedLibraryGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleSelectAllCurrentPageGroups = () => {
    const pageIds = socialGroupsLibrary.map((g) => g.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedLibraryGroupIds.has(id));
    setSelectedLibraryGroupIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectCampaign = (c) => {
    if (selectedCampaignId === c.id) {
      setSelectedCampaignId(null);
      setCampaignDetail(null);
      setShowOnlySelectedGroups(false);
    } else {
      setSelectedCampaignId(c.id);
      loadCampaignDetailData(c.id);
    }
  };

  const handleSaveTargetGroups = async () => {
    if (!selectedCampaignId) return;
    setSavingTargetGroups(true);
    try {
      await setCampaignTargetGroups(selectedCampaignId, Array.from(targetGroupIds));
      await loadCampaignDetailData(selectedCampaignId);
      await loadCampaignsList();
    } catch (err) {
      console.error("Failed to save target groups:", err);
    } finally {
      setSavingTargetGroups(false);
    }
  };

  const toggleTagFilter = (tagName) => {
    setSelectedTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  };

  const clearAllTagFilters = () => {
    setSelectedTagFilters(new Set());
  };

  // Select all visible (filtered) groups into targetGroupIds (union across all pages)
  const handleSelectAllFiltered = async () => {
    try {
      const res = await getSocialGroupIdsMatchingFilter({
        search: groupSearchTerm,
        tagFilters: Array.from(selectedTagFilters),
      });
      if (res.success && res.ids) {
        setTargetGroupIds((prev) => {
          const next = new Set(prev);
          for (const id of res.ids) {
            next.add(id);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to select all filtered groups:", err);
    }
  };

  // Deselect all visible (filtered) groups from targetGroupIds (subtract across all pages)
  const handleDeselectAllFiltered = async () => {
    try {
      const res = await getSocialGroupIdsMatchingFilter({
        search: groupSearchTerm,
        tagFilters: Array.from(selectedTagFilters),
      });
      if (res.success && res.ids) {
        setTargetGroupIds((prev) => {
          const next = new Set(prev);
          for (const id of res.ids) {
            next.delete(id);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to deselect all filtered groups:", err);
    }
  };

  const handleGroupTagsUpdated = (groupId, newTags) => {
    setAllSocialGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, group_type: newTags } : g))
    );
    if (newTags && newTags.length > 0) {
      setAllTagOptions((prev) => {
        const merged = new Set([...prev, ...newTags]);
        return Array.from(merged).sort((a, b) => a.localeCompare(b));
      });
    }
  };

  const toggleTargetGroup = (groupId) => {
    setTargetGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleAccountStatusChange = async (accountId, newStatus) => {
    try {
      await updateFbAccount(accountId, { status: newStatus });
      setFbAccounts((prev) =>
        prev.map((acc) => (acc.id === accountId ? { ...acc, status: newStatus } : acc))
      );
    } catch (err) {
      console.error("Failed to update account status:", err);
    }
  };

  // Status Badge Mapper for Campaign
  const renderCampaignStatusBadge = (c) => {
    if (c.latest_run_status === "Running") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Loader2 size={11} className="animate-spin" />
          Running
        </span>
      );
    }
    switch (c.status) {
      case "Needs Review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertCircle size={11} />
            Needs Review
          </span>
        );
      case "Active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        );
      case "Archived":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            Archived
          </span>
        );
      case "Draft":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Draft
          </span>
        );
    }
  };

  // Filtered FB Accounts
  const filteredFbAccounts = useMemo(() => {
    const q = stripAccents(fbAccountSearch);
    return fbAccounts.filter(
      (a) =>
        stripAccents(a.name).includes(q) ||
        stripAccents(a.account_ref).includes(q) ||
        stripAccents(a.proxy_url).includes(q)
    );
  }, [fbAccounts, fbAccountSearch]);

  // ==========================================
  // 3. SOCIAL GROUPS LIBRARY HELPERS
  // ==========================================

  const toggleLibraryTagFilter = (tagName) => {
    setLibrarySelectedTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  };

  const clearAllLibraryTagFilters = () => {
    setLibrarySelectedTagFilters(new Set());
  };

  const handleTagDeleted = (tagName) => {
    setAllTagOptions((prev) => prev.filter((t) => t !== tagName));
    // Dọn luôn nếu tag vừa xoá đang được chọn làm filter (tránh filter "ma" trỏ tới tag không còn tồn tại)
    setLibrarySelectedTagFilters((prev) => {
      if (!prev.has(tagName)) return prev;
      const next = new Set(prev);
      next.delete(tagName);
      return next;
    });
    setSelectedTagFilters((prev) => {
      if (!prev.has(tagName)) return prev;
      const next = new Set(prev);
      next.delete(tagName);
      return next;
    });
    loadSocialGroupsLibrary();
  };

  const handleTagRenamed = (oldName, newName) => {
    setAllTagOptions((prev) => {
      const filtered = prev.filter((t) => t !== oldName);
      return [...filtered, newName].sort();
    });
    setLibrarySelectedTagFilters((prev) => {
      if (!prev.has(oldName)) return prev;
      const next = new Set(prev);
      next.delete(oldName);
      next.add(newName);
      return next;
    });
    setSelectedTagFilters((prev) => {
      if (!prev.has(oldName)) return prev;
      const next = new Set(prev);
      next.delete(oldName);
      next.add(newName);
      return next;
    });
    loadSocialGroupsLibrary();
  };

  const handleStartEditGroup = (g) => {
    setEditingGroupId(g.id);
    setEditName(g.name || "");
    setEditUrl(g.url || "");
    setEditMemberCount(g.member_count != null ? String(g.member_count) : "");
  };

  const handleCancelEditGroup = () => {
    setEditingGroupId(null);
    setEditName("");
    setEditUrl("");
    setEditMemberCount("");
  };

  const handleSaveEditGroup = async (id) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      let parsedMemberCount = undefined;
      if (editMemberCount.trim() === "") {
        parsedMemberCount = null;
      } else {
        const cleaned = parseInt(editMemberCount.replace(/\D/g, ""), 10);
        parsedMemberCount = isNaN(cleaned) ? null : cleaned;
      }

      const res = await updateSocialGroupDetails(id, {
        name: editName.trim(),
        url: editUrl.trim(),
        member_count: parsedMemberCount
      });
      if (res.success) {
        setSocialGroupsLibrary((prev) =>
          prev.map((g) =>
            g.id === id
              ? {
                  ...g,
                  name: editName.trim(),
                  url: editUrl.trim(),
                  member_count: parsedMemberCount,
                }
              : g
          )
        );
        setEditingGroupId(null);
      }
    } catch (err) {
      console.error("Failed to update group details:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleGroupActive = async (id, currentActive) => {
    const nextActive = !currentActive;
    try {
      await toggleSocialGroupActive(id, nextActive);
      setSocialGroupsLibrary((prev) =>
        prev.map((g) => (g.id === id ? { ...g, is_active: nextActive } : g))
      );
    } catch (err) {
      console.error("Failed to toggle group active:", err);
    }
  };

  const handleLibraryTagUpdated = (groupId, newTags) => {
    setSocialGroupsLibrary((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, group_type: newTags } : g))
    );
    if (newTags && newTags.length > 0) {
      setAllTagOptions((prev) => {
        const merged = new Set([...prev, ...newTags]);
        return Array.from(merged).sort((a, b) => a.localeCompare(b));
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header & Tab Controls */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Megaphone size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Campaigns & Auto-Post Hub</span>
              </h1>
            </div>
          </div>

          {/* Sub-tab Pill Navigation */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === "campaigns"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Campaigns
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("fb_accounts")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === "fb_accounts"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              FB Accounts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("social_groups")}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "social_groups"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe size={13} />
              <span>Social Group URLs</span>
            </button>
          </div>
        </div>

        {/* Global Action Button */}
        <div>
          {activeTab === "campaigns" ? (
            <button
              type="button"
              onClick={() => {
                setEditingCampaignId(null);
                setCampaignModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 active:scale-98 transition-all"
            >
              <Plus size={14} />
              <span>New Campaign</span>
            </button>
          ) : activeTab === "fb_accounts" ? (
            <button
              type="button"
              onClick={() => {
                setEditingFbAccountId(null);
                setFbAccountModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 active:scale-98 transition-all"
            >
              <Plus size={14} />
              <span>Add FB Account</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkImportModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Bulk import social group URLs from Excel or CSV file"
              >
                <Upload size={14} />
                <span>Import from File</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateGroupModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 active:scale-98 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>New Group URL</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-hidden flex flex-col p-5">
        {/* ========================================================================= */}
        {/* TAB 1: CAMPAIGNS WORKBENCH */}
        {/* ========================================================================= */}
        {activeTab === "campaigns" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Campaign Warning Toast */}
            {campaignToast && (
              <div className="flex items-center justify-between p-3 rounded-lg border text-xs bg-amber-500/10 border-amber-500/30 text-amber-300 shrink-0 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span>{campaignToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignToast(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    placeholder="Search campaigns by name or channel..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={campaignStatusFilter}
                  onChange={(e) => setCampaignStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="HIDE_ARCHIVED">Active (Hide Archived)</option>
                  <option value="ALL">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                  <option value="Needs Review">Needs Review</option>
                </select>

                <select
                  value={campaignTypeFilter}
                  onChange={(e) => setCampaignTypeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="Job Posting">Job Posting</option>
                  <option value="Warming">Warming</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => loadCampaignsList()}
                disabled={loadingCampaigns}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                title="Refresh Campaigns"
              >
                <RefreshCw size={14} className={loadingCampaigns ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Master Campaigns Table — chiếm toàn bộ chiều cao khả dụng khi chưa chọn campaign nào (tránh
                khoảng trống lớn phía dưới); tự thu gọn về max-h-64 khi đã chọn 1 campaign để nhường chỗ cho
                Detail Expandable Panel bên dưới. */}
            <div
              className={`border border-slate-800 rounded-xl overflow-x-hidden bg-slate-900/40 shadow-sm flex flex-col overflow-y-auto ${
                selectedCampaignId ? (isDetailPanelExpanded ? "shrink-0 max-h-36" : "shrink-0 max-h-64") : "flex-1 min-h-0"
              }`}
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-4">Campaign Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Linked Job</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Target Groups</th>
                    <th className="py-2.5 px-3">Last Run</th>
                    <th className="py-2.5 px-3 text-center">Total Sent</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingCampaigns ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-emerald-400" />
                          <span>Loading campaigns...</span>
                        </div>
                      </td>
                    </tr>
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        No campaigns found. Click &ldquo;+ New Campaign&rdquo; to get started.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => {
                      const isSelected = selectedCampaignId === c.id;
                      const isRunning = c.latest_run_status === "Running";

                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleSelectCampaign(c)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-slate-800/60 border-l-2 border-l-emerald-500"
                              : "hover:bg-slate-800/30"
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-slate-100">
                            <div className="flex items-center gap-2">
                              <span>{c.campaign_name || c.name}</span>
                              {c.auto_run_enabled && (
                                <span 
                                  title={`Auto-Scheduler Active (${c.start_time || '08:00'} - ${c.end_time || '20:00'})`} 
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                >
                                  <Zap size={10} className="fill-emerald-400" />
                                  <span>Auto</span>
                                </span>
                              )}
                              {c.auto_spin_content && (
                                <span title="AI Spin Content Enabled" className="text-emerald-400">
                                  <Sparkles size={12} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {c.campaign_type === "Warming" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Flame size={11} />
                                <span>Warming</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Rocket size={11} />
                                <span>Job Posting</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                            {c.channel || "Facebook Group"}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {c.job_ids && c.job_ids.length > 0 ? (
                              <div className={`flex flex-wrap gap-1 max-w-xs ${expandedJobsRowIds.has(c.id) ? "max-h-32 overflow-y-auto" : ""}`}>
                                {(expandedJobsRowIds.has(c.id) ? c.job_ids : c.job_ids.slice(0, LINKED_JOB_BADGES_VISIBLE_LIMIT)).map((jid, idx) => {
                                  const title = (c.job_titles && c.job_titles[idx]) || "Linked Job";
                                  return (
                                    <Link
                                      key={jid}
                                      href={`/jobs?job_id=${jid}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 text-[11px] transition-colors"
                                    >
                                      <span className="truncate max-w-[130px]">{title}</span>
                                      <ExternalLink size={9} className="shrink-0" />
                                    </Link>
                                  );
                                })}
                                {c.job_ids.length > LINKED_JOB_BADGES_VISIBLE_LIMIT && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleJobsRowExpanded(c.id);
                                    }}
                                    className="text-[10px] font-semibold text-slate-400 hover:text-emerald-400 underline decoration-dotted decoration-slate-600 cursor-pointer"
                                  >
                                    {expandedJobsRowIds.has(c.id) ? "See less" : `+${c.job_ids.length - LINKED_JOB_BADGES_VISIBLE_LIMIT} more`}
                                  </button>
                                )}
                              </div>
                            ) : c.job_id ? (
                              <Link
                                href={`/jobs?job_id=${c.job_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                              >
                                <span>{c.job_title || "Linked Job"}</span>
                                <ExternalLink size={9} />
                              </Link>
                            ) : (
                              <span className="text-slate-600 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {renderCampaignStatusBadge(c)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-[11px]">
                              {c.target_groups_count ?? c.target_group_count ?? c.target_groups?.length ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                            {formatRelativeTime(c.latest_run_started_at || c.last_run_at)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                            {c.total_sent || 0}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Run Campaign Button: Dispatch Preview for Job Posting, Warm Modal for Warming */}
                              {c.campaign_type === "Warming" ? (
                                <button
                                  type="button"
                                  disabled={isRunning || isWarmingRunning}
                                  onClick={() => {
                                    setWarmFeedback(null);
                                    setWarmCampaignTarget(c);
                                    setConfirmWarmModalOpen(true);
                                    loadFbAccountsList();
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                                    isWarmingRunning
                                      ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                                      : "bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30 active:scale-95 cursor-pointer"
                                  }`}
                                  title={isWarmingRunning ? "Warming session in progress" : "Launch Warm & Join Session"}
                                >
                                  <Flame size={10} />
                                  <span>Run</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isRunning}
                                  onClick={() => {
                                    setPreviewCampaign(c);
                                    setPreviewModalOpen(true);
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                                    isRunning
                                      ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                                      : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 active:scale-95 cursor-pointer"
                                  }`}
                                  title={isRunning ? "Campaign is currently running" : "Launch Dispatch Preview"}
                                >
                                  <Play size={10} />
                                  <span>Run</span>
                                </button>
                              )}

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCampaignId(c.id);
                                  setCampaignModalOpen(true);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                                title="Edit Campaign"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Detail Expandable Panel */}
            {selectedCampaignId && (
              <div className={`flex flex-col border border-slate-800 rounded-xl bg-slate-900/70 overflow-hidden shadow-lg transition-all duration-300 ease-in-out ${
                isDetailPanelExpanded
                  ? "h-[clamp(380px,54vh,760px)] shrink-0"
                  : "flex-1 min-h-[360px]"
              }`}>
                {/* Detail Header & Sub-Tabs */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-2">
                      <span className="text-emerald-400">Campaign Details:</span>
                      <span>{campaignDetail?.name || "Loading..."}</span>
                    </span>

                    <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDetailSubTab("overview")}
                        className={`px-2.5 py-1 rounded transition-all ${
                          detailSubTab === "overview"
                            ? "bg-slate-800 text-emerald-400 font-bold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Overview & Groups
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailSubTab("run_history")}
                        className={`px-2.5 py-1 rounded transition-all ${
                          detailSubTab === "run_history"
                            ? "bg-slate-800 text-emerald-400 font-bold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Run History ({campaignDetail?.runs?.length || 0})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDetailPanelExpanded((prev) => !prev)}
                      title={isDetailPanelExpanded ? "Collapse Details" : "Expand Details"}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                        isDetailPanelExpanded
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-600"
                          : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      {isDetailPanelExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      <span>{isDetailPanelExpanded ? "Collapse" : "Expand"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCampaignId(null);
                        setCampaignDetail(null);
                        setIsDetailPanelExpanded(false);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="flex-1 overflow-y-auto p-5 text-xs">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                      <Loader2 size={16} className="animate-spin text-emerald-400" />
                      <span>Loading campaign details & target groups...</span>
                    </div>
                  ) : detailSubTab === "overview" ? (
                    <div className="space-y-5">
                      {/* Overview Metadata Grid: Conditional on campaign_type */}
                      {campaignDetail?.campaign_type === "Warming" ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2">
                            <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider flex items-center justify-between">
                              <span>Assigned Target FB Accounts Pool</span>
                              <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                                <Flame size={11} />
                                Warm &amp; Join Pool
                              </span>
                            </div>
                            <div className="p-3 bg-slate-900 rounded border border-slate-800 text-slate-300 text-xs min-h-[60px] max-h-32 overflow-y-auto">
                              {campaignDetail?.fbAccounts && campaignDetail.fbAccounts.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {campaignDetail.fbAccounts.map((acc) => (
                                    <span key={acc.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 text-xs">
                                      <span className="font-mono text-[10px] text-slate-400">{acc.account_ref || 'ACC'}</span>
                                      <span className="font-medium">{acc.account_name || acc.name}</span>
                                      <span className="text-[10px] text-emerald-400 font-mono">({acc.status})</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-slate-400 italic">
                                  Default: All Active accounts in system pool (will sequentially execute warm-up &amp; join across active accounts).
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Target groups selected below will be sequentially allocated across these accounts when launched.
                            </div>
                          </div>

                          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3">
                            <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
                              Campaign Info
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Type:</span>
                                <span className="text-amber-400 font-semibold flex items-center gap-1">
                                  <Flame size={11} /> Warming
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Target Criteria:</span>
                                <span className="text-slate-200 font-medium">{campaignDetail?.target_criteria || "All"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Dates:</span>
                                <span className="text-slate-200 font-mono">
                                  {formatCampaignDate(campaignDetail?.start_date)} — {formatCampaignDate(campaignDetail?.end_date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2">
                            <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider flex items-center justify-between">
                              <span>Post Content Body</span>
                              {campaignDetail?.auto_spin_content && (
                                <span className="text-emerald-400 text-[10px] font-normal flex items-center gap-1 lowercase">
                                  <Sparkles size={11} />
                                  auto-spin enabled
                                </span>
                              )}
                            </div>
                            <div className="p-3 bg-slate-900 rounded border border-slate-800 text-slate-300 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {campaignDetail?.content || "No post body defined."}
                            </div>
                            {campaignDetail?.post_image_url && (
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                Image: <a href={campaignDetail.post_image_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{campaignDetail.post_image_url}</a>
                              </div>
                            )}
                          </div>

                          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3">
                            <div className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
                              Configuration
                            </div>
                            <div className="space-y-1.5 text-xs">
                              {campaignDetail?.linkedJobs && campaignDetail.linkedJobs.length > 0 && (
                                <div>
                                  <span className="text-slate-400 block mb-1">Linked Jobs ({campaignDetail.linkedJobs.length}):</span>
                                  <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto pr-1">
                                    {campaignDetail.linkedJobs.map((j) => (
                                      <Link
                                        key={j.id}
                                        href={`/jobs?job_id=${j.id}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] hover:underline"
                                      >
                                        <span className="truncate max-w-[140px]">{j.job_title}</span>
                                        <ExternalLink size={9} />
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-400">Target Criteria:</span>
                                <span className="text-slate-200 font-medium">{campaignDetail?.target_criteria || "All"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <span>Target Pool (toàn bộ nhóm mục tiêu):</span>
                                  <span className="text-slate-500 cursor-help" title="Toàn bộ nhóm mục tiêu đã gán cho chiến dịch. Mỗi lượt chạy sẽ đăng tối đa số nhóm theo Max Posts Per Run.">
                                    <Info size={11} />
                                  </span>
                                </span>
                                <span className="text-slate-200 font-mono font-bold text-emerald-400">
                                  {campaignDetail?.totalGroupsInPool ?? campaignDetail?.targetGroups?.length ?? campaignDetail?.target_groups_count ?? 0} groups
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Auto-Scheduler:</span>
                                <span className="text-slate-200 font-medium flex items-center gap-1">
                                  {campaignDetail?.auto_run_enabled ? (
                                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                      <Zap size={11} className="fill-emerald-400" /> Active ({campaignDetail?.start_time || '08:00'} - {campaignDetail?.end_time || '20:00'})
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">Disabled</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Dates:</span>
                                <span className="text-slate-200 font-mono">
                                  {formatCampaignDate(campaignDetail?.start_date)} — {formatCampaignDate(campaignDetail?.end_date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Target Groups Selector Table */}
                      <div className="space-y-3">
                        {/* Filter Bar & Actions */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                            <input
                              type="text"
                              value={groupSearchTerm}
                              onChange={(e) => setGroupSearchTerm(e.target.value)}
                              placeholder="Search group name or URL..."
                              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs w-full sm:w-52 shrink-0 focus:outline-none focus:border-emerald-500"
                            />

                            {/* Toggle: Only Selected */}
                            <button
                              type="button"
                              onClick={() => setShowOnlySelectedGroups((v) => !v)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors shrink-0 cursor-pointer ${
                                showOnlySelectedGroups
                                  ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                              }`}
                              title="Show only groups already assigned to this campaign"
                            >
                              <ListChecks size={12} />
                              <span>Only Selected ({targetGroupIds.size})</span>
                            </button>

                            {/* Tag Filter Bar */}
                            <div className="overflow-x-auto">
                              <GroupTypeTagEditor
                                mode="filter"
                                allKnownTags={allTagOptions}
                                selectedTags={selectedTagFilters}
                                onToggleTag={toggleTagFilter}
                                onClearAll={clearAllTagFilters}
                              />
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 justify-end">
                            <button
                              type="button"
                              onClick={handleSelectAllFiltered}
                              disabled={showOnlySelectedGroups}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                              title={
                                showOnlySelectedGroups
                                  ? "All visible groups are already selected in this view"
                                  : "Select all groups matching current search and tag filters across all pages"
                              }
                            >
                              Select All ({groupTotalCount})
                            </button>

                            <button
                              type="button"
                              onClick={handleDeselectAllFiltered}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] border border-slate-800 transition-colors cursor-pointer"
                              title="Deselect all groups matching current search and tag filters across all pages"
                            >
                              Deselect All
                            </button>

                            <button
                              type="button"
                              onClick={handleSaveTargetGroups}
                              disabled={savingTargetGroups}
                              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ml-1 cursor-pointer"
                            >
                              {savingTargetGroups ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <Check size={12} />
                                  <span>Save ({targetGroupIds.size})</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Table */}
                        {(() => {
                          const visibleGroups = showOnlySelectedGroups
                            ? allSocialGroups.filter((g) => targetGroupIds.has(g.id))
                            : allSocialGroups;

                          return (
                            <>
                              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80 max-h-64 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider z-10">
                                    <tr>
                                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                                      <th className="py-2.5 px-3">Group Name</th>
                                      <th className="py-2.5 px-3">Group Type Tags</th>
                                      <th className="py-2.5 px-3">Join Status</th>
                                      <th className="py-2.5 px-3 text-right">URL</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40">
                                    {loadingGroups ? (
                                      <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-500">
                                          <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={14} className="animate-spin text-emerald-400" />
                                            <span>Loading target groups...</span>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : visibleGroups.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-500">
                                          No social groups matched the current search and tag filters.
                                        </td>
                                      </tr>
                                    ) : (
                                      visibleGroups.map((g) => {
                                        const isChecked = targetGroupIds.has(g.id);
                                        return (
                                          <tr
                                            key={g.id}
                                            onClick={() => toggleTargetGroup(g.id)}
                                            className={`cursor-pointer transition-colors ${
                                              isChecked ? "bg-slate-900/70" : "opacity-55 hover:opacity-85"
                                            }`}
                                          >
                                            <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleTargetGroup(g.id)}
                                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                              />
                                            </td>
                                            <td className="py-2 px-3 font-medium text-slate-200">
                                              {g.name || g.url}
                                            </td>
                                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                              <GroupTypeTagEditor
                                                mode="badge"
                                                tags={g.group_type}
                                                socialGroupId={g.id}
                                                allKnownTags={allTagOptions}
                                                onTagsUpdated={handleGroupTagsUpdated}
                                              />
                                            </td>
                                            <td className="py-2 px-3">
                                              <JoinStatusBadge
                                                status={g.join_status}
                                                groupId={g.id}
                                                customAnswer={g.custom_join_answer}
                                                adminQuestions={g.admin_questions}
                                                onAnswerUpdated={() => fetchTargetGroups(groupPage, groupSearchTerm, selectedTagFilters, showOnlySelectedGroups)}
                                              />
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              {g.url && (
                                                <a
                                                  href={g.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-emerald-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                                                >
                                                  <span>Open</span>
                                                  <ExternalLink size={9} />
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

                              {/* Target Groups Pagination */}
                              {groupTotalCount > 0 && (
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
                                  <div className="text-slate-400 text-[11px]">
                                    Showing <span className="text-slate-200 font-semibold">{visibleGroups.length}</span> of <span className="text-emerald-400 font-semibold">{groupTotalCount.toLocaleString()}</span> groups
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => handleGroupPageChange(1)}
                                      disabled={groupPage <= 1 || loadingGroups}
                                      className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                                      title="First Page"
                                    >
                                      <ChevronsLeft size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleGroupPageChange(groupPage - 1)}
                                      disabled={groupPage <= 1 || loadingGroups}
                                      className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                                      title="Previous Page"
                                    >
                                      <ChevronLeft size={12} />
                                    </button>

                                    <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-300 text-[10px] font-bold">
                                      Page <span className="text-emerald-400">{groupPage}</span> of {Math.max(1, Math.ceil(groupTotalCount / groupPageSize))}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleGroupPageChange(groupPage + 1)}
                                      disabled={groupPage >= Math.max(1, Math.ceil(groupTotalCount / groupPageSize)) || loadingGroups}
                                      className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                                      title="Next Page"
                                    >
                                      <ChevronRight size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleGroupPageChange(Math.max(1, Math.ceil(groupTotalCount / groupPageSize)))}
                                      disabled={groupPage >= Math.max(1, Math.ceil(groupTotalCount / groupPageSize)) || loadingGroups}
                                      className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                                      title="Last Page"
                                    >
                                      <ChevronsRight size={12} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    /* Run History Sub-tab: warm_join for Warming, campaign for Job Posting */
                    <RunHistoryTable
                      runs={campaignDetail?.runs || []}
                      type={campaignDetail?.campaign_type === "Warming" ? "warm_join" : "campaign"}
                      fetchRunDetail={campaignDetail?.campaign_type === "Warming" ? getWarmJoinRunDetail : getCampaignRunDetail}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FB ACCOUNTS MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "fb_accounts" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Toolbar: Search + Add FB Account */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="relative w-72">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={fbAccountSearch}
                  onChange={(e) => setFbAccountSearch(e.target.value)}
                  placeholder="Search accounts by name, ref, or proxy..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2.5">
                {/* + Add FB Account Button */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingFbAccountId(null);
                    setFbAccountModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm hover:shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add FB Account</span>
                </button>
              </div>
            </div>

            {/* Warm Feedback Notification Banner */}
            {warmFeedback && (
              <div
                className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                  warmFeedback.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {warmFeedback.type === "success" ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-400" />
                  )}
                  <span>{warmFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWarmFeedback(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Accounts Management Table */}
            <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-sm flex flex-col min-h-0">
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider z-10">
                      <tr>
                        <th className="py-2.5 px-4">Account Name</th>
                        <th className="py-2.5 px-3">Ref Code</th>
                        <th className="py-2.5 px-3">Profile Link</th>
                        <th className="py-2.5 px-3">4G Proxy</th>
                        <th className="py-2.5 px-3">Warming Health</th>
                        <th className="py-2.5 px-3">Last Warmed</th>
                        <th className="py-2.5 px-3 text-center">Daily Quota</th>
                        <th className="py-2.5 px-3 text-center">Today Posts</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {loadingFbAccounts ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-500">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 size={16} className="animate-spin text-emerald-400" />
                              <span>Loading Facebook accounts...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredFbAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-10 text-center text-slate-500">
                            No Facebook accounts found. Click &ldquo;+ Add FB Account&rdquo; to configure your sender pool.
                          </td>
                        </tr>
                      ) : (
                        filteredFbAccounts.map((acc) => (
                          <tr key={acc.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-100">
                              <div className="flex items-center gap-2">
                                <span>{acc.account_name || acc.name}</span>
                                {acc.allow_post_without_join && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                    title="Allowed to post to groups without joining"
                                  >
                                    Direct Post
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80">
                                {acc.account_ref || "—"}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {acc.fb_profile_url ? (
                                <a
                                  href={acc.fb_profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px] font-mono"
                                >
                                  <span>View Profile</span>
                                  <ExternalLink size={9} />
                                </a>
                              ) : (
                                <span className="text-slate-600 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400 text-[11px] max-w-xs truncate" title={acc.proxy_url}>
                              {acc.proxy_url || "Direct Host IP"}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {(() => {
                                const health = getWarmingHealth(acc);
                                const HealthIcon = health.icon;
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${health.color}`}
                                    title={health.description}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${health.dotColor}`} />
                                    <HealthIcon size={11} />
                                    <span>{health.label}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                              {(() => {
                                const { text, dotClass } = getLastWarmedDisplay(acc.last_warmed_at);
                                return (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                                    <span title={acc.last_warmed_at ? new Date(acc.last_warmed_at).toLocaleString('vi-VN') : 'Never warmed'}>
                                      {text}
                                    </span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-200">
                              {acc.daily_quota || 5}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-sky-400">
                              {acc.today_posts_count || acc.posts_today || 0}
                            </td>
                            <td className="py-3 px-3">
                              {/* Direct Status Selector */}
                              <select
                                value={acc.status || "Active"}
                                onChange={(e) => handleAccountStatusChange(acc.id, e.target.value)}
                                className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                              >
                                <option value="Active">Active</option>
                                <option value="Cooldown">Cooldown</option>
                                <option value="Restricted">Restricted</option>
                                <option value="Checkpoint">Checkpoint</option>
                                <option value="Inactive">Inactive</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFbAccountId(acc.id);
                                  setFbAccountModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <Edit3 size={11} />
                                <span>Edit</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-TAB 3: SOCIAL GROUP URLS LIBRARY */}
        {/* ========================================================================= */}
        {activeTab === "social_groups" && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
            {/* Library Feedback Toast */}
            {libraryToast && (
              <div
                className={`flex items-center justify-between p-3 rounded-lg border text-xs mb-3 shrink-0 ${
                  libraryToast.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {libraryToast.type === "success" ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-400" />
                  )}
                  <span>{libraryToast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLibraryToast(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Bulk Selection Action Banner */}
            {selectedLibraryGroupIds.size > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs mb-3 shrink-0 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>{selectedLibraryGroupIds.size} group(s) selected</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredLibrary}
                    disabled={isSelectingAllFiltered}
                    className="text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    {isSelectingAllFiltered ? "Selecting..." : `Select all ${libraryTotalCount.toLocaleString()} matching filter`}
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLibraryGroupIds(new Set())}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setAssignModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 active:scale-98 transition-all cursor-pointer shrink-0"
                >
                  <Layers size={13} />
                  <span>Add to Campaign...</span>
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 mb-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 flex-wrap">
                {/* Search */}
                <div className="relative w-full sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Search name or URL..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Member Count Range Filter */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
                  <Users size={13} className="text-slate-500 shrink-0" />
                  <span className="text-[11px] text-slate-500">Members:</span>
                  <input
                    type="number"
                    min="0"
                    value={libraryMinMembers}
                    onChange={(e) => setLibraryMinMembers(e.target.value)}
                    placeholder="Min"
                    className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono text-right"
                  />
                  <span className="text-slate-600">–</span>
                  <input
                    type="number"
                    min="0"
                    value={libraryMaxMembers}
                    onChange={(e) => setLibraryMaxMembers(e.target.value)}
                    placeholder="Max"
                    className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono text-right"
                  />
                  {(libraryMinMembers || libraryMaxMembers) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLibraryMinMembers("");
                        setLibraryMaxMembers("");
                      }}
                      className="text-slate-500 hover:text-slate-300 p-0.5 ml-0.5 cursor-pointer"
                      title="Clear member count filter"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Tag Filter Bar */}
                <GroupTypeTagEditor
                  mode="filter"
                  allKnownTags={allTagOptions}
                  selectedTags={librarySelectedTagFilters}
                  onToggleTag={toggleLibraryTagFilter}
                  onClearAll={clearAllLibraryTagFilters}
                  allowDelete={true}
                  onTagDeleted={handleTagDeleted}
                  onTagRenamed={handleTagRenamed}
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Show Inactive toggle */}
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Show Inactive ({libraryInactiveTotalCount})</span>
                </label>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={loadSocialGroupsLibrary}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  title="Refresh Library"
                >
                  <RefreshCw size={14} className={loadingLibrary ? "animate-spin text-emerald-400" : ""} />
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 flex flex-col min-h-0">
              <div className="overflow-x-auto flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider z-10">
                    <tr>
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            socialGroupsLibrary.length > 0 &&
                            socialGroupsLibrary.every((g) => selectedLibraryGroupIds.has(g.id))
                          }
                          onChange={toggleSelectAllCurrentPageGroups}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                          title="Select all on this page"
                        />
                      </th>
                      <th className="py-3 px-4">Group Name</th>
                      <th className="py-3 px-3 text-right">Members</th>
                      <th className="py-3 px-3">Group Type Tags</th>
                      <th className="py-3 px-3 text-center">Campaigns</th>
                      <th className="py-3 px-3">Accounts Joined</th>
                      <th className="py-3 px-3">Last Posted</th>
                      <th className="py-3 px-3">Group URL</th>
                      <th className="py-3 px-4 text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingLibrary ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-slate-500">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin text-emerald-400" />
                            <span>Loading social groups library...</span>
                          </div>
                        </td>
                      </tr>
                    ) : socialGroupsLibrary.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500">
                          No social groups found. Click &ldquo;+ New Group URL&rdquo; to add a new group.
                        </td>
                      </tr>
                    ) : (
                      socialGroupsLibrary.map((g, idx) => {
                        const isEditing = editingGroupId === g.id;
                        const isInactive = !g.is_active;
                        const itemIndex = (libraryPage - 1) * libraryPageSize + idx + 1;

                        return (
                          <tr
                            key={g.id}
                            className={`transition-colors hover:bg-slate-800/30 ${
                              isInactive ? "opacity-50 bg-slate-950/40" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedLibraryGroupIds.has(g.id)}
                                onChange={() => toggleSelectLibraryGroup(g.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Name column (inline edit) */}
                            <td className="py-3 px-4">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs w-48 focus:outline-none focus:border-emerald-500"
                                    placeholder="Group name"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditGroup(g.id)}
                                    disabled={savingEdit || !editName.trim()}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                                    title="Save"
                                  >
                                    {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditGroup}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group/name">
                                  <span className="font-semibold text-slate-100">{g.name || "Untitled Group"}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditGroup(g)}
                                    className="opacity-0 group-hover/name:opacity-100 text-slate-500 hover:text-slate-300 p-0.5 transition-opacity cursor-pointer"
                                    title="Edit group name and URL"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Members column (inline edit) */}
                            <td className="py-3 px-3 text-right">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editMemberCount}
                                  onChange={(e) => setEditMemberCount(e.target.value)}
                                  className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs w-24 text-right focus:outline-none focus:border-emerald-500 font-mono"
                                  placeholder="e.g. 15,000"
                                />
                              ) : (
                                <span className="font-mono text-slate-300 font-medium">
                                  {g.member_count != null ? (
                                    g.member_count.toLocaleString()
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </span>
                              )}
                            </td>

                            {/* Group Type Tags */}
                            <td className="py-3 px-3">
                              <GroupTypeTagEditor
                                mode="badge"
                                tags={g.group_type}
                                socialGroupId={g.id}
                                allKnownTags={allTagOptions}
                                onTagsUpdated={handleLibraryTagUpdated}
                              />
                            </td>

                            {/* Campaigns tooltip */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700 cursor-help"
                                title={
                                  g.campaign_names && g.campaign_names.length > 0
                                    ? `Assigned to ${g.campaign_count} campaign(s):\n• ${g.campaign_names.join("\n• ")}`
                                    : "Not assigned to any campaigns yet"
                                }
                              >
                                {g.campaign_count || 0}
                              </span>
                            </td>

                            {/* Accounts Joined Ratio & Status */}
                            <td className="py-3 px-3">
                              <JoinStatusBadge
                                status={g.join_status}
                                groupId={g.id}
                                customAnswer={g.custom_join_answer}
                                adminQuestions={g.admin_questions}
                                joinedCount={g.joined_account_count ?? 0}
                                totalActiveAccounts={g.total_active_accounts ?? fbAccounts.filter(a => a.status === 'Active').length}
                                joinedAccountsList={g.joined_accounts_list || []}
                                onAnswerUpdated={loadSocialGroupsLibrary}
                                autoOpenAnswer={g.id === focusGroupId}
                              />
                            </td>

                            {/* Last Posted */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                              {formatRelativeTime(g.last_posted_at)}
                            </td>

                            {/* Group URL */}
                            <td className="py-3 px-3">
                              {isEditing ? (
                                <input
                                  type="url"
                                  value={editUrl}
                                  onChange={(e) => setEditUrl(e.target.value)}
                                  className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs w-56 focus:outline-none focus:border-emerald-500 font-mono"
                                  placeholder="https://facebook.com/groups/..."
                                />
                              ) : g.url ? (
                                <a
                                  href={g.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400/90 hover:text-emerald-300 hover:underline inline-flex items-center gap-1 font-mono text-[11px] max-w-xs truncate"
                                  title={g.url}
                                >
                                  <span className="truncate">{g.url}</span>
                                  <ExternalLink size={10} className="shrink-0" />
                                </a>
                              ) : (
                                <span className="text-slate-600 text-[11px] italic">No URL</span>
                              )}
                            </td>

                            {/* Active toggle */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleGroupActive(g.id, g.is_active)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                                  g.is_active
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                                }`}
                                title={`Click to ${g.is_active ? 'deactivate' : 'activate'}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${g.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                <span>{g.is_active ? "Active" : "Inactive"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Library Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900/60 border-t border-slate-800 text-xs shrink-0">
                <div className="text-slate-400 text-[11px]">
                  Showing <span className="text-slate-200 font-semibold">{socialGroupsLibrary.length}</span> of <span className="text-emerald-400 font-semibold">{libraryTotalCount.toLocaleString()}</span> groups
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleLibraryPageChange(1)}
                    disabled={libraryPage <= 1 || loadingLibrary}
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                    title="First Page"
                  >
                    <ChevronsLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLibraryPageChange(libraryPage - 1)}
                    disabled={libraryPage <= 1 || loadingLibrary}
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                    title="Previous Page"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <span className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 text-xs font-bold">
                    Page <span className="text-emerald-400">{libraryPage}</span> of {Math.max(1, Math.ceil(libraryTotalCount / libraryPageSize))}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleLibraryPageChange(libraryPage + 1)}
                    disabled={libraryPage >= Math.max(1, Math.ceil(libraryTotalCount / libraryPageSize)) || loadingLibrary}
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                    title="Next Page"
                  >
                    <ChevronRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLibraryPageChange(Math.max(1, Math.ceil(libraryTotalCount / libraryPageSize)))}
                    disabled={libraryPage >= Math.max(1, Math.ceil(libraryTotalCount / libraryPageSize)) || loadingLibrary}
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-300 cursor-pointer border border-slate-800"
                    title="Last Page"
                  >
                    <ChevronsRight size={13} />
                  </button>

                  <span className="text-slate-500 text-[11px] ml-1">
                    ({libraryTotalCount.toLocaleString()} total)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Preview & Smart Dispatch Modal */}
      {previewModalOpen && previewCampaign && (
        <CampaignDispatchPreviewModal
          campaignId={previewCampaign.id}
          campaignName={previewCampaign.name}
          isOpen={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewCampaign(null);
          }}
          onSuccess={() => {
            loadCampaignsList();
            if (selectedCampaignId === previewCampaign.id) {
              loadCampaignDetailData(previewCampaign.id);
            }
          }}
        />
      )}

      {/* 2. Campaign Create/Edit Modal */}
      {campaignModalOpen && (
        <CampaignEditModal
          campaignId={editingCampaignId}
          isOpen={campaignModalOpen}
          onClose={() => {
            setCampaignModalOpen(false);
            setEditingCampaignId(null);
          }}
          onSuccess={(info) => {
            if (info?.warning || typeof info === "string") {
              setCampaignToast(info?.warning || info);
            }
            loadCampaignsList();
            if (editingCampaignId && selectedCampaignId === editingCampaignId) {
              loadCampaignDetailData(editingCampaignId);
            }
          }}
        />
      )}

      {/* 3. FB Account Create/Edit Modal */}
      {fbAccountModalOpen && (
        <FbAccountEditModal
          accountId={editingFbAccountId}
          isOpen={fbAccountModalOpen}
          onClose={() => {
            setFbAccountModalOpen(false);
            setEditingFbAccountId(null);
          }}
          onSuccess={() => {
            loadFbAccountsList();
          }}
        />
      )}

      {/* 4. Social Group URL Create Modal */}
      {createGroupModalOpen && (
        <SocialGroupCreateModal
          isOpen={createGroupModalOpen}
          onClose={() => setCreateGroupModalOpen(false)}
          onSuccess={() => {
            loadSocialGroupsLibrary();
          }}
        />
      )}

      {/* 5. Bulk Import Modal */}
      {bulkImportModalOpen && (
        <SocialGroupBulkImportModal
          isOpen={bulkImportModalOpen}
          onClose={() => setBulkImportModalOpen(false)}
          onSuccess={() => {
            loadSocialGroupsLibrary();
            loadAllTagOptions();
          }}
        />
      )}

      {/* 5.1 Assign Groups to Campaigns Modal */}
      {assignModalOpen && (
        <AssignGroupsToCampaignsModal
          isOpen={assignModalOpen}
          selectedGroupIds={Array.from(selectedLibraryGroupIds)}
          onClose={() => setAssignModalOpen(false)}
          onSuccess={(res) => {
            setLibraryToast({
              type: "success",
              message: `Successfully assigned ${res.groupCount} group(s) to ${res.campaignCount} campaign(s) (${res.insertedCount} new links created, ${res.alreadyLinkedCount} already linked).`
            });
            setSelectedLibraryGroupIds(new Set());
            loadSocialGroupsLibrary();
            loadCampaignsList();
          }}
        />
      )}

      {/* 6. Warm & Join Confirmation Modal */}
      {confirmWarmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Flame size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Run Warm &amp; Join Session
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Campaign: <span className="text-amber-400 font-semibold">{warmCampaignTarget?.name || campaignDetail?.name || "Selected Warming Campaign"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmWarmModalOpen(false)}
                disabled={triggeringWarm}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* In-Modal Error Toast / Alert Banner */}
              {warmFeedback && warmFeedback.type === "error" && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in duration-150">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-rose-200">Unable to Start Warm &amp; Join Session</p>
                    <p className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed break-words">{warmFeedback.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWarmFeedback(null)}
                    className="text-rose-400 hover:text-rose-200 p-0.5 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Eligible Active Accounts:</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">
                    {fbAccounts.filter(a => a.status === 'Active').length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Execution Mode:</span>
                  <span className="text-slate-300 font-medium">Strict Sequential (1 by 1)</span>
                </div>

                {/* Max Groups Per Account Selector (Phase 5) */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold text-[11px]">Max Groups Per Account:</span>
                    <span className="text-amber-400 font-mono font-bold text-[11px]">
                      {maxGroupsPerAccount === "custom" 
                        ? (customMaxGroups ? `${customMaxGroups} group(s)` : "Custom") 
                        : `${maxGroupsPerAccount} group(s)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxGroupsPerAccount(num)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono border transition-all cursor-pointer ${
                          maxGroupsPerAccount === num
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs shadow-amber-500/10"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMaxGroupsPerAccount("custom")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        maxGroupsPerAccount === "custom"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs shadow-amber-500/10"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                      }`}
                    >
                      Custom
                    </button>
                    {maxGroupsPerAccount === "custom" && (
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={customMaxGroups}
                        onChange={(e) => setCustomMaxGroups(e.target.value)}
                        placeholder="Qty"
                        className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/50 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Dynamic Risk Indicator Badge */}
                  {(() => {
                    const effectiveVal = maxGroupsPerAccount === "custom"
                      ? parseInt(customMaxGroups, 10) || 0
                      : maxGroupsPerAccount;

                    if (effectiveVal <= 2) {
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
                          <ShieldCheck size={13} className="shrink-0" />
                          <span><strong>Safe Pace (1–2):</strong> Recommended daily routine to preserve high account trust score.</span>
                        </div>
                      );
                    } else if (effectiveVal === 3) {
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px]">
                          <Info size={13} className="shrink-0" />
                          <span><strong>Moderate Pace (3):</strong> Suitable for seasoned accounts with established history.</span>
                        </div>
                      );
                    } else if (effectiveVal <= 5) {
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                          <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                          <span><strong>Aggressive Pace (4–5):</strong> May encounter temporary Facebook rate limits if accounts are newly warmed.</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px]">
                          <AlertCircle size={13} className="shrink-0 text-rose-400" />
                          <span><strong>High Risk Pace (&gt;5):</strong> Elevated risk of Facebook action block or checkpoint verification.</span>
                        </div>
                      );
                    }
                  })()}

                  {(() => {
                    const activeCount = fbAccounts.filter(a => a.status === 'Active').length;
                    const effectiveVal = maxGroupsPerAccount === "custom"
                      ? parseInt(customMaxGroups, 10) || 0
                      : maxGroupsPerAccount;
                    const totalActions = activeCount * effectiveVal;
                    if (totalActions > 20) {
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px]">
                          <AlertTriangle size={13} className="shrink-0" />
                          <span>Ước tính {activeCount} account × {effectiveVal} group = {totalActions} thao tác — hệ thống sẽ TỰ ĐỘNG giảm để tránh vượt timeout 55 phút hạ tầng.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Target Account Queue
                </span>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-950/40">
                  {fbAccounts.filter(a => a.status === 'Active').length === 0 ? (
                    <div className="py-4 text-center text-slate-500 text-[11px]">
                      No active accounts available.
                    </div>
                  ) : (
                    fbAccounts.filter(a => a.status === 'Active').map(acc => {
                      const { text, dotClass } = getLastWarmedDisplay(acc.last_warmed_at);
                      return (
                        <div key={acc.id} className="flex items-center justify-between px-3.5 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700/60">
                              {acc.account_ref || "—"}
                            </span>
                            <span className="font-medium text-slate-200 truncate">
                              {acc.account_name || acc.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0 font-mono">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                            <span>{text}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Each account will be warmed sequentially through headless Chromium on the VPS. 4G proxy IP will be rotated between accounts with safe cooldown pauses to protect trust score.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setConfirmWarmModalOpen(false)}
                disabled={triggeringWarm}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunWarmJoin}
                disabled={triggeringWarm || fbAccounts.filter(a => a.status === 'Active').length === 0}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
              >
                {triggeringWarm ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Flame size={14} className="fill-white/30" />
                    <span>Confirm &amp; Run Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 min-h-[calc(100vh-60px)]">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
        </div>
      }
    >
      <CampaignsContent />
    </Suspense>
  );
}

