import { getDashboardData } from "@/app/actions";
import { KidsChurchPool } from "@/components/kids-church-pool";
import { StaffPinGate } from "@/components/staff-pin-gate";
import { hasStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await hasStaffSession())) {
    return <StaffPinGate />;
  }

  const data = await getDashboardData();
  return (
    <KidsChurchPool
      session={data.session}
      openSessions={data.openSessions}
      active={data.active}
      configError={data.configError}
      dataSource={data.dataSource}
      missingEnv={data.missingEnv}
    />
  );
}
