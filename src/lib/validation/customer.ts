/**
 * Customer & KYC Validation Schemas
 *
 * Server-enforced Zod schemas. These are the source of truth for validation.
 * Client forms also use these for immediate feedback, but server always re-validates.
 */

import { z } from "zod";

// Indian mobile: starts with 6-9, exactly 10 digits
const indianPhoneRegex = /^[6-9]\d{9}$/;

export const customerCreateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim(),
  phone: z
    .string()
    .regex(indianPhoneRegex, "Invalid Indian mobile number (must start with 6-9, 10 digits)"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  addressLine1: z.string().min(1, "Address is required").max(200).trim(),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(1, "City is required").max(100).trim(),
  state: z.string().min(1, "State is required").max(100).trim(),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

// KYC Document validation with type-specific rules
export const kycDocumentSchema = z
  .object({
    docType: z.enum(["AADHAAR", "PAN", "VOTER_ID", "PASSPORT", "DRIVING_LICENSE"]),
    docNumber: z.string().min(1, "Document number is required"),
    fileUrl: z.string().url().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    switch (data.docType) {
      case "PAN":
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.docNumber)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid PAN format (e.g., ABCDE1234F)",
            path: ["docNumber"],
          });
        }
        break;
      case "AADHAAR":
        if (!/^\d{12}$/.test(data.docNumber)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Aadhaar must be exactly 12 digits",
            path: ["docNumber"],
          });
        }
        break;
      case "VOTER_ID":
        if (!/^[A-Z]{3}\d{7}$/.test(data.docNumber)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid Voter ID format (e.g., ABC1234567)",
            path: ["docNumber"],
          });
        }
        break;
      case "PASSPORT":
        if (!/^[A-Z]\d{7}$/.test(data.docNumber)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid Passport format (e.g., A1234567)",
            path: ["docNumber"],
          });
        }
        break;
      case "DRIVING_LICENSE":
        if (data.docNumber.length < 10) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Driving License must be at least 10 characters",
            path: ["docNumber"],
          });
        }
        break;
    }
  });

export type KycDocumentInput = z.infer<typeof kycDocumentSchema>;

/**
 * Mask a document number — show last 4 characters only.
 * Used in all UI surfaces for PII protection.
 */
export function maskDocNumber(docNumber: string): string {
  if (docNumber.length <= 4) return docNumber;
  return "•".repeat(docNumber.length - 4) + docNumber.slice(-4);
}
