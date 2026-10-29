// Seeds the institution settings row and the initial admin account.
// Safe to re-run: an existing admin is left untouched (its password is not reset).
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { DEFAULT_TAXONOMY } from "./taxonomy-data";
import { DEMO_NOTE_BODY, DEMO_QUESTIONS } from "./demo-data";
import { questionFields, optionRows } from "../src/lib/questions";
import { parseTags, type QuestionInput } from "../src/lib/question-content";

const db = new PrismaClient();

const ADMIN = {
  name: "NextCampus Admin",
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@nextcampus.local",
  phone: process.env.SEED_ADMIN_PHONE ?? "01700000000",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
};

async function seedTaxonomy() {
  if (await db.unit.count()) return;
  for (const [i, { unit, subjects }] of DEFAULT_TAXONOMY.entries()) {
    await db.unit.create({
      data: {
        name: unit,
        sortOrder: i,
        subjects: {
          create: Object.entries(subjects).map(([name, topics], j) => ({ name, sortOrder: j, topics: { create: topics.map((t) => ({ name: t })) } })),
        },
      },
    });
  }
  console.log(`Seeded ${DEFAULT_TAXONOMY.length} units with subjects and topics.`);
}

export const DEMO = {
  student: { name: "Demo Student", phone: "01800000000", email: "student@nextcampus.local", password: "Student@123" },
  teacher: { name: "Demo Teacher", phone: "01900000000", email: "teacher@nextcampus.local", password: "Teacher@123" },
};

async function seedDemo(adminId: string) {
  if (process.env.SEED_DEMO === "false") return;
  if (await db.user.findFirst({ where: { phone: DEMO.student.phone } })) {
    console.log("Demo data already present; skipping.");
    return;
  }
  const batch = await db.batch.upsert({ where: { name: "Demo Batch 2026" }, update: {}, create: { name: "Demo Batch 2026", description: "Sample batch for trying the platform" } });
  await db.user.create({ data: { ...omitPassword(DEMO.student), role: "STUDENT", batchId: batch.id, passwordHash: await hashPassword(DEMO.student.password) } });
  const teacher = await db.user.create({ data: { ...omitPassword(DEMO.teacher), role: "TEACHER", passwordHash: await hashPassword(DEMO.teacher.password) } });

  const ids: { id: string; unit: string }[] = [];
  for (const q of DEMO_QUESTIONS) {
    const subject = await db.subject.findFirst({ where: { name: q.subject, unit: { name: q.unit } }, include: { topics: true } });
    if (!subject) continue;
    const input: QuestionInput = {
      language: q.language,
      text: { bn: q.text.bn ?? null, en: q.text.en ?? null },
      options: q.options.map((o) => ({ bn: o.bn ?? null, en: o.en ?? null, isCorrect: !!o.correct })),
      explanation: { bn: q.explanation?.bn ?? null, en: q.explanation?.en ?? null },
      difficulty: q.difficulty,
      tags: parseTags(q.tags),
    };
    const created = await db.question.create({
      data: {
        ...questionFields(input),
        subjectId: subject.id,
        topicId: subject.topics.find((t) => t.name === q.topic)?.id ?? null,
        createdById: q.unit === "Medical" ? teacher.id : adminId,
        options: { create: optionRows(input) },
      },
    });
    ids.push({ id: created.id, unit: q.unit });
  }

  const engineering = await db.unit.findFirst({ where: { name: "Engineering" } });
  await db.exam.create({
    data: {
      title: "Demo Mock Test: Engineering",
      type: "FULL_MOCK",
      unitId: engineering?.id,
      instructions: "এটি একটি নমুনা পরীক্ষা। This is a sample exam: try it, check your result, then retake it.",
      durationMinutes: 15,
      marksPerQuestion: 1,
      passMark: 5,
      negativeMarking: true,
      negativeMark: 0.25,
      shuffleQuestions: true,
      showExplanations: true,
      allowRetake: true,
      status: "PUBLISHED",
      createdById: adminId,
      questions: { create: ids.filter((q) => q.unit === "Engineering").map((q, i) => ({ questionId: q.id, sortOrder: i })) },
    },
  });

  await db.announcement.create({
    data: {
      title: "স্বাগতম! Welcome to NextCampus",
      body: "নতুন মডেল টেস্ট এখন চালু আছে। The Demo Mock Test is open now. Negative marking: 0.25 per wrong answer, so think before you guess!\nশুভকামনা — best of luck.",
      pinned: true,
      createdById: adminId,
    },
  });
  const physics = await db.subject.findFirst({ where: { name: "Physics", unit: { name: "Engineering" } } });
  if (physics) {
    await db.studyNote.create({
      data: { title: "গতিবিদ্যা: সূত্র তালিকা (Motion formula sheet)", description: "Key formulas for motion and energy", subjectId: physics.id, kind: "TEXT", body: DEMO_NOTE_BODY, createdById: teacher.id },
    });
  }
  console.log(`Seeded demo: batch, student ${DEMO.student.phone}, teacher ${DEMO.teacher.email}, ${ids.length} questions, 1 exam, 1 announcement, 1 note.`);
}

function omitPassword<T extends { password: string }>(u: T): Omit<T, "password"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u;
  return rest;
}

async function main() {
  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await seedTaxonomy();

  const existing = await db.user.findFirst({ where: { OR: [{ email: ADMIN.email }, { phone: ADMIN.phone }] } });
  if (existing) {
    console.log(`Admin already exists (${existing.email ?? existing.phone}); leaving it unchanged.`);
    await seedDemo(existing.id);
    return;
  }
  const admin = await db.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      phone: ADMIN.phone,
      role: "ADMIN",
      passwordHash: await hashPassword(ADMIN.password),
    },
  });
  console.log(`Seeded admin → ${ADMIN.email} / ${ADMIN.phone}  password: ${ADMIN.password}`);
  await seedDemo(admin.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
