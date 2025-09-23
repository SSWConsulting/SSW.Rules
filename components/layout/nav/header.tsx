'use client';

import React, { useState, useEffect } from 'react';
import posed from 'react-pose';
import { MenuWrapper } from '@/components/MenuWrapper';
import { MegaMenuWrapper } from '@/components/server/MegaMenuWrapper';
import { getMegamenu } from '@/utils/get-mega-menu';

const AnimatedContainer = posed.div({
    enter: {
        y: 0,
        transition: {
            ease: 'easeInOut',
        },
    },
    exit: {
        y: '-100%',
        transition: {
            ease: 'easeInOut',
        },
    },
});

export const Header = () => {
    const [menuGroups, setMenuGroups] = useState<any>(null);

    useEffect(() => {
        const fetchMenuData = async () => {
            try {
                const data = await getMegamenu();
                const menuGroups = data?.data.megamenu.menuGroups;
                setMenuGroups(menuGroups);
            } catch (err) {
                console.error('Error fetching menu data:', err);
            }
        };
        fetchMenuData();
    }, []);

    return (
        <AnimatedContainer>
            <header className='no-print z-1 main-container max-sm:!m-4 sm:px-8'>
                {menuGroups && menuGroups.length && (
                    <MenuWrapper>
                        <MegaMenuWrapper menu={menuGroups} />
                    </MenuWrapper>
                )}
            </header>
        </AnimatedContainer>
    );
};
