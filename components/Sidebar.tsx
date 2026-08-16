"use client";

import { useRef } from "react";

// Mostly empty for now (New Step [navbar-2]) — just the two monitoring pills
// at the top. Dismissible three ways (New Step [navbar-3]): swiping the
// sidebar itself, tapping the visible feed sliver to its right, or the close
// button below.
//
// Stacking priority: the sidebar sits above the whole reel screen — including
// TopNavBar — in both z-index and touch handling, per the "sidebar takes
// touch/visual priority over the rest of the screen" requirement. Its z-[60]
// beats TopNavBar's z-50, so wherever the two geometrically overlap (the
// hamburger and filter buttons, both within the sidebar's left-85% span),
// the opaque sidebar covers them and intercepts the touch — they're not
// independently clickable while open. The sliver backdrop below stays at
// z-40 (under TopNavBar) since it only spans the right 15%, where the search
// button lives and should stay reachable.
const SWIPE_DISMISS_THRESHOLD_PX = 60;

export default function Sidebar({
  open,
  coords,
  itemCount,
  onClose,
}: {
  open: boolean;
  coords: { lat: number; lng: number } | null;
  itemCount: number | null;
  onClose: () => void;
}) {
  const touchStartXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (deltaX < -SWIPE_DISMISS_THRESHOLD_PX) onClose();
  };

  return (
    <>
      {/* The visible 15% sliver of feed to the right of the sidebar — shaded
          (translucent, feed still visible through it) whenever the sidebar
          is open, to emphasize the sidebar's presence; deepens slightly on
          press, and tapping it dismisses the sidebar. */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-y-0 right-0 z-40 w-[15%] transition-colors duration-300 ease-out ${
          open ? "pointer-events-auto bg-ink/20 active:bg-ink/30" : "pointer-events-none bg-transparent"
        }`}
      />

      <aside
        aria-hidden={!open}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-y-0 left-0 z-[60] w-[85%] border-r border-ink/15 bg-parchment shadow-lg transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="glass-chip absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full text-ink/70 shadow-sm transition-colors hover:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col items-start gap-2 px-6 pt-20">
          {coords && (
            <div className="font-utility rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 text-xs tracking-widest text-ink/70 uppercase shadow-sm">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </div>
          )}
          {itemCount !== null && (
            <div className="font-utility rounded-full border border-ink/15 bg-parchment/95 px-3 py-1.5 text-xs tracking-widest text-ink/70 uppercase shadow-sm">
              {itemCount} loaded
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
