"use client";

import { useCallback, useRef } from "react";

/**
 * Handler-level double-submit guard. The first caller gets a release function;
 * further callers get null until that release runs.
 */
export function useSubmitLock() {
  const locked = useRef(false);
  return useCallback(() => {
    if (locked.current) return null;
    locked.current = true;
    return () => {
      locked.current = false;
    };
  }, []);
}
