import { createHash } from "node:crypto";
import { normalizeUrl } from "./normalize";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function computeRecordId(jobSpecUrl: string): string {
  return sha256Hex(normalizeUrl(jobSpecUrl));
}

export function computeUrlDedupeKey(jobSpecUrl: string): string {
  return computeRecordId(jobSpecUrl).slice(0, 10);
}
