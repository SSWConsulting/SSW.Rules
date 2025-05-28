"use client";

import { Category } from "@/tina/__generated__/types";
import Link from "next/link";

export interface HomeClientPageProps {
  categories: Category[];
}

export default function HomeClientPage(props: HomeClientPageProps) {
  const { categories } = props;

  return (
    <>
      <h1 className="font-bold mb-4">Categories</h1>

      {categories.map((category, index) =>
        category.__typename === "CategoryTop_category" ? (
          <h3 key={index} className="font-bold">
            {category.title}
          </h3>
        ) : (
          <ul key={index}>
            <li>
              <Link href={`/${category._sys.filename}`}>{category.title}</Link>
            </li>
          </ul>
        )
      )}

      <div className="flex justify-end mt-4">
        <Link href="/rules/latest-rules/?size=50">
          <button className="px-4 py-2 text-red-600 rounded-md cursor-pointer hover:underline">
            See More
          </button>
        </Link>
      </div>
    </>
  );
}
