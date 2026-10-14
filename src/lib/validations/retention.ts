import { z } from "zod";

export const retentionSettingSchema = z.object({
  years: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === 2 || v === 3, "Choose 1, 2, or 3 years"),
  // The form pairs the checkbox with a same-named hidden "false" input (see
  // RetentionSettingsForm) so this field is always present as an explicit
  // "true"/"false" string, never absent — z.coerce.boolean() can't be used
  // here since Boolean("false") is true. .catch(true) still fails safe to
  // dry-run-on for any malformed value, since silently landing on live mode
  // would be a data-loss bug, not a cosmetic one.
  dry_run: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .catch(true),
});
