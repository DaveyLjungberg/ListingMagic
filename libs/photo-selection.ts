/**
 * Intelligent Photo Selection for Listing Magic
 *
 * Analyzes all uploaded photos and selects the best representative set
 * to ensure comprehensive property coverage while staying within AI limits.
 */

// =============================================================================
// Types
// =============================================================================

export interface PhotoCategory {
  index: number;
  url: string;
  category: string;
  subcategory?: string;
  priority: number;
}

export interface PhotoCategorizationResponse {
  success: boolean;
  categories: PhotoCategory[];
  photos_analyzed: number;
  processing_time_ms: number;
  error?: string;
}

// Room category priority for selection algorithm
const CATEGORY_PRIORITY: Record<string, number> = {
  EXTERIOR: 1,
  KITCHEN: 2,
  BATHROOM: 3,
  BEDROOM: 4,
  LIVING: 5,
  DINING: 6,
  OUTDOOR: 7,
  GARAGE: 8,
  SPECIAL: 9,
  UTILITY: 10,
  DETAIL: 11,
  UNKNOWN: 12,
};

// =============================================================================
// Photo Categorization (Backend Call)
// =============================================================================

/**
 * Send all photos to backend for AI-powered categorization
 */
export async function categorizePhotos(
  photoUrls: string[]
): Promise<PhotoCategory[]> {
  // If 20 or fewer photos, no need to categorize - use all
  if (photoUrls.length <= 20) {
    console.log(
      `[PhotoSelection] ${photoUrls.length} photos - using all (no selection needed)`
    );
    return photoUrls.map((url, index) => ({
      index,
      url,
      category: "UNKNOWN",
      priority: 3,
    }));
  }

  console.log(
    `[PhotoSelection] Categorizing ${photoUrls.length} photos for intelligent selection...`
  );

  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://listingmagic-production.up.railway.app";

    const response = await fetch(`${backendUrl}/api/categorize-photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photo_urls: photoUrls,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Photo categorization failed");
    }

    const data: PhotoCategorizationResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Photo categorization failed");
    }

    console.log(
      `[PhotoSelection] Categorization complete in ${data.processing_time_ms.toFixed(0)}ms`
    );

    // Add URLs to categories
    const categoriesWithUrls = data.categories.map((cat) => ({
      ...cat,
      url: photoUrls[cat.index],
    }));

    // Log category distribution
    const distribution = categoriesWithUrls.reduce(
      (acc, cat) => {
        acc[cat.category] = (acc[cat.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log("[PhotoSelection] Category distribution:", distribution);

    return categoriesWithUrls;
  } catch (error) {
    console.error("[PhotoSelection] Categorization failed:", error);

    // Fallback: return all photos with unknown category
    return photoUrls.map((url, index) => ({
      index,
      url,
      category: "UNKNOWN",
      priority: 3,
    }));
  }
}

// =============================================================================
// Photo Selection Algorithm
// =============================================================================

/**
 * Select the best representative photos from categorized list
 *
 * Strategy:
 * 1. Ensure at least 1 photo per category (if available)
 * 2. Fill remaining slots with highest priority photos
 * 3. Prefer diversity over quantity
 */
export function selectBestPhotos(
  categories: PhotoCategory[],
  maxPhotos: number = 20
): PhotoCategory[] {
  // If we have fewer photos than max, return all
  if (categories.length <= maxPhotos) {
    return categories;
  }

  // Group photos by category
  const grouped: Record<string, PhotoCategory[]> = {};

  categories.forEach((photo) => {
    const cat = photo.category || "UNKNOWN";
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(photo);
  });

  // Sort each category by priority (1 = highest priority)
  Object.keys(grouped).forEach((category) => {
    grouped[category].sort((a, b) => a.priority - b.priority);
  });

  const selected: PhotoCategory[] = [];
  const selectedIndices = new Set<number>();

  // STEP 1: Ensure at least 1 photo per category (if available)
  const categoryOrder = Object.keys(CATEGORY_PRIORITY).sort(
    (a, b) => CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b]
  );

  categoryOrder.forEach((category) => {
    if (
      grouped[category] &&
      grouped[category].length > 0 &&
      selected.length < maxPhotos
    ) {
      const bestPhoto = grouped[category][0];
      if (!selectedIndices.has(bestPhoto.index)) {
        selected.push(bestPhoto);
        selectedIndices.add(bestPhoto.index);
      }
    }
  });

  console.log(
    `[PhotoSelection] After category coverage: ${selected.length} photos selected`
  );

  // STEP 2: Fill remaining slots with priority photos
  // Flatten all remaining photos
  const remaining: PhotoCategory[] = [];

  Object.keys(grouped).forEach((category) => {
    grouped[category].forEach((photo) => {
      if (!selectedIndices.has(photo.index)) {
        remaining.push(photo);
      }
    });
  });

  // Sort remaining by priority, then by category importance
  remaining.sort((a, b) => {
    // First by priority (lower is better)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Then by category importance
    const aPriority = CATEGORY_PRIORITY[a.category] || 99;
    const bPriority = CATEGORY_PRIORITY[b.category] || 99;
    return aPriority - bPriority;
  });

  // Add remaining photos until we hit maxPhotos
  while (selected.length < maxPhotos && remaining.length > 0) {
    const next = remaining.shift()!;
    if (!selectedIndices.has(next.index)) {
      selected.push(next);
      selectedIndices.add(next.index);
    }
  }

  // Sort by original index to maintain photo order
  selected.sort((a, b) => a.index - b.index);

  // Log final selection
  const finalDistribution = selected.reduce(
    (acc, cat) => {
      acc[cat.category] = (acc[cat.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(
    `[PhotoSelection] Final selection: ${selected.length} photos`,
    finalDistribution
  );

  return selected;
}

// =============================================================================
// Photo Ordering for Walkthrough Videos
// =============================================================================

/**
 * Tour order priority for video walkthroughs
 */
const TOUR_ORDER: Record<string, number> = {
  EXTERIOR: 1,
  LIVING: 2,
  KITCHEN: 3,
  DINING: 4,
  SPECIAL: 5,
  BEDROOM: 6,
  BATHROOM: 7,
  UTILITY: 8,
  GARAGE: 9,
  OUTDOOR: 10,
  DETAIL: 11,
  UNKNOWN: 12,
};

/**
 * Order photos in a logical walkthrough sequence
 * Tries to categorize photos with AI, but falls back to original order on timeout/error
 * 
 * @param photoUrls - All photo URLs
 * @param timeoutMs - Timeout for categorization (default 15s)
 * @returns Photo URLs ordered for walkthrough, or original order on failure
 */
export async function orderPhotosForWalkthrough(
  photoUrls: string[],
  timeoutMs: number = 15000
): Promise<string[]> {
  // If 5 or fewer photos, no need to reorder
  if (photoUrls.length <= 5) {
    console.log(`[PhotoOrdering] ${photoUrls.length} photos - keeping original order`);
    return photoUrls;
  }

  console.log(`[PhotoOrdering] Attempting to order ${photoUrls.length} photos for walkthrough...`);

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const categories = await categorizePhotosWithTimeout(photoUrls, controller.signal);
      clearTimeout(timeoutId);

      // Sort by tour order
      const sorted = [...categories].sort((a, b) => {
        const orderA = TOUR_ORDER[a.category] || 99;
        const orderB = TOUR_ORDER[b.category] || 99;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // Within same category, sort by priority (1 = highest)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        
        // Finally, maintain original index
        return a.index - b.index;
      });

      const orderedUrls = sorted.map(cat => cat.url);
      
      console.log(`[PhotoOrdering] Successfully ordered photos for walkthrough`);
      
      return orderedUrls;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.warn(`[PhotoOrdering] Categorization timed out after ${timeoutMs}ms - using original order`);
      } else {
        console.warn(`[PhotoOrdering] Categorization failed:`, error.message, `- using original order`);
      }
      
      return photoUrls;
    }
  } catch (error) {
    console.error(`[PhotoOrdering] Unexpected error:`, error);
    return photoUrls;
  }
}

/**
 * Call categorization API with abort signal support
 */
async function categorizePhotosWithTimeout(
  photoUrls: string[],
  signal: AbortSignal
): Promise<PhotoCategory[]> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://listingmagic-production.up.railway.app";

  const response = await fetch(`${backendUrl}/api/categorize-photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photo_urls: photoUrls,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Photo categorization failed");
  }

  const data: PhotoCategorizationResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Photo categorization failed");
  }

  // Add URLs to categories
  return data.categories.map((cat) => ({
    ...cat,
    url: photoUrls[cat.index],
  }));
}

