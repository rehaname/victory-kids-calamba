import { getDashboardData } from "@/app/actions";
import { KioskApp } from "@/components/kiosk-app";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  return (
    <KioskApp
      session={data.session}
      active={data.active}
      sessions={data.sessions}
    />
  );
}
