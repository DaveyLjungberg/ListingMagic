"use client";

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Camera, X, UploadCloud } from "lucide-react";

const PhotoUploader = forwardRef(({ onPhotosChange, disabled = false, photos = [] }, ref) => {
  const [isDragging, setIsDragging] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getPhotos: () => photos,
    clearPhotos: () => {
      photos.forEach(photo => {
        // Only revoke blob URLs for object-type photos
        if (typeof photo !== 'string' && photo?.preview && !photo.preview.startsWith("http")) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      if (onPhotosChange) onPhotosChange([]);
    },
    setPhotos: (newPhotos) => {
      if (onPhotosChange) onPhotosChange(newPhotos);
    },
    // Load photos from URLs (for loading saved listings)
    setPhotosFromUrls: (urls) => {
      if (!urls || urls.length === 0) {
        if (onPhotosChange) onPhotosChange([]);
        return;
      }
      const photoObjects = urls.map((url, index) => ({
        id: `loaded-${Date.now()}-${index}`,
        name: `Photo ${index + 1}`,
        preview: url,
        file: null,
      }));
      if (onPhotosChange) onPhotosChange(photoObjects);
    }
  }));

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

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith("image/")
    );

    const newPhotos = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));

    if (onPhotosChange) {
      onPhotosChange([...photos, ...newPhotos]);
    }
  }, [disabled, photos, onPhotosChange]);

  const handleFileSelect = useCallback((e) => {
    if (disabled) return;

    const files = Array.from(e.target.files).filter(file =>
      file.type.startsWith("image/")
    );

    const newPhotos = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));

    if (onPhotosChange) {
      onPhotosChange([...photos, ...newPhotos]);
    }
  }, [disabled, photos, onPhotosChange]);

  const removePhoto = useCallback((id) => {
    if (disabled) return;

    // Find photo by id property or by index for URL strings
    const photoIndex = photos.findIndex((p, idx) => {
      if (typeof p === 'string') {
        return `url-${idx}` === id;
      }
      return p.id === id;
    });

    if (photoIndex === -1) return;

    const photo = photos[photoIndex];
    // Only revoke blob URLs, not external URLs
    if (typeof photo !== 'string' && photo?.preview && !photo.preview.startsWith("http")) {
      URL.revokeObjectURL(photo.preview);
    }

    const newPhotos = photos.filter((_, idx) => idx !== photoIndex);
    if (onPhotosChange) {
      onPhotosChange(newPhotos);
    }
  }, [disabled, photos, onPhotosChange]);

  return (
    <div className={`space-y-6 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <label className="text-sm font-semibold text-primary-navy mb-2 flex items-center gap-1.5">
        <Camera className="w-4 h-4" />
        Property Photos
      </label>

      {/* Hero Drop Zone - Large, Centered Card (Only when no photos) */}
      {photos.length === 0 && (
        <div className="max-w-4xl mx-auto">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl py-10 px-8
              transition-all duration-200 ease-in-out
              ${isDragging
                ? "border-indigo-500 bg-indigo-50 scale-[1.01]"
                : "border-base-300 hover:border-indigo-400 hover:bg-indigo-50/30"
              }
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={disabled}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />

            <div className="flex flex-col items-center justify-center gap-4 text-center">
              {/* Large Icon Circle */}
              <div className={`
                p-4 rounded-full transition-colors
                ${isDragging ? "bg-indigo-100" : "bg-indigo-50"}
              `}>
                <UploadCloud className={`w-12 h-12 ${isDragging ? "text-indigo-600" : "text-indigo-500"}`} />
              </div>

              {/* Headline */}
              <div>
                <h3 className="text-2xl font-serif font-semibold text-primary-navy mb-2">
                  {isDragging ? "Drop photos here" : "Upload Property Photos"}
                </h3>
                <p className="text-base text-primary-muted mb-1">
                  Drag & drop 20-30 photos. We'll analyze lighting and features instantly.
                </p>
                <p className="text-sm text-base-content/50">
                  PNG, JPG, WEBP up to 10MB each • Click anywhere to browse
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Upload Bar (When photos exist) */}
      {photos.length > 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl px-4 h-16 
            flex items-center justify-between gap-3
            transition-all duration-200 ease-in-out
            ${isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-base-300 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-400"
            }
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          {/* Left Side: Icon + Text */}
          <div className="flex items-center gap-2 pointer-events-none">
            <UploadCloud className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-medium text-primary-navy">
              {isDragging ? "Drop to add more" : "Add more photos"}
            </span>
          </div>

          {/* Right Side: Count Badge */}
          <div className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium pointer-events-none">
            {photos.length} uploaded
          </div>
        </div>
      )}

      {/* Photo Grid with Scrollable Container */}
      {photos.length > 0 && (
        <div className="space-y-2">
          {/* Photo Count Header - Always Visible */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-slate-600">
              {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
            </p>
            <p className="text-xs text-slate-400">
              Scroll to view all
            </p>
          </div>
          
          {/* Scrollable Photo Grid */}
          <div className="max-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent hover:scrollbar-thumb-slate-400">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((photo, index) => {
                // Determine the image source based on photo type
                let thumbnailSrc;
                let photoId;
                let photoName;

                if (typeof photo === 'string') {
                  // Direct URL string
                  thumbnailSrc = photo;
                  photoId = `url-${index}`;
                  photoName = `Photo ${index + 1}`;
                } else if (photo?.preview) {
                  // Object with preview property
                  thumbnailSrc = photo.preview;
                  photoId = photo.id || `photo-${index}`;
                  photoName = photo.name || `Photo ${index + 1}`;
                } else if (photo?.url) {
                  // Object with url property
                  thumbnailSrc = photo.url;
                  photoId = photo.id || `photo-${index}`;
                  photoName = photo.name || `Photo ${index + 1}`;
                } else {
                  // Unknown format, skip
                  console.error('Unknown photo format:', photo);
                  return null;
                }

                return (
                  <div
                    key={photoId}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-base-200 animate-fade-in card-hover"
                  >
                    <img
                      src={thumbnailSrc}
                      alt={photoName}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        console.error('Failed to load image:', thumbnailSrc);
                        // Show a placeholder on error
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center bg-base-300 text-base-content/50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                          </div>
                        `;
                      }}
                    />

                    {/* Overlay on hover */}
                    {!disabled && (
                      <div className="absolute inset-0 bg-primary-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => removePhoto(photoId)}
                          className="p-2 bg-white rounded-full hover:bg-red-50 transition-all duration-150 hover:scale-110 active:scale-95"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PhotoUploader.displayName = "PhotoUploader";

export default PhotoUploader;
