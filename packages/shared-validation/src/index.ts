import { z } from "zod";
import {
  ACCOUNT_STATUSES,
  CLIENT_STATUSES,
  FOLLOWUP_STATUSES,
  ROLES,
  VISIT_ORIGINS,
  VISIT_OUTCOMES,
} from "@fieldops/shared-types";

/** Firebase web app config. These values identify the project and are not secrets. */
export const firebaseWebConfigSchema = z.object({
  apiKey: z.string().min(1, "NEXT_PUBLIC_FIREBASE_API_KEY is missing"),
  authDomain: z.string().min(1, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing"),
  projectId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing"),
  appId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_APP_ID is missing"),
  messagingSenderId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing"),
});
export type FirebaseWebConfig = z.infer<typeof firebaseWebConfigSchema>;

export const orgIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Organization ID must be 1-64 letters, digits, '_' or '-'");

export const membershipSchema = z.object({
  orgId: orgIdSchema,
  role: z.enum(ROLES),
  status: z.enum(ACCOUNT_STATUSES),
});

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address");

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is required")
  .max(20, "Phone number is too long")
  .regex(/^[+0-9()\-\s]+$/, "Phone can contain digits, spaces and + ( ) -");

export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name is too long");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a valid date");

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const geoCaptureInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100_000),
});

export const visitReportSchema = z
  .object({
    summary: z.string().trim().min(10, "Summary must be at least 10 characters").max(2000),
    outcome: z.enum(VISIT_OUTCOMES),
    activities: z
      .array(z.string().trim().min(1).max(200))
      .min(1, "Add at least one activity")
      .max(20, "Too many activities"),
    productsDiscussed: z.string().trim().max(500).default(""),
    competitorInfo: z.string().trim().max(500).default(""),
    customerFeedback: z.string().trim().max(1000).default(""),
    nextAction: z.string().trim().max(500).default(""),
    followupRequired: z.boolean(),
    followupDate: dateStringSchema.nullable().default(null),
  })
  .superRefine((report, ctx) => {
    if (report.followupRequired && !report.followupDate) {
      ctx.addIssue({
        code: "custom",
        path: ["followupDate"],
        message: "Choose the next follow-up date",
      });
    }
    if (!report.followupRequired && report.followupDate) {
      ctx.addIssue({
        code: "custom",
        path: ["followupDate"],
        message: "Clear the follow-up date or mark follow-up as required",
      });
    }
  });
export type VisitReportInput = z.infer<typeof visitReportSchema>;

export const clientInputSchema = z.object({
  name: personNameSchema.max(160, "Client name is too long"),
  contactPerson: personNameSchema,
  phone: phoneSchema,
  email: z.union([emailSchema, z.literal("")]).default(""),
  addressLine1: z.string().trim().min(3, "Address is required").max(200),
  addressLine2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  postalCode: z
    .string()
    .trim()
    .min(3, "Postal code is required")
    .max(12, "Postal code is too long"),
  category: z.string().trim().max(80).default("General"),
  notes: z.string().trim().max(1000).default(""),
  geo: geoPointSchema.nullable().default(null),
});
export type ClientInput = z.infer<typeof clientInputSchema>;

export const clientStatusSchema = z.enum(CLIENT_STATUSES);

export const salespersonInputSchema = z.object({
  fullName: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  employeeCode: z
    .string()
    .trim()
    .min(2, "Employee code is required")
    .max(24, "Employee code is too long")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, '_' or '-'"),
  password: passwordSchema,
  role: z.enum(ROLES).default("USER"),
});
export type SalespersonInput = z.infer<typeof salespersonInputSchema>;

export const profileUpdateSchema = z.object({
  fullName: personNameSchema,
  phone: phoneSchema,
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const visitScheduleSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  userId: z.string().min(1, "Choose a salesperson"),
  scheduledFor: z
    .string()
    .min(1, "Choose a date and time")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time"),
});
export type VisitScheduleInput = z.infer<typeof visitScheduleSchema>;

export const adHocVisitSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
});
export type AdHocVisitInput = z.infer<typeof adHocVisitSchema>;

export const followupInputSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  userId: z.string().min(1, "Choose a salesperson"),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
  notes: z.string().trim().max(1000).default(""),
  dueDate: dateStringSchema,
  visitId: z.string().nullable().default(null),
});
export type FollowupInput = z.infer<typeof followupInputSchema>;

export const followupCompletionSchema = z.object({
  completionNote: z.string().trim().max(1000).default(""),
});

export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(120),
  timezone: z.string().trim().min(3).max(64),
  currency: z.string().trim().min(2).max(8),
  gpsAccuracyThresholdMeters: z.number().int().min(10).max(5000),
  // Rules allow two photo slots per visit.
  photoMaxPerVisit: z.number().int().min(1).max(2, "At most 2 photos per visit"),
  // Photos are stored inline in Firestore; rules cap each photo document's sizeBytes at 350 KB.
  photoMaxBytes: z.number().int().min(50_000).max(350_000, "Max photo size is 350 KB"),
  visitReminderLeadMinutes: z.number().int().min(0).max(1440),
  workdayStart: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  workdayEnd: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
});
export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;

export const visitOriginSchema = z.enum(VISIT_ORIGINS);
export const followupStatusSchema = z.enum(FOLLOWUP_STATUSES);

/** Parses an env flag; anything other than the literal "true" is false. */
export function envFlag(value: string | undefined): boolean {
  return value === "true";
}

/** First error message for a Zod result, suitable for a form banner. */
export function firstError(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}): string {
  return result.error?.issues[0]?.message ?? "Please check the form and try again.";
}
