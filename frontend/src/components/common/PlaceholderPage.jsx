function PlaceholderPage({ title }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="rounded-lg border border-border bg-surface px-8 py-6 text-center">
        <p className="text-sm text-accent font-medium">AuraMed</p>
        <h1 className="mt-1 text-xl font-semibold text-primary">{title}</h1>
        <p className="mt-2 text-sm text-primary/60">This page has not been built yet.</p>
      </div>
    </div>
  )
}

export default PlaceholderPage
