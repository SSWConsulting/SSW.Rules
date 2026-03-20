import { Section } from "@/components/layout/section";

export default function Loading() {
  return (
    <Section>
      <div className="animate-pulse">
        {/* Breadcrumbs skeleton */}
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-4 m-4">
          <div className="h-8 bg-gray-200 rounded w-80" />
          <div className="flex gap-0">
            <div className="h-8 bg-gray-200 rounded-l-md w-28" />
            <div className="h-8 bg-gray-100 rounded-r-md w-32" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="layout-two-columns">
          <div className="layout-main-section space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border border-gray-200 rounded p-4 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
              </div>
            ))}
          </div>
          <div className="layout-sidebar space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-200 rounded p-4 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
