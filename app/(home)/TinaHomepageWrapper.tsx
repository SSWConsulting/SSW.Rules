"use client";

import { useTina } from "tinacms/dist/react";
import HomeClientPage, { HomeClientPageProps } from "./client-page";

export type TinaHomepageWrapperProps = {
  serverProps: Omit<HomeClientPageProps, "homepage">;
  tinaQueryProps: any;
};

export function TinaHomepageWrapper({ serverProps, tinaQueryProps }: TinaHomepageWrapperProps) {
  const { data } = useTina({
    query: tinaQueryProps.query,
    variables: tinaQueryProps.variables,
    data: tinaQueryProps.data,
  });

  return (
    <HomeClientPage
      {...serverProps}
      homepage={data.homepage}
    />
  );
}
