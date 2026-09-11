"use client";

import React, { useState, useMemo } from "react";
import { 
  Plus, 
  X, 
  Edit2, 
  Tag, 
  Check, 
  Loader2, 
  Sparkles,
  Filter
} from "lucide-react";
import { 
  updateSocialGroupTags, 
  deleteTagFromRegistry, 
  renameTagInRegistry, 
  bulkRemoveTagFromGroups 
} from "../campaign_actions";

/**
 * Validate a tag name: only [A-Za-z0-9 _-].
 */
function isValidTagName(name) {
  return /^[A-Za-z0-9 _-]+$/.test((name || '').trim());
}

/**
 * 8 Deterministic color palettes for tag badges.
 */
const TAG_COLOR_PALETTES = [
  { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", activeBg: "bg-emerald-600 text-white border-emerald-500" },
  { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30", activeBg: "bg-sky-600 text-white border-sky-500" },
  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", activeBg: "bg-amber-600 text-white border-amber-500" },
  { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30", activeBg: "bg-rose-600 text-white border-rose-500" },
  { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", activeBg: "bg-violet-600 text-white border-violet-500" },
  { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", activeBg: "bg-cyan-600 text-white border-cyan-500" },
  { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", border: "border-fuchsia-500/30", activeBg: "bg-fuchsia-600 text-white border-fuchsia-500" },
  { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/30", activeBg: "bg-indigo-600 text-white border-indigo-500" }
];

/**
 * Deterministically pick a color palette based on tag string hash.
 */
export function getTagColor(tagName) {
  if (!tagName) return TAG_COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = (hash << 5) - hash + tagName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TAG_COLOR_PALETTES.length;
  return TAG_COLOR_PALETTES[index];
}

/**
 * GroupTypeTagEditor Component
 * 
 * Supports 2 modes:
 * - mode="badge": Renders tag pills with popover tag editor for a group row
 * - mode="filter": Renders horizontal filter bar of available tags with multi-select OR semantics
 */
export default function GroupTypeTagEditor({
  mode = "badge",
  // Badge Mode Props
  tags = [],
  socialGroupId = null,
  allKnownTags = [],
  onTagsUpdated = null,
  // Filter Mode Props
  selectedTags = new Set(),
  onToggleTag = null,
  onClearAll = null,
  // NEW (PHẦN 5.5 / 5.8) — filter mode only:
  allowDelete = false,
  onTagDeleted = null,
  onTagRenamed = null
}) {
  // Popover State (for badge mode)
  const [showPopover, setShowPopover] = useState(false);
  const [tempTags, setTempTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Delete Tag State (for filter mode)
  const [deletingTag, setDeletingTag] = useState(null); // tagName being deleted or null

  // Rename Tag State (for filter mode)
  const [renamingTag, setRenamingTag] = useState(null); // tagName being renamed or null
  const [renameInput, setRenameInput] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState(null);

  // Normalize tags array (handle string or array)
  const normalizedTags = useMemo(() => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.filter(Boolean);
    if (typeof tags === "string") return tags.split(",").map(t => t.trim()).filter(Boolean);
    return [];
  }, [tags]);

  // Open Popover and sync temp state
  const handleOpenPopover = (e) => {
    e.stopPropagation();
    setTempTags([...normalizedTags]);
    setNewTagInput("");
    setErrorMsg(null);
    setShowPopover(true);
  };

  const handleAddTempTag = (tagToAdd) => {
    const clean = (tagToAdd || newTagInput || "").trim();
    if (!clean) return;
    if (!isValidTagName(clean)) {
      setErrorMsg(`Tên tag không hợp lệ: "${clean}". Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".`);
      return;
    }
    if (!tempTags.includes(clean)) {
      setTempTags([...tempTags, clean]);
    }
    setNewTagInput("");
    setErrorMsg(null);
  };

  const handleRemoveTempTag = (indexToRemove) => {
    setTempTags(tempTags.filter((_, i) => i !== indexToRemove));
  };

  const handleSaveTags = async (e) => {
    e.stopPropagation();
    if (!socialGroupId) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await updateSocialGroupTags(socialGroupId, tempTags);
      if (res.success) {
        setShowPopover(false);
        if (onTagsUpdated) {
          onTagsUpdated(socialGroupId, tempTags);
        }
      } else {
        setErrorMsg(res.error || "Failed to update tags");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to update tags");
    } finally {
      setSaving(false);
    }
  };

  const handleStartRename = (e, tagName) => {
    e.stopPropagation();
    setRenamingTag(tagName);
    setRenameInput(tagName);
    setRenameError(null);
  };

  const handleCancelRename = (e) => {
    if (e) e.stopPropagation();
    setRenamingTag(null);
    setRenameInput("");
    setRenameError(null);
  };

  const handleSaveRename = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const clean = (renameInput || "").trim();
    if (!clean) return;

    if (!isValidTagName(clean)) {
      setRenameError(`Tên tag không hợp lệ: "${clean}". Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".`);
      return;
    }

    if (clean.toLowerCase() === renamingTag.toLowerCase()) {
      setRenameError("Tên mới trùng với tên cũ (không phân biệt hoa/thường).");
      return;
    }

    setRenameSaving(true);
    setRenameError(null);

    try {
      const res = await renameTagInRegistry(renamingTag, clean);
      if (res.success) {
        const oldName = renamingTag;
        setRenamingTag(null);
        setRenameInput("");
        if (onTagRenamed) {
          onTagRenamed(oldName, clean, res.affectedGroups);
        }
      } else {
        setRenameError(res.error || "Không thể đổi tên tag.");
      }
    } catch (err) {
      setRenameError(err.message || "Lỗi không xác định khi đổi tên tag.");
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDeleteTag = async (e, tagName) => {
    e.stopPropagation();
    if (deletingTag) return; // đang xử lý 1 tag khác, chặn double-click

    const confirmed = window.confirm(
      `Xoá vĩnh viễn tag "${tagName}" khỏi hệ thống?\n\n` +
      `Hành động này chỉ thực hiện được khi KHÔNG còn nhóm nào đang dùng tag này. ` +
      `Nếu vẫn còn nhóm dùng, bạn sẽ được hỏi để tháo khỏi tất cả các nhóm.`
    );
    if (!confirmed) return;

    setDeletingTag(tagName);
    try {
      const res = await deleteTagFromRegistry(tagName);
      if (res.success) {
        if (onTagDeleted) onTagDeleted(tagName);
      } else {
        const inUseCount = res.inUseCount || 0;
        if (inUseCount > 0) {
          const forceConfirm = window.confirm(
            `Tag "${tagName}" đang được gắn ở ${inUseCount} nhóm.\n\n` +
            `Bạn có muốn tháo tag này khỏi tất cả ${inUseCount} nhóm rồi xoá vĩnh viễn khỏi hệ thống không?`
          );
          if (forceConfirm) {
            const bulkRes = await bulkRemoveTagFromGroups(tagName);
            if (!bulkRes.success) {
              alert(bulkRes.error || "Không thể tháo tag khỏi các nhóm.");
              return;
            }
            const finalDelRes = await deleteTagFromRegistry(tagName);
            if (finalDelRes.success) {
              if (onTagDeleted) onTagDeleted(tagName);
            } else {
              alert(finalDelRes.error || "Không thể xoá tag khỏi registry.");
            }
          }
        } else {
          alert(res.error || "Không thể xoá tag.");
        }
      }
    } catch (err) {
      alert(err.message || "Không thể xoá tag.");
    } finally {
      setDeletingTag(null);
    }
  };

  // ==========================================
  // MODE 1: FILTER BAR MODE
  // ==========================================
  if (mode === "filter") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mr-1 shrink-0">
          <Filter size={12} />
          <span>Tags:</span>
        </div>

        {/* 'All' Button */}
        <button
          type="button"
          onClick={onClearAll}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
            selectedTags.size === 0
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          All ({allKnownTags.length})
        </button>

        {/* All Known Tag Pills */}
        {allKnownTags.map((tagName) => {
          const isSelected = selectedTags.has(tagName);
          const palette = getTagColor(tagName);
          const isDeleting = deletingTag === tagName;
          const isRenaming = renamingTag === tagName;

          return (
            <span
              key={tagName}
              className={`relative inline-flex items-center gap-1 rounded-full text-[11px] font-medium border transition-all ${
                isRenaming ? 'z-50' : ''
              } ${
                isSelected
                  ? `${palette.activeBg} shadow-xs font-bold`
                  : isRenaming
                    ? `${palette.bg} ${palette.text} ${palette.border} opacity-100 ring-1 ring-emerald-500/50`
                    : `${palette.bg} ${palette.text} ${palette.border} opacity-70 hover:opacity-100 hover:border-slate-600`
              } ${allowDelete ? 'pl-2.5 pr-1 py-0.5' : 'px-2.5 py-0.5'}`}
            >
              <button
                type="button"
                onClick={() => onToggleTag && onToggleTag(tagName)}
                className="cursor-pointer flex items-center gap-1"
              >
                <span>{tagName}</span>
                {isSelected && <Check size={10} className="stroke-[3]" />}
              </button>
              {allowDelete && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(e, tagName)}
                    disabled={isDeleting || (isRenaming && renameSaving)}
                    title={`Rename tag "${tagName}"`}
                    className="p-0.5 rounded-full hover:bg-slate-700/60 hover:text-slate-200 text-slate-400 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Edit2 size={9} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTag(e, tagName)}
                    disabled={isDeleting || (isRenaming && renameSaving)}
                    title={`Delete tag "${tagName}" (chỉ xoá được nếu không còn nhóm nào dùng)`}
                    className="p-0.5 rounded-full hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {isDeleting ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                  </button>
                </>
              )}

              {/* Rename Popover */}
              {isRenaming && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl w-64 text-left font-normal"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <Edit2 size={11} className="text-emerald-400" />
                      <span>Rename Tag</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveRename}>
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => {
                        setRenameInput(e.target.value);
                        if (renameError) setRenameError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleCancelRename(e);
                      }}
                      placeholder="New tag name..."
                      autoFocus
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium"
                    />

                    {renameError && (
                      <div className="mt-2 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-1.5 leading-relaxed">
                        {renameError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={renameSaving || !renameInput.trim() || renameInput.trim() === tagName}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {renameSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        <span>Save</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  // ==========================================
  // MODE 2: BADGE DISPLAY & POPOVER EDITOR MODE
  // ==========================================
  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap">
      {normalizedTags.length === 0 ? (
        <button
          type="button"
          onClick={handleOpenPopover}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 border border-dashed border-slate-700/60 transition-colors"
          title="Click to add Group Type tags"
        >
          <Plus size={10} />
          <span>Add Tag</span>
        </button>
      ) : (
        <div 
          onClick={handleOpenPopover}
          className="group/tag inline-flex items-center gap-1 flex-wrap cursor-pointer"
          title="Click to edit group tags"
        >
          {normalizedTags.map((t) => {
            const palette = getTagColor(t);
            return (
              <span
                key={t}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${palette.bg} ${palette.text} ${palette.border}`}
              >
                {t}
              </span>
            );
          })}
          <span className="opacity-0 group-hover/tag:opacity-100 text-slate-400 p-0.5 hover:text-slate-200 transition-opacity">
            <Edit2 size={10} />
          </span>
        </div>
      )}

      {/* Popover Editor Dialog */}
      {showPopover && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 top-full mt-1.5 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-slate-200 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-100 text-[11px]">
              <Tag size={12} className="text-emerald-400" />
              <span>Edit Group Tags</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X size={13} />
            </button>
          </div>

          {/* Current Tags Chips */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400">Current Tags:</div>
            <div className="flex flex-wrap gap-1 min-h-7 p-1.5 rounded bg-slate-950/80 border border-slate-800">
              {tempTags.length === 0 ? (
                <span className="text-[10px] text-slate-500 italic">No tags selected.</span>
              ) : (
                tempTags.map((t, idx) => {
                  const palette = getTagColor(t);
                  return (
                    <span
                      key={t}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${palette.bg} ${palette.text} ${palette.border}`}
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTempTag(idx)}
                        className="hover:text-rose-400 p-0.5"
                      >
                        <X size={9} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Add New Tag Input */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400">Add New Tag:</div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTempTag();
                  }
                }}
                placeholder="Type tag name and press Enter..."
                className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleAddTempTag()}
                disabled={!newTagInput.trim()}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs disabled:opacity-40"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Autocomplete Suggestions from known tags */}
          {allKnownTags.filter((k) => !tempTags.includes(k)).length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <div className="text-[10px] font-semibold text-slate-500">Suggestions:</div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {allKnownTags
                  .filter((k) => !tempTags.includes(k))
                  .slice(0, 10)
                  .map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleAddTempTag(k)}
                      className="px-1.5 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] transition-colors"
                    >
                      + {k}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="text-[10px] text-rose-400 font-mono">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="px-2.5 py-1 rounded text-slate-400 hover:text-slate-200 text-[11px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTags}
              disabled={saving}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              <span>Save Tags</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
