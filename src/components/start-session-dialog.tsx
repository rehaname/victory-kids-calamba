"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatServiceTime } from "@/lib/session";
import { SERVICE_TIMES } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Service times that already have an open session today. */
  liveServiceTimes: string[];
  pending?: boolean;
  onStart: (serviceTime: string) => void;
};

export function StartSessionDialog({
  open,
  onOpenChange,
  liveServiceTimes,
  pending = false,
  onStart,
}: Props) {
  const live = new Set(liveServiceTimes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a Kids Church session</DialogTitle>
          <DialogDescription>
            Pick the service this tablet will check kids into. Sessions are saved
            online so they survive a refresh.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {SERVICE_TIMES.map((serviceTime) => {
            const alreadyLive = live.has(serviceTime);
            return (
              <Button
                key={serviceTime}
                size="xl"
                variant={alreadyLive ? "outline" : "default"}
                disabled={pending || alreadyLive}
                onClick={() => onStart(serviceTime)}
                className={
                  alreadyLive
                    ? "h-16 text-base"
                    : "h-16 bg-[#003B8E] text-base text-white hover:bg-[#002c6b]"
                }
              >
                <Play className="size-4" />
                {formatServiceTime(serviceTime)}
                {alreadyLive && <span className="text-xs font-normal">live</span>}
              </Button>
            );
          })}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
