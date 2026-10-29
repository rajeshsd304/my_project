# NextCampus

Admission-test preparation and mock exam platform for university admission candidates in Bangladesh
(engineering, medical, public university A/B/C/D units, GST/cluster). It is built for a **single coaching
center**: no payments, no multi-tenancy, and **no email or SMS is ever sent**.

The interface is in English only. Question content can be in Bangla, English or both, with KaTeX formulas.
The theme is black only.

## Quick start

Requirements: Node.js 20+ and npm. About 300 MB of disk space is needed, mostly for the headless Chrome used for PDFs.

```bash
npm install                     # also downloads headless Chrome for PDFs (Puppeteer)
cp .env.example .env            # then set AUTH_SECRET:  openssl rand -base64 48
npm run setup                   # creates the database and seeds admin + demo data
npm run dev                     # http://localhost:3000
```

For production: `npm run build && npm start`.

## Logins

Created by `npm run setup`. You can log in with **either the phone number or the email**.

| Role    | Phone         | Email                      | Password      |
| ------- | ------------- | -------------------------- | ------------- |
| Admin   | `01700000000` | `admin@nextcampus.local`   | `Admin@12345` |
| Student (demo) | `01800000000` | `student@nextcampus.local` | `Student@123` |
| Teacher (demo) | `01900000000` | `teacher@nextcampus.local` | `Teacher@123` |

**Change the admin password after your first login** (My account → Change password). Before seeding you can
override it with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PHONE` and `SEED_ADMIN_PASSWORD`. Set `SEED_DEMO=false` to
skip the demo content. Re-running the seed is safe: existing accounts are never changed.

### Demo content

- The default structure: Engineering, Medical, Public University A/B/C/D units and GST/Cluster, each with
  subjects and topics.
- **Demo Batch 2026**, which the demo student belongs to.
- 13 questions:
  - Bangla only, English only, and Bangla + English.
  - Several use KaTeX, e.g. $\frac{1}{2}mv^2$, $\int_0^1 2x\,dx$ and $H_2O$.
- **Demo Mock Test: Engineering**: published and always available. It has 11 questions, 15 minutes and
  negative marking of 0.25 per wrong answer, and retakes are allowed.
- A pinned Bangla/English announcement, and a text study note (a formula sheet).

To try it, log in as the demo student and open **Exams → Demo Mock Test**.

## Scripts

| Script              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Development server                                         |
| `npm run build`     | Production build                                           |
| `npm start`         | Run the production build                                   |
| `npm run setup`     | Create/update the database schema and seed                |
| `npm run db:push`   | Apply `prisma/schema.prisma` to the database               |
| `npm run db:seed`   | Seed settings, structure, admin and demo data              |
| `npm run test:pdf`  | Bangla conjunct + KaTeX PDF test (see below)               |
| `npm run typecheck` | TypeScript check                                           |
| `npm run lint`      | ESLint                                                     |

To start again from scratch: delete `prisma/dev.db` and `storage/`, then run `npm run setup`.

### Environment variables

| Variable                    | Description                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`              | Database connection string. Defaults to SQLite (`file:./dev.db`). For production, switch the Prisma provider to `postgresql`. |
| `AUTH_SECRET`               | **Required.** At least 32 random characters, used to sign session cookies.                        |
| `STORAGE_DIR`               | Folder for uploaded question images and note PDFs (default `storage/`). Back it up together with the database. |
| `NEXT_PUBLIC_TIMEZONE`      | Timezone for dates in the app and PDFs (default `Asia/Dhaka`).                                    |
| `PUPPETEER_EXECUTABLE_PATH` | Optional path to a system Chrome/Chromium for PDFs.                                               |
| `INSECURE_COOKIES`          | Set to `true` only to test a production build over plain HTTP.                                   |

## Features

### Accounts and roles
- Log in with a phone number or email plus a password.
  - Phone numbers are normalised, so `01711…`, `8801711…` and `+880 1711-…` are the same account.
  - There is **no verification of any kind**: no email links, no OTP, no "verify your account" step.
