'use client';

import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  Send,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import {
  User,
  Nakladnoy,
  NakladnoyItem,
  NakladnoyStatus,
  StockItem,
  ConstructionObject,
} from '@/lib/types';
import { syncController } from '@/lib/client-api';
import PrintModal from '../PrintModal';

interface Props {
  currentUser: User;
  nakladnoylar: Nakladnoy[];
  stocks: StockItem[];
  objects: ConstructionObject[];
  users: User[];
  onSaveNakladnoy: (nak: Nakladnoy, auditAction: string, auditDetails: string) => Promise<void>;
}

export default function NakladnoyView({
  currentUser,
  nakladnoylar,
  stocks,
  objects,
  users,
  onSaveNakladnoy,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedNak, setSelectedNak] = useState<Nakladnoy | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printNak, setPrintNak] = useState<Nakladnoy | null>(null);

  // New Form
  const [receiverId, setReceiverId] = useState('');
  const [objectId, setObjectId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [items, setItems] = useState<NakladnoyItem[]>([
    { id: 'item_1', materialName: '', unit: 'тн', qty: 1, price: 0, sum: 0 },
  ]);

  const centralStocks = stocks.filter((s) => s.ownerType === 'admin');
  const prorabUsers = users.filter((u) => u.rol === 'prorab');

  const visibleList = nakladnoylar.filter((n) => {
    if (currentUser.rol === 'prorab' && n.receiverId !== currentUser.id) return false;
    if (statusFilter !== 'all' && n.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const rName = n.receiverName || n.recipientName || '';
      const sName = n.senderName || '';
      return (
        n.docNumber.toLowerCase().includes(q) ||
        rName.toLowerCase().includes(q) ||
        sName.toLowerCase().includes(q) ||
        (n.objectName && n.objectName.toLowerCase().includes(q)) ||
        (n.driverName && n.driverName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const addItemRow = () => {
    setItems([
      ...items,
      { id: 'item_' + Date.now(), materialName: '', unit: 'тн', qty: 1, price: 0, sum: 0 },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId || !objectId) {
      alert('Қабул қилувчи прораб ва объектни танланг');
      return;
    }
    const targetProrab = users.find((u) => u.id === receiverId);
    const targetObj = objects.find((o) => o.id === objectId);
    if (!targetProrab || !targetObj) return;

    const validItems = items.filter((it) => it.materialName.trim() && it.qty > 0);
    if (validItems.length === 0) {
      alert('Камида битта позиция киритинг');
      return;
    }

    // Check stock sufficiency in sender / central warehouse before creating Nakladnoy
    for (const it of validItems) {
      const matchStock = stocks.find(
        (s) =>
          (s.ownerType === 'admin' || s.ownerId === currentUser.id || s.ownerId === 'central') &&
          (it.materialId && s.materialId
            ? s.materialId === it.materialId
            : s.materialName.trim().toLowerCase() === it.materialName.trim().toLowerCase())
      );
      const availableQty = matchStock ? (matchStock.quantity ?? matchStock.qty ?? 0) : 0;
      if (it.qty > availableQty) {
        alert(
          `"${it.materialName}" учун марказий омборда етарли қолдиқ йўқ!\nМавжуд қолдиқ: ${availableQty} ${it.unit}\nСўралган миқдор: ${it.qty} ${it.unit}\n\nИлтимос, миқдорни мавжуд қолдиққа мосланг.`
        );
        return;
      }
    }

    const currentYear = new Date().getFullYear();
    const docNum = await syncController.getNextDocNumber('nakladnoy', currentYear);
    const newNak: Nakladnoy = {
      id: 'nak_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      docNumber: docNum,
      senderId: currentUser.id,
      senderName: `${currentUser.fullName} (Марказий омбор)`,
      receiverId: targetProrab.id,
      receiverName: targetProrab.fullName,
      receiverOrg: targetProrab.org,
      objectId: targetObj.id,
      objectName: targetObj.name,
      driverName,
      vehicleNumber,
      items: validItems.map((it) => ({
        ...it,
        id: it.id || 'nitem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        sum: it.qty * (it.price || 0),
      })),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveNakladnoy(
      newNak,
      'nakladnoy.create',
      `Юк хати (Накладной) яратилди: ${docNum} (${targetProrab.fullName} га, ${targetObj.name})`
    );

    setIsCreateOpen(false);
  };

  // Step 2: Send from Central warehouse -> 'sent'
  const handleSendNakladnoy = async (nak: Nakladnoy) => {
    const updated: Nakladnoy = {
      ...nak,
      status: 'sent',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveNakladnoy(
      updated,
      'nakladnoy.send',
      `Юк хати юборилди: ${nak.docNumber} (${nak.items.length} хил юк йўлда)`
    );
    setSelectedNak(updated);
  };

  // Step 3: Prorab accepts -> 'received' (server automatically performs atomic stock transfer once)
  const handleReceiveNakladnoy = async (nak: Nakladnoy) => {
    const updated: Nakladnoy = {
      ...nak,
      status: 'received',
      receivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveNakladnoy(
      updated,
      'nakladnoy.receive',
      `Юк прораб томонидан қабул қилинди ва омборга кирим қилинди: ${nak.docNumber} (${nak.objectName})`
    );

    setSelectedNak(updated);
    alert('Юк муваффақиятли қабул қилинди ва прораб омбори қолдиғига қўшилди!');
  };

  const renderStatusBadge = (status: NakladnoyStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            <Clock className="h-3 w-3" /> Расмийлаштирилди (new)
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Truck className="h-3 w-3" /> Йўлда (Юборилган)
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Қабул қилинди (Омборда)
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="h-7 w-7 text-blue-600" />
            <span>Юк Хатлари (ТТН / Накладной)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Марказий омбордан Прорабларнинг объект омборларига материал юбориш ва қабул қилиш
          </p>
        </div>

        {currentUser.rol === 'admin' && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Юк хати ёзиш (Чиқариш)</span>
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
            placeholder="ТТН рақами, қабул қилувчи прораб, объект ёки ҳайдовчи бўйича қидириш..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
        >
          <option value="all">Барча ҳолатлар</option>
          <option value="new">1. Расмийлаштирилган</option>
          <option value="sent">2. Йўлда (Юборилган)</option>
          <option value="received">3. Қабул қилинган</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">№ ТТН</th>
                <th className="px-4 py-3.5">Қабул қилувчи Прораб</th>
                <th className="px-4 py-3.5">Бошқарма & Объект</th>
                <th className="px-4 py-3.5">Ҳайдовчи & Авто</th>
                <th className="px-4 py-3.5">Юк турлари</th>
                <th className="px-4 py-3.5">Ҳолати</th>
                <th className="px-4 py-3.5">Сана</th>
                <th className="px-4 py-3.5 text-right">Амаллар</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleList.map((n) => (
                <tr
                  key={n.id}
                  onClick={() => {
                    setSelectedNak(n);
                    setIsDetailOpen(true);
                  }}
                  className="hover:bg-blue-50/40 cursor-pointer transition"
                >
                  <td className="px-4 py-3.5 font-bold text-slate-900">{n.docNumber}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{n.receiverName || n.recipientName || '—'}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-900">{n.objectName}</span>
                    <span className="ml-1.5 text-[11px] font-semibold text-blue-600">({n.receiverOrg || n.recipientOrg || n.senderOrg || '—'})</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {n.driverName ? `${n.driverName} (${n.vehicleNumber || '—'})` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 font-medium">
                    {n.items.length} та позиция (
                    {n.items.map((i) => i.materialName).slice(0, 2).join(', ')}
                    {n.items.length > 2 ? '...' : ''})
                  </td>
                  <td className="px-4 py-3.5">{renderStatusBadge(n.status)}</td>
                  <td className="px-4 py-3.5 text-slate-400">
                    {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSelectedNak(n);
                          setIsDetailOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPrintNak(n)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {visibleList.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Truck className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="font-medium">Ҳеч қандай юк хати топилмади</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                <span>Янги Юк Хати (ТТН / Накладной) ёзиш</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Қабул қилувчи Прораб *
                  </label>
                  <select
                    required
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="">-- Прорабни танланг --</option>
                    {prorabUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.org})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Етказиладиган Объект *
                  </label>
                  <select
                    required
                    value={objectId}
                    onChange={(e) => setObjectId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="">-- Объектни танланг --</option>
                    {objects.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name} ({obj.org})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Ҳайдовчи (Ф.И.Ш)
                  </label>
                  <input
                    type="text"
                    placeholder="Масалан: Тошев Камол"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Автомобиль давлат рақами
                  </label>
                  <input
                    type="text"
                    placeholder="01 A 777 AA"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-mono"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    Юбориладиган материаллар рўйхати (Марказий омбордан)
                  </label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Қатор қўшиш
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/50">
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        placeholder="Материал номи..."
                        value={it.materialName}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].materialName = e.target.value;
                          setItems(copy);
                        }}
                        list="stock-mats"
                        className="flex-1 rounded-lg border border-slate-300 bg-white p-1.5 text-xs font-medium"
                      />
                      <datalist id="stock-mats">
                        {centralStocks.map((s) => (
                          <option key={s.id} value={s.materialName} />
                        ))}
                      </datalist>

                      <input
                        type="number"
                        step="any"
                        required
                        min="0.01"
                        placeholder="Миқдор"
                        value={it.qty || ''}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].qty = parseFloat(e.target.value) || 0;
                          copy[idx].sum = copy[idx].qty * (copy[idx].price || 0);
                          setItems(copy);
                        }}
                        className="w-24 rounded-lg border border-slate-300 bg-white p-1.5 text-xs font-bold"
                      />

                      <select
                        value={it.unit}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].unit = e.target.value;
                          setItems(copy);
                        }}
                        className="w-20 rounded-lg border border-slate-300 bg-white p-1.5 text-xs"
                      >
                        <option value="тн">тн</option>
                        <option value="м3">м3</option>
                        <option value="м2">м2</option>
                        <option value="м.п">м.п</option>
                        <option value="шт">дона</option>
                        <option value="кг">кг</option>
                      </select>

                      <input
                        type="number"
                        placeholder="Нархи"
                        value={it.price || ''}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].price = parseFloat(e.target.value) || 0;
                          copy[idx].sum = (copy[idx].qty || 0) * copy[idx].price;
                          setItems(copy);
                        }}
                        className="w-28 rounded-lg border border-slate-300 bg-white p-1.5 text-xs"
                      />

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                >
                  ТТН ни сақлаш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedNak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selectedNak.docNumber}</h3>
                  {renderStatusBadge(selectedNak.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Топширувчи: {selectedNak.senderName} → Қабул қилувчи: {selectedNak.receiverName || selectedNak.recipientName || '—'} ({selectedNak.receiverOrg || selectedNak.recipientOrg || selectedNak.senderOrg || '—'})
                </p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div><strong>Манзил объект:</strong> {selectedNak.objectName}</div>
                <div><strong>Ҳайдовчи / Авто:</strong> {selectedNak.driverName || '—'} ({selectedNak.vehicleNumber || '—'})</div>
                <div><strong>Юборилган вақт:</strong> {selectedNak.sentAt ? new Date(selectedNak.sentAt).toLocaleString() : 'Юборилмаган'}</div>
                <div><strong>Қабул қилинган вақт:</strong> {selectedNak.receivedAt ? new Date(selectedNak.receivedAt).toLocaleString() : 'Кутилмоқда'}</div>
              </div>

              {/* Items table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5 text-center w-8">№</th>
                      <th className="p-2.5">Материал номи</th>
                      <th className="p-2.5 text-center">Ўлчов</th>
                      <th className="p-2.5 text-right">Миқдори</th>
                      <th className="p-2.5 text-right">Нархи (сўм)</th>
                      <th className="p-2.5 text-right">Суммаси</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedNak.items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{it.materialName}</td>
                        <td className="p-2.5 text-center text-slate-500">{it.unit}</td>
                        <td className="p-2.5 text-right font-bold text-blue-700">{it.qty}</td>
                        <td className="p-2.5 text-right font-medium text-slate-600">{it.price ? it.price.toLocaleString() : '—'}</td>
                        <td className="p-2.5 text-right font-bold text-slate-800">{it.sum ? it.sum.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setPrintNak(selectedNak)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                <Printer className="h-4 w-4" /> ТТН Чоп этиш
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Ёпиш
                </button>

                {/* Step 2 Action: Admin sends */}
                {currentUser.rol === 'admin' && selectedNak.status === 'new' && (
                  <button
                    type="button"
                    onClick={() => handleSendNakladnoy(selectedNak)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                    <span>Юкни йўлга чиқариш (Юбориш)</span>
                  </button>
                )}

                {/* Step 3 Action: Prorab receives */}
                {currentUser.rol === 'prorab' &&
                  selectedNak.receiverId === currentUser.id &&
                  selectedNak.status === 'sent' && (
                    <button
                      type="button"
                      onClick={() => handleReceiveNakladnoy(selectedNak)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Юкни қабул қилиш (Омборга кирим қилиш)</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT TTN MODAL */}
      {printNak && (
        <PrintModal isOpen={true} onClose={() => setPrintNak(null)} title={`ТТН ${printNak.docNumber}`}>
          <div className="space-y-6 text-slate-900 font-serif">
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <h2 className="text-lg font-bold uppercase">ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ (ТТН)</h2>
              <h3 className="text-base font-bold font-sans mt-1">ЮК ХАТИ № {printNak.docNumber}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div><strong>Жўнатувчи омбор:</strong> {printNak.senderName}</div>
              <div><strong>Қабул қилувчи:</strong> {printNak.receiverName || printNak.recipientName || '—'} ({printNak.receiverOrg || printNak.recipientOrg || printNak.senderOrg || '—'})</div>
              <div><strong>Етказилиш манзили (Объект):</strong> {printNak.objectName}</div>
              <div><strong>Ҳайдовчи ва Авто:</strong> {printNak.driverName || '—'} / {printNak.vehicleNumber || '—'}</div>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-xs font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 p-2 text-center">№</th>
                  <th className="border border-slate-900 p-2 text-left">Материал номи</th>
                  <th className="border border-slate-900 p-2 text-center">Ўлчов</th>
                  <th className="border border-slate-900 p-2 text-right">Миқдори</th>
                  <th className="border border-slate-900 p-2 text-right">Нархи</th>
                  <th className="border border-slate-900 p-2 text-right">Суммаси</th>
                </tr>
              </thead>
              <tbody>
                {printNak.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                    <td className="border border-slate-900 p-2 font-bold">{it.materialName}</td>
                    <td className="border border-slate-900 p-2 text-center">{it.unit}</td>
                    <td className="border border-slate-900 p-2 text-right font-bold">{it.qty}</td>
                    <td className="border border-slate-900 p-2 text-right">{it.price ? it.price.toLocaleString() : '—'}</td>
                    <td className="border border-slate-900 p-2 text-right font-bold">{it.sum ? it.sum.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-6 pt-8 text-xs font-sans border-t border-slate-300">
              <div><strong>Жўнатди (Омбор мудири):</strong> ________________ / {printNak.senderName}</div>
              <div><strong>Қабул қилди (Прораб):</strong> ________________ / {printNak.receiverName}</div>
            </div>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
