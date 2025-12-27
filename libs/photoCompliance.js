/**
 * Photo Compliance Scanner
 * Scans photos for MLS compliance violations using client-side OCR and face detection
 * 
 * ⚠️ WARNING: This module is NOT safe for client-side bundles!
 * It imports face-api.js and @tensorflow/tfjs-core which attempt to resolve Node.js 'fs' module,
 * causing browser bundle errors. This should be:
 * - Moved to a server-side API route, OR
 * - Refactored to use a browser-compatible ML library, OR
 * - Lazy-loaded with proper error handling for missing Node modules
 * 
 * Currently disabled in production to prevent bundle errors.
 * See: app/dashboard/generate/hooks/useDescriptionsState.js
 */

import Tesseract from 'tesseract.js';

// Patterns to detect
const PHONE_REGEX = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g;
const URL_REGEX = /https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.co\b/gi;
const FOR_SALE_REGEX = /for\s*sale|fsbo|open\s*house/gi;
const BRAND_NAMES = [
  "century 21",
  "re/max",
  "remax",
  "coldwell banker",
  "keller williams",
  "berkshire hathaway",
  "sotheby",
  "compass",
  "redfin",
  "zillow",
  "realtor",
  "exp realty",
  "better homes",
  "weichert",
  "howard hanna",
];

// Face detection state
let faceApiLoaded = false;
let faceApiLoading = false;
let faceDetectionNet = null;

/**
 * Load face-api.js models (lazy load)
 */
async function loadFaceApi() {
  if (faceApiLoaded) return true;
  if (faceApiLoading) {
    // Wait for loading to complete
    while (faceApiLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return faceApiLoaded;
  }

  faceApiLoading = true;

  try {
    // Dynamic import to avoid SSR issues
    const faceapi = await import('face-api.js');

    // Load the tiny face detector model from CDN
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    faceDetectionNet = faceapi;
    faceApiLoaded = true;
    console.log('[PhotoCompliance] Face detection model loaded');
    return true;
  } catch (error) {
    console.error('[PhotoCompliance] Failed to load face detection model:', error);
    faceApiLoaded = false;
    return false;
  } finally {
    faceApiLoading = false;
  }
}

/**
 * Convert File to Image element
 */
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;

    if (file instanceof File) {
      img.src = URL.createObjectURL(file);
    } else if (typeof file === 'string') {
      img.src = file;
    } else if (file?.preview) {
      img.src = file.preview;
    } else {
      reject(new Error('Invalid file format'));
    }
  });
}

/**
 * Scan a single photo for text violations using OCR
 */
async function scanTextViolations(photo, photoIndex) {
  const issues = [];

  try {
    console.log(`[PhotoCompliance] Scanning photo ${photoIndex + 1} for text...`);

    // Get image source
    let imageSrc;
    if (photo instanceof File) {
      imageSrc = photo;
    } else if (typeof photo === 'string') {
      imageSrc = photo;
    } else if (photo?.file instanceof File) {
      imageSrc = photo.file;
    } else if (photo?.preview) {
      imageSrc = photo.preview;
    } else {
      console.warn(`[PhotoCompliance] Skipping photo ${photoIndex + 1} - invalid format`);
      return issues;
    }

    // Run OCR with fast settings
    const result = await Tesseract.recognize(imageSrc, 'eng', {
      logger: () => {}, // Silent logging
    });

    const text = result.data.text.toLowerCase();
    console.log(`[PhotoCompliance] Photo ${photoIndex + 1} text extracted: ${text.substring(0, 100)}...`);

    // Check for phone numbers
    if (PHONE_REGEX.test(text)) {
      issues.push('Phone number detected');
      PHONE_REGEX.lastIndex = 0; // Reset regex
    }

    // Check for URLs
    if (URL_REGEX.test(text)) {
      issues.push('Website/URL detected');
      URL_REGEX.lastIndex = 0; // Reset regex
    }

    // Check for "For Sale" text
    if (FOR_SALE_REGEX.test(text)) {
      issues.push('"For Sale" sign detected');
      FOR_SALE_REGEX.lastIndex = 0; // Reset regex
    }

    // Check for brand names
    for (const brand of BRAND_NAMES) {
      if (text.includes(brand)) {
        issues.push(`Brand name detected: ${brand}`);
        break; // Only report one brand
      }
    }

  } catch (error) {
    console.error(`[PhotoCompliance] OCR error on photo ${photoIndex + 1}:`, error.message);
    // Skip this photo and continue
  }

  return issues;
}

