"use client";

import { MLSDataResponse } from "@/types/api";

interface MLSDataDisplayProps {
  data: MLSDataResponse;
}

export default function MLSDataDisplay({ data }: MLSDataDisplayProps) {
  // Helper function to get confidence color
  const getConfidenceColor = (field: string): string => {
    const score = data.confidence_scores?.[field];
    if (score === "high") return "badge-success";
    if (score === "medium") return "badge-warning";
    return "badge-ghost";
  };

  // Helper to format arrays
  const formatArray = (arr: string[] | null | undefined): string => {
    if (!arr || arr.length === 0) return "—";
    return arr.join(", ");
  };

  // Helper to format Yes/No
  const formatYesNo = (value: string | null | undefined): string => {
    if (!value) return "—";
    return value;
  };

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportToCSV(data)}
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
            <FieldDisplay
              label="Property Type"
              value={data.property_type}
              confidence={getConfidenceColor("property_type")}
            />
            <FieldDisplay
              label="Bedrooms"
              value={data.bedrooms?.toString()}
              confidence={getConfidenceColor("bedrooms")}
            />
            <FieldDisplay
              label="Bathrooms (Full)"
              value={data.bathrooms_full?.toString()}
              confidence={getConfidenceColor("bathrooms_full")}
            />
            <FieldDisplay
              label="Bathrooms (Half)"
              value={data.bathrooms_half?.toString()}
              confidence={getConfidenceColor("bathrooms_half")}
            />
            <FieldDisplay
              label="Stories"
              value={data.stories?.toString()}
              confidence={getConfidenceColor("stories")}
            />
            <FieldDisplay
              label="Garage Spaces"
              value={data.garage_spaces?.toString()}
              confidence={getConfidenceColor("garage_spaces")}
            />
          </div>

          <div className="divider"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldDisplay
              label="Flooring"
              value={formatArray(data.flooring)}
              confidence={getConfidenceColor("flooring")}
            />
            <FieldDisplay
              label="Appliances"
              value={formatArray(data.appliances)}
              confidence={getConfidenceColor("appliances")}
            />
            <FieldDisplay
              label="Exterior Material"
              value={data.exterior_material}
              confidence={getConfidenceColor("exterior_material")}
            />
            <FieldDisplay
              label="Roof"
              value={data.roof}
              confidence={getConfidenceColor("roof")}
            />
            <FieldDisplay
              label="Parking"
              value={formatArray(data.parking)}
              confidence={getConfidenceColor("parking")}
            />
            <FieldDisplay
              label="Interior Features"
              value={formatArray(data.interior_features)}
              confidence={getConfidenceColor("interior_features")}
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
            <FieldDisplay
              label="Year Built (Est.)"
              value={data.year_built_estimate}
              confidence={getConfidenceColor("year_built_estimate")}
            />
            <FieldDisplay
              label="Total Sq Ft (Est.)"
              value={data.total_finished_sqft_estimate?.toLocaleString()}
              confidence={getConfidenceColor("total_finished_sqft_estimate")}
            />
            <FieldDisplay
              label="Lot Size (Est.)"
              value={data.lot_size_estimate}
              confidence={getConfidenceColor("lot_size_estimate")}
            />
            <FieldDisplay
              label="Basement"
              value={formatYesNo(data.basement)}
              confidence={getConfidenceColor("basement")}
            />
            <FieldDisplay
              label="Foundation"
              value={data.foundation}
              confidence={getConfidenceColor("foundation")}
            />
            <FieldDisplay
              label="Water Source"
              value={data.water_source}
              confidence={getConfidenceColor("water_source")}
            />
          </div>

          <div className="divider"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldDisplay
              label="Green Features"
              value={formatArray(data.green_features)}
              confidence={getConfidenceColor("green_features")}
            />
            <FieldDisplay
              label="HOA Amenities"
              value={formatArray(data.hoa_visible_amenities)}
              confidence={getConfidenceColor("hoa_visible_amenities")}
            />
          </div>
        </div>
      </div>

      {/* Room Details */}
      {data.rooms && data.rooms.length > 0 && (
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
                  {data.rooms.map((room, idx) => (
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
        Analyzed {data.photos_analyzed} photos using {data.model_used} in {data.processing_time_ms}ms
      </div>
    </div>
  );
}

// Field Display Component
function FieldDisplay({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string | null | undefined;
  confidence: string;
}) {
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
        <span className={`badge ${confidence} badge-xs`}>
          {confidence.includes("success") ? "High" : confidence.includes("warning") ? "Est" : ""}
        </span>
      </label>
      <div className="input input-bordered bg-base-200 flex items-center">
        {value || "—"}
      </div>
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
