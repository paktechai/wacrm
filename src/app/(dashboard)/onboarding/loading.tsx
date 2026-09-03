export default function OnboardingLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl animate-pulse space-y-7"
      aria-label="Loading setup"
    >
      <div className="space-y-3">
        <div className="bg-muted h-4 w-32 rounded" />
        <div className="bg-muted h-9 w-72 max-w-full rounded" />
        <div className="bg-muted h-4 w-full max-w-xl rounded" />
      </div>
      <div className="bg-muted h-2 rounded-full" />
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="border-border flex items-center gap-4 border-b px-5 py-5 last:border-b-0"
          >
            <div className="bg-muted size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-4 w-36 rounded" />
              <div className="bg-muted h-3 w-full max-w-md rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
