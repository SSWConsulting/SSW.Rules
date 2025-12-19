import React, { PropsWithChildren } from "react";
import { getMegamenu } from "@/utils/get-mega-menu";
import client from "../../tina/__generated__/client";
import { LayoutProvider } from "./layout-context";
import { MenuProvider } from "./MenuProvider";
import { Footer } from "./nav/footer";
import { Header } from "./nav/header";

type LayoutProps = PropsWithChildren & {
  rawPageData?: any;
};

export default async function Layout({ children, rawPageData }: LayoutProps) {
  const { data: globalData } = await client.queries.global(
    {
      relativePath: "index.json",
    },
    {
      fetchOptions: {
        next: {
          revalidate: 60,
        },
      },
    }
  );

  const data = await getMegamenu();
  const menuGroups = data?.data.megamenu.menuGroups;

  return (
    <LayoutProvider globalSettings={globalData.global} pageData={rawPageData}>
      <MenuProvider initialMenuGroups={menuGroups}>
        <div className="flex flex-col flex-1 min-h-full">
          <Header />
          <main className="flex-1 overflow-x-hidden main-container max-sm:p-2">{children}</main>
          <Footer />
        </div>
      </MenuProvider>
    </LayoutProvider>
  );
}
