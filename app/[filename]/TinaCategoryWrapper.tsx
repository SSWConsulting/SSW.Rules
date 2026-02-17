"use client";

import { useTina } from "tinacms/dist/react";
import ServerCategoryPage from "./ServerCategoryPage";
import { useMarkHighlight } from "@/lib/useMarkHighlight";
import { useRef, RefObject } from "react";

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

  const contentRef = useRef<HTMLDivElement>(null);
  useMarkHighlight(contentRef as RefObject<HTMLElement>);

  return (
    <ServerCategoryPage
      category={data.category}
      {...serverCategoryPageProps}
    />
  );
}
