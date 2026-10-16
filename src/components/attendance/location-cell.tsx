import { AlertTriangle, MapPin, MapPinOff } from "lucide-react";
import { googleMapsUrl, LOW_ACCURACY_THRESHOLD_M } from "@/lib/attendance";
import type { AttendanceLocationStatus } from "@/types";

const STATUS_LABEL: Record<AttendanceLocationStatus, string> = {
  captured: "not recorded",
  denied: "permission denied",
  unavailable: "unavailable",
};

export function LocationCell({
  label,
  status,
  latitude,
  longitude,
  accuracyM,
}: {
  label: string;
  status: AttendanceLocationStatus | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
}) {
  if (status !== "captured" || latitude === null || longitude === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <MapPinOff className="h-3 w-3" />
        {label}: {status ? STATUS_LABEL[status] : "not recorded"}
      </span>
    );
  }

  const lowAccuracy = accuracyM !== null && accuracyM > LOW_ACCURACY_THRESHOLD_M;

  return (
    <a
      href={googleMapsUrl(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        lowAccuracy ? "text-warning-600" : "text-brand-700"
      }`}
      title={accuracyM !== null ? `Accuracy: ±${Math.round(accuracyM)} m` : undefined}
    >
      {lowAccuracy ? <AlertTriangle className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
      {label}: View on map{accuracyM !== null && ` (±${Math.round(accuracyM)} m)`}
    </a>
  );
}
