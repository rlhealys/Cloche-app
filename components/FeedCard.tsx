import Image from "next/image";
import Link from "next/link";
import DistanceBadge from "./DistanceBadge";
import type { ConfirmedMenuItem } from "@/types";

export default function FeedCard({
  item,
  userLat,
  userLng,
}: {
  item: ConfirmedMenuItem;
  userLat: number;
  userLng: number;
}) {
  return (
    <article className="relative mx-auto flex h-full w-full max-w-md flex-col justify-center bg-parchment px-8 py-12 text-ink">
      <Link
        href={`/restaurant/${item.restaurant_id}`}
        className="glass-chip mb-6 ml-auto flex w-fit items-center gap-3 rounded-full py-2 pr-5 pl-2 text-ink/70 shadow-sm transition-colors hover:text-accent"
      >
        {item.hero_image_url && (
          <span className="relative h-24 w-24 shrink-0 -rotate-2 overflow-hidden rounded-sm border-4 border-ink/10 shadow-sm">
            <Image
              src={item.hero_image_url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </span>
        )}
        <span className="font-utility inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
          {item.restaurant_name}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3 shrink-0"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </Link>

      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
        {item.name}
      </h1>

      {item.category && (
        <p className="glass-chip font-utility mt-2 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium tracking-widest text-ink/70 uppercase shadow-sm">
          {item.category}
        </p>
      )}

      {item.description && (
        <p className="font-body mt-4 text-base leading-relaxed text-ink/70">
          {item.description}
        </p>
      )}

      {item.price !== null && (
        <div className="mt-6 flex items-baseline gap-2">
          <span className="flex-1 border-b border-dotted border-ink/40" />
          <span className="font-utility text-lg font-medium tracking-wide text-accent">
            ${item.price.toFixed(2)}
          </span>
        </div>
      )}

      <DistanceBadge
        userLat={userLat}
        userLng={userLng}
        lat={item.lat}
        lng={item.lng}
        placeId={item.place_id}
        restaurantId={item.restaurant_id}
        restaurantName={item.restaurant_name}
      />
    </article>
  );
}
