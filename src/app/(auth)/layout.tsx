import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(135deg,#020617_0%,#111827_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-white">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Hermes
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-slate-300 hover:text-white"
        >
          Continue to dashboard
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
