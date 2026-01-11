"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Plus } from "lucide-react";

/**
 * ContextSwitcher - Dropdown to switch between Generic and buyer-specific contexts
 * Shows document counts and expandable document list
 */
export default function ContextSwitcher({
  currentContext,
  setCurrentContext,
  buyers,
  setBuyers,
  genericDocuments = [],
  onAddBuyer,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showGenericDocs, setShowGenericDocs] = useState(false);
  const dropdownRef = useRef(null);

  // Get current buyer's documents
  const currentBuyer = buyers.find((b) => b.name === currentContext);
  const buyerDocuments = currentBuyer?.documents || [];

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

  // Select a context
  const selectContext = (context) => {
    setCurrentContext(context);
    setIsOpen(false);
  };

  // Remove a buyer with confirmation
  const removeBuyer = (e, buyerId) => {
    e.stopPropagation();
    const buyer = buyers.find((b) => b.id === buyerId);
    if (
      buyer &&
      confirm(
        `Remove ${buyer.name}? This will delete their associated documents.`
      )
    ) {
      setBuyers(buyers.filter((b) => b.id !== buyerId));
      // If we're removing the currently selected buyer, switch to Generic
      if (currentContext === buyer.name) {
        setCurrentContext("Generic");
      }
    }
  };

  return (
    <div className="space-y-1">
      {/* Row 1: Dropdown + Generic doc count */}
      <div className="flex items-center gap-4">
        {/* Context Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {currentContext}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {/* Generic Option */}
              <button
                onClick={() => selectContext("Generic")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                  currentContext === "Generic"
                    ? "bg-slate-100 font-medium"
                    : ""
                }`}
              >
                Generic
              </button>

              {/* Divider */}
              <div className="border-t border-slate-100" />

              {/* Add Buyer Option */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddBuyer();
                }}
                className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Buyer
              </button>

              {/* Buyer List */}
              {buyers.length > 0 && (
                <>
                  <div className="border-t border-slate-100" />
                  {buyers.map((buyer) => (
                    <div
                      key={buyer.id}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors ${
                        currentContext === buyer.name ? "bg-slate-100" : ""
                      }`}
                    >
                      <button
                        onClick={() => selectContext(buyer.name)}
                        className="flex-1 text-left text-sm"
                      >
                        {buyer.name}
                      </button>
                      <button
                        onClick={(e) => removeBuyer(e, buyer.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={`Remove ${buyer.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Generic Documents Count (clickable to expand) */}
        <button
          onClick={() => setShowGenericDocs(!showGenericDocs)}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          {genericDocuments.length} generic documents uploaded
        </button>
      </div>

      {/* Row 2: Buyer doc count (only when buyer selected) */}
      {currentContext !== "Generic" && (
        <div className="pl-4">
          <span className="text-sm text-slate-500">
            {buyerDocuments.length} documents related to {currentContext}{" "}
            uploaded
          </span>
        </div>
      )}

      {/* Expanded Generic Document List */}
      {showGenericDocs && genericDocuments.length > 0 && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
            {genericDocuments.map((doc, i) => (
              <li key={i} className="truncate">
                {doc.name}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Empty state for generic docs */}
      {showGenericDocs && genericDocuments.length === 0 && (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-400 italic">
            No generic documents uploaded yet
          </p>
        </div>
      )}
    </div>
  );
}
