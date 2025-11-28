/**
 * Save a listing to the database via API
 *
 * @param {Object} listingData - The listing data to save
 * @param {string} listingData.listing_type - Type: 'descriptions' or 'mls_data'
 * @param {string} listingData.property_address - Full property address
 * @param {Object} listingData.address_json - Structured address {street, city, state, zip_code}
 * @param {string} listingData.property_type - Type of property (single_family, condo, etc.)
 * @param {number} listingData.bedrooms - Number of bedrooms
 * @param {number} listingData.bathrooms - Number of bathrooms
 * @param {string} listingData.public_remarks - Generated listing description
 * @param {string} listingData.walkthru_script - Generated video script
 * @param {string} listingData.features - Generated features (JSON string or text)
 * @param {Object} listingData.mls_data - MLS extraction data (for mls_data type)
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
 * Get listings via API with optional filtering
 * @param {Object} options - Filter options
 * @param {string} options.listing_type - Filter by 'descriptions' or 'mls_data'
 * @param {string} options.user_id - Filter by user ID
 * @param {number} options.limit - Max number of results (default 20)
 */
export async function getListings(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.listing_type) params.set("listing_type", options.listing_type);
    if (options.user_id) params.set("user_id", options.user_id);
    if (options.limit) params.set("limit", options.limit.toString());

    const url = `/api/listings${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url);
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
