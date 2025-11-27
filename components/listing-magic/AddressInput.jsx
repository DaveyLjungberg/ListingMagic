"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";

const AddressInput = forwardRef(({ onAddressChange, disabled = false }, ref) => {
  const [address, setAddress] = useState({
    street: "",
    zip: "",
    city: "",
    state: ""
  });

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getAddress: () => ({
      street: address.street,
      zip_code: address.zip,
      city: address.city || undefined,
      state: address.state || undefined,
    }),
    isValid: () => Boolean(address.street && address.zip.length === 5),
    clearAddress: () => setAddress({ street: "", zip: "", city: "", state: "" })
  }));

  // Notify parent of address changes
  useEffect(() => {
    if (onAddressChange) {
      onAddressChange({
        street: address.street,
        zip_code: address.zip,
        city: address.city || undefined,
        state: address.state || undefined,
      });
    }
  }, [address, onAddressChange]);

  // Placeholder for auto-populate functionality
  // In the future, this will call an API to get city/state from ZIP
  useEffect(() => {
    if (address.zip.length === 5) {
      // Simulate auto-populate (replace with actual API call later)
      // For now, just show placeholder behavior
      setAddress(prev => ({
        ...prev,
        city: "City (auto)",
        state: "ST"
      }));
    } else if (address.zip.length < 5) {
      setAddress(prev => ({
        ...prev,
        city: "",
        state: ""
      }));
    }
  }, [address.zip]);

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-60' : ''}`}>
      <label className="block text-sm font-medium text-base-content/70 mb-2">
        Property Address
      </label>

      <div className="space-y-3">
        {/* Street Address */}
        <div>
          <input
            type="text"
            placeholder="Street address"
            value={address.street}
            onChange={(e) => setAddress(prev => ({ ...prev, street: e.target.value }))}
            disabled={disabled}
            className="input input-bordered w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200"
          />
        </div>

        {/* ZIP, City, State Row */}
        <div className="grid grid-cols-12 gap-3">
          {/* ZIP Code */}
          <div className="col-span-4">
            <input
              type="text"
              placeholder="ZIP code"
              value={address.zip}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 5);
                setAddress(prev => ({ ...prev, zip: value }));
              }}
              maxLength={5}
              disabled={disabled}
              className="input input-bordered w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200"
            />
          </div>

          {/* City (auto-populated) */}
          <div className="col-span-5">
            <input
              type="text"
              placeholder="City"
              value={address.city}
              readOnly
              className="input input-bordered w-full bg-base-200/50 text-base-content/70 cursor-not-allowed"
            />
          </div>

          {/* State (auto-populated) */}
          <div className="col-span-3">
            <input
              type="text"
              placeholder="State"
              value={address.state}
              readOnly
              className="input input-bordered w-full bg-base-200/50 text-base-content/70 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs text-base-content/40">
          Enter ZIP code to auto-populate city and state
        </p>
      </div>
    </div>
  );
});

AddressInput.displayName = "AddressInput";

export default AddressInput;
