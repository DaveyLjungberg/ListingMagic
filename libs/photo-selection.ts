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
// Sampling Utilities for Fallback Categorization
// =============================================================================

/**
 * Sample k items evenly spaced across the full list length.
 * Returns indices with no duplicates.
 */
function spreadSample(items: any[], k: number): number[] {
  if (k >= items.length) {
    return items.map((_, i) => i);
  }
  if (k <= 0) {
    return [];
  }

  const indices: number[] = [];
  const step = items.length / k;
  
  for (let i = 0; i < k; i++) {
    const index = Math.floor(i * step);
    // Ensure no duplicates and within bounds
    if (index < items.length && !indices.includes(index)) {
      indices.push(index);
    }
  }
  
  return indices;
}

/**
 * Pick k items from a specific third of the array.
 * @param items - Full array
 * @param thirdIndex - 0 = first third, 1 = middle third, 2 = last third
 * @param k - Number of items to pick
 */
function pickFromThird(items: any[], thirdIndex: number, k: number): number[] {
  const thirdSize = Math.ceil(items.length / 3);
  const startIdx = thirdIndex * thirdSize;
  const endIdx = Math.min(startIdx + thirdSize, items.length);
  const thirdSlice = items.slice(startIdx, endIdx);
  
  // Apply spreadSample within the third
  const relativeIndices = spreadSample(thirdSlice, k);
  // Convert back to absolute indices
  return relativeIndices.map(i => startIdx + i);
}

/**
 * Deterministic fallback selection that preserves category representation via quotas.
 * This is used when AI categorization times out/errors/returns unusable output.
 */
