import { getDashboardData } from "@/app/actions";
import { KidsChurchPool } from "@/components/kids-church-pool";
import { StaffPinGate } from "@/components/staff-pin-gate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  return (
    <StaffPinGate>
      <KidsChurchPool
        session={data.session}
        openSessions={data.openSessions}
        active={data.active}
        configError={data.configError}
        dataSource={data.dataSource}
        missingEnv={data.missingEnv}
      />
    </StaffPinGate>
  );
}
