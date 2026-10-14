"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { correctionRequestSchema, locationCaptureSchema, type LocationCaptureInput } from "@/lib/validations/attendance";
import { getWorkDateIST, toISTTimestamp } from "@/lib/attendance";

async function requireLocationForPunch(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "attendance_location")
    .maybeSingle();
  const value = data?.value as { require_location_for_punch?: boolean } | null;
  return Boolean(value?.require_location_for_punch);
}

function revalidateAttendancePaths() {
  revalidatePath("/agent/attendance");
  revalidatePath("/admin/attendance");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, adminId: null, error: "You must be signed in." } as const;

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { supabase, adminId: null, error: "Only admins can review attendance corrections." } as const;
  }

  return { supabase, adminId: user.id, error: null } as const;
}

export async function punchIn(location: LocationCaptureInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsedLocation = locationCaptureSchema.safeParse(location);
  if (!parsedLocation.success) return { error: "Invalid location data." };

  if ((await requireLocationForPunch(supabase)) && parsedLocation.data.status !== "captured") {
    return { error: "Location is required to punch in. Please allow location access and try again." };
  }

  const workDate = getWorkDateIST();
  const { data: existing } = await supabase
    .from("attendance_sessions")
    .select("id, punch_out_at")
    .eq("agent_id", user.id)
    .eq("work_date", workDate)
    .maybeSingle();

  if (existing) {
    return {
      error: existing.punch_out_at
        ? "You've already completed attendance for today."
        : "You're already punched in today.",
    };
  }

  const locationFields =
    parsedLocation.data.status === "captured"
      ? {
          punch_in_latitude: parsedLocation.data.latitude,
          punch_in_longitude: parsedLocation.data.longitude,
          punch_in_accuracy_m: parsedLocation.data.accuracy_m,
          punch_in_location_status: "captured" as const,
        }
      : { punch_in_location_status: parsedLocation.data.status };

  const { error } = await supabase.from("attendance_sessions").insert({
    agent_id: user.id,
    work_date: workDate,
    ...locationFields,
  });
  if (error) return { error: error.message };

  revalidateAttendancePaths();
  return { locationCaptured: parsedLocation.data.status === "captured" };
}

export async function punchOut(location: LocationCaptureInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsedLocation = locationCaptureSchema.safeParse(location);
  if (!parsedLocation.success) return { error: "Invalid location data." };

  if ((await requireLocationForPunch(supabase)) && parsedLocation.data.status !== "captured") {
    return { error: "Location is required to punch out. Please allow location access and try again." };
  }

  const locationFields =
    parsedLocation.data.status === "captured"
      ? {
          punch_out_latitude: parsedLocation.data.latitude,
          punch_out_longitude: parsedLocation.data.longitude,
          punch_out_accuracy_m: parsedLocation.data.accuracy_m,
          punch_out_location_status: "captured" as const,
        }
      : { punch_out_location_status: parsedLocation.data.status };

  const workDate = getWorkDateIST();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .update({ punch_out_at: new Date().toISOString(), ...locationFields })
    .eq("agent_id", user.id)
    .eq("work_date", workDate)
    .is("punch_out_at", null)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No open punch-in found for today." };

  revalidateAttendancePaths();
  return { locationCaptured: parsedLocation.data.status === "captured" };
}

export async function requestCorrection(formData: FormData) {
  const parsed = correctionRequestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { work_date, requested_punch_in_time, requested_punch_out_time, reason } = parsed.data;

  const { error } = await supabase.from("attendance_corrections").insert({
    agent_id: user.id,
    work_date,
    requested_punch_in_at: requested_punch_in_time
      ? toISTTimestamp(work_date, requested_punch_in_time)
      : null,
    requested_punch_out_at: requested_punch_out_time
      ? toISTTimestamp(work_date, requested_punch_out_time)
      : null,
    reason,
  });
  if (error) return { error: error.message };

  revalidateAttendancePaths();
  return {};
}

export async function reviewCorrection(correctionId: string, decision: "approved" | "rejected") {
  const { supabase, adminId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: correction } = await supabase
    .from("attendance_corrections")
    .select("id, agent_id, work_date, requested_punch_in_at, requested_punch_out_at, status")
    .eq("id", correctionId)
    .maybeSingle();
  if (!correction) return { error: "Correction request not found." };
  if (correction.status !== "pending") return { error: "This request has already been reviewed." };

  const { error: updateError } = await supabase
    .from("attendance_corrections")
    .update({ status: decision, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq("id", correctionId);
  if (updateError) return { error: updateError.message };

  if (decision === "approved") {
    const { data: existingSession } = await supabase
      .from("attendance_sessions")
      .select("punch_in_at, punch_out_at")
      .eq("agent_id", correction.agent_id)
      .eq("work_date", correction.work_date)
      .maybeSingle();

    const punchInAt = correction.requested_punch_in_at ?? existingSession?.punch_in_at ?? null;
    if (!punchInAt) {
      return { error: "Can't apply: no punch-in time on file or in the request for this day." };
    }
    const punchOutAt = correction.requested_punch_out_at ?? existingSession?.punch_out_at ?? null;

    const { error: upsertError } = await supabase.from("attendance_sessions").upsert(
      {
        agent_id: correction.agent_id,
        work_date: correction.work_date,
        punch_in_at: punchInAt,
        punch_out_at: punchOutAt,
      },
      { onConflict: "agent_id,work_date" }
    );
    if (upsertError) return { error: upsertError.message };
  }

  revalidateAttendancePaths();
  return {};
}
