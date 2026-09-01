export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ filter: "drop-shadow(0 0 8px var(--brand-glow))" }}
      >
        <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
          <defs>
            <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--brand)" />
              <stop offset="1" stopColor="var(--brand-hover)" />
            </linearGradient>
          </defs>
          <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="url(#logo-gradient)" opacity="0.12" />
          <path
            d="M7 12.5 15 12.5 15 7.5 23 15 15 22.5 15 17.5 7 17.5Z"
            fill="url(#logo-gradient)"
          />
          <path
            d="M25 19.5 17 19.5 17 24.5 9 17 17 9.5 17 14.5 25 14.5Z"
            fill="url(#logo-gradient)"
            opacity="0.45"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          JS Conciliação
        </span>
      )}
    </div>
  );
}
