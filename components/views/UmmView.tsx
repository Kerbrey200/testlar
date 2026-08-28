'use client';

import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Trash2,
  Edit2,
  Building,
} from 'lucide-react';
import {
  User,
  UmmZayavka,
  UmmStatus,
  ConstructionObject,
  MechanismCatalogueItem,
} from '@/lib/types';
import { syncController } from '@/lib/client-api';
import PrintModal from '../PrintModal';

interface Props {
  currentUser: User;
  ummZayavki: UmmZayavka[];
  objects: ConstructionObject[];
  mechanisms: MechanismCatalogueItem[];
  onSaveUmmZayavka: (umm: UmmZayavka, auditAction: string, auditDetails: string) => Promise<void>;
  onDeleteUmmZayavka: (id: string, details: string) => Promise<void>;
}

export default function UmmView({
  currentUser,
  ummZayavki,
  objects,
  mechanisms,
  onSaveUmmZayavka,
  onDeleteUmmZayavka,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUmm, setSelectedUmm] = useState<UmmZayavka | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printUmm, setPrintUmm] = useState<UmmZayavka | null>(null);
  const [rejectModal, setRejectModal] = useState<UmmZayavka | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Change Object Modal
  const [isEditObjectOpen, setIsEditObjectOpen] = useState(false);
  const [targetObjectToChange, setTargetObjectToChange] = useState<UmmZayavka | null>(null);
  const [newSelectedObjectId, setNewSelectedObjectId] = useState('');

  // New UMM Form
  const [objectId, setObjectId] = useState('');
  const [mechanismType, setMechanismType] = useState('');
  const [dateRequired, setDateRequired] = useState('2026-09-01');
  const [purpose, setPurpose] = useState('');
  const [onBehalfOf, setOnBehalfOf] = useState('');

  // Glinj SO allocation fields
  const [assignedUnit, setAssignedUnit] = useState('');
  const [assignedHours, setAssignedHours] = useState(8);

  const isBoshqarma = ['glinj_upr', 'nach_upr', 'pto_upr', 'buh_upr'].includes(currentUser.rol);
  const canCreate = ['prorab', 'admin', 'pto_upr', 'glinj_upr', 'pto_so', 'dispatcher_umm', 'nach_upr'].includes(currentUser.rol);

  const visibleList = ummZayavki.filter((u) => {
    if (isBoshqarma && currentUser.org && u.org && u.org !== currentUser.org) return false;
    if (currentUser.rol === 'prorab') {
      const isMine = u.prorabId === currentUser.id || (u.prorabName && u.prorabName.toLowerCase().includes(currentUser.fullName.toLowerCase()));
      const isSameOrg = currentUser.org && u.org === currentUser.org;
      if (!isMine && !isSameOrg) return false;
    }
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        u.docNumber?.toLowerCase().includes(q) ||
        u.objectName?.toLowerCase().includes(q) ||
        u.mechanismType?.toLowerCase().includes(q) ||
        u.prorabName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectId || !mechanismType.trim() || !purpose.trim()) {
      alert('Барча майдонларни тўлдиринг');
      return;
    }
    const targetObj = objects.find((o) => o.id === objectId);
    if (!targetObj) return;

    const orgToUse = targetObj.org || currentUser.org || 'РМУ';
    const currentYear = new Date().getFullYear();
    const docNum = await syncController.getNextDocNumber('ummZayavki', currentYear);
    const newUmm: UmmZayavka = {
      id: 'umm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      docNumber: docNum,
      org: orgToUse,
      objectId: targetObj.id,
      objectName: targetObj.name,
      prorabId: currentUser.id,
      prorabName: currentUser.fullName,
      onBehalfOf: onBehalfOf || undefined,
      mechanismType,
      dateRequired,
      purpose,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveUmmZayavka(
      newUmm,
      'umm.create',
      `УММ техника талабномаси яратилди: ${docNum} (${mechanismType}, ${targetObj.name})`
    );

    setIsCreateOpen(false);
    setMechanismType('');
    setPurpose('');
    setOnBehalfOf('');
  };

  // Step 2: GLINJ_UPR / NACH_UPR sign -> glinj_so
  const handleUprSign = async (umm: UmmZayavka) => {
    const updated: UmmZayavka = {
      ...umm,
      status: 'glinj_so',
      uprSignedBy: `${currentUser.fullName} (${currentUser.rol === 'glinj_upr' ? 'Гл.инж' : 'Нач.'} ${currentUser.org})`,
      uprSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveUmmZayavka(
      updated,
      'umm.upr_sign',
      `УММ талабномаси бошқарма томонидан имзоланди ва Гл.инженер СО га юборилди: ${umm.docNumber}`
    );
    setSelectedUmm(updated);
  };

  // Step 3: GLINJ_SO sets unit + hours -> umm (Dispatcher UMM)
  const handleGlinjSoApprove = async (umm: UmmZayavka) => {
    const updated: UmmZayavka = {
      ...umm,
      status: 'umm',
      assignedMechanismUnit: assignedUnit || umm.mechanismType,
      assignedHours: assignedHours || 8,
      glinjSoSignedBy: `${currentUser.fullName} (Гл.инженер СО)`,
      glinjSoSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveUmmZayavka(
      updated,
      'umm.glinj_so_approve',
      `Гл.инженер СО техникани тақсимлади ва Диспетчер УММ га топширди: ${umm.docNumber}`
    );
    setSelectedUmm(updated);
  };

  // Step 4: DISPATCHER_UMM accepts -> accepted
  const handleDispatcherAccept = async (umm: UmmZayavka) => {
    const updated: UmmZayavka = {
      ...umm,
      status: 'accepted',
      dispatcherSignedBy: `${currentUser.fullName} (Диспетчер УММ)`,
      dispatcherSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveUmmZayavka(
      updated,
      'umm.dispatcher_accept',
      `УММ Диспетчери техника чиқишини қабул қилди ва тасдиқлади: ${umm.docNumber}`
    );
    setSelectedUmm(updated);
    alert('Техника талабномаси УММ томонидан тўлиқ қабул қилинди!');
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const updated: UmmZayavka = {
      ...rejectModal,
      status: 'rejected',
      rejectionReason: rejectReason,
      updatedAt: new Date().toISOString(),
    };
    await onSaveUmmZayavka(
      updated,
      'umm.reject',
      `УММ талабномаси рад этилди: ${rejectModal.docNumber}. Сабаб: ${rejectReason}`
    );
    setRejectModal(null);
    setRejectReason('');
    if (selectedUmm?.id === updated.id) setSelectedUmm(updated);
  };

  const canEditObject = (u: UmmZayavka) => {
    if (currentUser.rol === 'admin') return true;
    if (u.status === 'accepted') return false;
    if (currentUser.rol === 'prorab' && (u.prorabId === currentUser.id || u.org === currentUser.org)) return true;
    if (['glinj_upr', 'nach_upr', 'pto_upr', 'pto_so', 'glinj_so', 'dispatcher_umm'].includes(currentUser.rol)) return true;
    return false;
  };

  const handleOpenChangeObject = (u: UmmZayavka, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetObjectToChange(u);
    setNewSelectedObjectId(u.objectId || '');
    setIsEditObjectOpen(true);
  };

  const handleSaveChangedObject = async () => {
    if (!targetObjectToChange || !newSelectedObjectId) {
      alert('Илтимос, қурилиш объектини танланг');
      return;
    }
    const newObj = objects.find((o) => o.id === newSelectedObjectId);
    if (!newObj) return;

    const oldName = targetObjectToChange.objectName;
    const updated: UmmZayavka = {
      ...targetObjectToChange,
      objectId: newObj.id,
      objectName: newObj.name,
      org: newObj.org || targetObjectToChange.org,
      updatedAt: new Date().toISOString(),
    };

    await onSaveUmmZayavka(
      updated,
      'umm.change_object',
      `УММ талабномаси объекти ўзгартирилди: ${targetObjectToChange.docNumber} ("${oldName}" ➔ "${newObj.name}")`
    );

    if (selectedUmm?.id === updated.id) {
      setSelectedUmm(updated);
    }
    setIsEditObjectOpen(false);
    setTargetObjectToChange(null);
    setNewSelectedObjectId('');
    alert(`Қурилиш объекти муваффақиятли "${newObj.name}" га ўзгартирилди!`);
  };

  const renderStatusBadge = (status: UmmStatus) => {
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
      case 'umm':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
            <Clock className="h-3 w-3" /> 3. Диспетчер УММ
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Қабул қилинган (Accepted)
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
            <Truck className="h-7 w-7 text-indigo-600" />
            <span>УММ Заявкалари (Кран ва Механизмлар Талабномаси)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Занжир: Прораб (new) → Гл.инж/Нач.УПР → Гл.инженер СО → Диспетчер УММ (accepted)
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Техника сўраш (Заявка)</span>
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
            placeholder="Ҳужжат рақами, техника тури, объект бўйича қидириш..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
        >
          <option value="all">Барча ҳолатлар</option>
          <option value="new">1. Прораб топширган (new)</option>
          <option value="glinj_so">2. Гл.инженер СО да</option>
          <option value="umm">3. Диспетчер УММ да</option>
          <option value="accepted">Қабул қилинган</option>
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
                <th className="px-4 py-3.5">Сўралган техника</th>
                <th className="px-4 py-3.5">Керакли сана</th>
                <th className="px-4 py-3.5">Мақсад</th>
                <th className="px-4 py-3.5">Ҳолати</th>
                <th className="px-4 py-3.5 text-right">Амаллар</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleList.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => {
                    setSelectedUmm(u);
                    setAssignedUnit(u.assignedMechanismUnit || u.mechanismType);
                    setAssignedHours(u.assignedHours || 8);
                    setIsDetailOpen(true);
                  }}
                  className="hover:bg-indigo-50/40 cursor-pointer transition"
                >
                  <td className="px-4 py-3.5 font-bold text-slate-900">{u.docNumber}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{u.org}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{u.objectName}</td>
                  <td className="px-4 py-3.5 font-bold text-indigo-700">{u.mechanismType}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-600">{u.dateRequired}</td>
                  <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">{u.purpose}</td>
                  <td className="px-4 py-3.5">{renderStatusBadge(u.status)}</td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {canEditObject(u) && (
                        <button
                          onClick={(e) => handleOpenChangeObject(u, e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition"
                          title="Объектни ўзгартириш"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedUmm(u);
                          setAssignedUnit(u.assignedMechanismUnit || u.mechanismType);
                          setAssignedHours(u.assignedHours || 8);
                          setIsDetailOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPrintUmm(u)}
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
                    <p className="font-medium">Ҳеч қандай УММ талабномаси топилмади</p>
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
                <Truck className="h-5 w-5 text-indigo-600" />
                <span>Янги УММ Техника Талабномаси</span>
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
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">-- Объектни танланг --</option>
                  {objects
                    .filter((o) => o.org === currentUser.org || currentUser.rol === 'admin')
                    .map((obj) => (
                      <option key={obj.id} value={obj.id}>{obj.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Сўралаётган техника тури *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Автокран 25т, Экскаватор..."
                    value={mechanismType}
                    onChange={(e) => setMechanismType(e.target.value)}
                    list="mech-list"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500 font-semibold"
                  />
                  <datalist id="mech-list">
                    {mechanisms.map((m) => (
                      <option key={m.id} value={`${m.name} (${m.model})`} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Чиқиш санаси *
                  </label>
                  <input
                    type="date"
                    required
                    value={dateRequired}
                    onChange={(e) => setDateRequired(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Бошқа ходим номидан (ихтиёрий)
                </label>
                <input
                  type="text"
                  placeholder="Масалан: Мастер Ибрагимов С."
                  value={onBehalfOf}
                  onChange={(e) => setOnBehalfOf(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Бажариладиган иш мақсади ва вазифаси *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Қандай ишлар бажарилади: Монтаж ферм, грунт қазиш, юк тушириш..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500"
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
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
                >
                  Талабномани юбориш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedUmm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selectedUmm.docNumber}</h3>
                  {renderStatusBadge(selectedUmm.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedUmm.org} • {selectedUmm.objectName}
                </p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Document Overview with Object Change Action */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Сўровчи Прораб</span>
                    <p className="font-semibold text-slate-800">{selectedUmm.prorabName} ({selectedUmm.org})</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Керакли сана</span>
                    <p className="font-semibold text-slate-800">{selectedUmm.dateRequired}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Техника тури</span>
                    <p className="font-bold text-indigo-700">{selectedUmm.mechanismType}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Иш мақсади</span>
                    <p className="text-slate-700">{selectedUmm.purpose}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Бириктирилган Қурилиш Объекти</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm mt-0.5">
                      <Building className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>{selectedUmm.objectName}</span>
                      <span className="text-xs font-normal text-slate-500">({selectedUmm.org})</span>
                    </div>
                  </div>

                  {canEditObject(selectedUmm) && (
                    <button
                      type="button"
                      onClick={() => handleOpenChangeObject(selectedUmm)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Объектни ўзгартириш</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2.5 rounded-lg border ${selectedUmm.uprSignedBy ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-500">1. Бошқарма имзоси</span>
                  <div className="font-semibold mt-1">{selectedUmm.uprSignedBy || 'Кутилмоқда'}</div>
                </div>
                <div className={`p-2.5 rounded-lg border ${selectedUmm.glinjSoSignedBy ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-500">2. Гл.инженер СО</span>
                  <div className="font-semibold mt-1">{selectedUmm.glinjSoSignedBy || 'Кутилмоқда'}</div>
                  {selectedUmm.assignedHours && <div className="text-[10px] text-blue-700 font-bold">{selectedUmm.assignedHours} соат ажратилди</div>}
                </div>
                <div className={`p-2.5 rounded-lg border ${selectedUmm.dispatcherSignedBy ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <span className="text-[10px] uppercase font-bold text-slate-500">3. Диспетчер УММ</span>
                  <div className="font-semibold mt-1">{selectedUmm.dispatcherSignedBy || 'Кутилмоқда'}</div>
                </div>
              </div>

              {/* GLINJ SO Allocation fields */}
              {(currentUser.rol === 'glinj_so' || currentUser.rol === 'admin') && selectedUmm.status === 'glinj_so' && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-3">
                  <h4 className="font-bold text-indigo-900">Механизм ва вақт ажратиш (Гл.инженер СО)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Бириктириладиган техника</label>
                      <input
                        type="text"
                        value={assignedUnit}
                        onChange={(e) => setAssignedUnit(e.target.value)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Ажратилган вақт (соат)</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={assignedHours}
                        onChange={(e) => setAssignedHours(parseInt(e.target.value) || 8)}
                        className="w-full rounded border border-slate-300 p-1.5 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                {selectedUmm.status !== 'accepted' && selectedUmm.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setRejectModal(selectedUmm)}
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
                  selectedUmm.status === 'new' &&
                  (currentUser.org === selectedUmm.org || currentUser.rol === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleUprSign(selectedUmm)}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                    >
                      Имзолаш → Гл.инженер СО га
                    </button>
                  )}

                {/* Step 2: GLINJ_SO */}
                {(currentUser.rol === 'glinj_so' || currentUser.rol === 'admin') &&
                  selectedUmm.status === 'glinj_so' && (
                    <button
                      type="button"
                      onClick={() => handleGlinjSoApprove(selectedUmm)}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
                    >
                      Тасдиқлаш → УММ Диспетчерга
                    </button>
                  )}

                {/* Step 3: DISPATCHER_UMM */}
                {(currentUser.rol === 'dispatcher_umm' || currentUser.rol === 'admin') &&
                  selectedUmm.status === 'umm' && (
                    <button
                      type="button"
                      onClick={() => handleDispatcherAccept(selectedUmm)}
                      className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
                    >
                      Қабул қилиш (Принять)
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
            <h3 className="text-base font-bold text-rose-600 mb-2">Техника талабномасини рад этиш</h3>
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

      {/* CHANGE OBJECT MODAL */}
      {isEditObjectOpen && targetObjectToChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-600" />
                <span>УММ талабномаси объектини ўзгартириш</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditObjectOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <p className="text-slate-500">Ҳужжат: <strong className="text-slate-900">{targetObjectToChange.docNumber}</strong></p>
                <p className="text-slate-500 mt-1">Ҳозирги объект: <strong className="text-indigo-700">{targetObjectToChange.objectName}</strong> ({targetObjectToChange.org})</p>
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1.5">
                  Янги қурилиш объектини танланг *
                </label>
                <select
                  value={newSelectedObjectId}
                  onChange={(e) => setNewSelectedObjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">-- Янги объектни танланг --</option>
                  {objects.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.name} ({obj.org})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditObjectOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Бекор қилиш
              </button>
              <button
                type="button"
                onClick={handleSaveChangedObject}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-md transition"
              >
                Сақлаш ва ўзгартириш
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {printUmm && (
        <PrintModal isOpen={true} onClose={() => setPrintUmm(null)} title={`УММ Талабнома ${printUmm.docNumber}`}>
          <div className="space-y-6 text-slate-900 font-serif">
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <h2 className="text-lg font-bold uppercase">УММ БОШҚАРМАСИГА ТАЛАБНОМА № {printUmm.docNumber}</h2>
              <p className="text-xs font-sans text-slate-600">Қурилиш техникаси ва автотранспорт ажратиш ҳақида</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div><strong>Объект:</strong> {printUmm.objectName} ({printUmm.org})</div>
              <div><strong>Керакли сана:</strong> {printUmm.dateRequired}</div>
              <div><strong>Техника тури:</strong> {printUmm.mechanismType}</div>
              <div><strong>Ажратилган соат:</strong> {printUmm.assignedHours || 8} соат</div>
            </div>
            <div className="text-xs font-sans border p-3 rounded">
              <strong>Мақсад:</strong> {printUmm.purpose}
            </div>
            <div className="grid grid-cols-2 gap-6 pt-8 text-xs font-sans border-t border-slate-300">
              <div><strong>Буюртмачи Прораб:</strong> ________________ / {printUmm.prorabName}</div>
              <div><strong>Бош муҳандис (СО):</strong> ________________ / {printUmm.glinjSoSignedBy || '________________'}</div>
              <div><strong>Диспетчер УММ:</strong> ________________ / {printUmm.dispatcherSignedBy || '________________'}</div>
            </div>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
