import { getDashboardData } from "@/app/actions";
import { HistoryModule } from "@/components/history-module";
import { StaffPinGate } from "@/components/staff-pin-gate";
import { hasStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!(await hasStaffSession())) {
    return <StaffPinGate />;
  }

  const data = await getDashboardData();
  return (
    <HistoryModule
      sessions={data.sessions}
      configError={data.configError}
      missingEnv={data.missingEnv}
      dataSource={data.dataSource}
    />
  );
}
