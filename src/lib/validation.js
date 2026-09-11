/**
 * @file validation.js
 * @description Centralized Input Payload Validation Schemas using Zod for ATS 3.0.
 * Enforces strict runtime data validation before touching PostgreSQL database.
 */

import { z } from "zod";
import { CANDIDATE_STAGES_LIST, CONTACT_TYPES, JOB_STATUSES, WORKING_MODES_LIST, PREFIXES_LIST } from "../constants/enums";

/**
 * Contact Point Item Schema.
 */
export const contactPointItemSchema = z.object({
  type: z.string().min(1, "Contact type is required"),
  value: z.string().min(1, "Contact value cannot be empty").trim()
});

/**
 * Helper to remove Vietnamese diacritics
 */
export function removeVietnameseTones(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/**
 * Candidate Creation Payload Schema.
 */
export const candidateCreationSchema = z.object({
  full_name: z.string().min(1, "Candidate full name is required").trim().transform(val => removeVietnameseTones(val)),
  prefix: z.enum(["Mr.", "Ms.", "Mrs.", "Dr."]).default("Mr."),
  dob: z.string().nullable().optional().refine(val => {
        if (!val) return true;
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        return d <= new Date();
    }, { message: "Date of birth is invalid or cannot be in the future" }),
  address: z.string().optional().default(""),
  cv_url: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  contactPoints: z.array(contactPointItemSchema).min(1, "At least one contact point is strictly required"),
  assignToJobId: z.string().uuid("Invalid Job Order ID").nullable().optional(),
  initialStage: z.string().default("Talent Mapping"),
  sourceChannel: z.string().default("LinkedIn Headhunt"),
  drive_file_id: z.string().optional().default(""),
  original_filename: z.string().optional().default("")
}).passthrough();

/**
 * Client Branch Payload Schema.
 */
export const clientBranchSchema = z.object({
  branch_name: z.string().min(1, "Branch name is required").trim(),
  city: z.string().optional().default(""),
  address: z.string().min(1, "Address is required").trim(),
  is_headquarter: z.boolean().default(false),
  phone: z.string().optional().default(""),
  notes: z.string().optional().default("")
});

/**
 * Job Order Update Payload Schema.
 */
export const jobOrderUpdateSchema = z.object({
  job_title: z.string().min(1, "Job title cannot be empty").optional(),
  location: z.string().optional(),
  status: z.enum(["Open", "On Hold", "Closed"]).optional(),
  working_mode: z.array(z.string()).optional(),
  jd_url: z.string().optional(),
  notes: z.string().optional()
});

/**
 * Activity Log Creation Schema.
 */
export const activityLogCreationSchema = z.object({
  activityId: z.string().uuid("Invalid Application Activity ID"),
  stage: z.string().min(1, "Stage cannot be empty"),
  note: z.string().optional().default(""),
  actionDate: z.string().optional()
});

/**
 * Helper to safely validate payload with Zod and format friendly error messages.
 * @template T
 * @param {z.ZodSchema<T>} schema 
 * @param {unknown} data 
 * @returns {{ success: true, data: T } | { success: false, error: string }}
 */
export function validatePayload(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.issues ? result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join("; ") : String(result.error);
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data };
}
