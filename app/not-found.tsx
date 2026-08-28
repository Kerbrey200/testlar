import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-center text-white">
      <h2 className="text-2xl font-bold">404 - Саҳифа топилмади</h2>
      <p className="mt-2 text-sm text-slate-400">Сиз қидирган саҳифа мавжуд эмас ёки кўчирилган.</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
      >
        Бош саҳифага қайтиш
      </Link>
    </div>
  );
}
