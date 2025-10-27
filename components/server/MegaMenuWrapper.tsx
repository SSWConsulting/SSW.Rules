'use client';

import classNames from 'classnames';
import { MegaMenuLayout } from 'ssw.megamenu';
import useAppInsights from '../hooks/useAppInsights';
import Tooltip from '../tooltip/tooltip';
import SignIn from '../auth/SignIn';
import { CustomLink } from '../customLink';
import { RiAddCircleFill, RiOpenaiFill, RiQuestionFill } from 'react-icons/ri';
import { Suspense } from 'react';

export function MegaMenuWrapper(props) {
    return (
        <div className='mx-auto max-w-7xl px-0 py-4'>
        <MegaMenuLayout
            title='Rules'
            menuBarItems={props.menu}
            subtitle='Secret ingredients to quality software'
            rightSideActionsOverride={() => <ActionButtons />}
            linkComponent={(props) => <CustomLink {...props} className={classNames('unstyled', props.className)} />}
            url="/"
            searchUrl='https://www.ssw.com.au/rules'
            isFlagVisible={false}
        />
        </div>
    );
}

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+/, '');

const ActionButtons = () => {
    const { trackEvent } = useAppInsights();

    return (
        <div className='action-btn-container max-sm:order-2 max-sm:mt-4 flex justify-between items-center w-full'>
            <div className='flex items-center'>
                <Tooltip text='Try out RulesGPT' showDelay={3000} hideDelay={18000}>
                    <a
                        target='_blank'
                        rel='noopener noreferrer'
                        href='https://rulesgpt.ssw.com.au'
                        className='action-btn-link-underlined'
                        onClick={() => {
                            trackEvent('RulesGPTButtonPressed');
                        }}
                    >
                        <RiOpenaiFill className='header-icon' />
                    </a>
                </Tooltip>

                <Tooltip text='Create an SSW Rule'>
                    <a target='_blank' rel='noopener noreferrer' href={`/${basePath}/admin/index.html#/collections/rule/~`} className='action-btn-link-underlined'>
                        <RiAddCircleFill className='header-icon' />
                    </a>
                </Tooltip>

                <Tooltip text='SSW Rules wiki'>
                    <a target='_blank' rel='noopener noreferrer' href='https://github.com/SSWConsulting/SSW.Rules.Content/wiki' className='action-btn-link-underlined'>
                        <RiQuestionFill className='header-icon' />
                    </a>
                </Tooltip>
            </div>
            
            <Suspense fallback={<div className="w-8 h-8" />}>
                <SignIn />
            </Suspense>
        </div>
    );
};