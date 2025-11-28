/**
 * Save a listing to the database via API
 *
 * @param {Object} listingData - The listing data to save
 * @param {string} listingData.property_address - Full property address
 * @param {string} listingData.property_type - Type of property (single_family, condo, etc.)
 * @param {number} listingData.bedrooms - Number of bedrooms
 * @param {number} listingData.bathrooms - Number of bathrooms
 * @param {string} listingData.public_remarks - Generated listing description
 * @param {string} listingData.walkthru_script - Generated video script
 * @param {string} listingData.features - Generated features (JSON string or text)
 * @param {string[]} listingData.photo_urls - Array of photo URLs
 * @param {number} listingData.ai_cost - Total AI generation cost in USD
 * @param {number} listingData.generation_time - Total generation time in ms
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function saveListing(listingData) {
  try {
    const response = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(listingData),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Failed to save listing" };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error("Error saving listing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save listing",
    };
  }
}

/**
 * Get all listings via API
 */
export async function getListings() {
  try {
    const response = await fetch("/api/listings");
    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Failed to fetch listings", data: [] };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error("Error fetching listings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch listings",
      data: [],
    };
  }
}

/**
 * Get a single listing by ID via API
 */
export async function getListing(id) {
  try {
    const response = await fetch(`/api/listings/${id}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Failed to fetch listing" };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error("Error fetching listing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch listing",
    };
  }
}
