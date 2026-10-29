import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().trim().min(2, "Title is too short.").max(150),
  body: z.string().trim().min(1, "Write the announcement.").max(10000),
  pinned: z.boolean().default(false),
  batchId: z.string().nullable().optional(),
});

export const noteSchema = z
  .object({
    title: z.string().trim().min(2, "Title is too short.").max(150),
    description: z.string().trim().max(500).nullable().optional(),
    subjectId: z.string().min(1, "Choose a subject."),
    kind: z.enum(["TEXT", "PDF"]),
    body: z.string().max(100_000).nullable().optional(),
    fileId: z.string().nullable().optional(),
  })
  .refine((n) => (n.kind === "TEXT" ? !!n.body?.trim() : !!n.fileId), { message: "Add the note text, or upload a PDF." });
