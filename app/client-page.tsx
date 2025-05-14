"use client";

import { Category } from "@/tina/__generated__/types";

export interface HomeClientPageProps {
  categories: Category[];
}

export default function HomeClientPage(props: HomeClientPageProps) {
  const { categories } = props;

  return (
    <>
      <h1 className="font-bold mb-4">Categories</h1>

      {categories.map((category) =>
        category.__typename === "CategoryTop_category" ? (
          <h3 className="font-bold">{category.title}</h3>
        ) : (
          <ul className="list-disc pl-5">
            <li key={category._sys.filename}>
              <a href={`/${category._sys.filename}`}>{category.title}</a>
            </li>
          </ul>
        )
      )}
    </>
  );
}
