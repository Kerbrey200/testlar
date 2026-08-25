'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  Trash2,
  ChevronRight,
  Upload,
  Download,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  User,
  Hisobot,
  HisobotRow,
  HisobotStatus,
  ConstructionObject,
  MaterialItem,
} from '@/lib/types';
import PrintModal from '../PrintModal';

interface Props {
  currentUser: User;
  hisobotlar: Hisobot[];
  objects: ConstructionObject[];
  materials: MaterialItem[];
  onSaveHisobot: (hisobot: Hisobot, auditAction: string, auditDetails: string) => Promise<void>;
  onDeleteHisobot: (id: string, details: string) => Promise<void>;
}

export default function HisobotlarView({
  currentUser,
  hisobotlar,
  objects,
  materials,
  onSaveHisobot,
  onDeleteHisobot,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedHisobot, setSelectedHisobot] = useState<Hisobot | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printHisobot, setPrintHisobot] = useState<Hisobot | null>(null);

  // New report form state
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [periodMonth, setPeriodMonth] = useState('2026-08');
  const [rows, setRows] = useState<HisobotRow[]>([
    {
      id: 'row_1',
      materialName: '',
      unit: 'тн',
      normQty: 10,
      factQty: 10,
      spisanieQty: 10,
      differenceQty: 0,
      price: 8500000,
      note: '',
    },
  ]);

  // Check Org visibility rule: Boshqarma employees only see their own org, SO & admin see all
  const isBoshqarma = ['glinj_upr', 'nach_upr', 'pto_upr', 'buh_upr'].includes(currentUser.rol);

  const visibleHisobotlar = hisobotlar.filter((h) => {
    if (isBoshqarma && h.org !== currentUser.org) return false;
    if (currentUser.rol === 'prorab' && h.prorabId !== currentUser.id && h.org !== currentUser.org) return false;
    if (statusFilter !== 'all' && h.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        h.docNumber.toLowerCase().includes(q) ||
        h.objectName.toLowerCase().includes(q) ||
        h.prorabName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const addRow = () => {
    setRows([
      ...rows,
      {
        id: 'row_' + Date.now(),
        materialName: '',
        unit: 'тн',
        normQty: 0,
        factQty: 0,
        spisanieQty: 0,
        differenceQty: 0,
        price: 0,
        note: '',
      },
    ]);
  };

  const removeRow = (idx: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== idx));
    }
  };

  // Excel File Import Handler for Prorab
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        // Skip headers, parse rows
        const parsedRows: HisobotRow[] = [];
        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          if (!r || !r[0]) continue;
          const materialName = String(r[0] || '').trim();
          const unit = String(r[1] || 'тн').trim();
          const normQty = parseFloat(r[2]) || 0;
          const factQty = parseFloat(r[3]) || normQty;
          const spisanieQty = parseFloat(r[4]) || factQty;
          const price = parseFloat(r[5]) || 0;
          const note = String(r[6] || '');

          parsedRows.push({
            id: 'row_' + Date.now() + '_' + i,
            materialName,
            unit,
            normQty,
            factQty,
            spisanieQty,
            differenceQty: spisanieQty - factQty,
            price,
            note,
          });
        }

        if (parsedRows.length > 0) {
          setRows(parsedRows);
          alert(`Excel дан ${parsedRows.length} та қатор материал муваффақиятли юкланди!`);
        }
      } catch (err) {
        console.error('Excel parse error:', err);
        alert('Excel файлни ўқишда хатолик. Форматни текширинг.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Excel Export Handler
  const handleExcelExport = (report: Hisobot) => {
    const exportData = report.rows.map((r, idx) => ({
      '№': idx + 1,
      'Материал номи': r.materialName,
      'Ўлчов бирлиги': r.unit,
      'Меъёр бўйича (Норма)': r.normQty,
      'Фактик сарф (Фактически)': r.factQty,
      'Бухгалтерия списанияси (Списание)': r.spisanieQty,
      'Экономия (+) / Перерасход (-)': r.differenceQty,
      'Нархи (сўм)': r.price || 0,
      'Суммаси': (r.spisanieQty * (r.price || 0)).toLocaleString(),
      'Изоҳ': r.note || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'М-29 Ҳисобот');
    XLSX.writeFile(wb, `${report.docNumber}_${report.periodMonth}.xlsx`);
  };

  // Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObjectId) {
      alert('Объектни танланг');
      return;
    }
    const targetObj = objects.find((o) => o.id === selectedObjectId);
    if (!targetObj) return;

    const validRows = rows.filter((r) => r.materialName.trim());
    if (validRows.length === 0) {
      alert('Камида битта қатор тўлдиринг');
      return;
    }

    const docNum = `ОТЧ-${periodMonth}/${hisobotlar.length + 1}`;
    const newHisobot: Hisobot = {
      id: 'his_' + Date.now(),
      docNumber: docNum,
      org: currentUser.org,
      objectId: targetObj.id,
      objectName: targetObj.name,
      prorabId: currentUser.id,
      prorabName: currentUser.fullName,
      periodMonth,
      status: 'new',
      rows: validRows.map((r) => ({
        ...r,
        differenceQty: (r.spisanieQty || r.factQty) - r.factQty,
      })),
      prorabSignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveHisobot(
      newHisobot,
      'hisobot.create',
      `Ойлик техник ҳисобот топширилди: ${docNum} (${targetObj.name})`
    );

    setIsCreateOpen(false);
  };

  // Workflow Step 2: PTO_UPR ("Фактически" 1-ustunni tekshiradi/tuzatadi -> status 'pto')
  const handlePtoApprove = async (report: Hisobot) => {
    const updated: Hisobot = {
      ...report,
      status: 'pto',
      ptoSignedBy: `${currentUser.fullName} (ПТО ${currentUser.org})`,
      ptoSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveHisobot(
      updated,
      'hisobot.pto_approve',
      `ПТО ${currentUser.org} томонидан "Фактически" устуни текширилди ва Бухгалтерияга берилди: ${report.docNumber}`
    );
    setSelectedHisobot(updated);
  };

  // Workflow Step 3: BUH_UPR ("Списание" 2-ustunni kiritadi, "Экономия/Перерасход" auto-calc -> status 'buh')
  const handleBuhApprove = async (report: Hisobot) => {
    const updatedRows = report.rows.map((r) => ({
      ...r,
      differenceQty: r.spisanieQty - r.factQty,
    }));

    const updated: Hisobot = {
      ...report,
      rows: updatedRows,
      status: 'buh',
      buhSignedBy: `${currentUser.fullName} (Бухгалтер ${currentUser.org})`,
      buhSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveHisobot(
      updated,
      'hisobot.buh_approve',
      `Бухгалтерия ${currentUser.org} томонидан Списание киритилди ва Бош муҳандисга ўтказилди: ${report.docNumber}`
    );
    setSelectedHisobot(updated);
  };

  // Workflow Step 4: GLINJ_UPR ("Провести" -> status 'listed')
  const handleGlinjConduct = async (report: Hisobot) => {
    const updated: Hisobot = {
      ...report,
      status: 'listed',
      glinjSignedBy: `${currentUser.fullName} (Гл.инженер ${currentUser.org})`,
      glinjSignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveHisobot(
      updated,
      'hisobot.glinj_conduct',
      `Ҳисобот ўтказилди (Проведено / Listed): ${report.docNumber} (${report.objectName})`
    );
    setSelectedHisobot(updated);
    alert('Ҳисобот муваффақиятли расмийлаштирилди (Listed / Проведено)!');
  };

  const renderStatusBadge = (status: HisobotStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            <Clock className="h-3 w-3" /> 1. Прораб (Янги)
          </span>
        );
      case 'pto':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" /> 2. ПТО текшируви
          </span>
        );
      case 'buh':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            <Clock className="h-3 w-3" /> 3. Бухгалтерия списанияси
          </span>
        );
      case 'glinj':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> 4. Гл.инж тасдиғи
          </span>
        );
      case 'listed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Проведено (Listed)
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
            <TrendingUp className="h-7 w-7 text-purple-600" />
            <span>Ойлик Техник Ҳисобот (М-29 Списание)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Занжир: Прораб (new) → ПТО_УПР (Фактически) → БУХ_УПР (Списание) → ГЛИНЖ_УПР (Провести / listed)
          </p>
        </div>

        {currentUser.rol === 'prorab' && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-purple-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Ойлик ҳисобот топшириш</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ҳужжат рақами, объект ёки прораб бўйича қидириш..."
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
          <option value="pto">2. ПТО текширувида (pto)</option>
          <option value="buh">3. Бухгалтерияда (buh)</option>
          <option value="glinj">4. Гл.инженерда (glinj)</option>
          <option value="listed">Ўтказилган (listed)</option>
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
                <th className="px-4 py-3.5">Қурилиш объекти</th>
                <th className="px-4 py-3.5">Прораб</th>
                <th className="px-4 py-3.5">Ҳисобот ойи</th>
                <th className="px-4 py-3.5">Позициялар сони</th>
                <th className="px-4 py-3.5">Ҳолати</th>
                <th className="px-4 py-3.5 text-right">Амаллар</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleHisobotlar.map((h) => (
                <tr
                  key={h.id}
                  onClick={() => {
                    setSelectedHisobot(h);
                    setIsDetailOpen(true);
                  }}
                  className="hover:bg-purple-50/40 cursor-pointer transition"
                >
                  <td className="px-4 py-3.5 font-bold text-slate-900">{h.docNumber}</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                      {h.org}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-800">{h.objectName}</td>
                  <td className="px-4 py-3.5 text-slate-600">{h.prorabName}</td>
                  <td className="px-4 py-3.5 font-semibold text-purple-700">{h.periodMonth}</td>
                  <td className="px-4 py-3.5 text-slate-500">{h.rows.length} та материал</td>
                  <td className="px-4 py-3.5">{renderStatusBadge(h.status)}</td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleExcelExport(h)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition"
                        title="Excel га юклаб олиш"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPrintHisobot(h)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Чоп этиш (М-29)"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {visibleHisobotlar.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <TrendingUp className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="font-medium">Ҳеч қандай ойлик ҳисобот топилмади</p>
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
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <span>Янги Ойлик Техник Ҳисобот яратиш (М-29)</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Қурилиш объекти *
                  </label>
                  <select
                    required
                    value={selectedObjectId}
                    onChange={(e) => setSelectedObjectId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-purple-500"
                  >
                    <option value="">-- Танланг --</option>
                    {objects
                      .filter((o) => o.org === currentUser.org || currentUser.rol === 'admin')
                      .map((obj) => (
                        <option key={obj.id} value={obj.id}>
                          {obj.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Ҳисобот ойи *
                  </label>
                  <input
                    type="month"
                    required
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-purple-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Excel орқали импорт
                  </label>
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-300 bg-purple-50/50 px-3 py-2 text-xs font-semibold text-purple-700 cursor-pointer hover:bg-purple-100/50 transition">
                    <Upload className="h-4 w-4" />
                    <span>Excel (.xlsx) юклаш</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Rows Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    Материаллар сарфи жадвали
                  </label>
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Қатор қўшиш
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-8 text-center">№</th>
                        <th className="p-2">Материал номи</th>
                        <th className="p-2 w-20">Ўлчов</th>
                        <th className="p-2 w-24">Норма</th>
                        <th className="p-2 w-24">Фактически</th>
                        <th className="p-2 w-28">Нархи (сўм)</th>
                        <th className="p-2">Изоҳ</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              value={row.materialName}
                              onChange={(e) => {
                                const copy = [...rows];
                                copy[idx].materialName = e.target.value;
                                setRows(copy);
                              }}
                              placeholder="Материал номи..."
                              className="w-full rounded border border-slate-300 p-1.5 text-xs font-medium"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.unit}
                              onChange={(e) => {
                                const copy = [...rows];
                                copy[idx].unit = e.target.value;
                                setRows(copy);
                              }}
                              className="w-full rounded border border-slate-300 p-1.5 text-xs"
                            >
                              <option value="тн">тн</option>
                              <option value="м3">м3</option>
                              <option value="м2">м2</option>
                              <option value="м.п">м.п</option>
                              <option value="тыс.шт">минг.дона</option>
                              <option value="шт">дона</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={row.normQty}
                              onChange={(e) => {
                                const copy = [...rows];
                                copy[idx].normQty = parseFloat(e.target.value) || 0;
                                setRows(copy);
                              }}
                              className="w-full rounded border border-slate-300 p-1.5 text-xs font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={row.factQty}
                              onChange={(e) => {
                                const copy = [...rows];
                                copy[idx].factQty = parseFloat(e.target.value) || 0;
                                copy[idx].spisanieQty = copy[idx].factQty;
                                setRows(copy);
                              }}
                              className="w-full rounded border border-slate-300 p-1.5 text-xs font-bold text-blue-700"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={row.price || ''}
                              onChange={(e) => {
                                const copy = [...rows];
                                copy[idx].price = parseFloat(e.target.value) || 0;
                                setRows(copy);
                              }}
                              className="w-full rounded border border-slate-300 p-1.5 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.note || ''}
                              onChange={(e) => {
                                const copy = [...rows];
                                copy[idx].note = e.target.value;
                                setRows(copy);
                              }}
                              placeholder="Изоҳ..."
                              className="w-full rounded border border-slate-300 p-1.5 text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700"
                >
                  Ҳисоботни топшириш → ПТО га
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL WITH 3 COLUMNS AND SIGNATURES */}
      {isDetailOpen && selectedHisobot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selectedHisobot.docNumber}</h3>
                  {renderStatusBadge(selectedHisobot.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedHisobot.org} • {selectedHisobot.objectName} • Давр: {selectedHisobot.periodMonth}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExcelExport(selectedHisobot)}
                  className="flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition border border-emerald-200"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </button>
                <button
                  onClick={() => setPrintHisobot(selectedHisobot)}
                  className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  М-29 Чоп этиш
                </button>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Steps & Digital Signatures Box */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">
                  Рақамли Имзолар ва Ҳужжат Босқичлари
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border bg-white border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500">1. Прораб (Topshirdi)</span>
                    <div className="font-semibold text-slate-800 mt-1">✓ {selectedHisobot.prorabName}</div>
                    <div className="text-[10px] text-slate-400">{new Date(selectedHisobot.prorabSignedAt).toLocaleString()}</div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${selectedHisobot.ptoSignedBy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedHisobot.status === 'new' ? 'bg-amber-50 border-amber-300 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span className="text-[10px] uppercase font-bold">2. ПТО УПР (Фактически)</span>
                    <div className="mt-1 font-semibold">{selectedHisobot.ptoSignedBy || 'Кутилмоқда'}</div>
                    {selectedHisobot.ptoSignedAt && <div className="text-[10px]">{new Date(selectedHisobot.ptoSignedAt).toLocaleString()}</div>}
                  </div>

                  <div className={`p-2.5 rounded-lg border ${selectedHisobot.buhSignedBy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedHisobot.status === 'pto' ? 'bg-amber-50 border-amber-300 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span className="text-[10px] uppercase font-bold">3. Бухгалтерия (Списание)</span>
                    <div className="mt-1 font-semibold">{selectedHisobot.buhSignedBy || 'Кутилмоқда'}</div>
                    {selectedHisobot.buhSignedAt && <div className="text-[10px]">{new Date(selectedHisobot.buhSignedAt).toLocaleString()}</div>}
                  </div>

                  <div className={`p-2.5 rounded-lg border ${selectedHisobot.glinjSignedBy ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedHisobot.status === 'buh' ? 'bg-amber-50 border-amber-300 font-bold' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span className="text-[10px] uppercase font-bold">4. Гл.инженер (Провести)</span>
                    <div className="mt-1 font-semibold">{selectedHisobot.glinjSignedBy || 'Кутилмоқда'}</div>
                    {selectedHisobot.glinjSignedAt && <div className="text-[10px]">{new Date(selectedHisobot.glinjSignedAt).toLocaleString()}</div>}
                  </div>
                </div>
              </div>

              {/* 3 Columns Table: 1-ustun "Фактически", 2-ustun "Списание", 3-ustun "Экономия/Перерасход" */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center w-8">№</th>
                      <th className="p-2.5">Материал номи</th>
                      <th className="p-2.5 text-center w-16">Ўлчов</th>
                      <th className="p-2.5 text-right w-20">Норма</th>
                      <th className="p-2.5 text-right w-28 bg-blue-50 text-blue-900">
                        1. Фактически (ПТО)
                      </th>
                      <th className="p-2.5 text-right w-28 bg-purple-50 text-purple-900">
                        2. Списание (Бух)
                      </th>
                      <th className="p-2.5 text-right w-32 bg-amber-50 text-amber-900">
                        3. Экономия / Перерасход
                      </th>
                      <th className="p-2.5">Изоҳ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedHisobot.rows.map((r, idx) => {
                      const diff = r.spisanieQty - r.factQty;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">{r.materialName}</td>
                          <td className="p-2.5 text-center text-slate-500">{r.unit}</td>
                          <td className="p-2.5 text-right text-slate-600 font-semibold">{r.normQty}</td>

                          {/* 1-Ustun: Фактически (PTO_UPR edits during 'new' status) */}
                          <td className="p-2.5 text-right bg-blue-50/40">
                            {currentUser.rol === 'pto_upr' && selectedHisobot.status === 'new' ? (
                              <input
                                type="number"
                                step="any"
                                value={r.factQty}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = { ...selectedHisobot };
                                  updated.rows[idx].factQty = val;
                                  setSelectedHisobot(updated);
                                }}
                                className="w-20 rounded border border-blue-300 bg-white p-1 text-right font-bold text-blue-700 outline-none"
                              />
                            ) : (
                              <span className="font-bold text-blue-800">{r.factQty}</span>
                            )}
                          </td>

                          {/* 2-Ustun: Списание (BUH_UPR edits during 'pto' status) */}
                          <td className="p-2.5 text-right bg-purple-50/40">
                            {currentUser.rol === 'buh_upr' && selectedHisobot.status === 'pto' ? (
                              <input
                                type="number"
                                step="any"
                                value={r.spisanieQty}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = { ...selectedHisobot };
                                  updated.rows[idx].spisanieQty = val;
                                  updated.rows[idx].differenceQty = val - updated.rows[idx].factQty;
                                  setSelectedHisobot(updated);
                                }}
                                className="w-20 rounded border border-purple-300 bg-white p-1 text-right font-bold text-purple-700 outline-none"
                              />
                            ) : (
                              <span className="font-bold text-purple-800">{r.spisanieQty}</span>
                            )}
                          </td>

                          {/* 3-Ustun: Экономия/Перерасход (= списание − фактически) */}
                          <td className="p-2.5 text-right bg-amber-50/40 font-extrabold">
                            <span
                              className={
                                diff > 0
                                  ? 'text-emerald-700'
                                  : diff < 0
                                  ? 'text-rose-700'
                                  : 'text-slate-600'
                              }
                            >
                              {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                            </span>
                          </td>

                          <td className="p-2.5 text-slate-500">{r.note || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                {currentUser.rol === 'admin' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Ҳисоботни ўчирмоқчимисиз?')) {
                        await onDeleteHisobot(selectedHisobot.id, `Ҳисобот ўчирилди: ${selectedHisobot.docNumber}`);
                        setIsDetailOpen(false);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Ўчириш
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

                {/* Step 2 Action: PTO_UPR */}
                {(currentUser.rol === 'pto_upr' || currentUser.rol === 'admin') &&
                  selectedHisobot.status === 'new' &&
                  (currentUser.org === selectedHisobot.org || currentUser.rol === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handlePtoApprove(selectedHisobot)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>1-босқич: Фактически тасдиқлаш → Бухгалтерияга</span>
                    </button>
                  )}

                {/* Step 3 Action: BUH_UPR */}
                {(currentUser.rol === 'buh_upr' || currentUser.rol === 'admin') &&
                  selectedHisobot.status === 'pto' &&
                  (currentUser.org === selectedHisobot.org || currentUser.rol === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleBuhApprove(selectedHisobot)}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>2-босқич: Списание тасдиқлаш → Гл.инженерга</span>
                    </button>
                  )}

                {/* Step 4 Action: GLINJ_UPR ("Провести") */}
                {(currentUser.rol === 'glinj_upr' || currentUser.rol === 'nach_upr' || currentUser.rol === 'admin') &&
                  selectedHisobot.status === 'buh' &&
                  (currentUser.org === selectedHisobot.org || currentUser.rol === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleGlinjConduct(selectedHisobot)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>ПРО ВЕСТИ (Расмийлаштириш)</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT M-29 MODAL */}
      {printHisobot && (
        <PrintModal
          isOpen={true}
          onClose={() => setPrintHisobot(null)}
          title={`М-29 Техник Ҳисобот ${printHisobot.docNumber}`}
        >
          <div className="space-y-6 text-slate-900 font-serif">
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <h2 className="text-lg font-bold uppercase">ТИПОВАЯ МЕЖОТРАСЛЕВАЯ ФОРМА № М-29</h2>
              <h3 className="text-base font-bold font-sans mt-1">
                МАТЕРИАЛЛАР САРИФИ БЎЙИЧА ҲИСОБОТ № {printHisobot.docNumber}
              </h3>
              <p className="text-xs font-sans text-slate-600 mt-1">
                Бошқарма: {printHisobot.org} • Давр: {printHisobot.periodMonth}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div><strong>Объект номи:</strong> {printHisobot.objectName}</div>
              <div><strong>Масъул прораб:</strong> {printHisobot.prorabName}</div>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-[11px] font-sans">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-900 p-1.5 text-center">№</th>
                  <th className="border border-slate-900 p-1.5 text-left">Материал номи</th>
                  <th className="border border-slate-900 p-1.5 text-center">Ўлчов</th>
                  <th className="border border-slate-900 p-1.5 text-right">Норма</th>
                  <th className="border border-slate-900 p-1.5 text-right">Фактически (1)</th>
                  <th className="border border-slate-900 p-1.5 text-right">Списание (2)</th>
                  <th className="border border-slate-900 p-1.5 text-right">Экономия/Перерасход (3)</th>
                </tr>
              </thead>
              <tbody>
                {printHisobot.rows.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-slate-900 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-slate-900 p-1.5 font-semibold">{r.materialName}</td>
                    <td className="border border-slate-900 p-1.5 text-center">{r.unit}</td>
                    <td className="border border-slate-900 p-1.5 text-right">{r.normQty}</td>
                    <td className="border border-slate-900 p-1.5 text-right font-bold">{r.factQty}</td>
                    <td className="border border-slate-900 p-1.5 text-right font-bold">{r.spisanieQty}</td>
                    <td className="border border-slate-900 p-1.5 text-right font-extrabold">
                      {r.differenceQty > 0 ? `+${r.differenceQty}` : r.differenceQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-6 text-xs font-sans border-t border-slate-300">
              <div className="space-y-4">
                <div><strong>Прораб (топширди):</strong> ________________ / {printHisobot.prorabName}</div>
                <div><strong>ПТО муҳандиси:</strong> ________________ / {printHisobot.ptoSignedBy || '________________'}</div>
              </div>
              <div className="space-y-4">
                <div><strong>Бухгалтер:</strong> ________________ / {printHisobot.buhSignedBy || '________________'}</div>
                <div><strong>Бош муҳандис:</strong> ________________ / {printHisobot.glinjSignedBy || '________________'}</div>
              </div>
            </div>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
