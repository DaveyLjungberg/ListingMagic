"use client";

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";

const PhotoUploader = forwardRef(({ onPhotosChange, disabled = false }, ref) => {
  const [photos, setPhotos] = useState([]);
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
      setPhotos([]);
    },
    setPhotos: (newPhotos) => setPhotos(newPhotos),
    // Load photos from URLs (for loading saved listings)
    setPhotosFromUrls: (urls) => {
      if (!urls || urls.length === 0) {
        setPhotos([]);
        return;
      }
      const photoObjects = urls.map((url, index) => ({
        id: `loaded-${Date.now()}-${index}`,
        name: `Photo ${index + 1}`,
        preview: url,
        file: null,
      }));
      setPhotos(photoObjects);
    }
  }));

  // Notify parent of photo changes
  useEffect(() => {
    if (onPhotosChange) {
      onPhotosChange(photos);
    }
  }, [photos, onPhotosChange]);

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

    setPhotos(prev => [...prev, ...newPhotos]);
  }, [disabled]);

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

    setPhotos(prev => [...prev, ...newPhotos]);
  }, [disabled]);

  const removePhoto = useCallback((id) => {
    if (disabled) return;

    setPhotos(prev => {
      // Find photo by id property or by index for URL strings
      const photoIndex = prev.findIndex((p, idx) => {
        if (typeof p === 'string') {
          return `url-${idx}` === id;
        }
        return p.id === id;
      });

      if (photoIndex === -1) return prev;

      const photo = prev[photoIndex];
      // Only revoke blob URLs, not external URLs
      if (typeof photo !== 'string' && photo?.preview && !photo.preview.startsWith("http")) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter((_, idx) => idx !== photoIndex);
    });
  }, [disabled]);

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <label className="block text-sm font-medium text-base-content/70 mb-2">
        Property Photos
      </label>

      {/* Drop Zone - Compact */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-4
          transition-all duration-200 ease-in-out
          ${isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-base-300 hover:border-primary/50 hover:bg-base-200/50"
          }
          ${disabled ? 'cursor-not-allowed' : ''}
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

        <div className="flex items-center justify-center gap-3">
          <div className={`
            p-2 rounded-full transition-colors
            ${isDragging ? "bg-primary/10" : "bg-base-200"}
          `}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={`w-5 h-5 ${isDragging ? "text-primary" : "text-base-content/50"}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>

          <div className="text-left">
            <p className="text-sm font-medium text-base-content">
              {isDragging ? "Drop photos here" : "Drag & drop photos"}
              <span className="text-base-content/50 font-normal"> or click to browse</span>
            </p>
            <p className="text-xs text-base-content/40">
              PNG, JPG, WEBP up to 10MB each
            </p>
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
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
                className="relative group aspect-square rounded-lg overflow-hidden bg-base-200"
              >
                <img
                  src={thumbnailSrc}
                  alt={photoName}
                  className="w-full h-full object-cover"
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
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => removePhoto(photoId)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4 text-error"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {photos.length > 0 && (
        <p className="text-xs text-base-content/50 text-center">
          {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
        </p>
      )}
    </div>
  );
});

PhotoUploader.displayName = "PhotoUploader";

export default PhotoUploader;
