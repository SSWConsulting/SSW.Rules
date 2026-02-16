"use client";

import { useTina } from "tinacms/dist/react";
import ServerCategoryPage from "./ServerCategoryPage";

export type TinaCategoryProps = {
  serverCategoryPageProps: {
    path?: string;
    includeArchived: boolean;
    view: "titleOnly" | "blurb" | "all";
    page: number;
    perPage: number;
  };
  tinaQueryProps: any;
};

export function TinaCategoryWrapper({ serverCategoryPageProps, tinaQueryProps }: TinaCategoryProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  return (
    <ServerCategoryPage
      category={data.category}
      {...serverCategoryPageProps}
    />
  );
}
