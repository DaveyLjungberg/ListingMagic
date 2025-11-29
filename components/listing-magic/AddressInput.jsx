"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import toast from "react-hot-toast";

const AddressInput = forwardRef(({ onAddressChange, disabled = false }, ref) => {
  const [address, setAddressState] = useState({
    street: "",
    zip: "",
    city: "",
    state: ""
  });
  const [zipLookupStatus, setZipLookupStatus] = useState("idle"); // idle, loading, success, error
  const [zipError, setZipError] = useState(null);
  const lastLookedUpZip = useRef("");

  // Tax record state
  const [taxData, setTaxData] = useState({
    apn: "",
    yearBuilt: "",
    lotSize: "",
    county: "",
  });
  const [loadingTaxRecords, setLoadingTaxRecords] = useState(false);
  const [taxRecordsLoaded, setTaxRecordsLoaded] = useState(false);

  // Store callback in ref to avoid re-render loops
  const onAddressChangeRef = useRef(onAddressChange);
  onAddressChangeRef.current = onAddressChange;

  // Notify parent of address changes (including tax data)
  const notifyParent = useCallback((addressData, taxInfo) => {
    if (onAddressChangeRef.current) {
      onAddressChangeRef.current({
        street: addressData.street,
        zip_code: addressData.zip,
        city: addressData.city || undefined,
        state: addressData.state || undefined,
        // Include tax data
        apn: taxInfo?.apn || undefined,
        yearBuilt: taxInfo?.yearBuilt || undefined,
        lotSize: taxInfo?.lotSize || undefined,
        county: taxInfo?.county || undefined,
      });
    }
  }, []);

  // Stable setAddress function that also notifies parent
  const setAddress = useCallback((updater) => {
    setAddressState(prev => {
      const newAddress = typeof updater === 'function' ? updater(prev) : updater;
      // Notify parent after state update (via ref to avoid dependency issues)
      setTimeout(() => {
        notifyParent(newAddress, taxData);
      }, 0);
      return newAddress;
    });
  }, [notifyParent, taxData]);

  // Update tax data and notify parent
  const setTaxDataWithNotify = useCallback((updater) => {
    setTaxData(prev => {
      const newTaxData = typeof updater === 'function' ? updater(prev) : updater;
      // Notify parent after state update
      setTimeout(() => {
        notifyParent(address, newTaxData);
      }, 0);
      return newTaxData;
    });
  }, [notifyParent, address]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getAddress: () => ({
      street: address.street,
      zip_code: address.zip,
      city: address.city || undefined,
      state: address.state || undefined,
      // Include tax data
      apn: taxData.apn || undefined,
      yearBuilt: taxData.yearBuilt || undefined,
      lotSize: taxData.lotSize || undefined,
      county: taxData.county || undefined,
    }),
    getTaxData: () => {
      console.log('[AddressInput] getTaxData called, returning:', taxData);
      return taxData;
    },
    isValid: () => Boolean(address.street && address.zip.length === 5),
    clearAddress: () => {
      setAddressState({ street: "", zip: "", city: "", state: "" });
      setTaxData({ apn: "", yearBuilt: "", lotSize: "", county: "" });
      setZipLookupStatus("idle");
      setZipError(null);
      setTaxRecordsLoaded(false);
      lastLookedUpZip.current = "";
    },
    setAddress: (newAddress) => {
      const addressData = {
        street: newAddress.street || "",
        zip: newAddress.zip_code || "",
        city: newAddress.city || "",
        state: newAddress.state || ""
      };
      setAddressState(addressData);

      // Set tax data if provided
      const newTaxData = {
        apn: newAddress.apn || "",
        yearBuilt: newAddress.yearBuilt || "",
        lotSize: newAddress.lotSize || "",
        county: newAddress.county || "",
      };
      setTaxData(newTaxData);
      if (newAddress.apn || newAddress.yearBuilt || newAddress.lotSize || newAddress.county) {
        setTaxRecordsLoaded(true);
      }

      if (newAddress.zip_code && newAddress.city) {
        lastLookedUpZip.current = newAddress.zip_code;
        setZipLookupStatus("success");
      }
      // Notify parent
      notifyParent(addressData, newTaxData);
    }
  }), [address, taxData, notifyParent]);

  // Fetch tax records from ATTOM API
  const handleFetchTaxRecords = async () => {
    if (!address.street || !address.city || !address.state || !address.zip) {
      toast.error("Please enter complete address first");
      return;
    }

    setLoadingTaxRecords(true);

    try {
      const res = await fetch('/api/lookup-tax-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.street,
          city: address.city,
          state: address.state,
          zip: address.zip
        })
      });

      const result = await res.json();

      if (result.success && result.data) {
        const newTaxData = {
          apn: result.data.apn || "",
          yearBuilt: result.data.yearBuilt?.toString() || "",
          lotSize: result.data.lotSize || "",
          county: result.data.county || "",
        };
        setTaxData(newTaxData);
        setTaxRecordsLoaded(true);

        // Notify parent with updated data
        notifyParent(address, newTaxData);

        toast.success('Tax records loaded!');
        console.log("[Tax Records] Loaded:", result.data);
      } else {
        toast.error(result.error || 'Tax records not found - enter manually');
        console.log("[Tax Records] Not found:", result.error);
      }
    } catch (error) {
      console.error('Tax lookup error:', error);
      toast.error('Failed to fetch tax records');
    } finally {
      setLoadingTaxRecords(false);
    }
  };

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
            setAddressState(prev => ({ ...prev, city: "", state: "" }));
          } else {
            setZipError("Lookup failed - enter manually");
            setAddressState(prev => ({ ...prev, city: "", state: "" }));
          }
          setZipLookupStatus("error");
          return;
        }

        const data = await response.json();

        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          const newCity = place["place name"];
          const newState = place["state abbreviation"];
          setAddressState(prev => {
            const newAddress = { ...prev, city: newCity, state: newState };
            // Notify parent of the auto-populated city/state
            setTimeout(() => {
              notifyParent(newAddress, taxData);
            }, 0);
            return newAddress;
          });
          setZipLookupStatus("success");
          lastLookedUpZip.current = zip;
        } else {
          setZipError("ZIP code not found");
          setAddressState(prev => ({ ...prev, city: "", state: "" }));
          setZipLookupStatus("error");
        }
      } catch (error) {
        console.error("ZIP lookup error:", error);
        setZipError("Lookup failed - enter manually");
        setAddressState(prev => ({ ...prev, city: "", state: "" }));
        setZipLookupStatus("error");
      }
    };

    if (address.zip.length === 5) {
      lookupZip(address.zip);
    } else if (address.zip.length < 5) {
      // Clear city/state when ZIP is incomplete - use internal state only
      if (address.city || address.state) {
        setAddressState(prev => ({ ...prev, city: "", state: "" }));
      }
      setZipLookupStatus("idle");
      setZipError(null);
      lastLookedUpZip.current = "";
    }
  }, [address.zip, notifyParent, taxData]);

  // Clear tax data when address changes significantly
  useEffect(() => {
    if (taxRecordsLoaded && address.street === "") {
      setTaxData({ apn: "", yearBuilt: "", lotSize: "", county: "" });
      setTaxRecordsLoaded(false);
    }
  }, [address.street, taxRecordsLoaded]);

  const canFetchTaxRecords = address.street && address.city && address.state && address.zip.length === 5;

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

        {/* Tax Records Section */}
        <div className="border-t border-base-200 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-base-content/70">
              Tax Records
            </label>
            <button
              type="button"
              onClick={handleFetchTaxRecords}
              disabled={disabled || !canFetchTaxRecords || loadingTaxRecords}
              className="btn btn-xs btn-primary gap-1"
            >
              {loadingTaxRecords ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Loading...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Fetch Tax Records
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* APN/Tax ID */}
            <div>
              <label className="text-xs text-base-content/50 mb-1 block">APN/Tax ID</label>
              <input
                type="text"
                placeholder="—"
                value={taxData.apn}
                onChange={(e) => setTaxDataWithNotify(prev => ({ ...prev, apn: e.target.value }))}
                disabled={disabled}
                className="input input-bordered input-sm w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200"
              />
            </div>

            {/* Year Built */}
            <div>
              <label className="text-xs text-base-content/50 mb-1 block">Year Built</label>
              <input
                type="text"
                placeholder="—"
                value={taxData.yearBuilt}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setTaxDataWithNotify(prev => ({ ...prev, yearBuilt: value }));
                }}
                maxLength={4}
                disabled={disabled}
                className="input input-bordered input-sm w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200"
              />
            </div>

            {/* Lot Size */}
            <div>
              <label className="text-xs text-base-content/50 mb-1 block">Lot Size</label>
              <input
                type="text"
                placeholder="—"
                value={taxData.lotSize}
                onChange={(e) => setTaxDataWithNotify(prev => ({ ...prev, lotSize: e.target.value }))}
                disabled={disabled}
                className="input input-bordered input-sm w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200"
              />
            </div>

            {/* County */}
            <div>
              <label className="text-xs text-base-content/50 mb-1 block">County</label>
              <input
                type="text"
                placeholder="—"
                value={taxData.county}
                onChange={(e) => setTaxDataWithNotify(prev => ({ ...prev, county: e.target.value }))}
                disabled={disabled}
                className="input input-bordered input-sm w-full bg-base-100 focus:border-primary focus:outline-none transition-colors disabled:bg-base-200"
              />
            </div>
          </div>

          {taxRecordsLoaded && (
            <p className="text-xs text-success mt-2">
              Tax records loaded - all fields are editable
            </p>
          )}
          {!taxRecordsLoaded && !loadingTaxRecords && (
            <p className="text-xs text-base-content/40 mt-2">
              {canFetchTaxRecords
                ? "Click 'Fetch Tax Records' to auto-fill from public records"
                : "Complete address above to fetch tax records"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

AddressInput.displayName = "AddressInput";

export default AddressInput;
