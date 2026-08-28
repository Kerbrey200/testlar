'use client';

import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Edit2,
  Trash2,
  ChevronRight,
  AlertTriangle,
  Upload,
  FileCheck,
  Building,
  User as UserIcon,
} from 'lucide-react';
import {
  User,
  Zayavka,
  ZayavkaPosition,
  ZayavkaStatus,
  ConstructionObject,
  MaterialItem,
  OrgType,
} from '@/lib/types';
import { syncController } from '@/lib/client-api';
import PrintModal from '../PrintModal';

interface Props {
  currentUser: User;
  zayavki: Zayavka[];
  objects: ConstructionObject[];
  materials: MaterialItem[];
  onSaveZayavka: (zayavka: Zayavka, auditAction: string, auditDetails: string) => Promise<void>;
  onDeleteZayavka: (id: string, details: string) => Promise<void>;
}

export default function ZayavkiView({
  currentUser,
  zayavki,
  objects,
  materials,
  onSaveZayavka,
  onDeleteZayavka,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedZayavka, setSelectedZayavka] = useState<Zayavka | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printZayavka, setPrintZayavka] = useState<Zayavka | null>(null);
  const [rejectReasonModal, setRejectReasonModal] = useState<Zayavka | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Object Change Modal state
  const [isEditObjectOpen, setIsEditObjectOpen] = useState(false);
  const [targetObjectToChange, setTargetObjectToChange] = useState<Zayavka | null>(null);
  const [newSelectedObjectId, setNewSelectedObjectId] = useState('');

  // Snab SO modal fields
  const [contractNo, setContractNo] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceFileBase64, setInvoiceFileBase64] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');

  // New Zayavka Form state
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [positions, setPositions] = useState<ZayavkaPosition[]>([
    { id: 'pos_1', materialName: '', unit: 'тн', qty: 1, note: '' },
  ]);

  // Check Org visibility rule: Boshqarma employees only see their own org, SO & admin see all
  const isBoshqarma = ['glinj_upr', 'nach_upr', 'pto_upr', 'buh_upr'].includes(currentUser.rol);
  const canCreate = ['prorab', 'admin', 'pto_upr', 'glinj_upr', 'pto_so', 'nach_upr'].includes(currentUser.rol);

  const visibleZayavki = zayavki.filter((z) => {
    // Org restriction for boshqarma employees
    if (isBoshqarma && currentUser.org && z.org && z.org !== currentUser.org) {
      return false;
    }
    // Prorab filter: can see own zayavki or zayavki from their org
    if (currentUser.rol === 'prorab') {
      const isMine = z.prorabId === currentUser.id || (z.prorabName && z.prorabName.toLowerCase().includes(currentUser.fullName.toLowerCase()));
      const isSameOrg = currentUser.org && z.org === currentUser.org;
      if (!isMine && !isSameOrg) return false;
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'glinj_upr') {
        if (z.status !== 'glinj_upr' && z.status !== 'new') return false;
      } else if (z.status !== statusFilter) {
        return false;
      }
    }

    // Org dropdown filter for SO / Admin
    if (orgFilter !== 'all' && z.org !== orgFilter) return false;

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchDoc = z.docNumber?.toLowerCase().includes(q);
      const matchObj = z.objectName?.toLowerCase().includes(q);
      const matchProrab = z.prorabName?.toLowerCase().includes(q);
      const matchPositions = z.positions?.some((p) => p.materialName?.toLowerCase().includes(q));
      if (!matchDoc && !matchObj && !matchProrab && !matchPositions) return false;
    }
    return true;
  });

  // Handle Position row modifications in New Modal
  const addPositionRow = () => {
    setPositions([
      ...positions,
      { id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5), materialName: '', unit: 'тн', qty: 1, note: '' },
    ]);
  };

  const removePositionRow = (idx: number) => {
    if (positions.length > 1) {
      setPositions(positions.filter((_, i) => i !== idx));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObjectId) {
      alert('Илтимос, объектни танланг');
      return;
    }
    const targetObj = objects.find((o) => o.id === selectedObjectId);
    if (!targetObj) return;

    const validPositions = positions.filter((p) => p.materialName && p.materialName.trim() && (p.qty || 0) > 0);
    if (validPositions.length === 0) {
      alert('Камида битта позиция тўлдирилиши шарт');
      return;
    }

    const orgToUse = targetObj.org || currentUser.org || 'РМУ';
    const currentYear = new Date().getFullYear();
    const docNum = await syncController.getNextDocNumber('zayavki', currentYear);
    const newZayavka: Zayavka = {
      id: 'zay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      docNumber: docNum,
      org: orgToUse,
      objectId: targetObj.id,
      objectName: targetObj.name,
      prorabId: currentUser.id,
      prorabName: currentUser.fullName,
      status: 'glinj_upr', // Immediately enters glinj_upr step
      positions: validPositions.map((p, idx) => ({
        ...p,
        id: p.id || `pos_${idx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        materialId: p.materialId || materials.find((m) => m.name.toLowerCase() === p.materialName.toLowerCase())?.id || '',
        approvedQty: p.qty,
        ptoApproved: true,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveZayavka(
      newZayavka,
      'zayavka.create',
      `Янги заявка яратилди: ${docNum} (${targetObj.name}, ${validPositions.length} позиция)`
    );

    setIsCreateOpen(false);
    setSelectedObjectId('');
    setPositions([{ id: 'pos_1', materialName: '', unit: 'тн', qty: 1, note: '' }]);
  };

  // Workflow Action Handlers
  const handleApproveGlinjUpr = async (zay: Zayavka) => {
    const updated: Zayavka = {
      ...zay,
      status: 'pto_so',
      glinjUprSignedBy: `${currentUser.fullName} (${currentUser.rol === 'glinj_upr' ? 'Гл.инж' : 'Нач.'} ${currentUser.org})`,
      glinjUprSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveZayavka(
      updated,
      'zayavka.approve_upr',
      `Бошқарма (${currentUser.org}) томонидан тасдиқланди ва ПТО СО га юборилди: ${zay.docNumber}`
    );
    setSelectedZayavka(updated);
  };

  const handleApprovePtoSo = async (zay: Zayavka) => {
    const updated: Zayavka = {
      ...zay,
      status: 'glinj_so',
      ptoSoSignedBy: `${currentUser.fullName} (ПТО СО)`,
      ptoSoSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveZayavka(
      updated,
      'zayavka.approve_pto_so',
      `ПТО СО томонидан текширилди ва Гл.инженер СО га юборилди: ${zay.docNumber}`
    );
    setSelectedZayavka(updated);
  };

  const handleApproveGlinjSo = async (zay: Zayavka) => {
    const updated: Zayavka = {
      ...zay,
      status: 'snab_so',
      glinjSoSignedBy: `${currentUser.fullName} (Гл.инженер СО)`,
      glinjSoSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveZayavka(
      updated,
      'zayavka.approve_glinj_so',
      `Бош муҳандис СО томонидан тасдиқланди ва Таъминот (Снабжение СО) га берилди: ${zay.docNumber}`
    );
    setSelectedZayavka(updated);
  };

  const handleFinishSnabSo = async (zay: Zayavka) => {
    if (!contractNo.trim()) {
      alert('Шартнома рақамини киритинг');
      return;
    }
    const updated: Zayavka = {
      ...zay,
      contractNumber: contractNo,
      contractDate: contractDate || new Date().toISOString().split('T')[0],
      invoiceNumber: invoiceNo,
      invoiceFile: invoiceFileBase64,
      invoiceFileName: invoiceFileName,
      snabSoSignedBy: `${currentUser.fullName} (Снабжение СО)`,
      snabSoSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveZayavka(
      updated,
      'zayavka.finish_snab_so',
      `Таъминот якунланди (Шартнома № ${contractNo}): ${zay.docNumber}`
    );
    setSelectedZayavka(updated);
    alert('Заявка таъминот бўйича тўлиқ якунланди!');
  };

  const handleRejectSubmit = async () => {
    if (!rejectReasonModal || !rejectReason.trim()) {
      alert('Илтимос, рад этиш сабабини кўрсатинг');
      return;
    }
    const updated: Zayavka = {
      ...rejectReasonModal,
      status: 'rejected',
      rejectionReason: rejectReason,
      rejectedBy: `${currentUser.fullName} (${currentUser.rol})`,
      rejectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveZayavka(
      updated,
      'zayavka.reject',
      `Заявка рад этилди: ${rejectReasonModal.docNumber}. Сабаб: ${rejectReason}`
    );
    setRejectReasonModal(null);
    setRejectReason('');
    if (selectedZayavka?.id === updated.id) {
      setSelectedZayavka(updated);
    }
  };

  const canEditObject = (z: Zayavka) => {
    if (currentUser.rol === 'admin') return true;
    if (z.status === 'snab_so' && z.contractNumber) return false;
    if (currentUser.rol === 'prorab' && (z.prorabId === currentUser.id || z.org === currentUser.org)) return true;
    if (['glinj_upr', 'nach_upr', 'pto_upr', 'pto_so', 'glinj_so'].includes(currentUser.rol)) return true;
    return false;
  };

  const handleOpenChangeObject = (z: Zayavka, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetObjectToChange(z);
    setNewSelectedObjectId(z.objectId || '');
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
    const updated: Zayavka = {
      ...targetObjectToChange,
      objectId: newObj.id,
      objectName: newObj.name,
      org: newObj.org || targetObjectToChange.org,
      updatedAt: new Date().toISOString(),
    };

    await onSaveZayavka(
      updated,
      'zayavka.change_object',
      `Заявка объекти ўзгартирилди: ${targetObjectToChange.docNumber} ("${oldName}" ➔ "${newObj.name}")`
    );

    if (selectedZayavka?.id === updated.id) {
      setSelectedZayavka(updated);
    }
    setIsEditObjectOpen(false);
    setTargetObjectToChange(null);
    setNewSelectedObjectId('');
    alert(`Заявка объекти муваффақиятли "${newObj.name}" га ўзгартирилди!`);
  };

  const handleDelete = async (zay: Zayavka) => {
    const canDelete =
      currentUser.rol === 'admin' ||
      (currentUser.rol === 'prorab' &&
        zay.prorabId === currentUser.id &&
        ['new', 'glinj_upr', 'rejected'].includes(zay.status));

    if (!canDelete) {
      alert('Сиз ушбу босқичда заявкани ўчира олмайсиз');
      return;
    }

    if (confirm(`Ҳақиқатан ҳам ${zay.docNumber} заявкасини ўчирмоқчимисиз?`)) {
      await onDeleteZayavka(zay.id, `Заявка ўчирилди: ${zay.docNumber}`);
      setIsDetailOpen(false);
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: ZayavkaStatus) => {
    switch (status) {
      case 'new':
      case 'glinj_upr':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" />
            1. Гл.инж / Нач.УПР
          </span>
        );
      case 'pto_so':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" />
            2. ПТО СО
          </span>
        );
      case 'glinj_so':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
            <Clock className="h-3 w-3" />
            3. Гл.инженер СО
          </span>
        );
      case 'snab_so':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Снабжение СО (Якунланган)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
            <XCircle className="h-3.5 w-3.5" />
            Рад этилган
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            <span>Материал Заявкалари Журнали</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Занжир: Прораб → Гл.инж/Нач.УПР → ПТО СО → Гл.инж СО → Снабжение СО
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Янги Заявка бериш</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ҳужжат рақами, объект, прораб ёки материал номи бўйича қидириш..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">Барча статуслар</option>
            <option value="glinj_upr">1. Гл.инж / Нач.УПР</option>
            <option value="pto_so">2. ПТО СО</option>
            <option value="glinj_so">3. Гл.инженер СО</option>
            <option value="snab_so">Якун (Снабжение СО)</option>
            <option value="rejected">Рад этилган</option>
          </select>

          {!isBoshqarma && (
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">Барча бошқармалар</option>
              <option value="РМУ">РМУ</option>
              <option value="СМУ">СМУ</option>
              <option value="СУ">СУ</option>
              <option value="ПМУ">ПМУ</option>
              <option value="УММ">УММ</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">№ Ҳужжат</th>
                <th className="px-4 py-3.5">Бошқарма</th>
                <th className="px-4 py-3.5">Қурилиш объекти</th>
                <th className="px-4 py-3.5">Прораб</th>
                <th className="px-4 py-3.5">Позициялар</th>
                <th className="px-4 py-3.5">Ҳолати (Status)</th>
                <th className="px-4 py-3.5">Сана</th>
                <th className="px-4 py-3.5 text-right">Амаллар</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleZayavki.map((zay) => (
                <tr
                  key={zay.id}
                  onClick={() => {
                    setSelectedZayavka(zay);
                    setIsDetailOpen(true);
                  }}
                  className="hover:bg-blue-50/50 cursor-pointer transition"
                >
                  <td className="px-4 py-3.5 font-bold text-slate-900">{zay.docNumber}</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                      {zay.org}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{zay.objectName}</td>
                  <td className="px-4 py-3.5 text-slate-600">{zay.prorabName}</td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {zay.positions.length} та материал (
                    {zay.positions.map((p) => p.materialName).slice(0, 2).join(', ')}
                    {zay.positions.length > 2 ? '...' : ''})
                  </td>
                  <td className="px-4 py-3.5">{renderStatusBadge(zay.status)}</td>
                  <td className="px-4 py-3.5 text-slate-400">
                    {new Date(zay.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {canEditObject(zay) && (
                        <button
                          onClick={(e) => handleOpenChangeObject(zay, e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition"
                          title="Объектни ўзгартириш"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedZayavka(zay);
                          setIsDetailOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                        title="Очиш ва кўриш"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPrintZayavka(zay)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Чоп этиш (Print)"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {visibleZayavki.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="font-medium">Ҳеч қандай заявка топилмади</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW ZAYAVKA MODAL (Prorab) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>Янги Материал Заявкаси яратиш</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Қурилиш объекти *
                  </label>
                  <select
                    required
                    value={selectedObjectId}
                    onChange={(e) => setSelectedObjectId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">-- Объектни танланг --</option>
                    {(objects.filter((o) => o.org === currentUser.org || currentUser.rol === 'admin' || !currentUser.org).length > 0
                      ? objects.filter((o) => o.org === currentUser.org || currentUser.rol === 'admin' || !currentUser.org)
                      : objects
                    ).map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name} ({obj.org})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Топширувчи прораб
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${currentUser.fullName} (${currentUser.org})`}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
                  />
                </div>
              </div>

              {/* Positions Table in Create Modal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase text-slate-700">
                    Керакли материаллар рўйхати
                  </label>
                  <button
                    type="button"
                    onClick={addPositionRow}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Қатор қўшиш
                  </button>
                </div>

                <div className="space-y-2">
                  {positions.map((pos, idx) => (
                    <div
                      key={pos.id}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50"
                    >
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        placeholder="Материал номи (ёки каталог бўйича)..."
                        value={pos.materialName}
                        onChange={(e) => {
                          const updated = [...positions];
                          updated[idx].materialName = e.target.value;
                          setPositions(updated);
                        }}
                        list="materials-list"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                      />
                      <datalist id="materials-list">
                        {materials.map((m) => (
                          <option key={m.id} value={m.name} />
                        ))}
                      </datalist>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.001"
                          placeholder="Миқдори"
                          value={pos.qty || ''}
                          onChange={(e) => {
                            const updated = [...positions];
                            updated[idx].qty = parseFloat(e.target.value) || 0;
                            setPositions(updated);
                          }}
                          className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-semibold"
                        />
                        <select
                          value={pos.unit}
                          onChange={(e) => {
                            const updated = [...positions];
                            updated[idx].unit = e.target.value;
                            setPositions(updated);
                          }}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                        >
                          <option value="тн">тн</option>
                          <option value="м3">м3</option>
                          <option value="м2">м2</option>
                          <option value="м.п">м.п</option>
                          <option value="м">м</option>
                          <option value="тыс.шт">минг.дона</option>
                          <option value="шт">дона</option>
                          <option value="компл">компл</option>
                          <option value="кг">кг</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Изоҳ (қаерга)"
                          value={pos.note || ''}
                          onChange={(e) => {
                            const updated = [...positions];
                            updated[idx].note = e.target.value;
                            setPositions(updated);
                          }}
                          className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                        {positions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePositionRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition"
                >
                  Заявкани топшириш → Гл.инж / Нач.УПР
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & WORKFLOW ACTION MODAL */}
      {isDetailOpen && selectedZayavka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selectedZayavka.docNumber}</h3>
                  {renderStatusBadge(selectedZayavka.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedZayavka.org} • {selectedZayavka.objectName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintZayavka(selectedZayavka)}
                  className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Чоп этиш
                </button>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Rejection alert if rejected */}
              {selectedZayavka.status === 'rejected' && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span>Заявка рад этилган!</span>
                  </div>
                  <p><strong>Рад этувчи:</strong> {selectedZayavka.rejectedBy}</p>
                  <p><strong>Сабаб:</strong> {selectedZayavka.rejectionReason}</p>
                </div>
              )}

              {/* Document Overview with Object Change Action */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Бошқарма</span>
                    <p className="font-semibold text-slate-800">{selectedZayavka.org}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Прораб / Сўровчи</span>
                    <p className="font-semibold text-slate-800">{selectedZayavka.prorabName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Яратилган сана</span>
                    <p className="font-semibold text-slate-800">{new Date(selectedZayavka.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Бириктирилган Қурилиш Объекти</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm mt-0.5">
                      <Building className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{selectedZayavka.objectName}</span>
                      <span className="text-xs font-normal text-slate-500">({selectedZayavka.org})</span>
                    </div>
                  </div>

                  {canEditObject(selectedZayavka) && (
                    <button
                      type="button"
                      onClick={() => handleOpenChangeObject(selectedZayavka)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Объектни ўзгартириш</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Steps Indicator */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">
                  Ҳужжат ўтиш босқичлари
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div className={`p-2.5 rounded-lg border ${selectedZayavka.glinjUprSignedBy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedZayavka.status === 'glinj_upr' ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <div className="text-[10px] uppercase font-semibold">1. Гл.инж / Нач.УПР</div>
                    <div className="mt-1 text-xs truncate">
                      {selectedZayavka.glinjUprSignedBy ? `✓ ${selectedZayavka.glinjUprSignedBy}` : 'Кутилмоқда'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${selectedZayavka.ptoSoSignedBy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedZayavka.status === 'pto_so' ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <div className="text-[10px] uppercase font-semibold">2. ПТО СО</div>
                    <div className="mt-1 text-xs truncate">
                      {selectedZayavka.ptoSoSignedBy ? `✓ ${selectedZayavka.ptoSoSignedBy}` : 'Кутилмоқда'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${selectedZayavka.glinjSoSignedBy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedZayavka.status === 'glinj_so' ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <div className="text-[10px] uppercase font-semibold">3. Гл.инженер СО</div>
                    <div className="mt-1 text-xs truncate">
                      {selectedZayavka.glinjSoSignedBy ? `✓ ${selectedZayavka.glinjSoSignedBy}` : 'Кутилмоқда'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${selectedZayavka.contractNumber ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedZayavka.status === 'snab_so' ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <div className="text-[10px] uppercase font-semibold">4. Снабжение СО</div>
                    <div className="mt-1 text-xs truncate">
                      {selectedZayavka.contractNumber ? `✓ Шартнома № ${selectedZayavka.contractNumber}` : 'Кутилмоқда'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Positions Table in Detail Modal */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-700 mb-2">
                  Талаб қилинадиган материаллар рўйхати
                </h4>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">№</th>
                        <th className="px-3 py-2.5">Материал номи</th>
                        <th className="px-3 py-2.5">Сўралган</th>
                        {currentUser.rol === 'pto_so' && selectedZayavka.status === 'pto_so' && (
                          <th className="px-3 py-2.5">Тасдиқ (ПТО)</th>
                        )}
                        <th className="px-3 py-2.5">Ўлчов</th>
                        <th className="px-3 py-2.5">Изоҳ / ПТО хулосаси</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedZayavka.positions.map((pos, idx) => (
                        <tr key={pos.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{pos.materialName}</td>
                          <td className="px-3 py-2.5 font-bold text-blue-700">{pos.qty}</td>
                          
                          {/* PTO SO position-by-position review (✓ / ✗ + note) */}
                          {currentUser.rol === 'pto_so' && selectedZayavka.status === 'pto_so' ? (
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...selectedZayavka };
                                    updated.positions[idx].ptoApproved = !pos.ptoApproved;
                                    setSelectedZayavka(updated);
                                  }}
                                  className={`rounded-md p-1 ${pos.ptoApproved !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
                                >
                                  {pos.ptoApproved !== false ? '✓ Қабул' : '✗ Рад'}
                                </button>
                                <input
                                  type="number"
                                  step="any"
                                  value={pos.approvedQty !== undefined ? pos.approvedQty : pos.qty}
                                  onChange={(e) => {
                                    const updated = { ...selectedZayavka };
                                    updated.positions[idx].approvedQty = parseFloat(e.target.value) || 0;
                                    setSelectedZayavka(updated);
                                  }}
                                  className="w-20 rounded border border-slate-300 px-1.5 py-1 text-xs font-bold"
                                />
                              </div>
                            </td>
                          ) : (
                            pos.approvedQty !== undefined && pos.approvedQty !== pos.qty && (
                              <td className="px-3 py-2.5 text-amber-700 font-bold">
                                Тасдиқ: {pos.approvedQty}
                              </td>
                            )
                          )}

                          <td className="px-3 py-2.5 text-slate-500">{pos.unit}</td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {currentUser.rol === 'pto_so' && selectedZayavka.status === 'pto_so' ? (
                              <input
                                type="text"
                                placeholder="ПТО изоҳи..."
                                value={pos.ptoComment || ''}
                                onChange={(e) => {
                                  const updated = { ...selectedZayavka };
                                  updated.positions[idx].ptoComment = e.target.value;
                                  setSelectedZayavka(updated);
                                }}
                                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                              />
                            ) : (
                              <span>
                                {pos.note || '-'}
                                {pos.ptoComment && (
                                  <span className="block text-[11px] text-blue-600 font-medium">
                                    ПТО: {pos.ptoComment}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Snab SO: Attached Contract & Invoice info */}
              {selectedZayavka.contractNumber && (
                <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-4 text-xs">
                  <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <span>Таъминот маълумотлари (Снабжение СО)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div><strong>Шартнома рақами:</strong> {selectedZayavka.contractNumber}</div>
                    <div><strong>Шартнома санаси:</strong> {selectedZayavka.contractDate}</div>
                    <div><strong>Счёт-фактура рақами:</strong> {selectedZayavka.invoiceNumber || 'Бириктирилган'}</div>
                    <div><strong>Масъул:</strong> {selectedZayavka.snabSoSignedBy}</div>
                  </div>
                </div>
              )}

              {/* Snab SO Input Section when status is snab_so */}
              {currentUser.rol === 'snab_so' && selectedZayavka.status === 'snab_so' && !selectedZayavka.contractNumber && (
                <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-4 text-xs space-y-3">
                  <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Upload className="h-4 w-4 text-blue-600" />
                    <span>Шартнома ва Счёт-фактура бириктириш (Снабжение СО)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Шартнома № *</label>
                      <input
                        type="text"
                        required
                        value={contractNo}
                        onChange={(e) => setContractNo(e.target.value)}
                        placeholder="Д-104/26"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Шартнома санаси</label>
                      <input
                        type="date"
                        value={contractDate}
                        onChange={(e) => setContractDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Счёт-фактура №</label>
                      <input
                        type="text"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                        placeholder="СФ-00129"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFinishSnabSo(selectedZayavka)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Таъминот бўйича якунлаш ва тасдиқлаш</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                {/* Delete button (for prorab in draft/upr or admin) */}
                {(currentUser.rol === 'admin' ||
                  (currentUser.rol === 'prorab' &&
                    selectedZayavka.prorabId === currentUser.id &&
                    ['new', 'glinj_upr', 'rejected'].includes(selectedZayavka.status))) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedZayavka)}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ўчириш</span>
                  </button>
                )}

                {/* Reject Button (accessible by any approver at current step) */}
                {selectedZayavka.status !== 'snab_so' && selectedZayavka.status !== 'rejected' && (
                  (['glinj_upr', 'nach_upr'].includes(currentUser.rol) && selectedZayavka.status === 'glinj_upr') ||
                  (currentUser.rol === 'pto_so' && selectedZayavka.status === 'pto_so') ||
                  (currentUser.rol === 'glinj_so' && selectedZayavka.status === 'glinj_so') ||
                  currentUser.rol === 'admin'
                ) && (
                  <button
                    type="button"
                    onClick={() => setRejectReasonModal(selectedZayavka)}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Рад этиш</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                >
                  Ёпиш
                </button>

                {/* Step 1 Approval: GLINJ_UPR or NACH_UPR */}
                {(currentUser.rol === 'glinj_upr' || currentUser.rol === 'nach_upr' || currentUser.rol === 'admin') &&
                  selectedZayavka.status === 'glinj_upr' &&
                  (currentUser.org === selectedZayavka.org || currentUser.rol === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleApproveGlinjUpr(selectedZayavka)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Тасдиқлаш → ПТО СО га юбориш</span>
                    </button>
                  )}

                {/* Step 2 Approval: PTO_SO */}
                {(currentUser.rol === 'pto_so' || currentUser.rol === 'admin') &&
                  selectedZayavka.status === 'pto_so' && (
                    <button
                      type="button"
                      onClick={() => handleApprovePtoSo(selectedZayavka)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>ПТО Тасдиғи → Гл.инженер СО га</span>
                    </button>
                  )}

                {/* Step 3 Approval: GLINJ_SO */}
                {(currentUser.rol === 'glinj_so' || currentUser.rol === 'admin') &&
                  selectedZayavka.status === 'glinj_so' && (
                    <button
                      type="button"
                      onClick={() => handleApproveGlinjSo(selectedZayavka)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Якуний Тасдиқ → Снабжение СО га</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {rejectReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Заявкани рад этиш: {rejectReasonModal.docNumber}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Илтимос, заявка нима сабабдан рад этилганини батафсил ёзинг (прорабга тушунтириш учун):
            </p>

            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Масалан: Меъёрдан ортиқ ҳажм киритилган, қайта ҳисоб-китоб қилинг..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRejectReasonModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Бекор қилиш
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Рад этишни тасдиқлаш
              </button>
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
                <Building className="h-5 w-5 text-blue-600" />
                <span>Қурилиш объектини ўзгартириш</span>
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
                <p className="text-slate-500">Ҳужжат рақами: <strong className="text-slate-900">{targetObjectToChange.docNumber}</strong></p>
                <p className="text-slate-500 mt-1">Ҳозирги объект: <strong className="text-blue-700">{targetObjectToChange.objectName}</strong> ({targetObjectToChange.org})</p>
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1.5">
                  Янги қурилиш объектини танланг *
                </label>
                <select
                  value={newSelectedObjectId}
                  onChange={(e) => setNewSelectedObjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition"
              >
                Сақлаш ва ўзгартириш
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE VIEW MODAL */}
      {printZayavka && (
        <PrintModal
          isOpen={true}
          onClose={() => setPrintZayavka(null)}
          title={`Материал Заявкаси ${printZayavka.docNumber}`}
        >
          <div className="space-y-6 text-slate-900 font-serif">
            <div className="text-center border-b-2 border-slate-900 pb-4">
              <h2 className="text-xl font-bold uppercase tracking-wide">
                «СТРОЙМЕНЕДЖЕР» ҚУРИЛИШ КОМПАНИЯСИ
              </h2>
              <p className="text-sm font-sans text-slate-600 mt-1">
                {printZayavka.org} Бошқармаси • Қурилиш материаллари талабномаси
              </p>
              <h3 className="text-lg font-bold font-sans mt-2">
                ЗАЯВКА № {printZayavka.docNumber}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div><strong>Объект номи:</strong> {printZayavka.objectName}</div>
              <div><strong>Топширилган сана:</strong> {new Date(printZayavka.createdAt).toLocaleDateString()}</div>
              <div><strong>Топширувчи Прораб:</strong> {printZayavka.prorabName}</div>
              <div><strong>Ҳолати:</strong> {printZayavka.status}</div>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-xs font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 p-2 text-center w-10">№</th>
                  <th className="border border-slate-900 p-2 text-left">Материал номи</th>
                  <th className="border border-slate-900 p-2 text-center w-24">Ўлчов бирлиги</th>
                  <th className="border border-slate-900 p-2 text-right w-24">Сўралган миқдор</th>
                  <th className="border border-slate-900 p-2 text-right w-24">ПТО тасдиғи</th>
                  <th className="border border-slate-900 p-2 text-left">Изоҳ</th>
                </tr>
              </thead>
              <tbody>
                {printZayavka.positions.map((pos, i) => (
                  <tr key={pos.id}>
                    <td className="border border-slate-900 p-2 text-center">{i + 1}</td>
                    <td className="border border-slate-900 p-2 font-semibold">{pos.materialName}</td>
                    <td className="border border-slate-900 p-2 text-center">{pos.unit}</td>
                    <td className="border border-slate-900 p-2 text-right font-bold">{pos.qty}</td>
                    <td className="border border-slate-900 p-2 text-right font-bold">
                      {pos.approvedQty !== undefined ? pos.approvedQty : pos.qty}
                    </td>
                    <td className="border border-slate-900 p-2">{pos.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures block */}
            <div className="grid grid-cols-2 gap-6 pt-8 text-xs font-sans border-t border-slate-300">
              <div className="space-y-4">
                <div>
                  <strong>Прораб:</strong> ________________ / {printZayavka.prorabName}
                </div>
                <div>
                  <strong>Гл.инженер/Нач. бошқарма:</strong> ________________ /{' '}
                  {printZayavka.glinjUprSignedBy || '________________'}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <strong>ПТО СО масъул муҳандиси:</strong> ________________ /{' '}
                  {printZayavka.ptoSoSignedBy || '________________'}
                </div>
                <div>
                  <strong>Бош муҳандис (СО):</strong> ________________ /{' '}
                  {printZayavka.glinjSoSignedBy || '________________'}
                </div>
              </div>
            </div>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
