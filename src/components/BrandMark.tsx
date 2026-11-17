export function BrandMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="connectlyGrad" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="52%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#connectlyGrad)" />
      <path
        d="M23.5 13.2C22.2 11.8 20.3 11 18.1 11C13.9 11 10.6 14.1 10.6 18C10.6 21.9 13.9 25 18.1 25C20.3 25 22.2 24.2 23.5 22.8"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="24.5" cy="18" r="2.5" fill="white" />
    </svg>
  );
}
