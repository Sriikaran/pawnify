"use client";

import React, { useState, useRef } from "react";
import axios from "axios";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Paperclip,
  CloudUpload,
  FolderPlus,
  AlertTriangle,
  Eye,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface UploadedDoc {
  name: string;
  url: string;
  size?: number;
  uploadedAt: string;
  warning?: string | null;
  category?: string;
}

interface DocumentUploaderProps {
  label?: string;
  bucket?: string;
  onUploadComplete?: (doc: UploadedDoc) => void;
  onRemove?: (url: string) => void;
  initialDocs?: UploadedDoc[];
  accept?: string;
  maxSizeMB?: number;
  categories?: string[];
  localStorageKey?: string;
}

export function DocumentUploader({
  label = "Upload KYC, Collateral Photos, or Documents to Supabase Bucket",
  bucket = "pawnify-docs",
  onUploadComplete,
  onRemove,
  initialDocs = [],
  accept = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.doc,.docx,.xls,.xlsx,.txt,image/*",
  maxSizeMB = 15,
  categories,
  localStorageKey,
}: DocumentUploaderProps) {
  const [docs, setDocs] = useState<UploadedDoc[]>(() => {
    if (typeof window !== "undefined" && localStorageKey) {
      try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return initialDocs;
  });

  React.useEffect(() => {
    if (typeof window !== "undefined" && localStorageKey) {
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(docs));
      } catch (e) {}
    }
  }, [docs, localStorageKey]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<UploadedDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCategories = React.useMemo(() => {
    if (categories && categories.length > 0) return categories;
    const l = label.toLowerCase();
    if (bucket.includes("kyc") || l.includes("kyc")) {
      return [
        "Aadhaar Card (Front)",
        "Aadhaar Card (Back)",
        "PAN Card",
        "Voter ID Card",
        "Driving License",
        "Passport",
        "Customer Photo",
        "Address Proof",
        "Other KYC Doc",
      ];
    } else if (
      bucket.includes("collateral") ||
      bucket.includes("item") ||
      l.includes("photo") ||
      l.includes("item")
    ) {
      return [
        "Gold Item Photo",
        "Silver Item Photo",
        "Hallmark / Purity Photo",
        "Weight Scale Photo",
        "Valuation Report Slip",
        "Purchase Invoice",
        "Other Collateral",
      ];
    } else {
      return [
        "Signed Loan Agreement",
        "Promissory Note",
        "KYC Document",
        "Collateral Photo",
        "Valuation Report",
        "Payment Receipt",
        "Other Document",
      ];
    }
  }, [categories, bucket, label]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => defaultCategories[0] || "General Document"
  );

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setWarning(null);

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File '${file.name}' exceeds maximum allowed size of ${maxSizeMB}MB.`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setWarning(null);
    setProgress(0);

    try {
      const uploadedResults: UploadedDoc[] = [];
      let lastWarning: string | null = null;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", bucket);

        const res = await axios.post("/api/storage/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setProgress(percentCompleted);
            }
          },
        });

        const data = res.data;
        if (data.warning) {
          lastWarning = data.warning;
        }

        const newDoc: UploadedDoc = {
          name: file.name,
          url: data.url || URL.createObjectURL(file),
          size: file.size,
          uploadedAt: new Date().toLocaleDateString("en-IN"),
          warning: data.warning || null,
          category: selectedCategory,
        };

        uploadedResults.push(newDoc);
        if (onUploadComplete) {
          onUploadComplete(newDoc);
        }
      }

      setDocs((prev) => [...prev, ...uploadedResults]);
      setSelectedFiles([]);
      if (lastWarning) {
        setWarning(lastWarning);
      }
    } catch (err: unknown) {
      let message = "Error uploading file to Supabase storage";
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const removeDoc = (url: string) => {
    setDocs((prev) => prev.filter((d) => d.url !== url));
    if (onRemove) onRemove(url);
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label
          className="text-xs font-bold flex items-center gap-1.5"
          style={{ color: "var(--text-secondary)" }}
        >
          <Paperclip className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
          {label}
        </label>
        <span
          className="text-[10px] font-mono uppercase px-2 py-0.5 rounded self-start sm:self-auto"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          Supabase Bucket: <strong style={{ color: "var(--accent-text)" }}>{bucket}</strong>
        </span>
      </div>

      {/* Document Category Pill Selector */}
      <div
        className="p-3 rounded-xl space-y-2"
        style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold" style={{ color: "var(--text-secondary)" }}>
            Select Document Category / Type:
          </span>
          <span
            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
            style={{
              color: "var(--accent-text)",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
            }}
          >
            Selected: {selectedCategory}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {defaultCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="text-[11px] px-3 py-1 rounded-lg font-medium transition-all cursor-pointer"
              style={
                selectedCategory === cat
                  ? {
                      background: "var(--accent)",
                      color: "var(--text-inverse)",
                      fontWeight: 700,
                      boxShadow: "0 2px 8px -2px rgba(34, 197, 94, 0.3)",
                    }
                  : {
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-tertiary)",
                    }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Drag and drop selection area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFileSelect(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5"
        style={{
          borderColor: dragActive ? "var(--accent)" : "var(--border-primary)",
          background: dragActive ? "var(--accent-bg)" : "var(--bg-tertiary)",
          transform: dragActive ? "scale(0.99)" : undefined,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-inner"
          style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
        >
          <FolderPlus className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Click to browse or drag & drop files here
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Supports all image types (Gold/Silver collateral photos, KYC) & documents (PDF, DOCX,
            XLS) up to {maxSizeMB}MB
          </div>
        </div>
      </div>

      {/* Selected files pending upload */}
      {selectedFiles.length > 0 && (
        <div
          className="p-4 rounded-xl space-y-3 animate-fadeIn"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold flex items-center gap-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              <CloudUpload className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
              Ready to Upload ({selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""})
            </span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-[11px] hover:text-red-500 transition-colors cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              Clear All
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {selectedFiles.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-2 rounded-lg"
                style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: "var(--accent-text)" }}
                  />
                  <span className="truncate font-medium">{f.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                    ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="hover:text-red-500 p-1 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  title="Remove from queue"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {uploading && (
            <div className="space-y-1">
              <div
                className="flex justify-between text-[11px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                <span>Uploading via Axios Proxy...</span>
                <span>{progress}%</span>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-tertiary)" }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "var(--accent)" }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={uploading}
              onClick={uploadFiles}
              className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading to {bucket}...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Uploading to the clouds
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error and Warning Banners */}
      {error && (
        <div
          className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs flex items-start gap-2.5 animate-fadeIn"
          style={{ color: "var(--text-primary)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div className="space-y-1">
            <div className="font-bold text-red-600">Upload Failed</div>
            <div style={{ color: "var(--text-secondary)" }}>{error}</div>
          </div>
        </div>
      )}

      {warning && (
        <div
          className="p-3.5 rounded-xl bg-(--accent-bg) border border-(--accent-border) text-xs flex items-start gap-2.5 animate-fadeIn"
          style={{ color: "var(--text-primary)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-(--accent)" />
          <div className="space-y-1">
            <div className="font-bold text-(--accent-text)">Supabase Configuration Notice</div>
            <div style={{ color: "var(--text-secondary)" }}>{warning}</div>
          </div>
        </div>
      )}

      {/* Uploaded Documents List */}
      {docs.length > 0 && (
        <div className="space-y-2 mt-4">
          <div
            className="text-[11px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Uploaded Documents & Images ({docs.length})</span>
            <span className="text-[10px] font-normal" style={{ color: "var(--accent-text)" }}>
              Active in Storage
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {docs.map((doc, idx) => {
              const isImg =
                doc.name.match(/\.(png|jpe?g|gif|webp|svg)$/i) ||
                doc.url.match(/\.(png|jpe?g|gif|webp|svg)$/i);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl flex items-center justify-between gap-3 group transition-all glass-card glass-card-hover"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isImg ? (
                      <img
                        src={doc.url}
                        alt={doc.name}
                        onClick={() => setPreviewDoc(doc)}
                        className="w-10 h-10 rounded-lg object-cover cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
                        style={{
                          border: "1px solid var(--accent-border)",
                          background: "var(--bg-tertiary)",
                        }}
                        title="Click to view photo preview"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                          title={doc.name}
                        >
                          {doc.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: "var(--accent-bg)",
                            color: "var(--accent-text)",
                            border: "1px solid var(--accent-border)",
                          }}
                        >
                          {doc.category || "General Doc"}
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: "var(--text-muted)" }}
                        >
                          · {doc.uploadedAt}
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: "var(--text-muted)" }}
                        >
                          ·
                        </span>
                        <span
                          className={`text-[10px] font-mono ${doc.warning ? "text-(--accent)" : ""}`}
                          style={!doc.warning ? { color: "var(--accent-text)" } : undefined}
                        >
                          {doc.warning ? "Local Fallback" : "Supabase Cloud"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewDoc(doc);
                      }}
                      className="p-1.5 rounded-lg transition-all cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                      title="Preview Document / Photo"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(doc.url);
                      }}
                      className="p-1.5 rounded-lg transition-all cursor-pointer"
                      style={{
                        color: copiedUrl === doc.url ? "var(--accent-text)" : "var(--text-muted)",
                      }}
                      title="Copy Storage URL"
                    >
                      {copiedUrl === doc.url ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: "var(--text-muted)" }}
                      title="Open Document"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDoc(doc.url);
                      }}
                      className="p-1.5 rounded-lg transition-all hover:text-red-500 cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                      title="Remove Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Universal Document & Image Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent
          className="max-w-4xl p-4"
          style={{ background: "var(--bg-card)", borderColor: "var(--accent-border)" }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-sm font-bold flex items-center justify-between pr-6 truncate"
              style={{ color: "var(--text-primary)" }}
            >
              <span>{previewDoc?.name}</span>
              {previewDoc?.category && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded ml-2"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent-text)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {previewDoc.category}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex justify-center items-center max-h-[75vh] overflow-hidden rounded-xl p-2 w-full min-h-[400px]"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)" }}
          >
            {previewDoc &&
              (previewDoc.name.match(/\.(png|jpe?g|gif|webp|svg)$/i) ||
              previewDoc.url.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="object-contain max-h-[72vh] w-auto rounded-lg mx-auto"
                />
              ) : previewDoc.name.match(/\.(pdf)$/i) || previewDoc.url.match(/\.(pdf)$/i) ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[70vh] rounded-lg border-0"
                  style={{ background: "#ffffff" }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
                  >
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {previewDoc.name}
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                      Category:{" "}
                      <strong style={{ color: "var(--accent-text)" }}>
                        {previewDoc.category || "General Document"}
                      </strong>
                    </div>
                    <div
                      className="text-xs mt-2 max-w-sm mx-auto"
                      style={{ color: "var(--text-muted)" }}
                    >
                      This document format cannot be rendered inside an inline browser iframe. Click
                      the button below to open or download it in full resolution.
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <div
            className="flex justify-between items-center pt-2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>
              Bucket: <strong style={{ color: "var(--accent-text)" }}>{bucket}</strong>
            </span>
            {previewDoc && (
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Full Resolution / Download
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
