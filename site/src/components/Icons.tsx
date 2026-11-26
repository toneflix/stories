type P = { size?: number; className?: string };

const stroke = (size = 22, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className,
});

export const PlayIcon = ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
);

export const CubeIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
);

export const HeartIcon = ({ size, className, filled }: P & { filled?: boolean }) => (
  <svg {...stroke(size, className)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
  </svg>
);

export const CommentIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)} fill="currentColor">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);

export const BookmarkIcon = ({ size, className, filled }: P & { filled?: boolean }) => (
  <svg {...stroke(size, className)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M6 4h12v16l-6-4-6 4z" />
  </svg>
);

export const ShareIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)} fill="currentColor" strokeWidth={1.2}>
    <path d="M14 4l7 7-7 7v-4c-5 0-8 1.5-10 5 1-6 4-9.5 10-10z" />
  </svg>
);

export const HomeIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)}>
    <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
  </svg>
);

export const GridIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

export const UserIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5" />
  </svg>
);

export const CloseIcon = ({ size = 20, className }: P) => (
  <svg {...stroke(size, className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ChevronIcon = ({ size = 18, className, dir = 'down' }: P & { dir?: 'up' | 'down' }) => (
  <svg {...stroke(size, className)} strokeWidth={2.3}>
    <path d={dir === 'down' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
  </svg>
);

export const VolumeIcon = ({ size, className, muted }: P & { muted?: boolean }) => (
  <svg {...stroke(size, className)}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" />}
  </svg>
);

export const SendIcon = ({ size = 20, className }: P) => (
  <svg {...stroke(size, className)} strokeWidth={2.2}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const LinkIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </svg>
);

export const MailIcon = ({ size, className }: P) => (
  <svg {...stroke(size, className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const TrashIcon = ({ size = 16, className }: P) => (
  <svg {...stroke(size, className)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

export const GoogleIcon = ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.57.38-2.29v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.1z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.26 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75z" />
  </svg>
);
