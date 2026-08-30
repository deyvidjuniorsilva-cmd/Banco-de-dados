import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={login} className="flex w-72 flex-col gap-3">
        <h1 className="text-lg font-semibold">Entrar</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          name="email"
          type="email"
          placeholder="email"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="senha"
          required
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black py-2 text-white">
          Entrar
        </button>
      </form>
    </main>
  );
}
