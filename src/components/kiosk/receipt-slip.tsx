import { formatTime } from "@/lib/age";
import { formatSessionDate } from "@/lib/session";
import type { PaperWidth } from "@/lib/printing/paper";
import type { Receipt } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  receipt: Receipt;
  paperWidth: PaperWidth;
  /** Marks the slip as a duplicate when reprinted from the settings roster. */
  reprint?: boolean;
  className?: string;
};

/**
 * The slip itself, laid out at true paper width in millimetres so what staff
 * see on screen matches what the printer produces. This is also the element the
 * system print dialog captures, via the print rules in globals.css.
 */
export function ReceiptSlip({ receipt, paperWidth, reprint, className }: Props) {
  return (
    <div
      data-receipt-slip
      style={{ width: `${paperWidth}mm` }}
      className={cn(
        "bg-white px-3 py-4 font-mono text-[11px] leading-[1.45] text-black",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/victory-mark.svg"
          alt=""
          width={40}
          height={40}
          className="size-10"
        />
        <p className="font-semibold tracking-[0.08em] uppercase">
          Victory Calamba Kids Church
        </p>
      </div>

      <Divider />

      <div className="text-center">
        <p className="font-sans text-[26px] leading-tight font-bold tracking-tight break-words uppercase">
          {receipt.displayName}
        </p>
        <p className="mt-0.5 text-[10px] break-words">{receipt.fullName}</p>
      </div>

      <Divider />

      <dl className="space-y-0.5">
        <Row label="Parent" value={receipt.parentName} />
        <Row label="Age" value={`${receipt.age}  (${receipt.agePoolLabel})`} />
        <Row label="Time In" value={formatTime(receipt.timeIn)} />
        <Row label="Session" value={receipt.sessionName} />
        <Row label="Date" value={formatSessionDate(receipt.sessionDate)} />
      </dl>

      <Divider />

      <div className="text-center">
        <p className="text-[13px] font-bold tracking-[0.18em]">
          CLAIM {receipt.claimCode}
        </p>
        <p className="mt-1 text-[10px]">Please keep this slip</p>
        {reprint && (
          <p className="mt-1 text-[10px] font-bold tracking-[0.14em]">** REPRINT **</p>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="my-2 border-t border-dashed border-black/45"
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[62px] shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 font-semibold break-words">{value}</dd>
    </div>
  );
}
