import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="rounded-lg border border-border bg-surface px-8 py-6 text-center">
        <p className="text-sm text-accent font-medium">404</p>
        <h1 className="mt-1 text-xl font-semibold text-primary">Page not found</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">
          Return home
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
