import { z } from "zod";

const UrlString = z.url();
const NullableUrlString = z.union([z.url(), z.null()]);

const StatusSchema = z.enum(["🔍", "📝", "💬", "✅", "🚫"]);
const FoundViaTypeSchema = z.enum([
  "aggregator",
  "board",
  "referral",
  "search",
  "direct",
  "other",
]);
const JobSpecKindSchema = z.enum(["ats", "company_site", "board_repost", "unknown"]);
const JobSpecConfidenceSchema = z.enum(["high", "medium", "low"]);
const SourceStatusStateSchema = z.enum([
  "pending",
  "verified",
  "needs_review",
  "broken",
  "unavailable",
]);

const BaseRecordShape = {
  Company: z.string().min(1),
  Role: z.string().min(1),
  "Job Spec": UrlString,
  Location: z.string().min(1).optional(),
  "Found Via Type": FoundViaTypeSchema.optional(),
  "Found Via URL": NullableUrlString.optional(),
  "Found Via Ref": z.union([z.string().min(1), z.null()]).optional(),
  "Job Spec Kind": JobSpecKindSchema.optional(),
  "Job Spec Verified": z.boolean().optional(),
  "Job Spec Confidence": JobSpecConfidenceSchema.optional(),
  "Source Status State": SourceStatusStateSchema.optional(),
  "Source Status Reason": z.union([z.string().min(1), z.null()]).optional(),
  Status: StatusSchema.optional(),
  "Next Step": z.string().min(1).optional(),
  Notes: z.string().min(1).optional(),
};

export const JobRecordSchema = z.object(BaseRecordShape);

export const AddInputSchema = z.object({
  ...BaseRecordShape,
  Status: StatusSchema.default("🔍"),
  body: z.string().optional(),
});

export const UpdatePatchSchema = z
  .object({
    ...BaseRecordShape,
    body: z.string().optional(),
  })
  .partial();

export const FindQuerySchema = z.object({
  query: z.string().min(1),
  status: StatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export type JobRecord = z.infer<typeof JobRecordSchema>;
export type AddInput = z.infer<typeof AddInputSchema>;
export type UpdatePatch = z.infer<typeof UpdatePatchSchema>;
export type FindQuery = z.infer<typeof FindQuerySchema>;
