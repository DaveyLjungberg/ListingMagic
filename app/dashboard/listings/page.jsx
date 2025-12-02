"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getListings } from "@/libs/listings";

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        // Use summary mode for optimized column selection
        const result = await getListings({
          limit: 50,
          summary: true,
        });

        if (!result.success) {
          if (result.error?.includes("Unauthorized")) {
            setError("Please log in to view your listings");
          } else {
            throw new Error(result.error);
          }
          return;
        }

        setListings(result.data || []);
      } catch (err) {
        console.error("Error fetching listings:", err);
        setError(err.message || "Failed to load listings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const truncateText = (text, maxLength = 150) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const handleViewDetails = (id) => {
    console.log("View details for listing:", id);
    // TODO: Navigate to listing detail page
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-base-100">
        <header className="sticky top-0 z-40 bg-base-100/80 backdrop-blur-lg border-b border-base-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-semibold text-base-content">My Listings</h1>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/60 mt-4">Loading your listings...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-base-100">
        <header className="sticky top-0 z-40 bg-base-100/80 backdrop-blur-lg border-b border-base-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-semibold text-base-content">My Listings</h1>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-16 h-16 mx-auto text-error/50 mb-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-base-content mb-2">Error Loading Listings</h2>
              <p className="text-base-content/60">{error}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-base-100/80 backdrop-blur-lg border-b border-base-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-base-content">My Listings</h1>
            <Link href="/dashboard/generate" className="btn btn-primary btn-sm gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Listing
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {listings.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="w-20 h-20 text-base-content/20 mb-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            <h2 className="text-2xl font-semibold text-base-content mb-2">No saved listings yet</h2>
            <p className="text-base-content/60 mb-6 max-w-md">
              Generate your first listing to get started. Upload photos, enter an address, and let AI create compelling property descriptions.
            </p>
            <Link href="/dashboard/generate" className="btn btn-primary gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
              Generate Your First Listing
            </Link>
          </div>
        ) : (
          /* Listings Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="card-body">
                  {/* Property Address */}
                  <h2 className="card-title text-lg font-bold text-base-content line-clamp-2">
                    {listing.property_address || "Untitled Listing"}
                  </h2>

                  {/* Property Type Badge */}
                  {listing.property_type && (
                    <span className="badge badge-outline badge-sm text-xs">
                      {listing.property_type.replace(/_/g, " ")}
                    </span>
                  )}

                  {/* Public Remarks Preview */}
                  {listing.public_remarks && (
                    <p className="text-sm text-base-content/70 mt-2 line-clamp-3">
                      {truncateText(listing.public_remarks, 150)}
                    </p>
                  )}

                  {/* Property Details */}
                  <div className="flex items-center gap-4 mt-3 text-sm text-base-content/60">
                    {listing.bedrooms && (
                      <span className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                          />
                        </svg>
                        {listing.bedrooms} bed
                      </span>
                    )}
                    {listing.bathrooms && (
                      <span className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                          />
                        </svg>
                        {listing.bathrooms} bath
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="card-actions justify-between items-center mt-4 pt-4 border-t border-base-200">
                    <span className="text-xs text-base-content/50">
                      {formatDate(listing.created_at)}
                    </span>
                    <button
                      onClick={() => handleViewDetails(listing.id)}
                      className="btn btn-ghost btn-sm gap-1"
                    >
                      View Details
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
