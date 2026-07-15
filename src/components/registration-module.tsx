"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { registerFamilyAction } from "@/app/actions";
import { KioskHeader } from "@/components/kiosk-header";
import {
  DEFAULT_HOME_SERVICE,
  emptyChild,
  RegisterFamilyForm,
} from "@/components/register-family-form";
import { Button } from "@/components/ui/button";

export function RegistrationModule() {
  const [pending, startTransition] = useTransition();
  const [parentName, setParentName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [kids, setKids] = useState([emptyChild()]);

  function resetForm() {
    setParentName("");
    setAddress("");
    setContact("");
    setKids([emptyChild()]);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black">
      <KioskHeader
        title="Registration"
        subtitle="Add families before Kids Church starts"
        showSessionControls={false}
        showRegisterLink={false}
      />

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Button variant="outline" asChild>
          <Link href="/">← Back to Kids Church pool</Link>
        </Button>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <RegisterFamilyForm
            parentName={parentName}
            address={address}
            contact={contact}
            kids={kids}
            checkInNow={false}
            showCheckInOption={false}
            pending={pending}
            submitLabel="Save for later check-in"
            description="Register anytime — no open session needed. On Kids Church day, just search the child’s name to Time In."
            onParentNameChange={setParentName}
            onAddressChange={setAddress}
            onContactChange={setContact}
            onKidsChange={setKids}
            onCheckInNowChange={() => {}}
            onSubmit={() => {
              startTransition(async () => {
                try {
                  await registerFamilyAction({
                    parent: {
                      fullName: parentName,
                      address,
                      contactNumber: contact,
                    },
                    children: kids.map((kid) => ({
                      ...kid,
                      homeService: kid.homeService || DEFAULT_HOME_SERVICE,
                    })),
                    checkInNow: false,
                  });
                  resetForm();
                  toast.success("Family saved — they can check in by name later");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Something went wrong",
                  );
                }
              });
            }}
          />
        </section>
      </main>
    </div>
  );
}
