export default function LiveBadge({ text = "LIVE" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-live">
      <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-dot" />
      {text}
    </span>
  );
}
