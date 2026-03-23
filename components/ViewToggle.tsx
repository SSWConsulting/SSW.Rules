"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ViewToggle() {
  const pathname = usePathname();
  const isCategories = pathname === "/categories";

  const baseClasses = "px-4 py-1 text-sm transition-colors";
  const activeClasses = "bg-ssw-red text-white";
  const inactiveClasses = "bg-white text-gray-700 hover:bg-ssw-red hover:text-white";

  return (
    <div className="flex items-center">
      <Link href="/" prefetch={true} className={`${baseClasses} border border-r-0 rounded-l-md ${!isCategories ? activeClasses : inactiveClasses}`}>
        What’s hot 🔥
      </Link>
      <Link href="/categories" prefetch={true} className={`${baseClasses} border border-l-0 rounded-r-md ${isCategories ? activeClasses : inactiveClasses}`}>
        Explore categories
      </Link>
    </div>
  );
}
