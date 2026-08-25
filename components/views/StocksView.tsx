'use client';

import React, { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  Building,
  User as UserIcon,
  Layers,
  ArrowRight,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { User, StockItem, MaterialItem } from '@/lib/types';

interface Props {
  currentUser: User;
  stocks: StockItem[];
  materials: MaterialItem[];
  onSaveStock: (stock: StockItem, auditAction: string, auditDetails: string) => Promise<void>;
}

export default function StocksView({
  currentUser,
  stocks,
  materials,
  onSaveStock,
}: Props) {
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'admin' | 'prorab'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New stock item for Central warehouse (admin)
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [unit, setUnit] = useState('тн');
  const [price, setPrice] = useState(8500000);

  const visibleStocks = stocks.filter((s) => {
    if (ownerFilter !== 'all' && s.ownerType !== ownerFilter) return false;
    if (currentUser.rol === 'prorab' && s.ownerType === 'prorab' && s.ownerId !== currentUser.id) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.materialName.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        (s.objectName && s.objectName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim() || quantity <= 0) return;

    const newStock: StockItem = {
      id: 'stk_' + Date.now(),
      materialName,
      unit,
      quantity,
      price,
      ownerType: 'admin',
      ownerId: currentUser.id,
      ownerName: 'Марказий Омбор (СО)',
      updatedAt: new Date().toISOString(),
    };

    await onSaveStock(
      newStock,
      'stock.add_central',
      `Марказий омборга янги материал кирим қилинди: ${materialName} (${quantity} ${unit})`
    );

    setIsAddOpen(false);
    setMaterialName('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-cyan-600" />
            <span>Омбор Қолдиқлари ва Материаллар Ҳисоби</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Марказий омбор ва прорабларнинг объект омборларидаги реал қолдиқлар
          </p>
        </div>

        {currentUser.rol === 'admin' && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Марказий омборга кирим</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Материал номи, омбор эгаси ёки объект бўйича қидириш..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOwnerFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${ownerFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Барчаси
          </button>
          <button
            onClick={() => setOwnerFilter('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${ownerFilter === 'admin' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Марказий омбор
          </button>
          <button
            onClick={() => setOwnerFilter('prorab')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${ownerFilter === 'prorab' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Прораблар омбори
          </button>
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleStocks.map((stk) => (
          <div
            key={stk.id}
            className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                    stk.ownerType === 'admin'
                      ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  {stk.ownerType === 'admin' ? 'Марказий Омбор' : `Прораб: ${stk.ownerName}`}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(stk.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 mt-1">{stk.materialName}</h3>

              {stk.objectName && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  <span>{stk.objectName}</span>
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Қолдиқ миқдори</span>
                <span className="text-xl font-extrabold text-slate-900">
                  {stk.quantity ?? stk.qty ?? 0} <span className="text-xs font-medium text-slate-500">{stk.unit}</span>
                </span>
              </div>
              {stk.price ? (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Баҳоси</span>
                  <span className="text-xs font-bold text-slate-700">
                    {(((stk.quantity ?? stk.qty ?? 0)) * stk.price).toLocaleString()} сўм
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {visibleStocks.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="font-medium">Омборда материаллар қолдиғи топилмади</p>
          </div>
        )}
      </div>

      {/* ADD STOCK MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-600" />
              <span>Марказий Омборга Янги Материал Киритиш</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Материал номи *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Арматура d-16 A500C, Цемент М400..."
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  list="mat-list"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-cyan-500 font-semibold"
                />
                <datalist id="mat-list">
                  {materials.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Миқдор *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-cyan-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Ўлчов
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none"
                  >
                    <option value="тн">тн</option>
                    <option value="м3">м3</option>
                    <option value="м2">м2</option>
                    <option value="м.п">м.п</option>
                    <option value="тыс.шт">минг.дона</option>
                    <option value="шт">дона</option>
                    <option value="кг">кг</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  1 бирлик нархи (сўм)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-700"
                >
                  Омборга қўшиш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
