'use client';

import React from 'react';
import posed from 'react-pose';
import { MenuWrapper } from '@/components/MenuWrapper';
import { MegaMenuWrapper } from '@/components/server/MegaMenuWrapper';
import { useMenu } from '../MenuProvider';

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
    const { menuGroups, isLoading, error } = useMenu();

    if (error) {
        console.error('Menu loading error:', error);
    }

    return (
        <AnimatedContainer>
            <header className='no-print z-1 main-container max-sm:px-4 sm:px-8 mt-4'>
                <MenuWrapper>
                    <MegaMenuWrapper menu={menuGroups || []} />
                </MenuWrapper>
            </header>
        </AnimatedContainer>
    );
};
