"use client";

import { useState, useEffect, useRef } from "react";
import { getListings } from "@/libs/listings";

/**
 * ListingLoader - Dropdown to load previous listings
 * @param {Object} props
 * @param {string} props.listingType - 'descriptions' or 'mls_data'
 * @param {string} props.userId - Current user ID
 * @param {Function} props.onSelectListing - Callback when a listing is selected
 * @param {boolean} props.disabled - Whether the dropdown is disabled
 */
export default function ListingLoader({ listingType, userId, onSelectListing, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const dropdownRef = useRef(null);

  // Reset loaded state when listingType changes (e.g., switching tabs)
  useEffect(() => {
    setHasLoaded(false);
    setListings([]);
  }, [listingType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load listings when dropdown opens
  const handleOpen = async () => {
    if (!userId) {
      setIsOpen(true);
      return;
    }

    setIsOpen(true);

    // Only fetch if we haven't loaded yet or want to refresh
    if (!hasLoaded) {
      setIsLoading(true);
      try {
        console.log(`[ListingLoader] Fetching listings with type: ${listingType}, userId: ${userId}`);
        const result = await getListings({
          listing_type: listingType,
          user_id: userId,
          limit: 20,
        });

        if (result.success) {
          console.log(`[ListingLoader] Got ${result.data.length} listings for type: ${listingType}`);
          setListings(result.data);
        }
        setHasLoaded(true);
      } catch (error) {
        console.error("Error loading listings:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format address for display
  const formatAddress = (listing) => {
    if (listing.address_json) {
      const { street, city, state } = listing.address_json;
      if (city && state) {
        return `${street}, ${city} ${state}`;
      }
      return street;
    }
    // Fallback to property_address
    return listing.property_address || "Untitled Listing";
  };

  // Handle selecting a listing
  const handleSelect = (listing) => {
    setIsOpen(false);
    if (onSelectListing) {
      onSelectListing(listing);
    }
  };

  // Refresh listings
  const handleRefresh = async (e) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const result = await getListings({
        listing_type: listingType,
        user_id: userId,
        limit: 20,
      });

      if (result.success) {
        setListings(result.data);
      }
    } catch (error) {
      console.error("Error refreshing listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-base-content"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Load Previous Listing
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-base-100 border border-base-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-base-200 bg-base-200/30">
            <span className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
              Recent Listings
            </span>
            {userId && hasLoaded && (
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="btn btn-ghost btn-xs gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Refresh
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            {!userId ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-base-content/60">
                  Please log in to view your listings
                </p>
              </div>
            ) : isLoading ? (
              <div className="px-4 py-6 text-center">
                <span className="loading loading-spinner loading-sm text-primary"></span>
                <p className="text-sm text-base-content/60 mt-2">Loading...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 mx-auto text-base-content/30 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm text-base-content/60">
                  No previous listings yet
                </p>
              </div>
            ) : (
              <ul className="py-1">
                {listings.map((listing) => (
                  <li key={listing.id}>
                    <button
                      onClick={() => handleSelect(listing)}
                      className="w-full px-3 py-2 text-left hover:bg-base-200/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-base-content truncate">
                        {formatAddress(listing)}
                      </p>
                      <p className="text-xs text-base-content/50 mt-0.5">
                        {formatDate(listing.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
