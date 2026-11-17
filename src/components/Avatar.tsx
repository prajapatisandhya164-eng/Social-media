import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showPresence?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

const DOT_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-2 h-2 right-0 bottom-0',
  sm: 'w-2.5 h-2.5 right-0 bottom-0',
  md: 'w-3 h-3 right-0 bottom-0',
  lg: 'w-3.5 h-3.5 right-0.5 bottom-0.5',
  xl: 'w-4 h-4 right-1 bottom-1',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  src,
  name,
  size = 'md',
  isOnline = false,
  showPresence = false,
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`relative inline-flex shrink-0 ${SIZE_CLASSES[size]} ${className}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-200 dark:bg-zinc-900"
        />
      ) : (
        <div
          aria-label={name}
          className="w-full h-full rounded-full flex items-center justify-center font-display font-semibold bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 text-white ring-1 ring-white/10 select-none"
        >
          {getInitials(name)}
        </div>
      )}
      {showPresence && (
        <span
          title={isOnline ? 'Online' : 'Offline'}
          className={`absolute rounded-full ring-2 ring-white dark:ring-zinc-950 ${DOT_CLASSES[size]} ${
            isOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
          }`}
        />
      )}
    </div>
  );
}
