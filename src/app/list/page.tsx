import { listChildrenAction } from "@/app/actions";
import { ChildrenRoster } from "@/components/children-roster";
import { StaffPinGate } from "@/components/staff-pin-gate";
import { hasStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export default async function ListPage() {
  if (!(await hasStaffSession())) {
    return <StaffPinGate />;
  }

  const result = await listChildrenAction();
  if (!result.ok) {
    return <ChildrenRoster roster={[]} configError={result.error} loadFailed />;
  }
  return <ChildrenRoster roster={result.children} />;
}
