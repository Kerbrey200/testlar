'use client';

import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  FileImage,
  AlertTriangle,
  ChevronRight,
  Upload,
} from 'lucide-react';
import {
  User,
  PmuZayavka,
  PmuStatus,
  ConstructionObject,
} from '@/lib/types';
import PrintModal from '../PrintModal';

interface Props {
  currentUser: User;
  pmuZayavki: PmuZayavka[];
  objects: ConstructionObject[];
  onSavePmuZayavka: (pmu: PmuZayavka, auditAction: string, auditDetails: string) => Promise<void>;
  onDeletePmuZayavka: (id: string, details: string) => Promise<void>;
}

export default function PmuView({
  currentUser,
  pmuZayavki,
  objects,
  onSavePmuZayavka,
  onDeletePmuZayavka,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPmu, setSelectedPmu] = useState<PmuZayavka | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printPmu, setPrintPmu] = useState<PmuZayavka | null>(null);
  const [rejectModal, setRejectModal] = useState<PmuZayavka | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // New PMU Form
  const [objectId, setObjectId] = useState('');
  const [itemName, setItemName] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('тн');
  const [drawingNumber, setDrawingNumber] = useState('');
  const [deadline, setDeadline] = useState('2026-09-01');
  const [note, setNote] = useState('');

  const isBoshqarma = ['glinj_upr', 'nach_upr', 'pto_upr', 'buh_upr'].includes(currentUser.rol);

  const visibleList = pmuZayavki.filter((p) => {
    if (isBoshqarma && p.org !== currentUser.org) return false;
    if (currentUser.rol === 'prorab' && p.prorabId !== currentUser.id && p.org !== currentUser.org) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const itemTitle = (p.itemName || p.constructionName || '').toLowerCase();
      return (
        p.docNumber.toLowerCase().includes(q) ||
        p.objectName.toLowerCase().includes(q) ||
        itemTitle.includes(q) ||
        p.prorabName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectId || !itemName.trim() || quantity <= 0) {
      alert('Майдонларни тўғри тўлдиринг');
      return;
    }
    const targetObj = objects.find((o) => o.id === objectId);
    if (!targetObj) return;

    const docNum = `ПМУ-${new Date().getFullYear()}-${String(pmuZayavki.length + 1).padStart(3, '0')}`;
    const newPmu: PmuZayavka = {
      id: 'pmu_' + Date.now(),
      docNumber: docNum,
      org: currentUser.org,
      objectId: targetObj.id,
      objectName: targetObj.name,
      prorabId: currentUser.id,
      prorabName: currentUser.fullName,
      itemName,
      dimensions,
      quantity,
      unit,
      drawingNumber,
      deadline,
      note,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSavePmuZayavka(
      newPmu,
      'pmu.create',
      `ПМУ металл конструкция буюртмаси яратилди: ${docNum} (${itemName}, ${quantity} ${unit})`
    );

    setIsCreateOpen(false);
    setItemName('');
    setDimensions('');
    setDrawingNumber('');
    setNote('');
  };

  const handleUprSign = async (pmu: PmuZayavka) => {
    const updated: PmuZayavka = {
      ...pmu,
      status: 'glinj_so',
      uprSignedBy: `${currentUser.fullName} (${currentUser.rol === 'glinj_upr' ? 'Гл.инж' : 'Нач.'} ${currentUser.org})`,
      uprSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSavePmuZayavka(
      updated,
      'pmu.upr_sign',
      `ПМУ буюртмаси бошқарма томонидан тасдиқланди ва Гл.инженер СО га юборилди: ${pmu.docNumber}`
    );
    setSelectedPmu(updated);
  };

  const handleGlinjSoApprove = async (pmu: PmuZayavka) => {
    const updated: PmuZayavka = {
      ...pmu,
      status: 'pmu',
      glinjSoSignedBy: `${currentUser.fullName} (Гл.инженер СО)`,
      glinjSoSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSavePmuZayavka(
      updated,
      'pmu.glinj_so_approve',
      `Гл.инженер СО ПМУ буюртмасини тасдиқлади ва ПМУ заводига юборди: ${pmu.docNumber}`
    );
    setSelectedPmu(updated);
  };

  const handlePmuFinish = async (pmu: PmuZayavka) => {
    const updated: PmuZayavka = {
      ...pmu,
      status: 'done',
      pmuSignedBy: `${currentUser.fullName} (Нач. ПМУ)`,
      pmuSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSavePmuZayavka(
      updated,
      'pmu.finish',
      `ПМУ заводи металл конструкцияни тайёрлади ва қабул қилди: ${pmu.docNumber}`
    );
    setSelectedPmu(updated);
    alert('ПМУ буюртмаси тайёрланди ва муваффақиятли якунланди!');
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const updated: PmuZayavka = {
      ...rejectModal,
      status: 'rejected',
      rejectionReason: rejectReason,
      updatedAt: new Date().toISOString(),
    };
    await onSavePmuZayavka(
      updated,
      'pmu.reject',
      `ПМУ буюртмаси рад этилди: ${rejectModal.docNumber}. Сабаб: ${rejectReason}`
    );
    setRejectModal(null);
    setRejectReason('');
    if (selectedPmu?.id === updated.id) setSelectedPmu(updated);
  };

  const renderStatusBadge = (status: PmuStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            <Clock className="h-3 w-3" /> 1. Прораб (new)
          </span>
        );
      case 'glinj_so':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" /> 2. Гл.инженер СО
          </span>
        );
      case 'pmu':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            <Clock className="h-3 w-3" /> 3. ПМУ Заводида
          </span>
        );
      case 'done':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Тайёр (Done)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Рад этилган
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
            <Layers className="h-7 w-7 text-purple-600" />
            <span>ПМУ Заявкалари (Металл Конструкциялар Буюртмаси)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Занжир: Прораб (new) → Гл.инж/Нач.УПР → Гл.инженер СО → Нач.ПМУ Завод (done)
          </p>
        </div>

        {currentUser.rol === 'prorab' && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-purple-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Конструкция буюртма қилиш</span>
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
            placeholder="Ҳужжат рақами, маҳсулот номи, чизма рақами бўйича қидириш..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-purple-500"
        >
          <option value="all">Барча ҳолатлар</option>
          <option value="new">1. Прораб топширган (new)</option>
          <option value="glinj_so">2. Гл.инженер СО да</option>
          <option value="pmu">3. ПМУ Заводида</option>
          <option value="done">Тайёрланган (Done)</option>
          <option value="rejected">Рад этилган</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">№ Ҳужжат</th>
                <th className="px-4 py-3.5">Бошқарма</th>
                <th className="px-4 py-3.5">Объект</th>
                <th className="px-4 py-3.5">Конструкция / Маҳсулот</th>
                <th className="px-4 py-3.5">Миқдор</th>
                <th className="px-4 py-3.5">Чизма №</th>
                <th className="px-4 py-3.5">Муддат</th>
                <th className="px-4 py-3.5">Ҳолати</th>
                <th className="px-4 py-3.5 text-right">Амаллар</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleList.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setSelectedPmu(p);
                    setIsDetailOpen(true);
                  }}
                  className="hover:bg-purple-50/40 cursor-pointer transition"
                >
                  <td className="px-4 py-3.5 font-bold text-slate-900">{p.docNumber}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{p.org}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{p.objectName}</td>
                  <td className="px-4 py-3.5 font-bold text-purple-800">{p.itemName}</td>
                  <td className="px-4 py-3.5 font-bold text-blue-700">{p.quantity} {p.unit}</td>
                  <td className="px-4 py-3.5 text-slate-600 font-mono">{p.drawingNumber || '-'}</td>
                  <td className="px-4 py-3.5 text-slate-600">{p.deadline}</td>
                  <td className="px-4 py-3.5">{renderStatusBadge(p.status)}</td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSelectedPmu(p);
                          setIsDetailOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-purple-600 transition"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPrintPmu(p)}
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
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Layers className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="font-medium">Ҳеч қандай ПМУ буюртмаси топилмади</p>
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
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-600" />
                <span>Янги ПМУ Металл Конструкция Буюртмаси</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Қурилиш объекти *
                </label>
                <select
                  required
                  value={objectId}
                  onChange={(e) => setObjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-purple-500"
                >
                  <option value="">-- Объектни танланг --</option>
                  {objects
                    .filter((o) => o.org === currentUser.org || currentUser.rol === 'admin')
                    .map((obj) => (
                      <option key={obj.id} value={obj.id}>{obj.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Конструкция / Маҳсулот номи *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ферма 12м, Колонна К-1, Закладная деталь ЗД-1..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-purple-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Миқдори *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-purple-500 font-bold"
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
                    <option value="кг">кг</option>
                    <option value="шт">дона</option>
                    <option value="м.п">м.п</option>
                    <option value="м2">м2</option>
                    <option value="компл">компл</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Чизма / Чертеж №
                  </label>
                  <input
                    type="text"
                    placeholder="КМ-10, КЖ-04 лист 12"
                    value={drawingNumber}
                    onChange={(e) => setDrawingNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Тайёр бўлиш муддати *
                  </label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Ўлчамлари ва техник талаблар
                </label>
                <textarea
                  rows={2}
                  placeholder="Ўлчамлари: 12000x2400x300 мм, швеллер 20, бурчакли пўлат..."
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700"
                >
                  Буюртмани топшириш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedPmu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selectedPmu.docNumber}</h3>
                  {renderStatusBadge(selectedPmu.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedPmu.org} • {selectedPmu.objectName}
                </p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div><strong>Буюртмачи Прораб:</strong> {selectedPmu.prorabName}</div>
                <div><strong>Керакли муддат:</strong> {selectedPmu.deadline}</div>
                <div><strong>Маҳсулот:</strong> <span className="font-bold text-purple-700">{selectedPmu.itemName}</span></div>
                <div><strong>Миқдор:</strong> <span className="font-bold text-blue-700">{selectedPmu.quantity} {selectedPmu.unit}</span></div>
                <div><strong>Чизма рақами:</strong> {selectedPmu.drawingNumber || '-'}</div>
                <div><strong>Ўлчамлари:</strong> {selectedPmu.dimensions || '-'}</div>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2.5 rounded-lg border ${selectedPmu.uprSignedBy ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-500">1. Бошқарма имзоси</span>
                  <div className="font-semibold mt-1">{selectedPmu.uprSignedBy || 'Кутилмоқда'}</div>
                </div>
                <div className={`p-2.5 rounded-lg border ${selectedPmu.glinjSoSignedBy ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-500">2. Гл.инженер СО</span>
                  <div className="font-semibold mt-1">{selectedPmu.glinjSoSignedBy || 'Кутилмоқда'}</div>
                </div>
                <div className={`p-2.5 rounded-lg border ${selectedPmu.pmuSignedBy ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-500">3. ПМУ Заводи (Нач.ПМУ)</span>
                  <div className="font-semibold mt-1">{selectedPmu.pmuSignedBy || 'Кутилмоқда'}</div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                {selectedPmu.status !== 'done' && selectedPmu.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setRejectModal(selectedPmu)}
                    className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Рад этиш
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Ёпиш
                </button>

                {/* Step 1: GLINJ_UPR / NACH_UPR */}
                {(currentUser.rol === 'glinj_upr' || currentUser.rol === 'nach_upr' || currentUser.rol === 'admin') &&
                  selectedPmu.status === 'new' &&
                  (currentUser.org === selectedPmu.org || currentUser.rol === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleUprSign(selectedPmu)}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                    >
                      Имзолаш → Гл.инженер СО га
                    </button>
                  )}

                {/* Step 2: GLINJ_SO */}
                {(currentUser.rol === 'glinj_so' || currentUser.rol === 'admin') &&
                  selectedPmu.status === 'glinj_so' && (
                    <button
                      type="button"
                      onClick={() => handleGlinjSoApprove(selectedPmu)}
                      className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700"
                    >
                      Тасдиқлаш → ПМУ Заводига
                    </button>
                  )}

                {/* Step 3: NACH_PMU */}
                {(currentUser.rol === 'nach_pmu' || currentUser.rol === 'admin') &&
                  selectedPmu.status === 'pmu' && (
                    <button
                      type="button"
                      onClick={() => handlePmuFinish(selectedPmu)}
                      className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
                    >
                      Ишлаб чиқарилди (Тайёр / Done)
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-rose-600 mb-2">ПМУ буюртмасини рад этиш</h3>
            <textarea
              rows={3}
              placeholder="Рад этиш сабаби..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-xs text-slate-600">Бекор</button>
              <button onClick={handleRejectSubmit} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">Рад этиш</button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {printPmu && (
        <PrintModal isOpen={true} onClose={() => setPrintPmu(null)} title={`ПМУ Заявка ${printPmu.docNumber}`}>
          <div className="space-y-6 text-slate-900 font-serif">
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <h2 className="text-lg font-bold uppercase">ПМУ ЗАВОДИГА БУЮРТМА № {printPmu.docNumber}</h2>
              <p className="text-xs font-sans text-slate-600">Металл конструкциялар тайёрлаш ҳақида</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div><strong>Буюртмачи:</strong> {printPmu.org} • {printPmu.objectName}</div>
              <div><strong>Муддат:</strong> {printPmu.deadline}</div>
              <div><strong>Маҳсулот:</strong> {printPmu.itemName}</div>
              <div><strong>Миқдор:</strong> {printPmu.quantity} {printPmu.unit}</div>
              <div><strong>Чизма №:</strong> {printPmu.drawingNumber || '-'}</div>
              <div><strong>Ўлчамлари:</strong> {printPmu.dimensions || '-'}</div>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-8 text-xs font-sans border-t border-slate-300">
              <div><strong>Буюртмачи Прораб:</strong> ________________ / {printPmu.prorabName}</div>
              <div><strong>Бош муҳандис (СО):</strong> ________________ / {printPmu.glinjSoSignedBy || '________________'}</div>
              <div><strong>Нач. ПМУ:</strong> ________________ / {printPmu.pmuSignedBy || '________________'}</div>
            </div>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
