export default function AuthLoading() {
  return (
    <div aria-label="Loading authentication page" className="animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-5 w-64 rounded bg-muted" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-9 w-full rounded-md bg-muted" />
          </div>
        ))}
        <div className="h-9 w-full rounded-md bg-muted" />
        <div className="mx-auto h-5 w-48 rounded bg-muted" />
      </div>
    </div>
  )
}
