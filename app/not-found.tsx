import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 text-center">
      <h2 className="text-2xl font-bold text-slate-800">404 - Саҳифа топилмади</h2>
      <p className="text-sm text-slate-600 mt-2">Сиз сўраган саҳифа мавжуд эмас ёки кўчирилган.</p>
      <Link
        href="/"
        className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
      >
        Бош саҳифага қайтиш
      </Link>
    </div>
  );
}
