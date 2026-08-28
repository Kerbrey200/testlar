'use client';

import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  Building,
  Database,
  Activity,
  Plus,
  Search,
  Lock,
  RefreshCw,
  Download,
  Upload,
  FileUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  User,
  UserRole,
  OrgType,
  ConstructionObject,
  ActivityAudit,
} from '@/lib/types';
import { hashPassword } from '@/lib/auth-crypto';

interface Props {
  currentUser: User;
  users: User[];
  objects: ConstructionObject[];
  activities: ActivityAudit[];
  onSaveUser: (user: User, auditAction: string, auditDetails: string) => Promise<void>;
  onDeleteUser: (userId: string, details: string) => Promise<void>;
  onSaveObject: (obj: ConstructionObject, auditAction: string, auditDetails: string) => Promise<void>;
  onDeleteObject: (objId: string, details: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export default function AdminView({
  currentUser,
  users,
  objects,
  activities,
  onSaveUser,
  onDeleteUser,
  onSaveObject,
  onDeleteObject,
  onRefreshData,
}: Props) {
  const [activeTab, setActiveTab] = useState<'users' | 'objects' | 'backup' | 'audit'>('users');
  const [search, setSearch] = useState('');

  // User creation modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userLogin, setUserLogin] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('prorab');
  const [userOrg, setUserOrg] = useState<OrgType>('РМУ');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Object creation modal
  const [isObjModalOpen, setIsObjModalOpen] = useState(false);
  const [objName, setObjName] = useState('');
  const [objOrg, setObjOrg] = useState<OrgType>('РМУ');
  const [objAddress, setObjAddress] = useState('');

  // Backup list state
  const [backups, setBackups] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load backups when switching to backup tab
  const fetchBackups = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup/list');
      const data = await res.json();
      if (data.backups) {
        setBackups(data.backups);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateManualBackup = async () => {
    try {
      const res = await fetch('/api/backup/auto', { method: 'POST' });
      const data = await res.json();
      if (data.backup) {
        alert(`Нусха яратилди: ${data.backup.filename}`);
        fetchBackups();
      }
    } catch (e) {
      alert('Нусха олишда хатолик бўлди');
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const res = await fetch(`/api/backup/download?filename=${encodeURIComponent(filename)}`, {
        headers: {
          'x-user': encodeURIComponent(JSON.stringify(currentUser)),
        },
      });
      if (!res.ok) {
        throw new Error('Файлни юклаб олишда хатолик');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Файлни юклаб олишда хатолик юз берди');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Фақат .json форматидаги захира файлини юклаш мумкин!');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('JSON формати нотўғри');
        }

        if (
          !confirm(
            `ДИҚҚАТ! "${file.name}" файлидан маълумотлар тикланади.\nБу амал ҳозирги барча маълумотларни алмаштиради.\nДавом этасизми?`
          )
        ) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setBackupLoading(true);
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawData: parsed,
            user: currentUser,
          }),
        });

