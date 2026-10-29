import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { QuestionBankPage, type BankSearchParams } from "@/features/questions/bank-page";

export const metadata: Metadata = { title: "Question Bank" };

export default async function Page({ searchParams }: { searchParams: Promise<BankSearchParams> }) {
  const user = await requireRole("ADMIN");
  return <QuestionBankPage user={user} base="/admin" searchParams={await searchParams} />;
}
