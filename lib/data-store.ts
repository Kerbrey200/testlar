import fs from 'fs';
import path from 'path';
import { hashPasswordSync } from './auth-crypto';
import {
  User,
  ConstructionObject,
  MaterialItem,
  MechanismCatalogueItem,
  Zayavka,
  Hisobot,
  UmmZayavka,
  PmuZayavka,
  PmuNakladnoy,
  StockItem,
  Nakladnoy,
  SynonymMapping,
  AccountInvoice,
  ActivityAudit,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORES_DIR = path.join(DATA_DIR, 'stores');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORES_DIR)) fs.mkdirSync(STORES_DIR, { recursive: true });
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error('Directory creation error:', err);
  }
}

const cache: Record<string, unknown> = {};

function getStorePath(entity: string): string {
  return path.join(STORES_DIR, `${entity}.json`);
}

export function readStore<T>(entity: string, defaultData: T): T {
  ensureDirectories();
  const filePath = getStorePath(entity);

  if (cache[entity]) {
    return cache[entity] as T;
  }

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      cache[entity] = parsed;
      return parsed as T;
    }
  } catch (err) {
    console.error(`Error reading store ${entity}:`, err);
  }

  writeStore(entity, defaultData);
  cache[entity] = defaultData;
  return defaultData;
}

