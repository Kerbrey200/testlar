'use client';

import React, { useState } from 'react';
import { CreditCard, Plus, Search, Building2, Wallet } from 'lucide-react';
import { User, CompanyAccount } from '@/lib/types';

interface Props {
  currentUser: User;
  accounts: CompanyAccount[];
  onSaveAccount: (acc: CompanyAccount, auditAction: string, auditDetails: string) => Promise<void>;
}

export default function AccountsView({
  currentUser,
  accounts,
  onSaveAccount,
}: Props) {
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('UZS');
  const [balance, setBalance] = useState(0);
  const [mfo, setMfo] = useState('');

  const visibleList = accounts.filter((a) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.bankName.toLowerCase().includes(q) ||
        a.accountNumber.toLowerCase().includes(q) ||
        (a.mfo && a.mfo.includes(q))
      );
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) return;

    const newAcc: CompanyAccount = {
      id: 'acc_' + Date.now(),
      org: currentUser.org,
      bankName,
      accountNumber,
      currency,
      balance,
      mfo,
      updatedAt: new Date().toISOString(),
    };

    await onSaveAccount(
      newAcc,
      'account.add',
      `Янги банк ҳисоб рақами қўшилди: ${bankName} (${accountNumber})`
    );

    setIsAddOpen(false);
    setBankName('');
    setAccountNumber('');
    setBalance(0);
    setMfo('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-indigo-600" />
            <span>Банк Ҳисоб Рақамлари (Accounts)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Корхона ва бошқармаларнинг банк ҳисоб рақамлари ва тўлов қолдиқлари
          </p>
        </div>

        {['admin', 'buh_so', 'ruk'].includes(currentUser.rol) && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Янги Ҳисоб Рақам қўшиш</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleList.map((acc) => (
          <div
            key={acc.id}
            className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between h-48 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                {acc.org} • {acc.bankName}
              </span>
              <Wallet className="h-5 w-5 text-indigo-400" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block mb-1">
                Ҳисоб рақами:
              </span>
              <div className="font-mono text-sm tracking-wider font-semibold text-slate-100">
                {acc.accountNumber.replace(/(\d{4})/g, '$1 ').trim()}
              </div>
              {acc.mfo && <div className="text-[10px] text-slate-400 mt-1">МФО: {acc.mfo}</div>}
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-400">Қолдиқ:</span>
              <span className="text-lg font-extrabold text-emerald-400">
                {acc.balance.toLocaleString()} <span className="text-xs font-normal text-slate-300">{acc.currency}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              <span>Янги Банк Ҳисоб Рақами киритиш</span>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Банк номи *</label>
                <input
                  type="text"
                  required
                  placeholder="АТБ «Ўзсаноатқурилишбанк»"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">20 хоналик Ҳисоб рақам *</label>
                <input
                  type="text"
                  required
                  placeholder="20208000900123456001"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">МФО</label>
                  <input
                    type="text"
                    placeholder="00440"
                    value={mfo}
                    onChange={(e) => setMfo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Валюта</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none"
                  >
                    <option value="UZS">UZS (Сўм)</option>
                    <option value="USD">USD (Доллар)</option>
                    <option value="EUR">EUR (Евро)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Бошланғич қолдиқ</label>
                <input
                  type="number"
                  value={balance || ''}
                  onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-bold"
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
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
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
