import type { ConfirmedMenuItem } from "@/types";

export default function MenuItemRow({ item }: { item: ConfirmedMenuItem }) {
  return (
    <div className="py-4">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-lg font-medium tracking-tight">{item.name}</h3>
        {item.price !== null && (
          <>
            <span className="flex-1 border-b border-dotted border-ink/30" />
            <span className="font-utility text-sm font-medium tracking-wide text-accent">
              ≈${item.price.toFixed(2)}
            </span>
          </>
        )}
      </div>
      {item.description && (
        <p className="font-body mt-1 text-sm leading-relaxed text-ink/70">
          {item.description}
        </p>
      )}
    </div>
  );
}