export function writeStore<T>(entity: string, data: T): void {
  ensureDirectories();
  cache[entity] = data;
  const filePath = getStorePath(entity);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing store ${entity}:`, err);
  }
}

export function getNextDocNumber(
  entity: string,
  yearOrPeriod?: string | number
): { docNumber: string; counter: number } {
  ensureDirectories();
  const normalizedEntity = entity === 'nakladnoylar' ? 'nakladnoy' : entity;
  const currentYear = new Date().getFullYear();
  const periodKey = yearOrPeriod ? String(yearOrPeriod) : String(currentYear);
  const counterKey = `${normalizedEntity}_${periodKey}`;

  const counters = readStore<Record<string, number>>('counters', {
    zayavki_2026: 3,
    'hisobotlar_2026-08': 1,
    nakladnoy_2026: 145,
    ummZayavki_2026: 12,
    pmuZayavki_2026: 5,
    pmuNakladnoy_2026: 81,
  });

  // If counter doesn't exist yet for this period, initialize based on existing store
  if (typeof counters[counterKey] !== 'number') {
    let maxFound = 0;
    try {
      const existingItems = readStore<Array<{ docNumber?: string }>>(normalizedEntity, []);
      for (const item of existingItems) {
        if (!item.docNumber) continue;
        const matches = item.docNumber.match(/\d+$/);
        if (matches && matches[0]) {
          const num = parseInt(matches[0], 10);
          if (!isNaN(num) && num > maxFound) {
            maxFound = num;
          }
        }
      }
    } catch {
      maxFound = 0;
    }
    counters[counterKey] = maxFound;
  }

  // Atomically increment counter
  counters[counterKey] += 1;
  const nextVal = counters[counterKey];
  writeStore('counters', counters);

  let docNumber = '';
  switch (normalizedEntity) {
    case 'zayavki':
      docNumber = `ЗАЯ-${periodKey}-${String(nextVal).padStart(3, '0')}`;
      break;
    case 'hisobotlar':
      docNumber = `ОТЧ-${periodKey}/${nextVal}`;
      break;
    case 'nakladnoy':
      docNumber = `ТТН-${periodKey}-${String(nextVal).padStart(3, '0')}`;
      break;
    case 'ummZayavki':
      docNumber = `УММ-${periodKey}-${String(nextVal).padStart(3, '0')}`;
      break;
    case 'pmuZayavki':
      docNumber = `ПМУ-${periodKey}-${String(nextVal).padStart(3, '0')}`;
      break;
    case 'pmuNakladnoy':
      docNumber = `ПМУ-НАКЛ-${String(nextVal).padStart(3, '0')}`;
      break;
    default:
      docNumber = `DOC-${periodKey}-${String(nextVal).padStart(4, '0')}`;
      break;
  }

  return { docNumber, counter: nextVal };
}

export function recordActivity(audit: Omit<ActivityAudit, 'id' | 'timestamp'>): ActivityAudit {
  const activities = readStore<ActivityAudit[]>('activity', []);
  const newEntry: ActivityAudit = {
    ...audit,
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
  };
  activities.unshift(newEntry);
  if (activities.length > 1000) {
    activities.length = 1000;
  }
  writeStore('activity', activities);
  return newEntry;
}

export const ARRAY_ENTITY_STORES = [
  'users',
  'objects',
  'materials',
  'mechanisms',
  'zayavki',
  'hisobotlar',
  'ummZayavki',
  'pmuZayavki',
  'pmuNakladnoy',
  'nakladnoy',
  'stocks',
  'synonyms',
  'invoices',
  'activity',
] as const;

export const OBJECT_ENTITY_STORES = [
  'counters',
] as const;

export const ALL_BACKUP_STORES = [
  ...ARRAY_ENTITY_STORES,
  ...OBJECT_ENTITY_STORES,
] as const;

export function performAutoBackup(): { success: boolean; filename: string; removedOldCount: number } {
  ensureDirectories();
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const filename = `auto-${dateStr}.json`;
  const backupFilePath = path.join(BACKUPS_DIR, filename);

  const fullData: Record<string, unknown> = {
    backupTimestamp: now.toISOString(),
    backupType: 'auto',
  };

  for (const entity of ARRAY_ENTITY_STORES) {
    fullData[entity] = readStore(entity, []);
  }

  for (const objEntity of OBJECT_ENTITY_STORES) {
    fullData[objEntity] = readStore(objEntity, {});
  }

  try {
    fs.writeFileSync(backupFilePath, JSON.stringify(fullData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Backup write failed:', err);
    return { success: false, filename: '', removedOldCount: 0 };
  }

  let removedCount = 0;
  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('auto-') && file.endsWith('.json')) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < tenDaysAgo) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      }
    }
  } catch (cleanErr) {
    console.error('Backup cleanup error:', cleanErr);
  }

  return { success: true, filename, removedOldCount: removedCount };
}

export function seedInitialDataIfNeeded() {
  ensureDirectories();
  const defaultPass = '12345678';
  
  const defaultUsers: User[] = [
    { id: 'u_admin', login: 'admin', parolHash: hashPasswordSync('admin', defaultPass), fullName: 'Система Админ', rol: 'admin', org: 'СО', phone: '+998 90 100-00-01', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_prorab1', login: 'prorab1', parolHash: hashPasswordSync('prorab1', defaultPass), fullName: 'Каримов Одил (Прораб РМУ)', rol: 'prorab', org: 'РМУ', obj: 'obj_1', phone: '+998 91 234-56-78', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_prorab2', login: 'prorab2', parolHash: hashPasswordSync('prorab2', defaultPass), fullName: 'Алиев Рустам (Прораб СМУ)', rol: 'prorab', org: 'СМУ', obj: 'obj_2', phone: '+998 93 345-67-89', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_glinj_rmu', login: 'glinj_rmu', parolHash: hashPasswordSync('glinj_rmu', defaultPass), fullName: 'Махмудов Сардор (Гл.инж РМУ)', rol: 'glinj_upr', org: 'РМУ', phone: '+998 90 987-65-43', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_nach_rmu', login: 'nach_rmu', parolHash: hashPasswordSync('nach_rmu', defaultPass), fullName: 'Назаров Ботир (Нач. РМУ)', rol: 'nach_upr', org: 'РМУ', phone: '+998 90 555-44-33', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_pto_rmu', login: 'pto_rmu', parolHash: hashPasswordSync('pto_rmu', defaultPass), fullName: 'Исмоилова Дилдора (ПТО РМУ)', rol: 'pto_upr', org: 'РМУ', phone: '+998 97 111-22-33', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_buh_rmu', login: 'buh_rmu', parolHash: hashPasswordSync('buh_rmu', defaultPass), fullName: 'Умарова Нигора (Бухгалтер РМУ)', rol: 'buh_upr', org: 'РМУ', phone: '+998 90 777-88-99', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_pto_so', login: 'pto_so', parolHash: hashPasswordSync('pto_so', defaultPass), fullName: 'Рахимов Жасур (ПТО СО)', rol: 'pto_so', org: 'СО', phone: '+998 99 888-77-66', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_glinj_so', login: 'glinj_so', parolHash: hashPasswordSync('glinj_so', defaultPass), fullName: 'Юсупов Темур (Гл.инженер СО)', rol: 'glinj_so', org: 'СО', phone: '+998 90 123-45-67', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_snab_so', login: 'snab_so', parolHash: hashPasswordSync('snab_so', defaultPass), fullName: 'Саидов Бахтиёр (Снабжение СО)', rol: 'snab_so', org: 'СО', phone: '+998 91 999-00-11', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_snab1', login: 'snab1', parolHash: hashPasswordSync('snab1', defaultPass), fullName: 'Тураев Мурод (Снабженец-экспедитор)', rol: 'snab', org: 'СО', phone: '+998 93 100-20-30', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_buh_so', login: 'buh_so', parolHash: hashPasswordSync('buh_so', defaultPass), fullName: 'Холикова Малика (Главбух СО)', rol: 'buh_so', org: 'СО', phone: '+998 90 222-33-44', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_glsklad', login: 'glsklad', parolHash: hashPasswordSync('glsklad', defaultPass), fullName: 'Шарипов Шокир (Завскладом ЦС)', rol: 'glsklad', org: 'СО', phone: '+998 98 333-44-55', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_sklad', login: 'sklad', parolHash: hashPasswordSync('sklad', defaultPass), fullName: 'Файзиев Анвар (Кладовщик)', rol: 'sklad', org: 'СО', phone: '+998 99 444-55-66', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_ruk', login: 'ruk', parolHash: hashPasswordSync('ruk', defaultPass), fullName: 'Ахмедов Шавкат (Генеральный директор)', rol: 'ruk', org: 'СО', phone: '+998 90 999-99-99', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_disp_pmu', login: 'dispatcher', parolHash: hashPasswordSync('dispatcher', defaultPass), fullName: 'Косимов Бобур (Диспетчер ПМУ)', rol: 'dispatcher', org: 'ПМУ', phone: '+998 94 555-66-77', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_konstr', login: 'konstruktor', parolHash: hashPasswordSync('konstruktor', defaultPass), fullName: 'Зокиров Илхом (Конструктор ПМУ)', rol: 'konstruktor', org: 'ПМУ', phone: '+998 97 666-77-88', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u_disp_umm', login: 'dispatcher_umm', parolHash: hashPasswordSync('dispatcher_umm', defaultPass), fullName: 'Мирзаев Эркин (Диспетчер УММ)', rol: 'dispatcher_umm', org: 'УММ', phone: '+998 93 777-88-99', createdAt: '2026-01-01T00:00:00.000Z' },
  ];

  const currentUsers = readStore<User[]>('users', []);
  if (!fs.existsSync(getStorePath('users')) || !Array.isArray(currentUsers) || currentUsers.length === 0) {
    writeStore('users', defaultUsers);
  }

  const defaultObjects: ConstructionObject[] = [
    { id: 'obj_1', name: 'ЖК "Навруз" (Блок А-1)', org: 'РМУ', address: 'г. Ташкент, Юнусабадский р-н', prorabId: 'u_prorab1', status: 'active', createdAt: '2026-01-10T00:00:00.000Z' },
    { id: 'obj_2', name: 'Бизнес-центр "Ташкент Плаза"', org: 'СМУ', address: 'г. Ташкент, ул. Мустакиллик 45', prorabId: 'u_prorab2', status: 'active', createdAt: '2026-01-15T00:00:00.000Z' },
    { id: 'obj_3', name: 'Школа №45 на 1200 мест', org: 'РМУ', address: 'г. Самарканд, ул. Гагарина 88', prorabId: 'u_prorab1', status: 'active', createdAt: '2026-02-01T00:00:00.000Z' },
    { id: 'obj_4', name: 'Производственный цех ПМУ №2', org: 'ПМУ', address: 'г. Ташкент, Сергелийский промзона', status: 'active', createdAt: '2026-02-10T00:00:00.000Z' },
    { id: 'obj_5', name: 'Автобаза и мехпарк УММ', org: 'УММ', address: 'г. Ташкент, Бектемирский р-н', status: 'active', createdAt: '2026-02-15T00:00:00.000Z' },
  ];
  const currentObjects = readStore<ConstructionObject[]>('objects', []);
  if (!fs.existsSync(getStorePath('objects')) || !Array.isArray(currentObjects) || currentObjects.length === 0) {
    writeStore('objects', defaultObjects);
  }

  const defaultMaterials: MaterialItem[] = [
    { id: 'mat_1', name: 'Арматура А500С d=12мм', unit: 'тн', category: 'Металл', code: '01.01.12' },
    { id: 'mat_2', name: 'Арматура А500С d=16мм', unit: 'тн', category: 'Металл', code: '01.01.16' },
    { id: 'mat_3', name: 'Арматура А500С d=20мм', unit: 'тн', category: 'Металл', code: '01.01.20' },
    { id: 'mat_4', name: 'Бетон товарный М-350 (B25)', unit: 'м3', category: 'Бетон', code: '02.01.35' },
    { id: 'mat_5', name: 'Цемент ПЦ 400-Д20', unit: 'тн', category: 'Вяжущие', code: '02.02.40' },
    { id: 'mat_6', name: 'Кирпич жженый одинарный 1НФ', unit: 'тыс.шт', category: 'Стеновые', code: '03.01.01' },
    { id: 'mat_7', name: 'Песок мытый строительный', unit: 'м3', category: 'Инертные', code: '04.01.02' },
    { id: 'mat_8', name: 'Щебень фракция 5-20', unit: 'м3', category: 'Инертные', code: '04.02.05' },
    { id: 'mat_9', name: 'Гипсокартон ГКЛ 12.5мм Кнауф', unit: 'м2', category: 'Отделка', code: '05.01.12' },
    { id: 'mat_10', name: 'Профиль потолочный CD 60/27', unit: 'м.п', category: 'Отделка', code: '05.02.60' },
    { id: 'mat_11', name: 'Труба стальная 89х3.5', unit: 'м.п', category: 'Трубы', code: '06.01.89' },
    { id: 'mat_12', name: 'Кабель ВВГнг-LS 3x2.5', unit: 'м', category: 'Электрика', code: '07.01.25' },
  ];
  const currentMaterials = readStore<MaterialItem[]>('materials', []);
  if (!fs.existsSync(getStorePath('materials')) || !Array.isArray(currentMaterials) || currentMaterials.length === 0) {
    writeStore('materials', defaultMaterials);
  }

  const defaultMechanisms: MechanismCatalogueItem[] = [
    { id: 'mech_1', name: 'Башенный кран КБ-408', category: 'Краны', model: 'КБ-408.21', plateNumber: '01 542 UAA', status: 'available' },
    { id: 'mech_2', name: 'Автокран 25т XCMG QY25K5', category: 'Краны', model: 'QY25K5-I', plateNumber: '01 771 TAA', status: 'available' },
    { id: 'mech_3', name: 'Экскаватор гусеничный Hyundai R220', category: 'Землеройные', model: 'R220LC-9S', plateNumber: '01 312 VAA', status: 'available' },
    { id: 'mech_4', name: 'Самосвал Howo 25т Sinotruk', category: 'Транспорт', model: 'ZZ3257N3847', plateNumber: '01 890 BAA', status: 'available' },
    { id: 'mech_5', name: 'Бетононасос Putzmeister', category: 'Бетонные', model: 'BSA 1409 D', plateNumber: '01 109 AAA', status: 'available' },
    { id: 'mech_6', name: 'Бульдозер Shantui SD16', category: 'Землеройные', model: 'SD16', plateNumber: '01 445 CAA', status: 'available' },
  ];
  const currentMechs = readStore<MechanismCatalogueItem[]>('mechanisms', []);
  if (!fs.existsSync(getStorePath('mechanisms')) || !Array.isArray(currentMechs) || currentMechs.length === 0) {
    writeStore('mechanisms', defaultMechanisms);
  }

  const defaultStocks: StockItem[] = [
    { id: 'stk_1', ownerType: 'admin', ownerId: 'central', ownerName: 'Центральный склад (СО)', materialId: 'mat_1', materialName: 'Арматура А500С d=12мм', unit: 'тн', qty: 48.5, updatedAt: '2026-08-20T10:00:00.000Z' },
    { id: 'stk_2', ownerType: 'admin', ownerId: 'central', ownerName: 'Центральный склад (СО)', materialId: 'mat_2', materialName: 'Арматура А500С d=16мм', unit: 'тн', qty: 32.0, updatedAt: '2026-08-20T10:00:00.000Z' },
    { id: 'stk_3', ownerType: 'admin', ownerId: 'central', ownerName: 'Центральный склад (СО)', materialId: 'mat_5', materialName: 'Цемент ПЦ 400-Д20', unit: 'тн', qty: 120.0, updatedAt: '2026-08-20T10:00:00.000Z' },
    { id: 'stk_4', ownerType: 'prorab', ownerId: 'u_prorab1', ownerName: 'Каримов Одил (ЖК Навруз)', materialId: 'mat_1', materialName: 'Арматура А500С d=12мм', unit: 'тн', qty: 14.2, updatedAt: '2026-08-22T14:30:00.000Z' },
    { id: 'stk_5', ownerType: 'prorab', ownerId: 'u_prorab1', ownerName: 'Каримов Одил (ЖК Навруз)', materialId: 'mat_6', materialName: 'Кирпич жженый одинарный 1НФ', unit: 'тыс.шт', qty: 65.0, updatedAt: '2026-08-22T14:30:00.000Z' },
    { id: 'stk_6', ownerType: 'expeditor', ownerId: 'u_snab1', ownerName: 'Тураев Мурод (Экспедитор)', materialId: 'mat_12', materialName: 'Кабель ВВГнг-LS 3x2.5', unit: 'м', qty: 850.0, updatedAt: '2026-08-23T09:15:00.000Z' },
  ];
  const currentStocks = readStore<StockItem[]>('stocks', []);
  if (!fs.existsSync(getStorePath('stocks')) || !Array.isArray(currentStocks) || currentStocks.length === 0) {
    writeStore('stocks', defaultStocks);
  }

  const defaultZayavki: Zayavka[] = [
    {
      id: 'zay_1',
      docNumber: 'ЗАЯ-2026-001',
      org: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      prorabId: 'u_prorab1',
      prorabName: 'Каримов Одил',
      status: 'glinj_upr',
      positions: [
        { id: 'pos_1', materialId: 'mat_1', materialName: 'Арматура А500С d=12мм', unit: 'тн', qty: 15.0, note: 'Для фундаментной плиты' },
        { id: 'pos_2', materialId: 'mat_4', materialName: 'Бетон товарный М-350 (B25)', unit: 'м3', qty: 120.0, note: 'Заливка 25 августа' },
      ],
      createdAt: '2026-08-24T08:30:00.000Z',
      updatedAt: '2026-08-24T08:30:00.000Z',
    },
    {
      id: 'zay_2',
      docNumber: 'ЗАЯ-2026-002',
      org: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      prorabId: 'u_prorab1',
      prorabName: 'Каримов Одил',
      status: 'pto_so',
      positions: [
        { id: 'pos_3', materialId: 'mat_6', materialName: 'Кирпич жженый одинарный 1НФ', unit: 'тыс.шт', qty: 80.0, approvedQty: 80.0, ptoApproved: true, note: 'Кладка 2-го этажа' },
        { id: 'pos_4', materialId: 'mat_5', materialName: 'Цемент ПЦ 400-Д20', unit: 'тн', qty: 25.0, approvedQty: 20.0, ptoApproved: true, ptoComment: 'Скорректировано по нормам ПТО', note: 'Кладочный раствор' },
      ],
      glinjUprSignedBy: 'Махмудов Сардор (Гл.инж РМУ)',
      glinjUprSignedAt: '2026-08-24T11:00:00.000Z',
      createdAt: '2026-08-23T14:00:00.000Z',
      updatedAt: '2026-08-24T11:00:00.000Z',
    },
    {
      id: 'zay_3',
      docNumber: 'ЗАЯ-2026-003',
      org: 'СМУ',
      objectId: 'obj_2',
      objectName: 'Бизнес-центр "Ташкент Плаза"',
      prorabId: 'u_prorab2',
      prorabName: 'Алиев Рустам',
      status: 'snab_so',
      positions: [
        { id: 'pos_5', materialId: 'mat_9', materialName: 'Гипсокартон ГКЛ 12.5мм Кнауф', unit: 'м2', qty: 450.0, approvedQty: 450.0, ptoApproved: true, note: 'Перегородки 3-й этаж' },
        { id: 'pos_6', materialId: 'mat_10', materialName: 'Профиль потолочный CD 60/27', unit: 'м.п', qty: 900.0, approvedQty: 900.0, ptoApproved: true, note: 'Монтаж каркаса' },
      ],
      glinjUprSignedBy: 'Алиев Рустам (Нач. СМУ)',
      glinjUprSignedAt: '2026-08-22T09:00:00.000Z',
      ptoSoSignedBy: 'Рахимов Жасур (ПТО СО)',
      ptoSoSignedAt: '2026-08-22T14:20:00.000Z',
      glinjSoSignedBy: 'Юсупов Темур (Гл.инженер СО)',
      glinjSoSignedAt: '2026-08-23T10:15:00.000Z',
      contractNumber: 'Д-78/26-КНАУФ',
      contractDate: '2026-08-24',
      invoiceNumber: 'СФ-004419',
      snabSoSignedBy: 'Саидов Бахтиёр (Снабжение СО)',
      snabSoSignedAt: '2026-08-24T16:00:00.000Z',
      createdAt: '2026-08-21T10:00:00.000Z',
      updatedAt: '2026-08-24T16:00:00.000Z',
    },
  ];
  const currentZayavki = readStore<Zayavka[]>('zayavki', []);
  if (!fs.existsSync(getStorePath('zayavki')) || !Array.isArray(currentZayavki) || currentZayavki.length === 0) {
    writeStore('zayavki', defaultZayavki);
  }

  const defaultHisobotlar: Hisobot[] = [
    {
      id: 'his_1',
      docNumber: 'ОТЧ-2026-08/1',
      org: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      prorabId: 'u_prorab1',
      prorabName: 'Каримов Одил',
      periodMonth: '2026-08',
      status: 'pto',
      rows: [
        { id: 'row_1', materialId: 'mat_1', materialName: 'Арматура А500С d=12мм', unit: 'тн', normQty: 18.0, factQty: 17.5, spisanieQty: 17.5, differenceQty: 0.0, price: 9200000, note: 'Плита перекрытия 1 этажа' },
        { id: 'row_2', materialId: 'mat_4', materialName: 'Бетон товарный М-350 (B25)', unit: 'м3', normQty: 150.0, factQty: 148.0, spisanieQty: 148.0, differenceQty: 0.0, price: 780000, note: 'Колонны и ригели' },
        { id: 'row_3', materialId: 'mat_6', materialName: 'Кирпич жженый одинарный 1НФ', unit: 'тыс.шт', normQty: 40.0, factQty: 39.2, spisanieQty: 40.0, differenceQty: 0.8, price: 1100000, note: 'Внутренние перегородки' },
      ],
      prorabSignedAt: '2026-08-24T17:00:00.000Z',
      createdAt: '2026-08-24T17:00:00.000Z',
      updatedAt: '2026-08-24T17:00:00.000Z',
    },
  ];
  const currentHis = readStore<Hisobot[]>('hisobotlar', []);
  if (!fs.existsSync(getStorePath('hisobotlar')) || !Array.isArray(currentHis) || currentHis.length === 0) {
    writeStore('hisobotlar', defaultHisobotlar);
  }

  const defaultUmmZayavki: UmmZayavka[] = [
    {
      id: 'umm_1',
      docNumber: 'УММ-2026-012',
      org: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      prorabId: 'u_prorab1',
      prorabName: 'Каримов Одил',
      mechanismType: 'Автокран 25т',
      dateRequired: '2026-08-26',
      purpose: 'Монтаж металлических ферм и разгрузка арматуры',
      status: 'glinj_so',
      uprSignedBy: 'Махмудов Сардор (Гл.инж РМУ)',
      uprSignedAt: '2026-08-24T15:00:00.000Z',
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T15:00:00.000Z',
    },
  ];
  const currentUmm = readStore<UmmZayavka[]>('ummZayavki', []);
  if (!fs.existsSync(getStorePath('ummZayavki')) || !Array.isArray(currentUmm) || currentUmm.length === 0) {
    writeStore('ummZayavki', defaultUmmZayavki);
  }

  const defaultPmuZayavki: PmuZayavka[] = [
    {
      id: 'pmu_1',
      docNumber: 'ПМУ-2026-005',
      org: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      prorabId: 'u_prorab1',
      prorabName: 'Каримов Одил',
      constructionName: 'Ферма стропильная металлическая ФС-18',
      qty: 12,
      unit: 'шт',
      note: 'По чертежам КМД лист 14',
      status: 'glinj_so',
      uprSignedBy: 'Махмудов Сардор (Гл.инж РМУ)',
      uprSignedAt: '2026-08-23T16:00:00.000Z',
      ptoSoSignedBy: 'Рахимов Жасур (ПТО СО)',
      ptoSoSignedAt: '2026-08-24T10:30:00.000Z',
      createdAt: '2026-08-23T11:00:00.000Z',
      updatedAt: '2026-08-24T10:30:00.000Z',
    },
  ];
  const currentPmuZay = readStore<PmuZayavka[]>('pmuZayavki', []);
  if (!fs.existsSync(getStorePath('pmuZayavki')) || !Array.isArray(currentPmuZay) || currentPmuZay.length === 0) {
    writeStore('pmuZayavki', defaultPmuZayavki);
  }

  const defaultPmuNakladnoy: PmuNakladnoy[] = [
    {
      id: 'pmunak_1',
      docNumber: 'ПМУ-НАКЛ-081',
      pmuZayavkaId: 'pmu_1',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      prorabId: 'u_prorab1',
      prorabName: 'Каримов Одил',
      konstruktorId: 'u_konstr',
      konstruktorName: 'Зокиров Илхом (Конструктор ПМУ)',
      items: [
        { id: 'pitem_1', itemName: 'Ферма стропильная ФС-18', unit: 'шт', qty: 6, weightKg: 4200 },
        { id: 'pitem_2', itemName: 'Связи вертикальные СВ-1', unit: 'компл', qty: 4, weightKg: 850 },
      ],
      status: 'sent',
      sentAt: '2026-08-24T14:00:00.000Z',
    },
  ];
  const currentPmuNak = readStore<PmuNakladnoy[]>('pmuNakladnoy', []);
  if (!fs.existsSync(getStorePath('pmuNakladnoy')) || !Array.isArray(currentPmuNak) || currentPmuNak.length === 0) {
    writeStore('pmuNakladnoy', defaultPmuNakladnoy);
  }

  const defaultNakladnoy: Nakladnoy[] = [
    {
      id: 'nak_1',
      docNumber: 'ТТН-2026-0145',
      senderType: 'admin',
      senderId: 'central',
      senderName: 'Центральный склад (СО)',
      senderOrg: 'СО',
      recipientType: 'prorab',
      recipientId: 'u_prorab1',
      recipientName: 'Каримов Одил (ЖК Навруз)',
      recipientOrg: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      items: [
        { id: 'nitem_1', materialId: 'mat_1', materialName: 'Арматура А500С d=12мм', unit: 'тн', qty: 5.0 },
        { id: 'nitem_2', materialId: 'mat_5', materialName: 'Цемент ПЦ 400-Д20', unit: 'тн', qty: 10.0 },
      ],
      status: 'sent',
      sentAt: '2026-08-24T16:00:00.000Z',
    },
  ];
  const currentNak = readStore<Nakladnoy[]>('nakladnoy', []);
  if (!fs.existsSync(getStorePath('nakladnoy')) || !Array.isArray(currentNak) || currentNak.length === 0) {
    writeStore('nakladnoy', defaultNakladnoy);
  }

  const defaultSynonyms: SynonymMapping[] = [
    { id: 'syn_1', vendorName: 'Арматурный прокат 12 мм А500С ст3', standardMaterialId: 'mat_1', standardMaterialName: 'Арматура А500С d=12мм', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'syn_2', vendorName: 'Бетонная смесь тяжелая В25 П4 F150 W6', standardMaterialId: 'mat_4', standardMaterialName: 'Бетон товарный М-350 (B25)', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'syn_3', vendorName: 'Портландцемент М400 в мешках по 50кг', standardMaterialId: 'mat_5', standardMaterialName: 'Цемент ПЦ 400-Д20', createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  const currentSyn = readStore<SynonymMapping[]>('synonyms', []);
  if (!fs.existsSync(getStorePath('synonyms')) || !Array.isArray(currentSyn) || currentSyn.length === 0) {
    writeStore('synonyms', defaultSynonyms);
  }

  const defaultInvoices: AccountInvoice[] = [
    {
      id: 'acc_1',
      docNumber: 'ЭСФ-884102',
      invoiceDate: '2026-08-15',
      supplier: 'ООО "METALL INVEST ASIA"',
      org: 'РМУ',
      objectId: 'obj_1',
      objectName: 'ЖК "Навруз" (Блок А-1)',
      items: [
        {
          rawName: 'Арматурный прокат 12 мм А500С ст3',
          mappedMaterialName: 'Арматура А500С d=12мм',
          unit: 'тн',
          qty: 20.0,
          price: 9100000,
          totalSum: 182000000,
        },
      ],
      totalSum: 182000000,
      importedBy: 'Умарова Нигора (Бухгалтер РМУ)',
      importedAt: '2026-08-16T11:00:00.000Z',
    },
  ];
  const currentInvoices = readStore<AccountInvoice[]>('invoices', []);
  if (!fs.existsSync(getStorePath('invoices')) || !Array.isArray(currentInvoices) || currentInvoices.length === 0) {
    writeStore('invoices', defaultInvoices);
  }

  const defaultActivity: ActivityAudit[] = [
    {
      id: 'act_init_1',
      action: 'system.init',
      userId: 'u_admin',
      userLogin: 'admin',
      userName: 'Система Админ',
      userRole: 'admin',
      userOrg: 'СО',
      details: 'Инициализация базы данных СтройМенеджер и структуры boshqarmalar',
      timestamp: '2026-08-24T06:00:00.000Z',
    },
  ];
  const currentActivity = readStore<ActivityAudit[]>('activity', []);
  if (!fs.existsSync(getStorePath('activity')) || !Array.isArray(currentActivity) || currentActivity.length === 0) {
    writeStore('activity', defaultActivity);
  }
}
