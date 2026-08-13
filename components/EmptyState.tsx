export default function EmptyState({ message }: { message: string }) {
  return (
    <p className="font-body max-w-xs text-center text-sm leading-relaxed text-ink/70">
      {message}
    </p>
  );
}
