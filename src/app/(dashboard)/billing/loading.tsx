export default function BillingLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse space-y-7"
      aria-label="Loading plan and usage"
    >
      <div className="space-y-3">
        <div className="bg-muted h-4 w-36 rounded" />
        <div className="bg-muted h-9 w-52 rounded" />
        <div className="bg-muted h-4 w-full max-w-xl rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="border-border bg-card h-36 rounded-2xl border"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-card h-52 rounded-2xl border" />
        <div className="border-border bg-card h-52 rounded-2xl border" />
      </div>
      <div className="border-border bg-card h-48 rounded-2xl border" />
    </div>
  );
}
