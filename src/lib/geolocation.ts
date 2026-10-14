import type { LocationCaptureInput } from "@/lib/validations/attendance";

// Punch-time-only capture — called once per punch, never watched/polled, so
// there's no background or continuous tracking to clean up.
const GEOLOCATION_TIMEOUT_MS = 8000;

export function captureLocation(): Promise<LocationCaptureInput> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "unavailable" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "captured",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        });
      },
      (err) => {
        resolve({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 0 }
    );
  });
}
