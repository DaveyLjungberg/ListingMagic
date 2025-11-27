"use client";

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";

const PhotoUploader = forwardRef(({ onPhotosChange, disabled = false }, ref) => {
  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getPhotos: () => photos,
    clearPhotos: () => {
      photos.forEach(photo => URL.revokeObjectURL(photo.preview));
      setPhotos([]);
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
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== id);
    });
  }, [disabled]);

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <label className="block text-sm font-medium text-base-content/70 mb-2">
        Property Photos
      </label>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8
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

        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className={`
            p-3 rounded-full transition-colors
            ${isDragging ? "bg-primary/10" : "bg-base-200"}
          `}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={`w-8 h-8 ${isDragging ? "text-primary" : "text-base-content/50"}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>

          <div>
            <p className="font-medium text-base-content">
              {isDragging ? "Drop photos here" : "Drag & drop photos"}
            </p>
            <p className="text-sm text-base-content/50 mt-1">
              or click to browse
            </p>
          </div>

          <p className="text-xs text-base-content/40">
            PNG, JPG, WEBP up to 10MB each
          </p>
        </div>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-base-200"
            >
              <img
                src={photo.preview}
                alt={photo.name}
                className="w-full h-full object-cover"
              />

              {/* Overlay on hover */}
              {!disabled && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removePhoto(photo.id)}
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
          ))}
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
