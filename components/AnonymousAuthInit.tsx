"use client";

import { useEffect } from "react";
import { ensureAnonymousSession } from "@/lib/auth";

// Mounted once in the root layout so a silent anonymous session exists as
// early as possible on app load — no login screen, no visible UI, renders
// nothing.
export default function AnonymousAuthInit() {
  useEffect(() => {
    ensureAnonymousSession();
  }, []);

  return null;
}