function buildFallbackSelection(
  photoUrls: string[],
  maxPhotos: number
): { selected: PhotoCategory[]; distribution: Record<string, number> } {
  const all = photoUrls;
  const used = new Set<number>();
  const selected: PhotoCategory[] = [];

  const clampValid = (idx: number) => idx >= 0 && idx < all.length;

  const pickFromPool = (pool: number[], k: number, category: string, priority: number) => {
    const unique = Array.from(new Set(pool)).filter((i) => clampValid(i) && !used.has(i));
    if (unique.length === 0 || k <= 0) return;

    const positions = spreadSample(unique, Math.min(k, unique.length));
    for (const pos of positions) {
      const idx = unique[pos];
      if (idx === undefined) continue;
      if (used.has(idx)) continue;
      used.add(idx);
      selected.push({ index: idx, url: all[idx], category, priority });
    }
  };

  // Candidate pools (dedup within pool later)
  const pools = {
    EXTERIOR: [
      ...spreadSample(all, 4),
      ...pickFromThird(all, 0, 3),
      ...pickFromThird(all, 2, 3),
    ],
    LIVING: [
      ...spreadSample(all, 10),
      ...pickFromThird(all, 1, 6),
    ],
    KITCHEN: [
      ...pickFromThird(all, 1, 6),
      ...spreadSample(all, 4),
    ],
    BATHROOM: [
      ...pickFromThird(all, 1, 6),
      ...spreadSample(all, 4),
    ],
    BEDROOM: [
      ...pickFromThird(all, 1, 4),
      ...pickFromThird(all, 2, 2),
      ...spreadSample(all, 2),
    ],
    UTILITY: spreadSample(all, 4),
  };

  // Per-category quotas (sum to 20 when maxPhotos=20)
  const quotas: Array<{ category: keyof typeof pools; k: number; priority: number }> = [
    { category: "EXTERIOR", k: Math.min(4, maxPhotos), priority: 2 },
    { category: "LIVING", k: Math.min(6, maxPhotos), priority: 2 },
    { category: "KITCHEN", k: Math.min(3, maxPhotos), priority: 2 },
    { category: "BATHROOM", k: Math.min(3, maxPhotos), priority: 2 },
    { category: "BEDROOM", k: Math.min(2, maxPhotos), priority: 2 },
    { category: "UTILITY", k: Math.min(2, maxPhotos), priority: 3 },
  ];

  for (const q of quotas) {
    if (selected.length >= maxPhotos) break;
    pickFromPool(pools[q.category], Math.min(q.k, maxPhotos - selected.length), q.category, q.priority);
  }

  // Fill remaining slots with a spread across remaining photos
  if (selected.length < maxPhotos) {
    const remaining = all.map((_, i) => i).filter((i) => !used.has(i));
    const positions = spreadSample(remaining, Math.min(maxPhotos - selected.length, remaining.length));
    for (const pos of positions) {
      const idx = remaining[pos];
      if (idx === undefined) continue;
      if (used.has(idx)) continue;
      used.add(idx);
      selected.push({ index: idx, url: all[idx], category: "LIVING", priority: 3 });
    }
  }

  // Sort by original order for stable UX
  selected.sort((a, b) => a.index - b.index);

  const distribution = selected.reduce((acc, cat) => {
    acc[cat.category] = (acc[cat.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { selected, distribution };
}

/**
 * Check if categorization result is unusable (all UNKNOWN or too homogeneous).
 */
function isCategorizationUnusable(categories: PhotoCategory[]): boolean {
  const distribution = categories.reduce((acc, cat) => {
    acc[cat.category] = (acc[cat.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const uniqueCategories = Object.keys(distribution).filter(cat => cat !== 'UNKNOWN');
  const unknownCount = distribution['UNKNOWN'] || 0;
  
  // If more than 80% are UNKNOWN or only 1 category exists, it's unusable
  if (unknownCount > categories.length * 0.8) {
    return true;
  }
  
  if (uniqueCategories.length <= 1) {
    return true;
  }
  
  return false;
}

// =============================================================================
// Photo Categorization (Backend Call)
// =============================================================================

/**
 * Send all photos to backend for AI-powered categorization with timeout support.
 * @param photoUrls - All photo URLs
 * @param timeoutMs - Timeout in milliseconds (default 25s, max ~30s)
 */
export async function categorizePhotos(
  photoUrls: string[],
  timeoutMs: number = 25000
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
    `[PhotoSelection] Categorizing ${photoUrls.length} photos (timeout: ${timeoutMs}ms)...`
  );

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
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

    // Check if result is unusable
    if (isCategorizationUnusable(categoriesWithUrls)) {
      console.warn('[PhotoSelection] Categorization result unusable - using fallback');
      console.log('[PhotoSelection] Fallback reason: categorization_unusable');
      const { selected, distribution } = buildFallbackSelection(photoUrls, 20);
      (selected as any).__didFallback = true;
      (selected as any).__fallbackReason = "categorization_unusable";
      (selected as any).__fallbackDistribution = distribution;
      console.log("[PhotoSelection] Fallback selected count:", selected.length, "distribution:", distribution);
      return selected;
    }

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
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    let fallbackReason = 'categorization_error';
    
    if (error.name === 'AbortError') {
      console.warn(`[PhotoSelection] Categorization timed out after ${timeoutMs}ms - using fallback`);
      fallbackReason = 'categorization_timeout';
    } else {
      console.error("[PhotoSelection] Categorization failed:", error.message);
    }
    
    console.log(`[PhotoSelection] Fallback reason: ${fallbackReason}`);

    const { selected, distribution } = buildFallbackSelection(photoUrls, 20);
    (selected as any).__didFallback = true;
    (selected as any).__fallbackReason = fallbackReason;
    (selected as any).__fallbackDistribution = distribution;
    console.log("[PhotoSelection] Fallback selected count:", selected.length, "distribution:", distribution);
    return selected;
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
 * @throws Error if photos exist but selection produces empty list
 */
export async function selectPhotosIntelligently(
  photoUrls: string[],
  maxPhotos: number = 20
): Promise<{ selectedUrls: string[]; categories: PhotoCategory[] }> {
  // Early validation: if no photos provided, throw clear error
  if (!photoUrls || photoUrls.length === 0) {
    throw new Error("No photos available for Features generation");
  }
  
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

  // Step 1: Categorize all photos (with timeout and fallback)
  const categories = await categorizePhotos(photoUrls);

  // If categorization fell back, we already selected a quota-balanced set.
  const didFallback = Boolean((categories as any).__didFallback);
  if (didFallback) {
    const fallbackReason = (categories as any).__fallbackReason || "categorization_error";
    const dist = (categories as any).__fallbackDistribution as Record<string, number> | undefined;
    console.warn(`[PhotoSelection] Using fallback selection for Features (reason: ${fallbackReason})`);
    if (dist) {
      console.log("[PhotoSelection] Fallback selection distribution:", dist);
    }
  }

  // Step 2: Select best representatives
  // - Normal path: use AI categorization + selection algorithm
  // - Fallback path: categories already represent a quota-balanced selection
  const selectedCategories = didFallback
    ? buildFallbackSelection(photoUrls, maxPhotos).selected
    : selectBestPhotos(categories, maxPhotos);

  // Step 3: Extract URLs with deduplication
  const urlSet = new Set<string>();
  const selectedUrls: string[] = [];
  
  selectedCategories.forEach(cat => {
    if (!urlSet.has(cat.url)) {
      urlSet.add(cat.url);
      selectedUrls.push(cat.url);
    }
  });
  
  // Guardrail: ensure we have photos after selection
  if (selectedUrls.length === 0 && photoUrls.length > 0) {
    throw new Error("No photos available for Features generation (selection produced empty list)");
  }

  console.log(
    `[PhotoSelection] Selected ${selectedUrls.length} photos from ${photoUrls.length} total (deduplicated)`
  );

  return {
    selectedUrls,
    categories: selectedCategories,
  };
}