// =============================================================================
// Main Export: Intelligent Photo Selection
// =============================================================================

/**
 * Intelligently select the best photos from a set of URLs
 *
 * @param photoUrls - All photo URLs
 * @param maxPhotos - Maximum photos to select (default 20)
 * @returns Selected photo URLs in optimal order
 */
export async function selectPhotosIntelligently(
  photoUrls: string[],
  maxPhotos: number = 20
): Promise<{ selectedUrls: string[]; categories: PhotoCategory[] }> {
  // Quick return if we don't need to select
  if (photoUrls.length <= maxPhotos) {
    console.log(
      `[PhotoSelection] ${photoUrls.length} photos <= ${maxPhotos} max - using all`
    );
    return {
      selectedUrls: photoUrls,
      categories: photoUrls.map((url, index) => ({
        index,
        url,
        category: "UNKNOWN",
        priority: 3,
      })),
    };
  }

  console.log(
    `[PhotoSelection] Selecting best ${maxPhotos} from ${photoUrls.length} photos...`
  );

  // Step 1: Categorize all photos
  const categories = await categorizePhotos(photoUrls);

  // Step 2: Select best representatives
  const selectedCategories = selectBestPhotos(categories, maxPhotos);

  // Step 3: Extract URLs
  const selectedUrls = selectedCategories.map((cat) => cat.url);

  console.log(
    `[PhotoSelection] Selected ${selectedUrls.length} photos from ${photoUrls.length} total`
  );

  return {
    selectedUrls,
    categories: selectedCategories,
  };
}
