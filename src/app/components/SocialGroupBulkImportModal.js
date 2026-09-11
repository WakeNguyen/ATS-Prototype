"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Tag,
  ArrowRight
} from "lucide-react";
import * as XLSX from "xlsx";
import { bulkImportSocialGroups } from "../campaign_actions";

/**
 * Auto-detect column mapping based on standard header names
 */
function autoDetectColumns(headers) {
  const mapping = {
    url: "",
    name: "",
    member_count: "",
    group_type: ""
  };

  const lowerHeaders = headers.map(h => String(h || "").trim().toLowerCase());

  headers.forEach((originalHeader, idx) => {
    const h = lowerHeaders[idx];
    if (!mapping.url && (h === "url" || h === "link" || h.includes("url") || h.includes("link group") || h.includes("group url"))) {
      mapping.url = originalHeader;
    } else if (!mapping.name && !h.includes("type") && !h.includes("tag") && !h.includes("url") && (h === "name" || h === "tên" || h === "ten" || h.includes("group name") || h.includes("tên group") || h === "group")) {
      mapping.name = originalHeader;
    } else if (!mapping.member_count && (h.includes("member") || h.includes("thành viên") || h.includes("thanh vien") || h.includes("mem") || h.includes("count") || h.includes("size"))) {
      mapping.member_count = originalHeader;
    } else if (!mapping.group_type && (h.includes("tag") || h.includes("type") || h.includes("loại") || h.includes("loai") || h.includes("nhóm") || h.includes("nhom") || h === "group type")) {
      mapping.group_type = originalHeader;
    }
  });

  return mapping;
}

