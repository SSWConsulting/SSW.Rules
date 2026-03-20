import Link from "next/link";

type HomeView = "categories" | "activity";

interface ViewToggleProps {
  activeView: HomeView;
}

export default function ViewToggle({ activeView }: ViewToggleProps) {
  const baseClasses = "px-4 py-1 text-sm transition-colors";
  const activeClasses = "bg-ssw-red text-white";
  const inactiveClasses = "bg-white text-gray-700 hover:bg-ssw-red hover:text-white";

  return (
    <div className="flex items-center">
      <Link
        href="/"
        prefetch={true}
        className={`${baseClasses} border border-r-0 rounded-l-md ${activeView === "activity" ? activeClasses : inactiveClasses}`}
      >
        Activity View
      </Link>
      <Link
        href="/categories"
        prefetch={true}
        className={`${baseClasses} border border-l-0 rounded-r-md ${activeView === "categories" ? activeClasses : inactiveClasses}`}
      >
        Category View
      </Link>
    </div>
  );
}
