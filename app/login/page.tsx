export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form action="/api/login" method="post" className="w-full max-w-xs space-y-3 rounded-lg border border-border bg-panel p-6">
        <h1 className="text-lg font-semibold">Jev Lab</h1>
        <input type="password" name="password" placeholder="Password" autoFocus required className="w-full px-3 py-2 text-sm" aria-label="Password" />
        {error && <p className="text-xs text-bad">Wrong password.</p>}
        <button type="submit" className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90">
          Enter
        </button>
      </form>
    </main>
  );
}