export default function SocialGroupBulkImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    url: "",
    name: "",
    member_count: "",
    group_type: ""
  });

  const [step, setStep] = useState("select"); // 'select' | 'mapping' | 'preview' | 'completed'
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Preview result from Server Action
  const [previewReport, setPreviewReport] = useState(null);
  const [previewTab, setPreviewTab] = useState("valid"); // 'valid' | 'duplicate_db' | 'duplicate_file' | 'invalid'

  // Final result
  const [finalResult, setFinalResult] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setErrorMsg(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setErrorMsg("The uploaded file has no sheets.");
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!json || json.length === 0) {
          setErrorMsg("The selected sheet is empty or contains no data rows.");
          return;
        }

        // Extract header names
        const detectedHeaders = Object.keys(json[0] || {});
        setHeaders(detectedHeaders);
        setRawRows(json);

        const detectedMapping = autoDetectColumns(detectedHeaders);
        setColumnMapping(detectedMapping);
        setStep("mapping");
      } catch (err) {
        console.error("Failed to parse file:", err);
        setErrorMsg("Failed to read file. Please ensure it is a valid .xlsx, .xls, or .csv file.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const getTransformedRows = () => {
    return rawRows.map((r) => {
      const url = columnMapping.url ? String(r[columnMapping.url] || "") : "";
      const name = columnMapping.name ? String(r[columnMapping.name] || "") : "";
      const member_count = columnMapping.member_count ? r[columnMapping.member_count] : null;
      const group_type = columnMapping.group_type ? r[columnMapping.group_type] : "";

      return {
        url,
        name,
        member_count,
        group_type
      };
    });
  };

  const handleRunAnalysis = async () => {
    if (!columnMapping.url || !columnMapping.name) {
      setErrorMsg("Please select the columns for both Group URL and Group Name.");
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);

    try {
      const rows = getTransformedRows();
      const res = await bulkImportSocialGroups(rows, { confirm: false });

      if (res.success) {
        setPreviewReport(res);
        setStep("preview");
        if (res.summary.validCount > 0) {
          setPreviewTab("valid");
        } else if (res.summary.duplicateInDbCount > 0) {
          setPreviewTab("duplicate_db");
        } else if (res.summary.invalidFormatCount > 0) {
          setPreviewTab("invalid");
        }
      } else {
        setErrorMsg(res.error || "Failed to analyze rows.");
      }
    } catch (err) {
      setErrorMsg(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewReport || previewReport.summary.validCount === 0) return;

    setImporting(true);
    setErrorMsg(null);

    try {
      const rows = getTransformedRows();
      const res = await bulkImportSocialGroups(rows, { confirm: true });

      if (res.success) {
        setFinalResult(res);
        setStep("completed");
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || "Failed to import rows.");
      }
    } catch (err) {
      setErrorMsg(err.message || "An unexpected error occurred during import.");
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMapping({ url: "", name: "", member_count: "", group_type: "" });
    setPreviewReport(null);
    setFinalResult(null);
    setErrorMsg(null);
    setStep("select");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 font-bold text-slate-100 text-sm">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet size={16} />
            </div>
            <span>Import Social Groups from File</span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              Excel / CSV
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <XCircle size={14} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-rose-200 p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* STEP 1: File Selection */}
          {step === "select" && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl bg-slate-950/50 transition-colors">
              <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-400 mb-3">
                <Upload size={28} className="text-emerald-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-100 mb-1">
                Choose an Excel or CSV file
              </h4>
              <p className="text-xs text-slate-400 text-center max-w-sm mb-4">
                Supported formats: <code className="text-emerald-400 font-mono">.xlsx</code>,{" "}
                <code className="text-emerald-400 font-mono">.xls</code>,{" "}
                <code className="text-emerald-400 font-mono">.csv</code>. Maximum 5,000 rows per batch.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="social-group-file-upload"
              />
              <label
                htmlFor="social-group-file-upload"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                <FileSpreadsheet size={14} />
                <span>Select File from Computer</span>
              </label>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === "mapping" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <FileSpreadsheet size={15} className="text-emerald-400" />
                  <span className="font-semibold text-slate-200">{file?.name}</span>
                  <span className="text-slate-500">
                    ({rawRows.length.toLocaleString()} data rows found)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Change file
                </button>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1">
                  Match Columns
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  We automatically detected the matching columns below. Verify or adjust the mapping before analyzing:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* URL */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>Group URL</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={columnMapping.url}
                      onChange={(e) => setColumnMapping((prev) => ({ ...prev, url: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Select URL column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">Links to Facebook groups</p>
                  </div>

                  {/* Name */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>Group Name</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={columnMapping.name}
                      onChange={(e) => setColumnMapping((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Select Name column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">Display name for the group</p>
                  </div>

                  {/* Members */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Member Count (Optional)
                    </label>
                    <select
                      value={columnMapping.member_count}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({ ...prev, member_count: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- None / Skip --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">Supports e.g. 1.900 or 1,900</p>
                  </div>

                  {/* Group Type / Tags */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Group Type / Tags (Optional)
                    </label>
                    <select
                      value={columnMapping.group_type}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({ ...prev, group_type: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- None / Skip --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">Comma-separated tags (A-Z, 0-9, space, -, _)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Preview Report */}
          {step === "preview" && previewReport && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Total Rows</div>
                  <div className="text-lg font-bold text-slate-100 font-mono">
                    {previewReport.summary.totalRows.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>Ready to Import</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {previewReport.summary.validCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>Duplicates (Skipped)</span>
                  </div>
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    {(
                      previewReport.summary.duplicateInDbCount +
                      previewReport.summary.duplicateInFileCount
                    ).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    DB: {previewReport.summary.duplicateInDbCount} | File:{" "}
                    {previewReport.summary.duplicateInFileCount}
                  </div>
                </div>

                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                  <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                    <XCircle size={12} />
                    <span>Errors (Skipped)</span>
                  </div>
                  <div className="text-lg font-bold text-rose-400 font-mono">
                    {previewReport.summary.invalidFormatCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* New Tags Banner */}
              {previewReport.newTags && previewReport.newTags.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-400 mb-1.5">
                    <Tag size={13} />
                    <span>
                      {previewReport.newTags.length} New Tag(s) will be automatically registered:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {previewReport.newTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] border border-blue-500/30"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Detail Table Tabs */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60">
                <div className="flex items-center gap-1 p-1 bg-slate-900 border-b border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("valid")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewTab === "valid"
                        ? "bg-slate-800 text-emerald-400 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Ready ({previewReport.summary.validCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("duplicate_db")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewTab === "duplicate_db"
                        ? "bg-slate-800 text-amber-400 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Exists in DB ({previewReport.summary.duplicateInDbCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("duplicate_file")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewTab === "duplicate_file"
                        ? "bg-slate-800 text-amber-400 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    File Dupes ({previewReport.summary.duplicateInFileCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("invalid")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewTab === "invalid"
                        ? "bg-slate-800 text-rose-400 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Errors ({previewReport.summary.invalidFormatCount})
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {previewTab === "valid" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                        <tr>
                          <th className="py-2 px-3 w-10">Row</th>
                          <th className="py-2 px-3">Group Name</th>
                          <th className="py-2 px-3 text-right">Members</th>
                          <th className="py-2 px-3">Tags</th>
                          <th className="py-2 px-3">URL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {previewReport.validPreview?.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">
                              No valid groups found to import.
                            </td>
                          </tr>
                        ) : (
                          previewReport.validPreview?.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">
                                #{r.rowNumber}
                              </td>
                              <td className="py-1.5 px-3 font-semibold text-slate-200 truncate max-w-xs">
                                {r.name}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-slate-300">
                                {r.member_count != null ? r.member_count.toLocaleString() : "—"}
                              </td>
                              <td className="py-1.5 px-3">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {r.group_type?.map((t) => (
                                    <span
                                      key={t}
                                      className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-emerald-400/80 truncate max-w-xs">
                                {r.url}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {previewTab === "duplicate_db" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                        <tr>
                          <th className="py-2 px-3 w-10">Row</th>
                          <th className="py-2 px-3">Group Name</th>
                          <th className="py-2 px-3">URL</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {previewReport.duplicateInDbPreview?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              No existing database duplicates.
                            </td>
                          </tr>
                        ) : (
                          previewReport.duplicateInDbPreview?.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">
                                #{r.rowNumber}
                              </td>
                              <td className="py-1.5 px-3 text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                                {r.url}
                              </td>
                              <td className="py-1.5 px-3 text-amber-400 font-medium text-[11px]">
                                {r.reason}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {previewTab === "duplicate_file" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                        <tr>
                          <th className="py-2 px-3 w-10">Row</th>
                          <th className="py-2 px-3">Group Name</th>
                          <th className="py-2 px-3">URL</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {previewReport.duplicateInFilePreview?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              No duplicate URLs found within file.
                            </td>
                          </tr>
                        ) : (
                          previewReport.duplicateInFilePreview?.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">
                                #{r.rowNumber}
                              </td>
                              <td className="py-1.5 px-3 text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                                {r.url}
                              </td>
                              <td className="py-1.5 px-3 text-amber-400 font-medium text-[11px]">
                                {r.reason}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {previewTab === "invalid" && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                        <tr>
                          <th className="py-2 px-3 w-10">Row</th>
                          <th className="py-2 px-3">Group Name</th>
                          <th className="py-2 px-3">URL</th>
                          <th className="py-2 px-3">Error Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {previewReport.invalidPreview?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              No format or validation errors found.
                            </td>
                          </tr>
                        ) : (
                          previewReport.invalidPreview?.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">
                                #{r.rowNumber}
                              </td>
                              <td className="py-1.5 px-3 text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                                {r.url}
                              </td>
                              <td className="py-1.5 px-3 text-rose-400 text-[11px]">
                                {r.errors?.join("; ")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Completed */}
          {step === "completed" && finalResult && (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-slate-100">Import Completed!</h3>
              <p className="text-xs text-slate-300 max-w-md">
                Successfully added{" "}
                <span className="text-emerald-400 font-bold font-mono">
                  {finalResult.insertedCount.toLocaleString()}
                </span>{" "}
                new social group(s) to the library.
              </p>
              {finalResult.skippedCount > 0 && (
                <p className="text-xs text-slate-500">
                  {finalResult.skippedCount.toLocaleString()} row(s) were skipped due to existing duplicates or errors.
                </p>
              )}
              {finalResult.newTagsRegistered && finalResult.newTagsRegistered.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-400 mb-1">New tags registered:</div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {finalResult.newTagsRegistered.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-[11px] border border-blue-500/20"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <div>
            {step === "mapping" && (
              <button
                type="button"
                onClick={resetAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Back
              </button>
            )}
            {step === "preview" && (
              <button
                type="button"
                onClick={() => setStep("mapping")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Adjust Columns
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step !== "completed" && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            )}

            {step === "mapping" && (
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={analyzing || !columnMapping.url || !columnMapping.name}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Analyzing Rows...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze & Preview</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            )}

            {step === "preview" && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || previewReport?.summary.validCount === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Importing to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>
                      Confirm Import ({previewReport?.summary.validCount || 0} Groups)
                    </span>
                  </>
                )}
              </button>
            )}

            {step === "completed" && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
