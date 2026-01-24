"use client";

import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { UploadCloud, FileText, Image, X, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

// Accepted file types
const ACCEPTED_TYPES = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Accept string for file input
const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.txt";

/**
 * Sanitize filename to only allow alphanumeric, dashes, underscores
 */
function sanitizeFilename(name) {
  const lastDot = name.lastIndexOf(".");
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
  const extension = lastDot > 0 ? name.slice(lastDot) : "";

  const sanitized = baseName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  return sanitized + extension.toLowerCase();
}

/**
 * Format file size for display
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createBrowserClient(url, key);
}

const DocumentUploader = forwardRef(({
  listingId,
  userId,
  onUploadComplete,
  disabled = false,
}, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getDocuments: () => documents,
    clearDocuments: () => {
      documents.forEach(doc => {
        if (doc.preview && !doc.preview.startsWith("http")) {
          URL.revokeObjectURL(doc.preview);
        }
      });
      setDocuments([]);
    },
    setDocuments: (newDocs) => setDocuments(newDocs),
  }));

  /**
   * Validate file type and size
   */
  const isValidFile = useCallback((file) => {
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`File ${file.name} exceeds 10MB limit`);
      return false;
    }
    if (!ACCEPTED_TYPES[file.type]) {
      console.warn(`File ${file.name} has unsupported type: ${file.type}`);
      return false;
    }
    return true;
  }, []);

  /**
   * Upload a single document to Supabase
   */
  const uploadDocument = useCallback(async (doc) => {
    if (!listingId || !userId) {
      console.error("Missing listingId or userId for upload");
      return null;
    }

    const supabase = getSupabaseClient();
    const timestamp = Date.now();
    const sanitizedName = sanitizeFilename(doc.name);
    const path = `${userId}/${listingId}/${timestamp}-${sanitizedName}`;

    try {
      // Upload to storage
      const { data, error } = await supabase.storage
        .from('listing-documents')
        .upload(path, doc.file, {
          contentType: doc.file.type,
          cacheControl: '3600',
        });

      if (error) {
        console.error("Storage upload error:", error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('listing-documents')
        .getPublicUrl(data.path);

      // Insert into documents table
      const { data: dbData, error: dbError } = await supabase
        .from('documents')
        .insert({
          listing_id: listingId,
          user_id: userId,
          file_name: doc.name,
          file_url: urlData.publicUrl,
          file_type: getFileExtension(doc.name),
          file_size: doc.file.size,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database insert error:", dbError);
        return null;
      }

      return {
        id: dbData.id,
        file_name: dbData.file_name,
        file_url: dbData.file_url,
        file_type: dbData.file_type,
        file_size: dbData.file_size,
      };
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  }, [listingId, userId]);

  /**
   * Process and upload files
   */
  const processFiles = useCallback(async (files) => {
    const validFiles = files.filter(isValidFile);

    if (validFiles.length === 0) return;

    // Create local document objects
    const newDocs = validFiles.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      file: file,
      size: file.size,
      type: ACCEPTED_TYPES[file.type],
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      uploaded: false,
    }));

    setDocuments(prev => [...prev, ...newDocs]);

    // Upload to Supabase if listingId and userId are available
    if (listingId && userId) {
      setUploading(true);
      const uploadedDocs = [];

      for (const doc of newDocs) {
        setUploadProgress(prev => ({ ...prev, [doc.id]: 'uploading' }));
        const result = await uploadDocument(doc);
        if (result) {
          uploadedDocs.push(result);
          setUploadProgress(prev => ({ ...prev, [doc.id]: 'complete' }));
          // Update document with uploaded status
          setDocuments(prev => prev.map(d =>
            d.id === doc.id ? { ...d, uploaded: true, dbId: result.id } : d
          ));
        } else {
          setUploadProgress(prev => ({ ...prev, [doc.id]: 'error' }));
        }
      }

      setUploading(false);

      if (onUploadComplete && uploadedDocs.length > 0) {
        onUploadComplete(uploadedDocs);
      }
    }
  }, [isValidFile, listingId, userId, uploadDocument, onUploadComplete]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [disabled, processFiles]);

  const handleFileSelect = useCallback((e) => {
    if (disabled) return;

    const files = Array.from(e.target.files);
    processFiles(files);
    // Reset input
    e.target.value = '';
  }, [disabled, processFiles]);

  const removeDocument = useCallback(async (id) => {
    if (disabled) return;

    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    // Revoke preview URL if exists
    if (doc.preview && !doc.preview.startsWith("http")) {
      URL.revokeObjectURL(doc.preview);
    }

    // If uploaded, delete from Supabase
    if (doc.dbId && listingId && userId) {
      const supabase = getSupabaseClient();
      await supabase.from('documents').delete().eq('id', doc.dbId);
    }

    setDocuments(prev => prev.filter(d => d.id !== id));
  }, [disabled, documents, listingId, userId]);

  /**
   * Get icon for file type
   */
  const FileIcon = ({ type, className }) => {
    if (type === 'image') {
      return <Image className={className} />;
    }
    return <FileText className={className} />;
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Hero Drop Zone - Large (Only when no documents) */}
      {documents.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-2xl py-10 px-8
            transition-all duration-200 ease-in-out
            ${isDragging
              ? "border-violet-500 bg-violet-50 scale-[1.01]"
              : "border-slate-300 hover:border-violet-400 hover:bg-violet-50/30"
            }
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <input
            type="file"
            multiple
            accept={ACCEPT_STRING}
            onChange={handleFileSelect}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="flex flex-col items-center justify-center gap-4 text-center">
            {/* Large Icon Circle */}
            <div className={`
              p-4 rounded-full transition-colors
              ${isDragging ? "bg-violet-100" : "bg-violet-50"}
            `}>
              <UploadCloud className={`w-12 h-12 ${isDragging ? "text-violet-600" : "text-violet-500"}`} />
            </div>

            {/* Headline */}
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-2">
                {isDragging ? "Drop documents here" : "Upload Documents"}
              </h3>
              <p className="text-base text-slate-600 mb-1">
                Drag & drop photos and documents
              </p>
              <p className="text-sm text-slate-400">
                PDF, DOC, TXT, JPG, PNG up to 10MB each
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compact Upload Bar (When documents exist) */}
      {documents.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl px-4 h-14
            flex items-center justify-between gap-3
            transition-all duration-200 ease-in-out
            ${isDragging
              ? "border-violet-500 bg-violet-50"
              : "border-slate-300 bg-violet-50/40 hover:bg-violet-50 hover:border-violet-400"
            }
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <input
            type="file"
            multiple
            accept={ACCEPT_STRING}
            onChange={handleFileSelect}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          {/* Left Side: Icon + Text */}
          <div className="flex items-center gap-2 pointer-events-none">
            <UploadCloud className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-slate-700">
              {isDragging ? "Drop to add more" : "Add more documents"}
            </span>
          </div>

          {/* Right Side: Count Badge */}
          <div className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium pointer-events-none">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg group hover:border-slate-300 transition-colors"
            >
              {/* File Icon */}
              <div className={`
                p-2 rounded-lg
                ${doc.type === 'image' ? 'bg-blue-50' : 'bg-violet-50'}
              `}>
                <FileIcon
                  type={doc.type}
                  className={`w-5 h-5 ${doc.type === 'image' ? 'text-blue-500' : 'text-violet-500'}`}
                />
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-slate-400">
                  {formatSize(doc.size)}
                </p>
              </div>

              {/* Upload Status */}
              {uploadProgress[doc.id] === 'uploading' && (
                <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
              )}
              {uploadProgress[doc.id] === 'complete' && (
                <span className="text-xs text-green-600 font-medium">Uploaded</span>
              )}
              {uploadProgress[doc.id] === 'error' && (
                <span className="text-xs text-red-500 font-medium">Failed</span>
              )}

              {/* Remove Button */}
              {!disabled && (
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading documents...
        </p>
      )}
    </div>
  );
});

DocumentUploader.displayName = "DocumentUploader";

export default DocumentUploader;
