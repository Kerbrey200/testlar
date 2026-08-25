'use client';

import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Building2,
  Package,
  Layers,
  Activity,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { User, Zayavka, Hisobot, UmmZayavka, PmuZayavka, ActivityAudit, StockItem } from '@/lib/types';

interface Props {
  currentUser: User;
  zayavki: Zayavka[];
  hisobotlar: Hisobot[];
  ummZayavki: UmmZayavka[];
  pmuZayavki: PmuZayavka[];
  stocks: StockItem[];
  activities: ActivityAudit[];
  onNavigate: (view: string) => void;
}

export default function DashboardView({
  currentUser,
  zayavki,
  hisobotlar,
  ummZayavki,
  pmuZayavki,
  stocks,
  activities,
  onNavigate,
}: Props) {
  // Visibility rules filter for stats
  const isBoshqarmaEmployee = ['glinj_upr', 'nach_upr', 'pto_upr', 'buh_upr'].includes(currentUser.rol);
  const relevantZayavki = isBoshqarmaEmployee
    ? zayavki.filter((z) => z.org === currentUser.org)
    : currentUser.rol === 'prorab'
    ? zayavki.filter((z) => z.prorabId === currentUser.id)
    : zayavki;

  const totalZayavki = relevantZayavki.length;
  const inProgressZayavki = relevantZayavki.filter((z) => ['new', 'glinj_upr', 'pto_so', 'glinj_so'].includes(z.status)).length;
  const snabSoZayavki = relevantZayavki.filter((z) => z.status === 'snab_so').length;
  const rejectedZayavki = relevantZayavki.filter((z) => z.status === 'rejected').length;

  const relevantHisobotlar = isBoshqarmaEmployee
    ? hisobotlar.filter((h) => h.org === currentUser.org)
    : currentUser.rol === 'prorab'
    ? hisobotlar.filter((h) => h.prorabId === currentUser.id)
    : hisobotlar;

  const totalHisobot = relevantHisobotlar.length;
  const listedHisobot = relevantHisobotlar.filter((h) => h.status === 'listed').length;
  const pendingHisobot = relevantHisobotlar.filter((h) => h.status !== 'listed').length;

  const pendingUmm = ummZayavki.filter((u) => u.status !== 'accepted' && u.status !== 'rejected').length;
  const pendingPmu = pmuZayavki.filter((p) => p.status !== 'done' && p.status !== 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-400/20 mb-2">
              <span>{currentUser.org} бошқармаси</span>
              <span>•</span>
              <span className="capitalize">{currentUser.rol}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Хуш келибсиз, {currentUser.fullName}!
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Қурилиш жараёнлари ва таъминотни тезкор назорат қилиш маркази
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentUser.rol === 'prorab' && (
              <button
                onClick={() => onNavigate('zayavki')}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-blue-500 transition"
              >
                <FileText className="h-4 w-4" />
                <span>Янги Заявка</span>
              </button>
            )}
            {currentUser.rol === 'admin' && (
              <button
                onClick={() => onNavigate('admin')}
                className="flex items-center gap-2 rounded-xl bg-slate-700/80 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition"
              >
                <span>Админ панел</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workflow 1 Stats: Jami / Ishda / Snab.SO / Rad etilgan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Материал Заявкалари (Workflow #1 Статистикаси)</span>
          </h2>
          <button
            onClick={() => onNavigate('zayavki')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Барчасини кўриш <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Жами заявкалар</span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">{totalZayavki}</div>
            <p className="mt-1 text-xs text-slate-500">Рўйхатдаги барча ҳужжатлар</p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ишда (Жараёнда)</span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-amber-600">{inProgressZayavki}</div>
            <p className="mt-1 text-xs text-slate-500">Тасдиқлаш босқичларида</p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Снаб.СО да (Якун)</span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-emerald-600">{snabSoZayavki}</div>
            <p className="mt-1 text-xs text-slate-500">Шартнома ва счёт-фактурали</p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Рад этилган</span>
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-rose-600">{rejectedZayavki}</div>
            <p className="mt-1 text-xs text-slate-500">Қайта кўриб чиқиш керак</p>
          </div>
        </div>
      </div>

      {/* Secondary Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Texnik Hisobot M-29 */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-purple-50 p-2 text-purple-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Техник Ҳисобот (M-29)</h3>
              </div>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                {totalHisobot} та
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Проведено (Listed):</span>
                <span className="font-bold text-emerald-600">{listedHisobot} та</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Жараёнда (ПТО / Бух / Гл.инж):</span>
                <span className="font-bold text-amber-600">{pendingHisobot} та</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('hisobotlar')}
            className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition"
          >
            <span>Ҳисоботлар журнали</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* UMM & PMU Texnika */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Truck className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">УММ & ПМУ Буюртмалари</h3>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>УММ (Механизм ва кранлар):</span>
                <span className="font-bold text-indigo-700">{pendingUmm} та жараёнда</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>ПМУ (Металл конструкциялар):</span>
                <span className="font-bold text-indigo-700">{pendingPmu} та буюртма</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => onNavigate('umm')}
              className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition"
            >
              УММ Заявка
            </button>
            <button
              onClick={() => onNavigate('pmu')}
              className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition"
            >
              ПМУ Заявка
            </button>
          </div>
        </div>

        {/* Omborlar va Qoldiqlar */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
                  <Package className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Омборлар & Қолдиқлар</h3>
              </div>
              <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
                {stocks.length} позиция
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Марказий омбор (СО):</span>
                <span className="font-bold text-slate-800">
                  {stocks.filter((s) => s.ownerType === 'admin').length} хил материал
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Прораблар объект омборлари:</span>
                <span className="font-bold text-slate-800">
                  {stocks.filter((s) => s.ownerType === 'prorab').length} позиция
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('stocks')}
            className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 transition"
          >
            <span>Омбор қолдиқларини очиш</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Recent Activity Audit Stream */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold">Сўнгги Амаллар Журнали (Audit Log)</h2>
          </div>
          {currentUser.rol === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Тўлиқ аудитни кўриш
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {activities.slice(0, 7).map((act) => (
            <div key={act.id} className="py-3 flex items-start justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{act.userName}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {act.userRole}
                  </span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {act.userOrg}
                  </span>
                </div>
                <p className="text-slate-600">{act.details}</p>
              </div>
              <span className="text-slate-400 shrink-0">
                {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                {new Date(act.timestamp).toLocaleDateString()}
              </span>
            </div>
          ))}

          {activities.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              Ҳозирча фаолият ёзувлари мавжуд эмас
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
