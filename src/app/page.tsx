import { getDashboardData } from "@/app/actions";
import { KidsChurchPool } from "@/components/kids-church-pool";
import { StaffPinGate } from "@/components/staff-pin-gate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  return (
    <StaffPinGate>
      <KidsChurchPool session={data.session} active={data.active} />
    </StaffPinGate>
  );
}