- Passwords are hashed with scrypt. Admins reset passwords manually, and a reset logs the user out everywhere.
- Admins can create users one at a time or bulk-import students by CSV (name, phone, batch).
- Self-registration can be switched on or off in Settings. When it is on, a new student can use the account
  immediately.
- **Admin**: everything. **Teacher**: their own questions, exams, results and notes (no access to users or
  settings). **Student**: exams, results, leaderboard, notes and result slips.
- Access is enforced in three places:
  1. Middleware.
  2. A guard in every role's layout, re-checked against the database.
  3. A guard in every API handler.

### Question bank
- Organised as **Unit → Subject → Topic**; admins edit these under Question Bank → Units & subjects.
- Each question has text, 2–6 options, one or several correct answers, an optional explanation, a difficulty,
  tags and an optional image.
- The editor has three modes (**Bangla / English / Both**), a live student preview, KaTeX (`$…$` inline,
  `$$…$$` on its own line), and optional **Avro-style phonetic Bangla typing**.
- Students see exactly what was entered. For "Both", Bangla comes first with English directly below, for the
  question, the options and the explanation. Students have no language toggle.
- Search works in Bangla and English, with filters for unit, subject, topic, difficulty, language and tag.
- Bulk actions: delete, change topic, change difficulty.
- Teachers can edit only their own questions. Questions already used in an exam are archived rather than
  deleted, so past results stay intact.

### Question import (Excel/CSV)
- Two templates, each downloadable as `.xlsx` (recommended) or `.csv`:
  - **Simple**: one language per file; you choose Bangla or English when uploading.
  - **Bangla + English**: the language of each row is detected from which columns are filled.
- The Excel templates have dropdowns for correct_answer and difficulty, 3 example rows (Bangla, English and
  KaTeX), an Instructions sheet, and use the Hind Siliguri font.
- The importer is forgiving:
  - Column names are matched case-insensitively and with aliases; extra spaces and blank rows are ignored.
  - `correct_answer` accepts A/a/1/ক, B/2/খ and so on, plus multiple answers such as "A,C" when enabled.
  - Difficulty accepts easy/Easy/EASY/1/2/3.
  - Tags can be separated by commas or semicolons.
- CSVs are read as UTF-8, with or without a BOM. Files saved in the wrong encoding (Bangla shows as `à¦…`)
  are rejected with clear instructions.
- **Preview before saving**: every row is rendered as the student will see it, marked OK, Warning or Error, with
  messages such as "Row 12: correct_answer is missing." You can fix rows inline.
  - "Import valid rows only (X of Y)" imports the rest.
  - The error report CSV has an `error_reason` column and can be fixed and re-uploaded.
  - Duplicates are warnings, not blockers.
- An optional `image` column, together with a ZIP of images, attaches pictures; missing images are warnings.
- Import history records who imported what, when and how many rows, with **Undo import for 24 hours**.

### Exams
- Types: Full mock, Subject test, Topic quiz, and Practice (untimed).
- Settings: duration, marks per question (total marks are calculated), optional pass mark, and instructions.
- **Negative marking**:
  - An on/off switch, with quick picks 0.25 / 0.50 / 1.00 or a custom value.
  - Skipped answers are never penalised.
  - Settings holds the default for new exams.
  - The setting is **locked once any student has started**.
- Questions are added from the bank or picked randomly by subject, topic and difficulty.
- Options: shuffle questions, shuffle options, show explanations, allow retakes.
- Live exams have a fixed window and allow one attempt; other exams are always available. Exams can be
  assigned to everyone or to specific batches.
- Draft/Published status, and one-click duplication.

### Exam screen
- No navigation sidebar, works well on phones, and shows questions exactly as entered with KaTeX.
- The countdown is always visible and **comes from the server**: changing the device clock has no effect.
  The exam auto-submits when time runs out, and the server also closes expired attempts by itself.