        const data = await res.json();
        if (data.success) {
          alert(`Файлдан муваффақиятли тикланди! (${data.message || ''})`);
          await onRefreshData();
          await fetchBackups();
        } else {
          alert(`Тиклашда хатолик: ${data.error || 'Номаълум хато'}`);
        }
      } catch (err: any) {
        console.error(err);
        alert(`Файлни ўқишда хатолик: ${err?.message || 'JSON формати нотўғри'}`);
      } finally {
        setBackupLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleRestoreBackup = async (filename: string) => {
    if (
      confirm(
        `ДИҚҚАТ! ${filename} нусхаси тикланади. Ҳозирги маълумотлар шу нусха билан алмаштирилади. Давом этасизми?`
      )
    ) {
      try {
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, user: currentUser }),
        });
        const data = await res.json();
        if (data.success) {
          alert('Маълумотлар муваффақиятли қайта тикланди!');
          await onRefreshData();
          await fetchBackups();
        }
      } catch (e) {
        alert('Тиклашда хатолик бўлди');
      }
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userLogin.trim() || !userFullName.trim()) return;

    if (editingUser) {
      const updated: User = {
        ...editingUser,
        username: userLogin,
        fullName: userFullName,
        rol: userRole,
        org: userOrg,
        updatedAt: new Date().toISOString(),
      };
      if (userPassword.trim()) {
        updated.passwordHash = await hashPassword(userLogin, userPassword);
        updated.parolHash = updated.passwordHash;
        updated.isFirstLogin = false;
      }
      await onSaveUser(updated, 'user.update', `Фойдаланувчи ўзгартирилди: ${userLogin} (${userRole})`);
    } else {
      if (!userPassword.trim()) {
        alert('Паролни киритинг');
        return;
      }
      const pHash = await hashPassword(userLogin.trim(), userPassword);
      const newUser: User = {
        id: 'usr_' + Date.now(),
        login: userLogin.trim(),
        username: userLogin.trim(),
        passwordHash: pHash,
        parolHash: pHash,
        fullName: userFullName,
        rol: userRole,
        org: userOrg,
        isFirstLogin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSaveUser(newUser, 'user.create', `Янги фойдаланувчи яратилди: ${userLogin} (${userRole}, ${userOrg})`);
    }

    setIsUserModalOpen(false);
    setEditingUser(null);
    setUserLogin('');
    setUserPassword('');
    setUserFullName('');
  };

  const handleObjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objName.trim()) return;

    const newObj: ConstructionObject = {
      id: 'obj_' + Date.now(),
      name: objName.trim(),
      org: objOrg,
      address: objAddress.trim(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveObject(newObj, 'object.create', `Янги объект қўшилди: ${objName} (${objOrg})`);
    setIsObjModalOpen(false);
    setObjName('');
    setObjAddress('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-blue-600" />
            <span>Тизим Бошқаруви (Администратор Панели)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Фойдаланувчилар, қурилиш объектлари, захира нусхалари (Backups) ва хавфсизлик аудити
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-white p-1.5 border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Users className="h-4 w-4" />
            <span>Фойдаланувчилар ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('objects')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === 'objects' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Building className="h-4 w-4" />
            <span>Объектлар ({objects.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('backup');
              fetchBackups();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === 'backup' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Database className="h-4 w-4" />
            <span>Auto-Backup</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${activeTab === 'audit' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Activity className="h-4 w-4" />
            <span>Audit Log</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Логин, исм ёки бошқарма бўйича қидириш..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => {
                setEditingUser(null);
                setUserLogin('');
                setUserPassword('');
                setUserFullName('');
                setUserRole('prorab');
                setUserOrg('РМУ');
                setIsUserModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition"
            >
              <Plus className="h-4 w-4" /> Янги Фойдаланувчи
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Логин (Username)</th>
                  <th className="px-4 py-3.5">Ф.И.Ш (Тўлиқ исми)</th>
                  <th className="px-4 py-3.5">Тизимдаги Роли</th>
                  <th className="px-4 py-3.5">Бошқарма (Орг)</th>
                  <th className="px-4 py-3.5">Биринчи кириш</th>
                  <th className="px-4 py-3.5 text-right">Амаллар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users
                  .filter((u) => {
                    const uname = (u.username || u.login || '').toLowerCase();
                    const fname = (u.fullName || '').toLowerCase();
                    const org = (u.org || '').toLowerCase();
                    const s = search.toLowerCase();
                    return uname.includes(s) || fname.includes(s) || org.includes(s);
                  })
                  .map((u) => {
                    const displayLogin = u.username || u.login || '';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-bold font-mono text-slate-900">{displayLogin}</td>
                        <td className="px-4 py-3.5 font-semibold">{u.fullName}</td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-800">
                            {u.rol}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-800">
                            {u.org}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {u.isFirstLogin ? (
                            <span className="text-amber-600 font-medium">Ҳа (Парол ўзгартирилмаган)</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Ўзгартирилган</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setUserLogin(displayLogin);
                                setUserFullName(u.fullName);
                                setUserRole(u.rol);
                                setUserOrg(u.org);
                                setUserPassword('');
                                setIsUserModalOpen(true);
                              }}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              Таҳрирлаш
                            </button>
                            {displayLogin !== 'admin' && (
                              <button
                                onClick={async () => {
                                  if (confirm(`Фойдаланувчи ${displayLogin} ни ўчирмоқчимисиз?`)) {
                                    await onDeleteUser(u.id, `Фойдаланувчи ўчирилди: ${displayLogin}`);
                                  }
                                }}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                              >
                                Ўчириш
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OBJECTS */}
      {activeTab === 'objects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Объект номи ёки манзили бўйича қидириш..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => setIsObjModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition"
            >
              <Plus className="h-4 w-4" /> Янги Объект қўшиш
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {objects
              .filter(
                (o) =>
                  o.name.toLowerCase().includes(search.toLowerCase()) ||
                  (o.address && o.address.toLowerCase().includes(search.toLowerCase()))
              )
              .map((obj) => (
                <div
                  key={obj.id}
                  className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 font-bold text-[11px] text-blue-800">
                        {obj.org}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">Фаол</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{obj.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{obj.address || 'Манзил кўрсатилмаган'}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>{new Date(obj.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={async () => {
                        if (confirm(`Объект "${obj.name}" ни ўчирмоқчимисиз?`)) {
                          await onDeleteObject(obj.id, `Объект ўчирилди: ${obj.name}`);
                        }
                      }}
                      className="text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Ўчириш
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUTO-BACKUP */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                <span>Авто-Захира Нусхалари (10 кунлик ротация)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ҳар куни авто-нусха олинади ва 10 кундан ошган эски нусхалар автоматик тозаланади.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={backupLoading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                title="Компьютердаги JSON захира файлидан тиклаш"
              >
                <Upload className="h-4 w-4 text-slate-600" />
                <span>Файлдан тиклаш (Import)</span>
              </button>

              <button
                onClick={handleCreateManualBackup}
                disabled={backupLoading}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
              >
                <Database className="h-4 w-4" />
                <span>Ҳозир нусха олиш</span>
              </button>

              <button
                onClick={fetchBackups}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                title="Янгилаш"
              >
                <RefreshCw className={`h-4 w-4 ${backupLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Нусха Файли (Filename)</th>
                  <th className="px-4 py-3.5">Ҳажми (KB)</th>
                  <th className="px-4 py-3.5">Яратилган сана ва вақт</th>
                  <th className="px-4 py-3.5 text-right">Амаллар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-bold font-mono text-slate-900">{b.filename}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono">{(b.size / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-3.5 text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleDownloadBackup(b.filename)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                          title="Файлни компютерга юклаб олиш"
                        >
                          <Download className="h-3.5 w-3.5 text-slate-600" />
                          <span>Юклаб олиш</span>
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                        >
                          <span>Тиклаш (Restore)</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {backups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      Ҳозирча захира нусхалари мавжуд эмас
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ходим исми, роли, амал тури ёки тафсилот бўйича қидириш..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Вақт</th>
                  <th className="px-4 py-3.5">Ходим (Ф.И.Ш)</th>
                  <th className="px-4 py-3.5">Роли & Орг</th>
                  <th className="px-4 py-3.5">Амал тури (Action)</th>
                  <th className="px-4 py-3.5">Тафсилотлар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities
                  .filter(
                    (a) =>
                      a.userName.toLowerCase().includes(search.toLowerCase()) ||
                      a.userRole.toLowerCase().includes(search.toLowerCase()) ||
                      a.action.toLowerCase().includes(search.toLowerCase()) ||
                      a.details.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(a.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">{a.userName}</td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800">
                          {a.userRole}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-500 font-semibold">({a.userOrg})</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-indigo-700">{a.action}</td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-md">{a.details}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>{editingUser ? 'Фойдаланувчини таҳрирлаш' : 'Янги Фойдаланувчи қўшиш'}</span>
            </h3>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Логин (Username) *</label>
                <input
                  type="text"
                  required
                  value={userLogin}
                  onChange={(e) => setUserLogin(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Тўлиқ исми (Ф.И.Ш) *</label>
                <input
                  type="text"
                  required
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  {editingUser ? 'Янги парол (агар ўзгартирилса)' : 'Парол *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Тизимдаги роли *</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-mono"
                  >
                    <option value="prorab">prorab</option>
                    <option value="glinj_upr">glinj_upr</option>
                    <option value="nach_upr">nach_upr</option>
                    <option value="pto_upr">pto_upr</option>
                    <option value="buh_upr">buh_upr</option>
                    <option value="pto_so">pto_so</option>
                    <option value="glinj_so">glinj_so</option>
                    <option value="snab_so">snab_so</option>
                    <option value="nach_pmu">nach_pmu</option>
                    <option value="dispatcher_umm">dispatcher_umm</option>
                    <option value="ruk">ruk</option>
                    <option value="snab">snab</option>
                    <option value="buh_so">buh_so</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Бошқарма (Орг) *</label>
                  <select
                    value={userOrg}
                    onChange={(e) => setUserOrg(e.target.value as OrgType)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-bold"
                  >
                    <option value="РМУ">РМУ</option>
                    <option value="СМУ">СМУ</option>
                    <option value="СУ">СУ</option>
                    <option value="ПМУ">ПМУ</option>
                    <option value="УММ">УММ</option>
                    <option value="СО">СО</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Сақлаш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OBJECT MODAL */}
      {isObjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              <span>Янги Қурилиш Объекти қўшиш</span>
            </h3>

            <form onSubmit={handleObjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Объект номи *</label>
                <input
                  type="text"
                  required
                  placeholder="Масалан: Тошкент Сити Лот-4, Кўп қаватли турар-жой..."
                  value={objName}
                  onChange={(e) => setObjName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Бошқарма (Орг) *</label>
                <select
                  value={objOrg}
                  onChange={(e) => setObjOrg(e.target.value as OrgType)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none font-bold"
                >
                  <option value="РМУ">РМУ</option>
                  <option value="СМУ">СМУ</option>
                  <option value="СУ">СУ</option>
                  <option value="ПМУ">ПМУ</option>
                  <option value="УММ">УММ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Манзили</label>
                <input
                  type="text"
                  placeholder="Тошкент ш., Шайхонтоҳур т., Навоий кўчаси..."
                  value={objAddress}
                  onChange={(e) => setObjAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsObjModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Бекор қилиш
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Қўшиш
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
