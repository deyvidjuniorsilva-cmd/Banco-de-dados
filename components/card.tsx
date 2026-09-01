import Link from "next/link";

export function Card({
  children,
  className = "",
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const classes = `rounded-xl border border-glass-border bg-glass p-5 backdrop-blur-md ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`block transition-all duration-200 hover:border-brand hover:shadow-[0_0_24px_var(--brand-glow)] ${classes}`}
      >
        {children}
      </Link>
    );
  }

  return <div className={classes}>{children}</div>;
}