- A question palette shows answered, not answered, marked for review and the current question. There are
  Next/Previous, Clear and Mark for review buttons.
- **Every answer is saved instantly.**
  - If the connection drops, answers are kept on the device and synced on reconnect.
  - After a refresh the student resumes with their answers and remaining time intact.
- The submit confirmation shows answered, unanswered and marked counts.
- **Correct answers and explanations are never sent to the browser during an exam.**

### Results, analytics, leaderboard
- Students get an instant result: score, correct, wrong, skipped, negative marks, percentage and rank.
  - For live exams, the admin can instead release results after the window ends.
  - The answer review for a live exam always opens after the window ends, so early finishers can't share answers.
- The answer review shows each question with the student's answer, the correct answer and the explanation.
- Results include subject- and topic-wise charts with weak topics highlighted. The student dashboard adds a
  score trend, average and best scores, and focus areas.
- Admin/teacher analytics (teachers see only their own exams):
  - Average, highest and lowest scores, pass rate and score distribution.
  - Percentage correct per question, and the most-skipped questions.
  - Export to Excel or CSV.
- Leaderboards: per exam, plus overall weekly, monthly and all-time. Ties go to the faster student, and
  rankings use each student's first attempt. Each leaderboard can be hidden or limited to the top N.

### PDFs
- A **result slip**, a printable **question paper**, and an **answer key** with explanations.
- PDFs have a white background and dark text and labels are in English, while question content keeps the
  Bangla-first-then-English layout.
- They are rendered by headless Chrome, with Hind Siliguri and the KaTeX fonts embedded, so conjuncts
  (যুক্তাক্ষর) and formulas render correctly.

### Announcements and study notes
- Admins post announcements in Bangla, English or both, optionally pinned or aimed at one batch. They appear
  on the student dashboard.
- Admins and teachers upload notes per subject, as a PDF or as text with formulas. Students can read and
  download them.

## Bangla PDF test

`npm run test:pdf` renders 24 conjunct-heavy words (বিজ্ঞান, ক্ষুদ্র, শ্রদ্ধা, উজ্জ্বল, স্বাস্থ্য, রাষ্ট্র, লক্ষ্মী, …) at three
sizes, plus a both-language question with KaTeX, through the production PDF engine. It then checks:

1. Hind Siliguri and the KaTeX fonts are embedded in the PDF, and every Bangla text run uses Hind Siliguri.
2. **Shaping**: conjuncts are drawn as single shaped glyphs, with no stray hasanta (্) glyphs that would mean
   a broken conjunct.
3. The output is written to `test-output/bangla-test.pdf`. On macOS it is also rasterised to PNG for
   inspection.

One known limitation: when you copy text *out of* a PDF, some words can come out in a different order. Chrome
stores pre-base vowel signs such as ি in visual order, so this affects copy-and-paste and search inside a PDF
viewer. It does not affect how the PDF looks or prints.

## Project structure

```
prisma/        schema.prisma, seed.ts, taxonomy-data.ts, demo-data.ts
scripts/       test-pdf-bangla.ts
src/
  middleware.ts                 route-level access control + CSRF origin check
  lib/
    auth.ts, token.ts, roles.ts accounts, sessions, roles
    question-content.ts         language/difficulty/answer rules (shared by browser + server)
    question-import.ts          import validation (shared: live preview + server re-check)
    import-parse.ts             xlsx/csv/zip parsing
    rich.ts, render-question.ts KaTeX rendering
    exams.ts                    scheduling, server timer, scoring, release rules
    results.ts                  ranks, leaderboards, analytics
    pdf.ts, pdf-templates.ts    PDF engine + templates
    avro.ts                     phonetic Bangla typing
  features/                     page-level UI shared by admin/teacher routes
  components/                   app shell, question view, charts, UI primitives
  app/                          routes: (auth), admin, teacher, student, exam, account, api
storage/       uploaded files (git-ignored)
```
