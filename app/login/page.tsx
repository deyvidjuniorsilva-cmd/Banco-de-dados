import { login } from "./actions";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <h1 className="text-center text-lg font-semibold text-foreground">
          Entrar
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          Acesse seu controle de gastos
        </p>

        <form action={login} className="mt-6 flex flex-col gap-3">
          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <input
            name="email"
            type="email"
            placeholder="email"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand"
          />
          <input
            name="password"
            type="password"
            placeholder="senha"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand"
          />
          <button
            type="submit"
            className="mt-1 rounded-lg bg-brand py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
