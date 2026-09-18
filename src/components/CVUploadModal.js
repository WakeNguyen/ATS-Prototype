"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Trash2
} from "lucide-react";

const MAX_FILES = 10;
const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpeg", ".jpg"];

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function CVUploadModal({ isOpen, onClose, onSuccess }) {
  const [files, setFiles] = useState([]);
  const [step, setStep] = useState("select"); // 'select' | 'submitting' | 'success'
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const validateAndAddFiles = (newFiles) => {
    setErrorMsg(null);
    const validList = [];
    const invalidList = [];

    for (const f of newFiles) {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        validList.push(f);
      } else {
        invalidList.push(f.name);
      }
    }

    if (invalidList.length > 0) {
      setErrorMsg(`Invalid file type: ${invalidList.slice(0, 3).join(", ")}. Supported formats: .pdf, .png, .jpg`);
      return;
    }

    const combined = [...files, ...validList];
    if (combined.length > MAX_FILES) {
      setErrorMsg(`Maximum ${MAX_FILES} files allowed per batch. You selected ${combined.length} files.`);
      return;
    }

    // Deduplicate by name and size
    const unique = [];
    const seen = new Set();
    for (const f of combined) {
      const key = `${f.name}_${f.size}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(f);
      }
    }

    setFiles(unique);
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      validateAndAddFiles(selected);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      validateAndAddFiles(droppedFiles);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setErrorMsg(null);
  };

  const handleUploadSubmit = async () => {
    if (files.length === 0) {
      setErrorMsg("Please select at least one CV file.");
      return;
    }

    setStep("submitting");
    setErrorMsg(null);

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f);
      }

      const res = await fetch("/api/cv-upload-proxy", {
        method: "POST",
        body: formData
      });

      let data;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(responseText || `Upload failed with HTTP status ${res.status}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload CV files.");
      }

      setUploadedCount(files.length);
      setStep("success");
      if (onSuccess) onSuccess(files.length);
    } catch (err) {
      console.error("CV upload failed:", err);
      setErrorMsg(err.message || "An unexpected error occurred while uploading.");
      setStep("select");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setStep("select");
    setErrorMsg(null);
    setUploadedCount(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">Parse CV — AI Extraction</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                  PDF / Image
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Upload candidate CV/resumes for automated AI parsing & deduplication</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-400 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {step === "select" && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-sky-500 bg-sky-500/10 scale-[0.99]"
                    : "border-slate-700/80 hover:border-sky-500/50 hover:bg-slate-800/40 bg-slate-950/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpeg,.jpg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Upload size={20} />
                </div>
                <p className="text-xs font-bold text-slate-200">
                  Choose CV file(s) or drag & drop here
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supported formats: <span className="text-sky-400 font-mono">.pdf, .png, .jpg</span> (Max {MAX_FILES} files per batch)
                </p>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Selected Files ({files.length}/{MAX_FILES})</span>
                    <button
                      onClick={() => setFiles([])}
                      className="text-[11px] text-slate-500 hover:text-rose-400 transition"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={15} className="text-sky-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-slate-200 font-medium truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                          title="Remove file"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "submitting" && (
            <div className="py-12 text-center space-y-3">
              <Loader2 size={36} className="animate-spin text-sky-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100">
                Uploading {files.length} file(s) to AI Queue...
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Files are being dispatched to the automated AI parsing pipeline for OCR extraction and candidate deduplication.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-100">
                  {uploadedCount} CV File(s) Queued Successfully!
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Đã gửi {uploadedCount} file để AI xử lý. Kết quả sẽ xuất hiện trong <strong className="text-slate-200">CV Imports Queue</strong> / thông báo trong vài phút.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/50">
          {step === "select" && (
            <>
              <button
                onClick={handleClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={files.length === 0}
                className="px-4 py-1.5 text-xs font-bold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 rounded-lg shadow-md shadow-sky-500/20 flex items-center gap-1.5 transition"
              >
                <Sparkles size={14} />
                <span>Upload & Queue for AI Parsing ({files.length})</span>
              </button>
            </>
          )}

          {step === "submitting" && (
            <div className="w-full text-center text-xs text-slate-500">
              Please wait while your files are being uploaded...
            </div>
          )}

          {step === "success" && (
            <div className="w-full flex justify-end gap-2">
              <button
                onClick={handleReset}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                Upload More
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-md shadow-emerald-500/20 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
