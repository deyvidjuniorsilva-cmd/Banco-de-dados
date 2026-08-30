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
  const classes = `rounded-xl border border-border bg-surface p-5 ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`block transition-colors hover:border-brand hover:bg-surface-hover ${classes}`}
      >
        {children}
      </Link>
    );
  }

  return <div className={classes}>{children}</div>;
}
