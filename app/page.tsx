import React from "react";
import Layout from "@/components/layout/layout";

export const revalidate = 300;

export default async function Home() {


  return (
    <Layout>
      <p>Hello Rules v3!</p>
    </Layout>
  );
}
