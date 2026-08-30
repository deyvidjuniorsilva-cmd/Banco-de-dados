export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">
        JS
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          JS Conciliação
        </span>
      )}
    </div>
  );
}
