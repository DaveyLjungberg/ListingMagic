"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";

const AddressInput = forwardRef(({ onAddressChange, disabled = false }, ref) => {
  const [address, setAddress] = useState({
    street: "",
    zip: "",
    city: "",
    state: ""
  });
  const [zipLookupStatus, setZipLookupStatus] = useState("idle"); // idle, loading, success, error
  const [zipError, setZipError] = useState(null);
  const lastLookedUpZip = useRef("");

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getAddress: () => ({
      street: address.street,
      zip_code: address.zip,
      city: address.city || undefined,
      state: address.state || undefined,
    }),
    isValid: () => Boolean(address.street && address.zip.length === 5),
    clearAddress: () => {
      setAddress({ street: "", zip: "", city: "", state: "" });
      setZipLookupStatus("idle");
      setZipError(null);
      lastLookedUpZip.current = "";
    }
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

  // Lookup city/state from ZIP code using Zippopotam.us API
  useEffect(() => {
    const lookupZip = async (zip) => {
      // Skip if we already looked up this ZIP
      if (zip === lastLookedUpZip.current) return;

      setZipLookupStatus("loading");
      setZipError(null);

      try {
        const response = await fetch(`https://api.zippopotam.us/us/${zip}`);

        if (!response.ok) {
          if (response.status === 404) {
            setZipError("ZIP code not found");
            setAddress(prev => ({ ...prev, city: "", state: "" }));
          } else {
            setZipError("Lookup failed - enter manually");
            setAddress(prev => ({ ...prev, city: "", state: "" }));
          }
          setZipLookupStatus("error");
          return;
        }

        const data = await response.json();

        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          setAddress(prev => ({
            ...prev,
            city: place["place name"],
            state: place["state abbreviation"]
          }));
          setZipLookupStatus("success");
          lastLookedUpZip.current = zip;
        } else {
          setZipError("ZIP code not found");
          setAddress(prev => ({ ...prev, city: "", state: "" }));
          setZipLookupStatus("error");
        }
      } catch (error) {
        console.error("ZIP lookup error:", error);
        setZipError("Lookup failed - enter manually");
        setAddress(prev => ({ ...prev, city: "", state: "" }));
        setZipLookupStatus("error");
      }
    };

    if (address.zip.length === 5) {
      lookupZip(address.zip);
    } else if (address.zip.length < 5) {
      // Clear city/state when ZIP is incomplete
      if (address.city || address.state) {
        setAddress(prev => ({ ...prev, city: "", state: "" }));
      }
      setZipLookupStatus("idle");
      setZipError(null);
      lastLookedUpZip.current = "";
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
            <div className="relative">
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
                className={`input input-bordered w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200 ${
                  zipLookupStatus === "error" ? "border-error" : ""
                }`}
              />
              {zipLookupStatus === "loading" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="loading loading-spinner loading-xs text-primary"></span>
                </span>
              )}
            </div>
          </div>

          {/* City (auto-populated or manual on error) */}
          <div className="col-span-5">
            <input
              type="text"
              placeholder="City"
              value={address.city}
              onChange={(e) => {
                if (zipLookupStatus === "error") {
                  setAddress(prev => ({ ...prev, city: e.target.value }));
                }
              }}
              readOnly={zipLookupStatus !== "error"}
              disabled={disabled}
              className={`input input-bordered w-full transition-colors ${
                zipLookupStatus === "error"
                  ? "bg-base-100 focus:border-primary focus:outline-none"
                  : "bg-base-200/50 text-base-content/70 cursor-not-allowed"
              } disabled:bg-base-200`}
            />
          </div>

          {/* State (auto-populated or manual on error) */}
          <div className="col-span-3">
            <input
              type="text"
              placeholder="State"
              value={address.state}
              onChange={(e) => {
                if (zipLookupStatus === "error") {
                  const value = e.target.value.toUpperCase().slice(0, 2);
                  setAddress(prev => ({ ...prev, state: value }));
                }
              }}
              readOnly={zipLookupStatus !== "error"}
              disabled={disabled}
              maxLength={2}
              className={`input input-bordered w-full transition-colors ${
                zipLookupStatus === "error"
                  ? "bg-base-100 focus:border-primary focus:outline-none"
                  : "bg-base-200/50 text-base-content/70 cursor-not-allowed"
              } disabled:bg-base-200`}
            />
          </div>
        </div>

        {/* Helper text / Error message */}
        {zipError ? (
          <p className="text-xs text-error">
            {zipError}
          </p>
        ) : zipLookupStatus === "success" ? (
          <p className="text-xs text-success">
            City and state auto-populated
          </p>
        ) : (
          <p className="text-xs text-base-content/40">
            Enter ZIP code to auto-populate city and state
          </p>
        )}
      </div>
    </div>
  );
});

AddressInput.displayName = "AddressInput";

export default AddressInput;
