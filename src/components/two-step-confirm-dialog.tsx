"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeleteConfirmStep } from "@/lib/staff-delete-confirm";

type Props = {
  open: boolean;
  step: DeleteConfirmStep;
  deleting: boolean;
  error: string | null;
  summaryTitle: string;
  summaryBody: ReactNode;
  finalTitle: string;
  finalDescription: string;
  continueDisabled?: boolean;
  errorTitle?: string;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
  onConfirmDelete: () => void;
};

export function TwoStepConfirmDialog({
  open,
  step,
  deleting,
  error,
  summaryTitle,
  summaryBody,
  finalTitle,
  finalDescription,
  continueDisabled = false,
  errorTitle = "Could not delete",
  onOpenChange,
  onContinue,
  onBack,
  onConfirmDelete,
}: Props) {
  const finalTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open || step !== 2) return;
    // Step 2 replaces Continue. Leave focus on the title so a held Enter
    // does not activate Delete.
    finalTitleRef.current?.focus();
  }, [open, step]);

  function handleOpenChange(next: boolean) {
    if (deleting) return;
    onOpenChange(next);
  }

  function blockRepeatKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,40rem)] flex-col gap-4 overflow-hidden sm:max-w-md"
        showCloseButton={!deleting}
        onEscapeKeyDown={(event) => {
          if (deleting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (deleting) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (deleting) event.preventDefault();
        }}
        onFocusOutside={(event) => {
          if (deleting) event.preventDefault();
        }}
      >
        {step === 1 ? (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle>{summaryTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                Review what will be removed before continuing.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{summaryBody}</div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{errorTitle}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={deleting || continueDisabled}
                onClick={onContinue}
                onKeyDown={blockRepeatKey}
              >
                Continue
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full"
                disabled={deleting}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle ref={finalTitleRef} tabIndex={-1} className="outline-none">
                {finalTitle}
              </DialogTitle>
              <DialogDescription>{finalDescription}</DialogDescription>
            </DialogHeader>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{errorTitle}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                size="xl"
                className="w-full bg-red-700 text-white hover:bg-red-800"
                disabled={deleting}
                onClick={onConfirmDelete}
                onKeyDown={blockRepeatKey}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full"
                disabled={deleting}
                onClick={onBack}
              >
                Go back
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
