"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ViewToggle() {
  const pathname = usePathname();
  const isCategories = pathname === "/categories";

  const baseClasses = "px-4 py-1 text-sm transition-colors";
  const activeClasses = "bg-ssw-red text-white";
  const inactiveClasses = "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  return (
    <div className="flex items-center">
      <Link href="/" prefetch={true} className={`${baseClasses} border rounded-l-md ${!isCategories ? activeClasses : inactiveClasses}`}>
        What’s Hot 🔥
      </Link>
      <Link href="/categories" prefetch={true} className={`${baseClasses} border border-l-0 rounded-r-md ${isCategories ? activeClasses : inactiveClasses}`}>
        Explore Categories
      </Link>
    </div>
  );
}
