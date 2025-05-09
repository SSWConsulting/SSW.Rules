import React from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import HomeClientPage from "./client-page";
import client from "@/tina/__generated__/client";
import SearchBar from "@/components/SearchBar";

export const revalidate = 300;

export default async function Home() {

const categoriesConnectionData = await client.queries.categoryConnection({});
const categories = categoriesConnectionData.data.categoryConnection.edges?.map((edge: any) => edge.node)||[];

  return (
    <Layout>
      <Section>
      <SearchBar />
      <HomeClientPage categories={categories} />
      </Section>
    </Layout>
  );
}
