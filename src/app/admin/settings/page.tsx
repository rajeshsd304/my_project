import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Institution-wide configuration." />
      <SettingsForm
        initial={{
          institutionName: settings.institutionName,
          allowSelfRegistration: settings.allowSelfRegistration,
          defaultNegativeMarking: settings.defaultNegativeMarking,
          defaultNegativeMark: settings.defaultNegativeMark,
          overallLeaderboardEnabled: settings.overallLeaderboardEnabled,
          overallLeaderboardTopN: settings.overallLeaderboardTopN,
        }}
      />
    </>
  );
}
