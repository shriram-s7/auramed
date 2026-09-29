import { Link } from 'react-router-dom'

function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="rounded-lg border border-border bg-surface px-8 py-6 text-center">
        <p className="text-sm text-danger font-medium">403</p>
        <h1 className="mt-1 text-xl font-semibold text-primary">Access denied</h1>
        <p className="mt-2 text-sm text-primary/60">
          You do not have permission to view this page.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">
          Return home
        </Link>
      </div>
    </div>
  )
}

export default ForbiddenPage
