"use client";

import type { ReactNode } from "react";
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
  onOpenChange,
  onContinue,
  onBack,
  onConfirmDelete,
}: Props) {
  function handleOpenChange(next: boolean) {
    if (deleting) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,40rem)] flex-col gap-4 sm:max-w-md"
        showCloseButton={!deleting}
        onEscapeKeyDown={(event) => {
          if (deleting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (deleting) event.preventDefault();
        }}
      >
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>{summaryTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                Review what will be removed before continuing.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{summaryBody}</div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not delete</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                size="xl"
                className="w-full"
                disabled={deleting || continueDisabled}
                onClick={onContinue}
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
            <DialogHeader>
              <DialogTitle>{finalTitle}</DialogTitle>
              <DialogDescription>{finalDescription}</DialogDescription>
            </DialogHeader>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not delete</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                size="xl"
                className="w-full bg-red-700 text-white hover:bg-red-800"
                disabled={deleting}
                onClick={onConfirmDelete}
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
