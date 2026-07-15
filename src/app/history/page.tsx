import { getDashboardData } from "@/app/actions";
import { HistoryModule } from "@/components/history-module";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const data = await getDashboardData();
  return <HistoryModule sessions={data.sessions} />;
}
