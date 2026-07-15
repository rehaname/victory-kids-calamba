import { getDashboardData } from "@/app/actions";
import { KidsChurchPool } from "@/components/kids-church-pool";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  return <KidsChurchPool session={data.session} active={data.active} />;
}
