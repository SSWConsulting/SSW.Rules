'use client';

import { useUser } from '@auth0/nextjs-auth0';
import UserDropdown from './UserDropdown';

export default function SignIn() {
    const { user } = useUser();

    if (!user) {
        const href = `/auth/login?returnTo=/`;
        return (
            <a
                href={href}
                className='text-white cursor-pointer no-underline ml-6 px-3.5 py-2 text-center align-middle flex items-center justify-center bg-ssw-red text-sm font-medium shadow hover:bg-ssw-red/90 w-full h-full'
            >
                LOG IN
            </a>
        );
    }

    return <UserDropdown />;
}
