'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from './UserClientProvider';
import UserDropdown from './UserDropdown';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function SignIn() {
  const { user } = useAuth();

  const pathname = usePathname() ?? '/';
  const query = useSearchParams()?.toString();
  const current = query ? `${pathname}?${query}` : pathname;

  if (!user) {
    const href = `${basePath}/auth/login?returnTo=${encodeURIComponent(current)}`;

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