"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatServiceTime } from "@/lib/session";
import { SERVICE_TIMES } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onStart: (serviceTime: string, location: string) => void;
};

export function StartSessionDialog({
  open,
  onOpenChange,
  pending = false,
  onStart,
}: Props) {
  const [location, setLocation] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setLocation("");
    onOpenChange(next);
  }

  const trimmed = location.trim();
  const canStart = trimmed.length > 0 && !pending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a Kids Church session</DialogTitle>
          <DialogDescription>
            Enter this tablet&apos;s location and pick a service hour. Every Start
            creates a new session so Halang and Bayan (or two kiosks at the same
            site) can run at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="session-location">Location</Label>
          <Input
            id="session-location"
            className="h-12 text-base"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Halang or Bayan"
            autoFocus
            disabled={pending}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SERVICE_TIMES.map((serviceTime) => (
            <Button
              key={serviceTime}
              size="xl"
              disabled={!canStart}
              onClick={() => onStart(serviceTime, trimmed)}
              className="h-16 bg-[#003B8E] text-base text-white hover:bg-[#002c6b] disabled:bg-black/10"
            >
              <Play className="size-4" />
              {formatServiceTime(serviceTime)}
            </Button>
          ))}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
