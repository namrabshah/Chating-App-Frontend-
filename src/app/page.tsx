import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="mb-4 text-5xl">💬</div>

        <h1 className="text-4xl font-bold">
          ChatApp
        </h1>

        <p className="mt-3 text-gray-500">
          Simple. Fast. Real-time.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-blue-600 px-6 py-3 text-white"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-xl border border-gray-300 bg-white px-6 py-3"
          >
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}