"use client";

import { useTina } from "tinacms/dist/react";
import { CategoryQueryProps } from "@/models/CategoryQueryProps";
import { Category, Rule } from "@/tina/__generated__/types";

export interface ClientCategoryPageProps {
  categoryQueryProps: any;
}

export default function ClientCategoryPage(props: ClientCategoryPageProps) {
  const { categoryQueryProps } = props;

  const categoryData = useTina({
    query: categoryQueryProps?.props?.query,
    variables: categoryQueryProps?.props?.variables,
    data: categoryQueryProps?.props?.data,
  }).data;

  const category = categoryData;

  return (
    <>
      <h1 className="font-bold mb-4"> {category.title} </h1>
      <ul className="list-disc pl-5">
        {category.index &&
          category.index.map((x) => {
            return (
              <li key={x.rule._sys.filename}>
                <a href={`/${x.rule._sys.filename}`}>{x.rule.title}</a>
              </li>
            );
          })}
      </ul>
    </>
  );
}
