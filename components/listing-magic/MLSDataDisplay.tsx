"use client";

import { MLSDataResponse } from "@/types/api";
import { CheckCircleIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

interface MLSDataDisplayProps {
  data: MLSDataResponse;
  editableData?: MLSDataResponse;
  onFieldChange?: (field: string, value: string | number | string[] | null) => void;
  isEditable?: boolean;
}

export default function MLSDataDisplay({
  data,
  editableData,
  onFieldChange,
  isEditable = false
}: MLSDataDisplayProps) {
  // Use editable data if provided, otherwise fall back to original data
  const displayData = editableData || data;

  // Check if a field was sourced from tax records
  const isFromTaxRecords = (field: string): boolean => {
    // The backend will set tax_data_applied with fields that came from tax records
    return data.tax_data_applied?.[field] === true;
  };

  // Helper function to get confidence color
  const getConfidenceColor = (field: string): string => {
    const score = data.confidence_scores?.[field];
    if (score === "high") return "badge-success";
    if (score === "medium") return "badge-warning";
    return "badge-ghost";
  };

  // Helper to format arrays for display
  const formatArray = (arr: string[] | null | undefined): string => {
    if (!arr || arr.length === 0) return "";
    return arr.join(", ");
  };

  // Helper to parse array from string
  const parseArrayFromString = (value: string): string[] => {
    if (!value.trim()) return [];
    return value.split(",").map(s => s.trim()).filter(s => s.length > 0);
  };

  // Handle field changes
  const handleChange = (field: string, value: string, isArray: boolean = false) => {
    if (!onFieldChange) return;

    if (isArray) {
      onFieldChange(field, parseArrayFromString(value));
    } else {
      onFieldChange(field, value || null);
    }
  };

  // Handle number field changes
  const handleNumberChange = (field: string, value: string) => {
    if (!onFieldChange) return;
    const numValue = value ? parseInt(value, 10) : null;
    onFieldChange(field, isNaN(numValue as number) ? null : numValue);
  };

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportToCSV(displayData)}
          className="btn btn-primary btn-sm gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export to CSV
        </button>
      </div>

      {/* High Confidence Fields */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h3 className="card-title text-lg flex items-center gap-2">
            <span className="badge badge-success badge-sm">High Confidence</span>
            Primary Property Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <EditableField
              label="Property Type"
              value={displayData.property_type || ""}
              confidence={getConfidenceColor("property_type")}
              isEditable={isEditable}
              onChange={(value) => handleChange("property_type", value)}
            />
            <EditableField
              label="Bedrooms"
              value={displayData.bedrooms?.toString() || ""}
              confidence={getConfidenceColor("bedrooms")}
              isEditable={isEditable}
              type="number"
              onChange={(value) => handleNumberChange("bedrooms", value)}
            />
            <EditableField
              label="Bathrooms (Full)"
              value={displayData.bathrooms_full?.toString() || ""}
              confidence={getConfidenceColor("bathrooms_full")}
              isEditable={isEditable}
              type="number"
              onChange={(value) => handleNumberChange("bathrooms_full", value)}
            />
            <EditableField
              label="Bathrooms (Half)"
              value={displayData.bathrooms_half?.toString() || ""}
              confidence={getConfidenceColor("bathrooms_half")}
              isEditable={isEditable}
              type="number"
              onChange={(value) => handleNumberChange("bathrooms_half", value)}
            />
            <EditableField
              label="Stories"
              value={displayData.stories?.toString() || ""}
              confidence={getConfidenceColor("stories")}
              isEditable={isEditable}
              type="number"
              onChange={(value) => handleNumberChange("stories", value)}
            />
            <EditableField
              label="Garage Spaces"
              value={displayData.garage_spaces?.toString() || ""}
              confidence={getConfidenceColor("garage_spaces")}
              isEditable={isEditable}
              type="number"
              onChange={(value) => handleNumberChange("garage_spaces", value)}
            />
          </div>

          <div className="divider"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableTextarea
              label="Flooring"
              value={formatArray(displayData.flooring)}
              confidence={getConfidenceColor("flooring")}
              isEditable={isEditable}
              onChange={(value) => handleChange("flooring", value, true)}
            />
            <EditableTextarea
              label="Appliances"
              value={formatArray(displayData.appliances)}
              confidence={getConfidenceColor("appliances")}
              isEditable={isEditable}
              onChange={(value) => handleChange("appliances", value, true)}
            />
            <EditableField
              label="Exterior Material"
              value={displayData.exterior_material || ""}
              confidence={getConfidenceColor("exterior_material")}
              isEditable={isEditable}
              onChange={(value) => handleChange("exterior_material", value)}
            />
            <EditableField
              label="Roof"
              value={displayData.roof || ""}
              confidence={getConfidenceColor("roof")}
              isEditable={isEditable}
              onChange={(value) => handleChange("roof", value)}
            />
            <EditableTextarea
              label="Parking"
              value={formatArray(displayData.parking)}
              confidence={getConfidenceColor("parking")}
              isEditable={isEditable}
              onChange={(value) => handleChange("parking", value, true)}
            />
            <EditableTextarea
              label="Interior Features"
              value={formatArray(displayData.interior_features)}
              confidence={getConfidenceColor("interior_features")}
              isEditable={isEditable}
              onChange={(value) => handleChange("interior_features", value, true)}
            />
          </div>
        </div>
      </div>

      {/* Moderate Confidence Fields */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h3 className="card-title text-lg flex items-center gap-2">
            <span className="badge badge-warning badge-sm">Estimated</span>
            Additional Property Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <EditableField
              label={isFromTaxRecords("year_built_estimate") ? "Year Built" : "Year Built (Est.)"}
              value={displayData.year_built_estimate || ""}
              confidence={getConfidenceColor("year_built_estimate")}
              isEditable={isEditable}
              onChange={(value) => handleChange("year_built_estimate", value)}
              fromTaxRecords={isFromTaxRecords("year_built_estimate")}
            />
            <EditableField
              label="Total Sq Ft (Est.)"
              value={displayData.total_finished_sqft_estimate?.toString() || ""}
              confidence={getConfidenceColor("total_finished_sqft_estimate")}
              isEditable={isEditable}
              type="number"
              onChange={(value) => handleNumberChange("total_finished_sqft_estimate", value)}
            />
            <EditableField
              label={isFromTaxRecords("lot_size_estimate") ? "Lot Size" : "Lot Size (Est.)"}
              value={displayData.lot_size_estimate || ""}
              confidence={getConfidenceColor("lot_size_estimate")}
              isEditable={isEditable}
              onChange={(value) => handleChange("lot_size_estimate", value)}
              fromTaxRecords={isFromTaxRecords("lot_size_estimate")}
            />
            <EditableField
              label="Basement"
              value={displayData.basement || ""}
              confidence={getConfidenceColor("basement")}
              isEditable={isEditable}
              onChange={(value) => handleChange("basement", value)}
            />
            <EditableField
              label="Foundation"
              value={displayData.foundation || ""}
              confidence={getConfidenceColor("foundation")}
              isEditable={isEditable}
              onChange={(value) => handleChange("foundation", value)}
            />
            <EditableField
              label="Water Source"
              value={displayData.water_source || ""}
              confidence={getConfidenceColor("water_source")}
              isEditable={isEditable}
              onChange={(value) => handleChange("water_source", value)}
            />
          </div>

          <div className="divider"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableTextarea
              label="Green Features"
              value={formatArray(displayData.green_features)}
              confidence={getConfidenceColor("green_features")}
              isEditable={isEditable}
              onChange={(value) => handleChange("green_features", value, true)}
            />
            <EditableTextarea
              label="HOA Amenities"
              value={formatArray(displayData.hoa_visible_amenities)}
              confidence={getConfidenceColor("hoa_visible_amenities")}
              isEditable={isEditable}
              onChange={(value) => handleChange("hoa_visible_amenities", value, true)}
            />
          </div>
        </div>
      </div>

      {/* Room Details */}
      {displayData.rooms && displayData.rooms.length > 0 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h3 className="card-title text-lg">Room Details</h3>

            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Room Type</th>
                    <th>Level</th>
                    <th>Dimensions (Est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.rooms.map((room, idx) => (
                    <tr key={idx}>
                      <td>{room.room_type}</td>
                      <td>{room.level}</td>
                      <td>
                        {room.length_ft && room.width_ft
                          ? `${room.length_ft}' × ${room.width_ft}'`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-base-content/50 text-center">
        Analyzed {displayData.photos_analyzed} photos using {displayData.model_used} in {displayData.processing_time_ms}ms
      </div>
    </div>
  );
}

// Editable Field Component (for short single-value fields)
function EditableField({
  label,
  value,
  confidence,
  isEditable,
  type = "text",
  onChange,
  fromTaxRecords = false,
}: {
  label: string;
  value: string;
  confidence: string;
  isEditable: boolean;
  type?: "text" | "number";
  onChange: (value: string) => void;
  fromTaxRecords?: boolean;
}) {
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium text-primary-navy">{label}</span>
        <div className="flex gap-1">
          {fromTaxRecords && (
            <span className="badge-tax badge-xs gap-1 px-2 py-0.5 rounded-md flex items-center animate-bounce-in">
              <CheckCircleIcon className="w-3 h-3" />
              Tax Records
            </span>
          )}
          {!fromTaxRecords && (
            <span className={`badge ${confidence} badge-xs`}>
              {confidence.includes("success") ? "High" : confidence.includes("warning") ? "Est" : ""}
            </span>
          )}
        </div>
      </label>
      {isEditable ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input input-bordered bg-base-100 w-full transition-all duration-150 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          placeholder="—"
        />
      ) : (
        <div className="input input-bordered bg-base-200 flex items-center font-mono text-sm">
          {value || "—"}
        </div>
      )}
    </div>
  );
}

// Editable Textarea Component (for long comma-separated fields)
function EditableTextarea({
  label,
  value,
  confidence,
  isEditable,
  onChange,
}: {
  label: string;
  value: string;
  confidence: string;
  isEditable: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
        <span className={`badge ${confidence} badge-xs`}>
          {confidence.includes("success") ? "High" : confidence.includes("warning") ? "Est" : ""}
        </span>
      </label>
      {isEditable ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="textarea textarea-bordered bg-base-100 w-full resize-none"
          rows={2}
          placeholder="—"
        />
      ) : (
        <div className="p-3 border border-base-300 rounded-lg bg-base-200 min-h-[60px] text-sm whitespace-pre-wrap break-words">
          {value || "—"}
        </div>
      )}
    </div>
  );
}

// Export to CSV function
function exportToCSV(data: MLSDataResponse) {
  const rows = [
    ["Field Name", "Value", "Confidence"],
    ["Property Type", data.property_type || "", data.confidence_scores?.property_type || ""],
    ["Bedrooms", data.bedrooms?.toString() || "", data.confidence_scores?.bedrooms || ""],
    ["Bathrooms (Full)", data.bathrooms_full?.toString() || "", data.confidence_scores?.bathrooms_full || ""],
    ["Bathrooms (Half)", data.bathrooms_half?.toString() || "", data.confidence_scores?.bathrooms_half || ""],
    ["Stories", data.stories?.toString() || "", data.confidence_scores?.stories || ""],
    ["Garage Spaces", data.garage_spaces?.toString() || "", data.confidence_scores?.garage_spaces || ""],
    ["Flooring", data.flooring?.join(", ") || "", data.confidence_scores?.flooring || ""],
    ["Appliances", data.appliances?.join(", ") || "", data.confidence_scores?.appliances || ""],
    ["Exterior Material", data.exterior_material || "", data.confidence_scores?.exterior_material || ""],
    ["Roof", data.roof || "", data.confidence_scores?.roof || ""],
    ["Parking", data.parking?.join(", ") || "", data.confidence_scores?.parking || ""],
    ["Interior Features", data.interior_features?.join(", ") || "", data.confidence_scores?.interior_features || ""],
    ["Year Built (Est.)", data.year_built_estimate || "", data.confidence_scores?.year_built_estimate || ""],
    ["Total Sq Ft (Est.)", data.total_finished_sqft_estimate?.toString() || "", data.confidence_scores?.total_finished_sqft_estimate || ""],
    ["Lot Size (Est.)", data.lot_size_estimate || "", data.confidence_scores?.lot_size_estimate || ""],
    ["Basement", data.basement || "", data.confidence_scores?.basement || ""],
    ["Foundation", data.foundation || "", data.confidence_scores?.foundation || ""],
    ["Water Source", data.water_source || "", data.confidence_scores?.water_source || ""],
    ["Green Features", data.green_features?.join(", ") || "", data.confidence_scores?.green_features || ""],
    ["HOA Amenities", data.hoa_visible_amenities?.join(", ") || "", data.confidence_scores?.hoa_visible_amenities || ""],
  ];

  const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mls-data-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
