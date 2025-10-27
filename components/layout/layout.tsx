import React, { PropsWithChildren } from 'react';
import { LayoutProvider } from './layout-context';
import { MenuProvider } from './MenuProvider';
import client from '../../tina/__generated__/client';
import { Header } from './nav/header';
import { Footer } from './nav/footer';
import { getMegamenu } from '@/utils/get-mega-menu';

type LayoutProps = PropsWithChildren & {
    rawPageData?: any;
};

export default async function Layout({ children, rawPageData }: LayoutProps) {
    const { data: globalData } = await client.queries.global(
        {
            relativePath: 'index.json',
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
                <div className='flex flex-col flex-1'>
                    <Header />
                    <main className='flex-1 overflow-x-hidden main-container max-sm:p-2'>{children}</main>
                    <Footer />
                </div>
            </MenuProvider>
        </LayoutProvider>
    );
}
