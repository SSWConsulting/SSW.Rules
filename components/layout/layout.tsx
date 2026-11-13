import React, { PropsWithChildren } from "react";
import { getGlobalSettings } from "@/lib/services/global";
import { getMegamenu } from "@/utils/get-mega-menu";
import { HiddenOnChatPopOut } from "./HiddenOnChatPopOut";
import { LayoutProvider } from "./layout-context";
import { MenuProvider } from "./MenuProvider";
import { Footer } from "./nav/footer";
import { Header } from "./nav/header";

type LayoutProps = PropsWithChildren & {
  rawPageData?: any;
};

export default async function Layout({ children, rawPageData }: LayoutProps) {
  const globalSettings = await getGlobalSettings().catch((error) => {
    console.error("[SiteLayout] global query failed:", error);
    throw error;
  });

  const { menuGroups } = await getMegamenu();

  return (
    <LayoutProvider globalSettings={globalSettings} pageData={rawPageData}>
      <MenuProvider initialMenuGroups={menuGroups}>
        <div className="flex flex-col flex-1 min-h-full">
          <HiddenOnChatPopOut>
            <Header />
          </HiddenOnChatPopOut>
          <main className="flex-1 overflow-x-hidden main-container max-sm:p-2">{children}</main>
          <HiddenOnChatPopOut>
            <Footer />
          </HiddenOnChatPopOut>
        </div>
      </MenuProvider>
    </LayoutProvider>
  );
}
