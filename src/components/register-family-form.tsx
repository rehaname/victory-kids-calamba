"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_POOL_LABELS, getAge, getAgePool } from "@/lib/age";

/** Victory Calamba Kids Church service times */
export const HOME_SERVICE_OPTIONS = ["9am", "11am", "2pm", "4pm"] as const;
export type HomeServiceOption = (typeof HOME_SERVICE_OPTIONS)[number];
export const DEFAULT_HOME_SERVICE: HomeServiceOption = "9am";

export type ChildDraft = {
  firstName: string;
  lastName: string;
  nickname: string;
  birthday: string;
  homeService: string;
};

export const emptyChild = (): ChildDraft => ({
  firstName: "",
  lastName: "",
  nickname: "",
  birthday: "",
  homeService: DEFAULT_HOME_SERVICE,
});

type Props = {
  parentName: string;
  address: string;
  contact: string;
  kids: ChildDraft[];
  checkInNow: boolean;
  pending?: boolean;
  submitLabel?: string;
  description?: string;
  showCheckInOption?: boolean;
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
  description = "First visit only. Ages 4–12. Choose their home service time.",
  showCheckInOption = true,
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
        <p className="text-sm text-black/55">{description}</p>
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
                <Field
                  label="Nickname (optional)"
                  value={kid.nickname}
                  onChange={(v) =>
                    onKidsChange(kids.map((k, i) => (i === index ? { ...k, nickname: v } : k)))
                  }
                />
                <div className="space-y-2">
                  <Label>Birthday</Label>
                  <Input
                    type="date"
                    className="h-14 text-base"
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`home-service-${index}`}>Usual Sunday service</Label>
                  <p className="text-xs text-black/45">
                    The service this family normally attends — not today&rsquo;s Kids Church session.
                  </p>
                  <select
                    id={`home-service-${index}`}
                    required
                    className="h-14 w-full rounded-md border border-black/15 bg-white px-3 text-base"
                    value={kid.homeService}
                    onChange={(e) =>
                      onKidsChange(
                        kids.map((k, i) =>
                          i === index ? { ...k, homeService: e.target.value } : k,
                        ),
                      )
                    }
                  >
                    {HOME_SERVICE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="w-full sm:w-auto"
          onClick={() => onKidsChange([...kids, emptyChild()])}
        >
          Add another child
        </Button>
      </div>

      {showCheckInOption && (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={checkInNow}
            onChange={(e) => onCheckInNowChange(e.target.checked)}
            className="size-4"
          />
          Time in now after saving
        </label>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" size="xl" className="w-full sm:w-auto" onClick={onCancel}>
            Back
          </Button>
        )}
        <Button
          type="submit"
          size="xl"
          disabled={pending}
          className="w-full bg-[#003B8E] text-white hover:bg-[#002c6b] sm:w-auto"
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
        className="h-14 text-base"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
