import { RegistrationModule } from "@/components/registration-module";
import { StaffPinGate } from "@/components/staff-pin-gate";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <StaffPinGate>
      <RegistrationModule />
    </StaffPinGate>
  );
}
