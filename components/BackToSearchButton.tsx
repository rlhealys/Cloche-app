import Link from "next/link";

// search-7: the Menu Item Detail Screen's back arrow — always returns to the
// Search Screen. Unlike the Restaurant Menu Screen's back button, this
// screen has exactly one entry point (a search result), so there's no
// `?from=` marker to branch on.
export default function BackToSearchButton() {
  return (
    <Link
      href="/search"
      aria-label="Back to search"
      className="glass-chip fixed top-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-ink/70 shadow-sm transition-colors hover:text-accent"
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
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );
}
