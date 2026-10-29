import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { TaxonomyPage } from "@/features/questions/misc-pages";

export const metadata: Metadata = { title: "Units & subjects" };

export default async function Page() {
  await requireRole("ADMIN");
  return <TaxonomyPage />;
}
