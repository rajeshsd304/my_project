import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AnnouncementsAdminPage } from "@/features/content/pages";

export const metadata: Metadata = { title: "Announcements" };

export default async function Page() {
  await requireRole("ADMIN");
  return <AnnouncementsAdminPage />;
}
