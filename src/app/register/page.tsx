import { RegistrationModule } from "@/components/registration-module";
import { StaffPinGate } from "@/components/staff-pin-gate";
import { hasStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (!(await hasStaffSession())) {
    return <StaffPinGate />;
  }
  return <RegistrationModule />;
}
