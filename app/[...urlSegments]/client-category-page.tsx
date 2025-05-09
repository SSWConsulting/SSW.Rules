"use client";

import { useTina } from "tinacms/dist/react";
import { CategoryQueryProps } from "@/models/CategoryQueryProps";
import { Rule } from "@/tina/__generated__/types";

export interface ClientCategoryPageProps {
  categoryQueryProps: CategoryQueryProps;
  rules: Rule[];
}

export default function ClientCategoryPage(props: ClientCategoryPageProps) {
  const { categoryQueryProps, rules } = props;

  const categoryData = useTina({
    query: categoryQueryProps.query,
    variables: categoryQueryProps.variables,
    data: categoryQueryProps.data,
  }).data;

  const category = categoryData.category;

  return (
    <>
      <h1 className="font-bold mb-4"> {category.title} </h1>
      <ul className="list-disc pl-5">
        {rules &&
          rules.map((rule) => {
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
