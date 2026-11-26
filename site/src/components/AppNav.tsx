'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { BookmarkIcon, GridIcon, HomeIcon, UserIcon } from './Icons';
import { useAuthGate } from './Providers';

const links = [
  { href: '/watch', label: 'For you', short: 'Home', Icon: HomeIcon },
  { href: '/stories', label: 'All stories', short: 'Stories', Icon: GridIcon },
  { href: '/saved', label: 'Saved', short: 'Saved', Icon: BookmarkIcon },
];

export function AppNav() {
  const path = usePathname();
  const { data } = useSession();
  const { openSignIn } = useAuthGate();
  const user = data?.user;
  const isActive = (href: string) => path === href || (href === '/watch' && path.startsWith('/s/'));

  return (
    <nav className="app-nav" aria-label="Main">
      <Link href="/" className="brand app-nav-brand">
        <Image src="/brand/mark.png" alt="" width={30} height={30} />
        <span>STORIES</span>
      </Link>
      <ul>
        {links.map(({ href, label, short, Icon }) => (
          <li key={href}>
            <Link href={href} className={isActive(href) ? 'nav-link active' : 'nav-link'} aria-current={isActive(href) ? 'page' : undefined}>
              <Icon />
              <span className="nav-long">{label}</span>
              <span className="nav-short">{short}</span>
            </Link>
          </li>
        ))}
        <li>
          {user ? (
            <button type="button" className="nav-link" onClick={() => signOut()}>
              <UserIcon />
              <span className="nav-long">Sign out {user.name ? `(${user.name})` : ''}</span>
              <span className="nav-short">Sign out</span>
            </button>
          ) : (
            <button type="button" className="nav-link" onClick={openSignIn}>
              <UserIcon />
              <span className="nav-long">Sign in</span>
              <span className="nav-short">Sign in</span>
            </button>
          )}
        </li>
      </ul>
      <p className="app-nav-foot">© {new Date().getFullYear()} Toneflix Stories</p>
    </nav>
  );
}
