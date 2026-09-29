function SkeletonBox({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
}

function ScanResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-5 w-64" />
        <SkeletonBox className="h-8 w-36" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <SkeletonBox className="h-5 w-40" />
              <SkeletonBox className="h-3 w-28" />
            </div>
          </div>
          <SkeletonBox className="h-10 w-36 rounded-lg" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-5">
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
        </div>
      </div>

      <div className="flex gap-2">
        <SkeletonBox className="h-9 w-28 rounded-lg" />
        <SkeletonBox className="h-9 w-32 rounded-lg" />
        <SkeletonBox className="h-9 w-36 rounded-lg" />
        <SkeletonBox className="h-9 w-32 rounded-lg" />
        <SkeletonBox className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <SkeletonBox className="h-6 w-48" />
          <div className="grid grid-cols-2 gap-2">
            <SkeletonBox className="h-36 w-full" />
            <SkeletonBox className="h-36 w-full" />
          </div>
          <SkeletonBox className="h-28 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <SkeletonBox className="h-6 w-48" />
          <SkeletonBox className="h-48 w-full" />
          <SkeletonBox className="h-20 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <SkeletonBox className="h-6 w-48" />
          <div className="grid grid-cols-2 gap-2">
            <SkeletonBox className="h-20 w-full" />
            <SkeletonBox className="h-20 w-full" />
          </div>
          <SkeletonBox className="h-12 w-full" />
          <SkeletonBox className="h-14 w-full" />
        </div>
      </div>
    </div>
  )
}

export default ScanResultsSkeleton
