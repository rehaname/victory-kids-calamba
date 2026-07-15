import { listChildrenAction } from "@/app/actions";
import { ChildrenRoster } from "@/components/children-roster";
import { StaffPinGate } from "@/components/staff-pin-gate";

export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  const roster = await listChildrenAction();
  return (
    <StaffPinGate>
      <ChildrenRoster roster={roster} />
    </StaffPinGate>
  );
}
