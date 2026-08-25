'use client';

import React, { useState } from 'react';
import {
  FileCheck,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Calendar,
  Building2,
  DollarSign,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { User, SfsoRecord, ConstructionObject } from '@/lib/types';

interface Props {
  currentUser: User;
  sfsoList: SfsoRecord[];
  objects: ConstructionObject[];
  onSaveSfso: (sfso: SfsoRecord, auditAction: string, auditDetails: string) => Promise<void>;
}

export default function SfsoView({
  currentUser,
  sfsoList,
  objects,
  onSaveSfso,
}: Props) {
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New Sfso Form
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractNumber, setContractNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [totalSum, setTotalSum] = useState(0);
  const [paidSum, setPaidSum] = useState(0);
  const [objectId, setObjectId] = useState('');
  const [description, setDescription] = useState('');

  const visibleList = sfsoList.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.contractNumber.toLowerCase().includes(q) ||
        s.supplierName.toLowerCase().includes(q) ||
        (s.objectName && s.objectName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !supplierName.trim()) return;

    const targetObj = objects.find((o) => o.id === objectId);
    const newRecord: SfsoRecord = {
      id: 'sfso_' + Date.now(),
      invoiceNumber,
      invoiceDate,
      contractNumber,
      supplierName,
      totalSum,
      paidSum,
      remainingSum: totalSum - paidSum,
      objectId: targetObj?.id,
      objectName: targetObj?.name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveSfso(
      newRecord,
      'sfso.add',
      `Янги Счёт-фактура (СФСО) қўшилди: № ${invoiceNumber} (${supplierName}, ${totalSum.toLocaleString()} сўм)`
    );

    setIsAddOpen(false);
    setInvoiceNumber('');
    setSupplierName('');
    setTotalSum(0);
    setPaidSum(0);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        let count = 0;
        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          if (!r || !r[0]) continue;
          const rec: SfsoRecord = {
            id: 'sfso_' + Date.now() + '_' + i,
            invoiceNumber: String(r[0] || '').trim(),
            invoiceDate: String(r[1] || new Date().toISOString().split('T')[0]),
            contractNumber: String(r[2] || '').trim(),
            supplierName: String(r[3] || '').trim(),
            totalSum: parseFloat(r[4]) || 0,
            paidSum: parseFloat(r[5]) || 0,
            remainingSum: (parseFloat(r[4]) || 0) - (parseFloat(r[5]) || 0),
            objectName: String(r[6] || ''),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await onSaveSfso(rec, 'sfso.excel_import', `Excel дан СФСО киритилди: № ${rec.invoiceNumber}`);
          count++;
        }
        alert(`Excel дан ${count} та счёт-фактура муваффақиятли юкланди!`);
      } catch (err) {
        alert('Excel ни ўқишда хатолик бўлди');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelExport = () => {
    const data = sfsoList.map((s, idx) => ({
      '№': idx + 1,
      'Счёт-фактура №': s.invoiceNumber,
      'Сана': s.invoiceDate,
      'Шартнома №': s.contractNumber,
      'Таъминотчи (Контрагент)': s.supplierName,
      'Жами сумма (сўм)': s.totalSum,
      'Тўланган (сўм)': s.paidSum,
      'Қарздорлик (сўм)': s.remainingSum,
      'Объект': s.objectName || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'СФСО Реестри');
    XLSX.writeFile(wb, `SFSO_Reestri_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalAll = sfsoList.reduce((a, b) => a + (b.totalSum || 0), 0);
  const paidAll = sfsoList.reduce((a, b) => a + (b.paidSum || 0), 0);
  const debtAll = sfsoList.reduce((a, b) => a + (b.remainingSum || 0), 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="h-7 w-7 text-emerald-600" />
            <span>СФСО (Счёт-фактуралар ва Шартномалар Реестри)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Таъминот бўлими (Снабжение СО) ва бухгалтерия ўртасидаги ҳисоб-фактуралар ҳисоби
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Excel га юклаш</span>
          </button>

          {['admin', 'snab_so', 'buh_so'].includes(currentUser.rol) && (
            <>
              <label className="flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100/60 cursor-pointer transition">
                <Upload className="h-4 w-4" />
                <span>Excel Импорт</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelImport}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Янги Счёт-фактура</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500">Жами счёт-фактуралар</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{totalAll.toLocaleString()} <span className="text-xs text-slate-500">сўм</span></div>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-emerald-600">Тўланган сумма</span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">{paidAll.toLocaleString()} <span className="text-xs text-slate-500">сўм</span></div>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-rose-600">Тўланмаган (Қарздорлик)</span>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{debtAll.toLocaleString()} <span className="text-xs text-slate-500">сўм</span></div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Счёт-фактура №, шартнома № ёки контрагент бўйича қидириш..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">№ Счёт-фактура</th>
                <th className="px-4 py-3.5">Сана</th>
                <th className="px-4 py-3.5">Шартнома №</th>
                <th className="px-4 py-3.5">Таъминотчи (Контрагент)</th>
                <th className="px-4 py-3.5">Объект</th>
                <th className="px-4 py-3.5 text-right">Жами сумма</th>
                <th className="px-4 py-3.5 text-right">Тўланган</th>
                <th className="px-4 py-3.5 text-right">Қарз қолдиғи</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleList.map((s) => (
                <tr key={s.id} className="hover:bg-emerald-50/40 transition">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{s.invoiceNumber}</td>
                  <td className="px-4 py-3.5 text-slate-600">{s.invoiceDate}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{s.contractNumber}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">{s.supplierName}</td>
                  <td className="px-4 py-3.5 text-slate-600">{s.objectName || '—'}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900">{s.totalSum.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">{s.paidSum.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-rose-600">{s.remainingSum.toLocaleString()}</td>
                </tr>
              ))}

              {visibleList.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileCheck className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="font-medium">Ҳеч қандай счёт-фактура топилмади</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD SFSO MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              <span>Янги Счёт-фактура (СФСО) киритиш</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Счёт-фактура № *</label>
                  <input
                    type="text"
                    required
                    placeholder="СФ-00109"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Сана *</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Шартнома №</label>
                  <input
                    type="text"
                    placeholder="Д-08/26"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Таъминотчи *</label>
                  <input
                    type="text"
                    required
                    placeholder="«Bekobod Metal» МЧЖ"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Жами сумма (сўм) *</label>
                  <input
                    type="number"
                    required
                    value={totalSum || ''}
                    onChange={(e) => setTotalSum(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Тўланган сумма (сўм)</label>
                  <input
                    type="number"
                    value={paidSum || ''}
                    onChange={(e) => setPaidSum(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none text-emerald-700 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Манзил Объект</label>
                <select
                  value={objectId}
                  onChange={(e) => setObjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none"
                >
                  <option value="">-- Объект танланмаган --</option>
                  {objects.map((obj) => (
                    <option key={obj.id} value={obj.id}>{obj.name}</option>
                  ))}
                </select>
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
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
                >
                  Сақлаш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
