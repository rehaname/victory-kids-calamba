"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_POOL_LABELS, getAge, getAgePool } from "@/lib/age";

export const HOME_SERVICE = "Church Service";

export type ChildDraft = {
  firstName: string;
  lastName: string;
  birthday: string;
};

export const emptyChild = (): ChildDraft => ({
  firstName: "",
  lastName: "",
  birthday: "",
});

type Props = {
  parentName: string;
  address: string;
  contact: string;
  kids: ChildDraft[];
  checkInNow: boolean;
  pending?: boolean;
  submitLabel?: string;
  onParentNameChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onContactChange: (v: string) => void;
  onKidsChange: (kids: ChildDraft[]) => void;
  onCheckInNowChange: (v: boolean) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

export function RegisterFamilyForm({
  parentName,
  address,
  contact,
  kids,
  checkInNow,
  pending = false,
  submitLabel = "Save registration",
  onParentNameChange,
  onAddressChange,
  onContactChange,
  onKidsChange,
  onCheckInNowChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Register parent &amp; child
        </h2>
        <p className="text-sm text-black/55">
          First visit only. Ages 4–12. Home service: {HOME_SERVICE}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parent's Name" value={parentName} onChange={onParentNameChange} required />
        <Field label="Contact Number" value={contact} onChange={onContactChange} required />
        <div className="sm:col-span-2">
          <Field label="Address (optional)" value={address} onChange={onAddressChange} />
        </div>
      </div>

      <div className="space-y-4">
        {kids.map((kid, index) => {
          const pool = kid.birthday ? getAgePool(kid.birthday) : null;
          const age = kid.birthday ? getAge(kid.birthday) : null;
          return (
            <div key={index} className="rounded-xl border border-black/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">Child {index + 1}</p>
                {kids.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onKidsChange(kids.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="First Name"
                  value={kid.firstName}
                  onChange={(v) =>
                    onKidsChange(kids.map((k, i) => (i === index ? { ...k, firstName: v } : k)))
                  }
                  required
                />
                <Field
                  label="Last Name"
                  value={kid.lastName}
                  onChange={(v) =>
                    onKidsChange(kids.map((k, i) => (i === index ? { ...k, lastName: v } : k)))
                  }
                  required
                />
                <div className="space-y-2">
                  <Label>Birthday</Label>
                  <Input
                    type="date"
                    className="h-12"
                    required
                    value={kid.birthday}
                    onChange={(e) =>
                      onKidsChange(
                        kids.map((k, i) => (i === index ? { ...k, birthday: e.target.value } : k)),
                      )
                    }
                  />
                  {kid.birthday && (
                    <p className={`text-xs ${pool ? "text-black/45" : "text-red-600"}`}>
                      {pool
                        ? `${AGE_POOL_LABELS[pool]} · age ${age}`
                        : `Age ${age} is outside the 4–12 range`}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Home Service</Label>
                  <div className="flex h-12 items-center rounded-md border border-black/10 bg-[#f7f9fc] px-3 text-base text-black/70">
                    {HOME_SERVICE}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          onClick={() => onKidsChange([...kids, emptyChild()])}
        >
          Add another child
        </Button>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={checkInNow}
          onChange={(e) => onCheckInNowChange(e.target.checked)}
          className="size-4"
        />
        Time in now after saving
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="h-12 bg-[#003B8E] text-base text-white hover:bg-[#002c6b]"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        className="h-12 text-base"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
