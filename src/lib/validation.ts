import { z } from "zod";
import { normalizeEmail, normalizePhone } from "./identity";
import { MIN_PASSWORD_LENGTH } from "./password";
import { ROLES } from "./roles";

/**
 * Optional string field: absent stays undefined ("leave unchanged" on updates),
 * while null / "" / whitespace become null ("clear it").
 */
const blankable = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim()));

export const nameSchema = z
  .string({ required_error: "Name is required." })
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name is too long.");

export const optionalPhone = blankable.transform((v, ctx) => {
  if (v == null) return v;
  const phone = normalizePhone(v);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." });
    return z.NEVER;
  }
  return phone;
});

export const optionalEmail = blankable.transform((v, ctx) => {
  if (v == null) return v;
  const email = normalizeEmail(v);
  if (!email) {
    ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
    return z.NEVER;
  }
  return email;
});

export const passwordSchema = z
  .string({ required_error: "Password is required." })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, "Password is too long.");

/** Blank → null (caller generates a password); otherwise must satisfy passwordSchema. Not trimmed. */
export const optionalPassword = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(passwordSchema.nullable());

export const roleSchema = z.enum(ROLES, { errorMap: () => ({ message: "Invalid role." }) });

export const optionalId = blankable;

export const userCreateSchema = z
  .object({
    name: nameSchema,
    email: optionalEmail,
    phone: optionalPhone,
    role: roleSchema.default("STUDENT"),
    batchId: optionalId,
    password: optionalPassword,
  })
  .refine((d) => d.email || d.phone, { message: "Provide a phone number or an email address." });

export const userUpdateSchema = z.object({
  name: nameSchema.optional(),
  email: optionalEmail,
  phone: optionalPhone,
  role: roleSchema.optional(),
  batchId: optionalId,
  active: z.boolean().optional(),
});

export const batchSchema = z.object({
  name: z.string().trim().min(1, "Batch name is required.").max(80, "Batch name is too long."),
  description: blankable.pipe(z.string().max(300, "Description is too long.").nullish()),
});
