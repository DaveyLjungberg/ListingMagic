/**
 * Smart Photo Selector for MLS Extraction
 * Analyzes all uploaded photos and selects the most relevant ones
 */

import { PhotoData } from "@/types/api";

interface PhotoAnalysis {
  index: number;
  room_type: "bedroom" | "bathroom" | "kitchen" | "living_room" | "dining_room" | "exterior" | "other";
  quality_score: number; // 1-10
  contains_key_features: boolean;
  description: string;
}

interface SelectionResult {
  selected: PhotoData[];
  analysis: PhotoAnalysis[];
  selectionReason: string;
}

/**
 * Smart selector that picks the best photos for MLS extraction
 * Uses GPT-4 Vision to analyze all photos and select diverse, high-quality ones
 */
export async function selectBestPhotosForMLS(
  photos: PhotoData[],
  targetCount: number = 12
): Promise<SelectionResult> {

  // If we have fewer photos than target, use all
  if (photos.length <= targetCount) {
    return {
      selected: photos,
      analysis: [],
      selectionReason: `Using all ${photos.length} photos (target: ${targetCount})`
    };
  }

  console.log(`Analyzing ${photos.length} photos to select best ${targetCount}...`);

  // Step 1: Create tiny thumbnails for batch analysis (50KB each)
  const thumbnails = await Promise.all(
    photos.map(async (photo, index) => ({
      index,
      data: await compressForAnalysis(photo.preview)
    }))
  );

  // Step 2: Analyze all photos in one GPT-4 Vision call
  const analysis = await analyzePhotosWithGPT(thumbnails);

  // Step 3: Smart selection algorithm
  const selected = selectDiversePhotos(photos, analysis, targetCount);

  return {
    selected,
    analysis,
    selectionReason: `Selected ${selected.length} photos from ${photos.length} based on room diversity and quality`
  };
}

/**
 * Compress photo to tiny thumbnail for analysis (reduces API costs)
 */
async function compressForAnalysis(previewUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 128; // Extra tiny to stay under token limits

      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = () => {
      // Return empty string on error
      resolve("");
    };
    img.src = previewUrl;
  });
}

/**
 * Analyze all photos using GPT-4 Vision
 */
async function analyzePhotosWithGPT(
  thumbnails: Array<{ index: number; data: string }>
): Promise<PhotoAnalysis[]> {

  // Filter out empty thumbnails
  const validThumbnails = thumbnails.filter(t => t.data);

  const prompt = `Analyze these ${validThumbnails.length} property photos. For each photo, identify:

1. Room type: bedroom, bathroom, kitchen, living_room, dining_room, exterior, or other
2. Quality score (1-10): Clarity, lighting, composition
3. Key features visible: Yes/No (appliances, fixtures, architectural details)
4. Brief description (5-10 words)

Return ONLY valid JSON array (no markdown):
[
  {
    "index": 0,
    "room_type": "bedroom",
    "quality_score": 8,
    "contains_key_features": true,
    "description": "Master bedroom with large windows"
  },
  ...
]

Focus on diversity - we want to represent all room types.`;

  try {
    const response = await fetch("/api/analyze-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thumbnails: validThumbnails.map(t => t.data),
        prompt
      })
    });

    if (!response.ok) {
      throw new Error("Photo analysis failed");
    }

    const data = await response.json();

    // Map analysis indices back to original photo indices
    return data.analysis.map((item: PhotoAnalysis, idx: number) => ({
      ...item,
      index: validThumbnails[idx]?.index ?? idx
    }));

  } catch (error) {
    console.error("Photo analysis error:", error);

    // Fallback: Simple heuristic selection
    return thumbnails.map(t => ({
      index: t.index,
      room_type: "other" as const,
      quality_score: 5,
      contains_key_features: false,
      description: "Photo " + (t.index + 1)
    }));
  }
}

/**
 * Select diverse set of photos based on analysis
 */
function selectDiversePhotos(
  photos: PhotoData[],
  analysis: PhotoAnalysis[],
  targetCount: number
): PhotoData[] {

  // Room type priorities and quotas
  const quotas = {
    bedroom: { target: 3, selected: [] as number[] },
    bathroom: { target: 2, selected: [] as number[] },
    kitchen: { target: 2, selected: [] as number[] },
    living_room: { target: 2, selected: [] as number[] },
    exterior: { target: 2, selected: [] as number[] },
    dining_room: { target: 1, selected: [] as number[] },
    other: { target: 0, selected: [] as number[] }
  };

  // Phase 1: Fill quotas with highest quality photos
  for (const [roomType, quota] of Object.entries(quotas)) {
    const roomPhotos = analysis
      .filter(a => a.room_type === roomType)
      .sort((a, b) => b.quality_score - a.quality_score);

    for (let i = 0; i < Math.min(quota.target, roomPhotos.length); i++) {
      quota.selected.push(roomPhotos[i].index);
    }
  }

  // Get all selected indices
  const selectedIndices = new Set<number>();
  Object.values(quotas).forEach(q => {
    q.selected.forEach(idx => selectedIndices.add(idx));
  });

  // Phase 2: Fill remaining slots with highest quality unselected photos
  const remaining = targetCount - selectedIndices.size;
  if (remaining > 0) {
    const unselected = analysis
      .filter(a => !selectedIndices.has(a.index))
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, remaining);

    unselected.forEach(a => selectedIndices.add(a.index));
  }

  // Convert indices to photos
  const selected = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map(idx => photos[idx])
    .filter(Boolean); // Filter out undefined

  console.log("Selection summary:", {
    total: photos.length,
    selected: selected.length,
    byType: Object.fromEntries(
      Object.entries(quotas).map(([type, q]) => [type, q.selected.length])
    )
  });

  return selected;
}
