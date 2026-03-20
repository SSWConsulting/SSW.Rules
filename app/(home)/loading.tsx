export default function Loading() {
  return (
    <div className="animate-pulse layout-two-columns">
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
  );
}