/**
 * Scan a single photo for faces
 */
async function scanForFaces(photo, photoIndex) {
  const issues = [];

  try {
    // Load face-api if not already loaded
    const loaded = await loadFaceApi();
    if (!loaded || !faceDetectionNet) {
      console.warn('[PhotoCompliance] Face detection not available, skipping...');
      return issues;
    }

    console.log(`[PhotoCompliance] Scanning photo ${photoIndex + 1} for faces...`);

    // Convert to image element
    const img = await fileToImage(photo);

    // Detect faces with tiny model for speed
    const detections = await faceDetectionNet.detectAllFaces(
      img,
      new faceDetectionNet.TinyFaceDetectorOptions({
        inputSize: 320, // Smaller for speed
        scoreThreshold: 0.5,
      })
    );

    // Clean up object URL if we created one
    if (photo instanceof File) {
      URL.revokeObjectURL(img.src);
    }

    if (detections.length > 0) {
      issues.push(`${detections.length} face${detections.length > 1 ? 's' : ''} detected`);
      console.log(`[PhotoCompliance] Photo ${photoIndex + 1}: ${detections.length} face(s) found`);
    }

  } catch (error) {
    console.error(`[PhotoCompliance] Face detection error on photo ${photoIndex + 1}:`, error.message);
    // Skip this photo and continue
  }

  return issues;
}

/**
 * Main function: Scan all photos for compliance violations
 * @param {(File|string|{file?: File, preview?: string})[]} photos - Array of photos to scan
 * @param {Object} options - Scanning options
 * @param {boolean} options.skipOCR - Skip text detection (faster)
 * @param {boolean} options.skipFaces - Skip face detection (faster)
 * @param {Function} options.onProgress - Progress callback (photoIndex, totalPhotos)
 * @returns {Promise<ComplianceReport>}
 */
export async function scanPhotoCompliance(photos, options = {}) {
  const { skipOCR = false, skipFaces = false, onProgress } = options;

  console.log(`[PhotoCompliance] Starting scan of ${photos.length} photos...`);
  console.log(`[PhotoCompliance] Options: OCR=${!skipOCR}, Faces=${!skipFaces}`);

  const violations = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoName = photo?.name || photo?.file?.name || `Photo ${i + 1}`;
    const issues = [];

    // Report progress
    if (onProgress) {
      onProgress(i, photos.length);
    }

    // Scan for text violations
    if (!skipOCR) {
      const textIssues = await scanTextViolations(photo, i);
      issues.push(...textIssues);
    }

    // Scan for faces
    if (!skipFaces) {
      const faceIssues = await scanForFaces(photo, i);
      issues.push(...faceIssues);
    }

    // Record violations if any
    if (issues.length > 0) {
      violations.push({
        photoIndex: i,
        photoName,
        issues,
      });
    }
  }

  const report = {
    totalPhotos: photos.length,
    violations,
    compliantPhotos: photos.length - violations.length,
    hasViolations: violations.length > 0,
  };

  console.log('[PhotoCompliance] Scan complete:', report);
  return report;
}

/**
 * Quick scan - only checks first N photos and uses faster settings
 * Good for real-time validation as user uploads
 */
export async function quickScanPhoto(photo, photoIndex = 0) {
  console.log(`[PhotoCompliance] Quick scan of photo ${photoIndex + 1}...`);

  const issues = [];

  // Run OCR and face detection in parallel for speed
  const [textIssues, faceIssues] = await Promise.all([
    scanTextViolations(photo, photoIndex),
    scanForFaces(photo, photoIndex),
  ]);

  issues.push(...textIssues, ...faceIssues);

  return {
    photoIndex,
    photoName: photo?.name || photo?.file?.name || `Photo ${photoIndex + 1}`,
    issues,
    hasViolations: issues.length > 0,
  };
}

/**
 * Preload face detection model (call early to avoid delay on first scan)
 */
export async function preloadFaceDetection() {
  console.log('[PhotoCompliance] Preloading face detection model...');
  return loadFaceApi();
}

export default {
  scanPhotoCompliance,
  quickScanPhoto,
  preloadFaceDetection,
};
