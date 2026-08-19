"use client";

import { useRef } from "react";

// Mostly empty for now (New Step [navbar-2]) — just the two monitoring pills
// at the top. Dismissible: swiping the sidebar itself, tapping the visible
// feed sliver to its right, or the hamburger button in TopNavBar (which
// stays visible above the sidebar specifically to serve as its close
// control — see TopNavBar's z-[70] vs this sidebar's z-[60]).
//
// Stacking priority: the sidebar sits above the rest of the reel screen —
// including the search button, which TopNavBar hides outright while the
// sidebar is open — in both z-index and touch handling. The sliver
// backdrop below stays at z-40 (under the sidebar) since it only spans the
// right 15%, the visible-feed strip the sidebar doesn't cover.
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
