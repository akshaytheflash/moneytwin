import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center px-4">
      <p className="eyebrow">404</p>
      <h1 className="display mt-2 text-5xl">This page ran out of money</h1>
      <p className="mt-4 text-lg text-inksoft">
        The page you were looking for doesn&apos;t exist — a risk even we couldn&apos;t simulate.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        ← Back to MONEYTWIN
      </Link>
    </main>
  );
}
