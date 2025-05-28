"use client";

import { useTina } from "tinacms/dist/react";
import Link from "next/link";

export interface ClientCategoryPageProps {
  categoryQueryProps;
}

export default function ClientCategoryPage(props: ClientCategoryPageProps) {
  const { categoryQueryProps } = props;

  const categoryData = useTina({
    query: categoryQueryProps?.query,
    variables: categoryQueryProps?.variables,
    data: categoryQueryProps?.data,
  }).data;

  const category = categoryData;

  return (
    <>
      <h1 className="font-bold mb-4"> {category.title} </h1>
      <ul>
        {category.index &&
          category.index.map((x) => {
            return (
              <li key={x?.rule?.uri}>
                <Link href={`/${x?.rule?.uri}`}>{x?.rule?.title}</Link>
              </li>
            );
          })}
      </ul>
    </>
  );
}
