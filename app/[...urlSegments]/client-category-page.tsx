"use client";

import { Category, Rule } from "@/tina/__generated__/types";

export interface ClientCategoryPageProps {
  category: Category;
  rules: Rule[];
}

export default function ClientCategoryPage(props: ClientCategoryPageProps) {
  const { category, rules } = props;
  return (
    <>
      <h1>
        <b>{category.title}</b>
      </h1>
      <br />
        <ul className="list-disc pl-5">
          {rules && rules.map((rule) => {
            return (
              <li key={rule._sys.filename}>
                <a href={`/${rule._sys.filename}`}>{rule.title}</a>
              </li>
            );
          })}
        </ul>
    </>
  );
}
