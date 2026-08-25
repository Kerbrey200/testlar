'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  FileText,
  TrendingUp,
  Truck,
  Layers,
  Package,
  FileCheck,
  CreditCard,
  ShieldCheck,
  LogOut,
  KeyRound,
  Wifi,
  WifiOff,
  RefreshCw,
  Menu,
  X,
  UserCheck,
  Building2,
  HardHat,
} from 'lucide-react';
import {
  User,
  Zayavka,
  Hisobot,
  UmmZayavka,
  PmuZayavka,
  Nakladnoy,
  StockItem,
  ConstructionObject,
  MaterialItem,
  MechanismCatalogueItem,
  SfsoRecord,
  CompanyAccount,
  ActivityAudit,
} from '@/lib/types';
import { syncController } from '@/lib/client-api';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import DashboardView from '@/components/views/DashboardView';
import ZayavkiView from '@/components/views/ZayavkiView';
import HisobotlarView from '@/components/views/HisobotlarView';
import UmmView from '@/components/views/UmmView';
import PmuView from '@/components/views/PmuView';
import NakladnoyView from '@/components/views/NakladnoyView';
import StocksView from '@/components/views/StocksView';
import SfsoView from '@/components/views/SfsoView';
import AccountsView from '@/components/views/AccountsView';
import AdminView from '@/components/views/AdminView';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const savedUser = localStorage.getItem('sm_current_user');
      const savedTime = localStorage.getItem('sm_session_time');
      if (savedUser && savedTime) {
        const timeElapsed = Date.now() - parseInt(savedTime, 10);
        if (timeElapsed < 8 * 60 * 60 * 1000) {
          return JSON.parse(savedUser);
        } else {
          localStorage.removeItem('sm_current_user');
          localStorage.removeItem('sm_session_time');
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App active view
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);

  // Connectivity & Sync state
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Core Data Stores
  const [users, setUsers] = useState<User[]>([]);
  const [zayavki, setZayavki] = useState<Zayavka[]>([]);
  const [hisobotlar, setHisobotlar] = useState<Hisobot[]>([]);
  const [ummZayavki, setUmmZayavki] = useState<UmmZayavka[]>([]);
  const [pmuZayavki, setPmuZayavki] = useState<PmuZayavka[]>([]);
  const [nakladnoylar, setNakladnoylar] = useState<Nakladnoy[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [objects, setObjects] = useState<ConstructionObject[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [mechanisms, setMechanisms] = useState<MechanismCatalogueItem[]>([]);
  const [sfsoList, setSfsoList] = useState<SfsoRecord[]>([]);
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [activities, setActivities] = useState<ActivityAudit[]>([]);

  // 1. Load all stores using syncController
  const loadAllData = useCallback(async () => {
    try {
      const [
        uList,
        zList,
        hList,
        uZayList,
        pZayList,
        nList,
        sList,
        oList,
        mList,
        mechList,
        sfList,
        accList,
        actList,
      ] = await Promise.all([
        syncController.getAll<User>('users'),
        syncController.getAll<Zayavka>('zayavki'),
        syncController.getAll<Hisobot>('hisobotlar'),
        syncController.getAll<UmmZayavka>('ummZayavki'),
        syncController.getAll<PmuZayavka>('pmuZayavki'),
        syncController.getAll<Nakladnoy>('nakladnoylar'),
        syncController.getAll<StockItem>('stocks'),
        syncController.getAll<ConstructionObject>('objects'),
        syncController.getAll<MaterialItem>('materials'),
        syncController.getAll<MechanismCatalogueItem>('mechanisms'),
        syncController.getAll<SfsoRecord>('sfso'),
        syncController.getAll<CompanyAccount>('accounts'),
        syncController.getAll<ActivityAudit>('activities'),
      ]);

      setUsers(uList);
      setZayavki(zList);
      setHisobotlar(hList);
      setUmmZayavki(uZayList);
      setPmuZayavki(pZayList);
      setNakladnoylar(nList);
      setStocks(sList);
      setObjects(oList);
      setMaterials(mList);
      setMechanisms(mechList);
      setSfsoList(sfList);
      setAccounts(accList);
      setActivities(actList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
      console.error('Error loading data stores:', err);
    }
  }, []);

  // 2. Sync Trigger
  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncController.processSyncQueue();
      await loadAllData();
      const count = await syncController.getPendingCount();
      setPendingSyncCount(count);
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [loadAllData]);

  // 3. Online/Offline & Sync Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let isMounted = true;
    const updatePending = async () => {
      const count = await syncController.getPendingCount();
      if (isMounted) setPendingSyncCount(count);
    };
    updatePending();
    const interval = setInterval(updatePending, 5000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync]);

  useEffect(() => {
    if (currentUser) {
      let isMounted = true;
      (async () => {
        if (isMounted) {
          await loadAllData();
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [currentUser, loadAllData]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Логин ёки парол нотўғри');
        return;
      }
      setCurrentUser(data.user);
      localStorage.setItem('sm_current_user', JSON.stringify(data.user));
      localStorage.setItem('sm_session_time', Date.now().toString());

      // If first login, trigger change password modal immediately
      if (data.user.isFirstLogin) {
        setIsChangePassOpen(true);
      }
    } catch (err) {
      setLoginError('Серверга уланишда хатолик. Илтимос, қайта уриниб кўринг.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Quick Demo Login Preset selector
  const handleQuickLogin = (uname: string, pword: string = '123456') => {
    setLoginUsername(uname);
    setLoginPassword(pword);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sm_current_user');
    localStorage.removeItem('sm_session_time');
    setActiveView('dashboard');
  };

  // Generic Audit logger & saver
  const logAndSave = async (
    entity: any,
    item: any,
    auditAction: string,
    auditDetails: string
  ) => {
    await syncController.saveItem(entity, item);
    if (currentUser) {
      const act: ActivityAudit = {
        id: 'act_' + Date.now(),
        userId: currentUser.id,
        userLogin: currentUser.username || currentUser.login,
        userName: currentUser.fullName,
        userRole: currentUser.rol,
        userOrg: currentUser.org,
        action: auditAction,
        details: auditDetails,
        timestamp: new Date().toISOString(),
      };
      await syncController.saveItem('activities', act);
    }
    await loadAllData();
  };

  // Specific Save Handlers
  const handleSaveZayavka = async (zay: Zayavka, auditAction: string, auditDetails: string) => {
    await logAndSave('zayavki', zay, auditAction, auditDetails);
  };

  const handleDeleteZayavka = async (id: string, details: string) => {
    await syncController.deleteItem('zayavki', id);
    if (currentUser) {
      const act: ActivityAudit = {
        id: 'act_' + Date.now(),
        userId: currentUser.id,
        userLogin: currentUser.username || currentUser.login,
        userName: currentUser.fullName,
        userRole: currentUser.rol,
        userOrg: currentUser.org,
        action: 'zayavka.delete',
        details,
        timestamp: new Date().toISOString(),
      };
      await syncController.saveItem('activities', act);
    }
    await loadAllData();
  };

  const handleSaveHisobot = async (h: Hisobot, auditAction: string, auditDetails: string) => {
    await logAndSave('hisobotlar', h, auditAction, auditDetails);
  };

  const handleDeleteHisobot = async (id: string, details: string) => {
    await syncController.deleteItem('hisobotlar', id);
    await loadAllData();
  };

  const handleSaveUmm = async (u: UmmZayavka, auditAction: string, auditDetails: string) => {
    await logAndSave('ummZayavki', u, auditAction, auditDetails);
  };

  const handleDeleteUmm = async (id: string, details: string) => {
    await syncController.deleteItem('ummZayavki', id);
    await loadAllData();
  };

  const handleSavePmu = async (p: PmuZayavka, auditAction: string, auditDetails: string) => {
    await logAndSave('pmuZayavki', p, auditAction, auditDetails);
  };

  const handleDeletePmu = async (id: string, details: string) => {
    await syncController.deleteItem('pmuZayavki', id);
    await loadAllData();
  };

  const handleSaveNakladnoy = async (n: Nakladnoy, auditAction: string, auditDetails: string) => {
    await logAndSave('nakladnoylar', n, auditAction, auditDetails);
  };

  const handleTransferStock = async (
    senderId: string,
    receiverId: string,
    receiverName: string,
    receiverOrg: any,
    objectId: string,
    objectName: string,
    items: any[]
  ) => {
    // 1. Decrease from central warehouse
    for (const it of items) {
      const centralItem = stocks.find(
        (s) => s.ownerType === 'admin' && s.materialName.toLowerCase() === it.materialName.toLowerCase()
      );
      if (centralItem) {
        const currentQty = centralItem.quantity ?? centralItem.qty ?? 0;
        centralItem.quantity = Math.max(0, currentQty - it.qty);
        centralItem.qty = centralItem.quantity;
        centralItem.updatedAt = new Date().toISOString();
        await syncController.saveItem('stocks', centralItem);
      }

      // 2. Increase or create for prorab's object warehouse
      const prorabItem = stocks.find(
        (s) =>
          s.ownerId === receiverId &&
          s.objectId === objectId &&
          s.materialName.toLowerCase() === it.materialName.toLowerCase()
      );

      if (prorabItem) {
        const currentQty = prorabItem.quantity ?? prorabItem.qty ?? 0;
        prorabItem.quantity = currentQty + it.qty;
        prorabItem.qty = prorabItem.quantity;
        prorabItem.updatedAt = new Date().toISOString();
        await syncController.saveItem('stocks', prorabItem);
      } else {
        const newStock: StockItem = {
          id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          materialName: it.materialName,
          unit: it.unit,
          quantity: it.qty,
          qty: it.qty,
          price: it.price || 0,
          ownerType: 'prorab',
          ownerId: receiverId,
          ownerName: receiverName,
          ownerOrg: receiverOrg,
          objectId,
          objectName,
          updatedAt: new Date().toISOString(),
        };
        await syncController.saveItem('stocks', newStock);
      }
    }
    await loadAllData();
  };

  const handleSaveStock = async (stk: StockItem, auditAction: string, auditDetails: string) => {
    await logAndSave('stocks', stk, auditAction, auditDetails);
  };

  const handleSaveSfso = async (sf: SfsoRecord, auditAction: string, auditDetails: string) => {
    await logAndSave('sfso', sf, auditAction, auditDetails);
  };

  const handleSaveAccount = async (acc: CompanyAccount, auditAction: string, auditDetails: string) => {
    await logAndSave('accounts', acc, auditAction, auditDetails);
  };

  const handleSaveUser = async (u: User, auditAction: string, auditDetails: string) => {
    await logAndSave('users', u, auditAction, auditDetails);
  };

  const handleDeleteUser = async (uId: string, details: string) => {
    await syncController.deleteItem('users', uId);
    await loadAllData();
  };

  const handleSaveObject = async (obj: ConstructionObject, auditAction: string, auditDetails: string) => {
    await logAndSave('objects', obj, auditAction, auditDetails);
  };

  const handleDeleteObject = async (oId: string, details: string) => {
    await syncController.deleteItem('objects', oId);
    await loadAllData();
  };

  // Nav menu items with role permission control
  const navItems = [
    { id: 'dashboard', label: 'Бош Саҳифа', icon: LayoutDashboard, roles: ['all'] },
    {
      id: 'zayavki',
      label: 'Материал Заявкалари',
      icon: FileText,
      badge: zayavki.filter((z) => ['new', 'glinj_upr', 'pto_so', 'glinj_so'].includes(z.status)).length,
      roles: ['prorab', 'glinj_upr', 'nach_upr', 'pto_so', 'glinj_so', 'snab_so', 'ruk', 'snab', 'admin'],
    },
    {
      id: 'hisobotlar',
      label: 'Техник Ҳисобот (М-29)',
      icon: TrendingUp,
      badge: hisobotlar.filter((h) => h.status !== 'listed').length,
      roles: ['prorab', 'pto_upr', 'buh_upr', 'glinj_upr', 'nach_upr', 'ruk', 'admin'],
    },
    {
      id: 'umm',
      label: 'УММ (Техника) Заявка',
      icon: Truck,
      badge: ummZayavki.filter((u) => u.status !== 'accepted' && u.status !== 'rejected').length,
      roles: ['prorab', 'glinj_upr', 'nach_upr', 'glinj_so', 'dispatcher_umm', 'ruk', 'admin'],
    },
    {
      id: 'pmu',
      label: 'ПМУ (Конструкциялар)',
      icon: Layers,
      badge: pmuZayavki.filter((p) => p.status !== 'done' && p.status !== 'rejected').length,
      roles: ['prorab', 'glinj_upr', 'nach_upr', 'glinj_so', 'nach_pmu', 'ruk', 'admin'],
    },
    {
      id: 'nakladnoy',
      label: 'Юк Хатлари (ТТН)',
      icon: Package,
      roles: ['prorab', 'admin', 'ruk', 'snab_so'],
    },
    {
      id: 'stocks',
      label: 'Омбор Қолдиқлари',
      icon: Package,
      roles: ['prorab', 'glinj_upr', 'nach_upr', 'pto_so', 'snab_so', 'admin', 'ruk'],
    },
    {
      id: 'sfso',
      label: 'СФСО ва Шартномалар',
      icon: FileCheck,
      roles: ['snab_so', 'buh_so', 'glinj_so', 'admin', 'ruk'],
    },
    {
      id: 'accounts',
      label: 'Банк Ҳисоблари',
      icon: CreditCard,
      roles: ['buh_so', 'ruk', 'admin'],
    },
    {
      id: 'admin',
      label: 'Администратор',
      icon: ShieldCheck,
      roles: ['admin'],
    },
  ];

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold tracking-wider uppercase text-slate-400">
            СтройМенеджер тизими юкланмоқда...
          </p>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-4 py-12 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-600/30 mb-4">
            <HardHat className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            СтройМенеджер
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Қурилиш компанияси бошқарув ва назорат ягона ахборот тизими
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-3xl bg-slate-900/90 p-8 shadow-2xl border border-slate-800 backdrop-blur-xl">
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs font-semibold text-rose-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Фойдаланувчи логини (Username)
                </label>
                <input
                  type="text"
                  required
                  placeholder="admin, prorab_rmu, pto_so..."
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Парол
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 transition"
              >
                {isLoggingIn ? 'Текширилмоқда...' : 'Тизимга кириш'}
              </button>
            </form>

            {/* Quick Login Presets to test all 16 roles immediately */}
            <div className="mt-6 pt-6 border-t border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
                Тезкор синов логинлари (Тест учун):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-blue-400 hover:bg-slate-800 font-mono text-center font-bold"
                >
                  admin (СО)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('prorab1', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  prorab1 (РМУ)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('prorab2', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  prorab2 (СМУ)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('glinj_rmu', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  glinj_rmu (РМУ)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('pto_so', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  pto_so (СО)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('glinj_so', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  glinj_so (СО)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('snab_so', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  snab_so (СО)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('pto_rmu', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  pto_rmu (РМУ)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('buh_so', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  buh_so (СО)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('glsklad', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  glsklad (ЦС)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('dispatcher', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  dispatcher (ПМУ)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('dispatcher_umm', '12345678')}
                  className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-300 hover:bg-slate-800 font-mono text-center"
                >
                  dispatcher_umm (УММ)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APPLICATION LAYOUT
  const allowedNavs = navItems.filter((item) => {
    if (item.roles.includes('all')) return true;
    if (currentUser.rol === 'admin') return true;
    return item.roles.includes(currentUser.rol);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* SIDEBAR (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col justify-between ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-0'
        }`}
      >
        <div>
          {/* Logo & Brand */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md">
                <HardHat className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-white tracking-tight text-base block leading-none">
                  СтройМенеджер
                </span>
                <span className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
                  {currentUser.org}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {allowedNavs.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isActive ? 'bg-white text-blue-700' : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="rounded-xl bg-slate-800/60 p-3 mb-2">
            <div className="text-xs font-bold text-white truncate">{currentUser.fullName}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-300">
                {currentUser.rol}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{currentUser.org}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setIsChangePassOpen(true)}
              className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Паролни ўзгартириш"
            >
              <KeyRound className="h-3 w-3" />
              <span>Парол</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1.5 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 transition"
              title="Тизимдан чиқиш"
            >
              <LogOut className="h-3 w-3" />
              <span>Чиқиш</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-slate-900 text-sm hidden sm:inline-block">
              {currentUser.org} Бошқармаси
            </span>
          </div>

          {/* Top Bar Right: Online/Offline Badge & Sync */}
          <div className="flex items-center gap-3">
            {/* Online/Offline status */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span>{isOnline ? 'Online (Сервер)' : 'Offline (IndexedDB)'}</span>
            </div>

            {/* Sync Status Button */}
            {pendingSyncCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing || !isOnline}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Синхронизация ({pendingSyncCount})</span>
              </button>
            )}

            {/* User Quick Info */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">{currentUser.fullName}</div>
                <div className="text-[10px] text-slate-500 uppercase">{currentUser.rol}</div>
              </div>
            </div>
          </div>
        </header>

        {/* VIEW CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
          {activeView === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              zayavki={zayavki}
              hisobotlar={hisobotlar}
              ummZayavki={ummZayavki}
              pmuZayavki={pmuZayavki}
              stocks={stocks}
              activities={activities}
              onNavigate={(v) => setActiveView(v)}
            />
          )}

          {activeView === 'zayavki' && (
            <ZayavkiView
              currentUser={currentUser}
              zayavki={zayavki}
              objects={objects}
              materials={materials}
              onSaveZayavka={handleSaveZayavka}
              onDeleteZayavka={handleDeleteZayavka}
            />
          )}

          {activeView === 'hisobotlar' && (
            <HisobotlarView
              currentUser={currentUser}
              hisobotlar={hisobotlar}
              objects={objects}
              materials={materials}
              onSaveHisobot={handleSaveHisobot}
              onDeleteHisobot={handleDeleteHisobot}
            />
          )}

          {activeView === 'umm' && (
            <UmmView
              currentUser={currentUser}
              ummZayavki={ummZayavki}
              objects={objects}
              mechanisms={mechanisms}
              onSaveUmmZayavka={handleSaveUmm}
              onDeleteUmmZayavka={handleDeleteUmm}
            />
          )}

          {activeView === 'pmu' && (
            <PmuView
              currentUser={currentUser}
              pmuZayavki={pmuZayavki}
              objects={objects}
              onSavePmuZayavka={handleSavePmu}
              onDeletePmuZayavka={handleDeletePmu}
            />
          )}

          {activeView === 'nakladnoy' && (
            <NakladnoyView
              currentUser={currentUser}
              nakladnoylar={nakladnoylar}
              stocks={stocks}
              objects={objects}
              users={users}
              onSaveNakladnoy={handleSaveNakladnoy}
              onTransferStock={handleTransferStock}
            />
          )}

          {activeView === 'stocks' && (
            <StocksView
              currentUser={currentUser}
              stocks={stocks}
              materials={materials}
              onSaveStock={handleSaveStock}
            />
          )}

          {activeView === 'sfso' && (
            <SfsoView
              currentUser={currentUser}
              sfsoList={sfsoList}
              objects={objects}
              onSaveSfso={handleSaveSfso}
            />
          )}

          {activeView === 'accounts' && (
            <AccountsView
              currentUser={currentUser}
              accounts={accounts}
              onSaveAccount={handleSaveAccount}
            />
          )}

          {activeView === 'admin' && (
            <AdminView
              currentUser={currentUser}
              users={users}
              objects={objects}
              activities={activities}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              onSaveObject={handleSaveObject}
              onDeleteObject={handleDeleteObject}
              onRefreshData={loadAllData}
            />
          )}
        </main>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      <ChangePasswordModal
        isOpen={isChangePassOpen}
        user={currentUser}
        onClose={() => setIsChangePassOpen(false)}
        onSuccess={() => {
          const updated = { ...currentUser, isFirstLogin: false };
          setCurrentUser(updated);
          localStorage.setItem('sm_current_user', JSON.stringify(updated));
        }}
      />
    </div>
  );
}
