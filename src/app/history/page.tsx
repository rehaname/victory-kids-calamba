import { getDashboardData } from "@/app/actions";
import { HistoryModule } from "@/components/history-module";
import { StaffPinGate } from "@/components/staff-pin-gate";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const data = await getDashboardData();
  return (
    <StaffPinGate>
      <HistoryModule sessions={data.sessions} />
    </StaffPinGate>
  );
}
