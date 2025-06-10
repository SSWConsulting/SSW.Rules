import React from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import SearchBar from "@/components/SearchBar";

export const revalidate = 300;

export default async function RulesSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string }>;
}) {
  //TODO: fix- cant use await searchParams in server component
  // const { keyword = '' } = await searchParams;
  const layout = await Layout({
    children: (
      <Section>
        {/* <SearchBar keyword={keyword} /> */}
        <SearchBar keyword="" />
      </Section>
    ),
  });

  return layout;
}
