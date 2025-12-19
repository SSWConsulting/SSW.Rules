import { Section } from "@/components/layout/section";

export default function Loading() {
  return (
    <Section>
      <div>
        {/* Breadcrumbs skeleton */}
        <div className="mb-4">
          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>

        <div className="flex">
          {/* Main content area */}
          <div className="w-full lg:w-2/3 bg-white pt-4 p-6 border border-[#CCC] rounded shadow-lg">
            {/* Title and action buttons skeleton */}
            <div className="flex justify-between mb-4">
              <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
              <div className="flex gap-2">
                <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>

            {/* Content skeleton */}
            <div className="space-y-3 mb-6">
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse"></div>
            </div>

            {/* Rule list skeleton (for category pages) */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-200 rounded p-4">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-1 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="hidden lg:block lg:w-1/3 pt-0 p-6 pr-0">
            <div className="space-y-6">
              {/* Sidebar cards skeleton */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white border border-[#CCC] rounded p-4 shadow-sm">
                  <div className="h-5 bg-gray-200 rounded w-24 mb-3 animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse"></div>
                  </div>
                </div>
              ))}

              {/* Sidebar list skeleton (for category pages) */}
              <div className="border-l-3 border-gray-300 pl-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="py-1 ml-4">
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
