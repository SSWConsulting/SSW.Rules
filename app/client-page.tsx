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
      <ul className="list-disc pl-5">
        {categories.map((category) => (
          <li key={category._sys.filename}>
            <a href={`/${category._sys.filename}`}>{category.title}</a>
          </li>
        ))}
      </ul>
    </>
  );
}
