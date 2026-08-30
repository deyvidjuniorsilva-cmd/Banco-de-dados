"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push("/login");
      }}
      className="w-full rounded-lg border border-sidebar-border px-3 py-2 text-left text-sm text-sidebar-foreground-muted transition-colors hover:border-transparent hover:bg-sidebar-active hover:text-sidebar-foreground"
    >
      Sair
    </button>
  );
}
