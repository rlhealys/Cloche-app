// Static layout only — hardcoded mock data, no props/live data yet (Step 7).
const mockItem = {
  name: "Brown Butter Agnolotti",
  description:
    "House-made pasta parcels filled with roasted squash and sage, finished with brown butter and toasted hazelnuts.",
  price: 24,
  hasImageAccent: true,
};

export default function FeedCard() {
  return (
    <article className="mx-auto flex h-full w-full max-w-md flex-col justify-center bg-parchment px-8 py-12 text-ink">
      {mockItem.hasImageAccent && (
        <div className="mb-6 ml-auto h-24 w-24 -rotate-2 rounded-sm border-4 border-ink/10 bg-gradient-to-br from-accent/30 to-ink/20 shadow-sm" />
      )}

      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
        {mockItem.name}
      </h1>

      <p className="font-body mt-4 text-base leading-relaxed text-ink/70">
        {mockItem.description}
      </p>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="flex-1 border-b border-dotted border-ink/40" />
        <span className="font-utility text-lg font-medium tracking-wide text-accent">
          ${mockItem.price.toFixed(2)}
        </span>
      </div>

      <div className="font-utility mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-ink/15 px-3 py-1 text-xs tracking-wide text-ink/60 uppercase">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M5 17h14M5 17a2 2 0 1 0 4 0M5 17a2 2 0 1 1 4 0M15 17a2 2 0 1 0 4 0M15 17a2 2 0 1 1 4 0M5 17V9l2-4h10l2 4v8" />
        </svg>
        <span>-- min away</span>
      </div>
    </article>
  );
}
