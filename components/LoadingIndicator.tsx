export default function LoadingIndicator() {
  return (
    <div className="font-utility flex items-center gap-2 text-xs tracking-widest text-ink/70 uppercase">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
      Loading
    </div>
  );
}
