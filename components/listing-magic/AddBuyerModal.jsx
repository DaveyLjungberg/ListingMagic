"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * AddBuyerModal - Modal for adding a new buyer to the context switcher
 */
export default function AddBuyerModal({ isOpen, onClose, onSave }) {
  const [buyerName, setBuyerName] = useState("");
  const inputRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setBuyerName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle save
  const handleSave = () => {
    if (buyerName.trim()) {
      onSave(buyerName.trim());
      setBuyerName("");
    }
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && buyerName.trim()) {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Add Buyer</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Buyer Name
          </label>
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter buyer name"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!buyerName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
