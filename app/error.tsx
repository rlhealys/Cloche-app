"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-parchment px-8 text-center">
      <p className="font-body max-w-xs text-sm leading-relaxed text-ink/70">
        Something went wrong loading this page.
      </p>
      <button
        onClick={reset}
        className="font-utility rounded-full border border-ink/15 px-4 py-2 text-xs font-medium tracking-widest text-ink/70 uppercase transition-colors hover:text-accent"
      >
        Try again
      </button>
    </main>
  );
}
