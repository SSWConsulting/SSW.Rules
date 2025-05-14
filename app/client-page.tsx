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
          <ul key={index} className="list-disc pl-5">
            <li>
              <Link href={`/${category._sys.filename}`}>{category.title}</Link>
            </li>
          </ul>
        )
      )}
    </>
  );
}
