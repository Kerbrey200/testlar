export type OrgType = 'РМУ' | 'СМУ' | 'СУ' | 'ПМУ' | 'УММ' | 'СО';

export type UserRole =
  | 'admin'
  | 'prorab'
  | 'glinj_upr'
  | 'nach_upr'
  | 'nach_pmu'
  | 'pto_upr'
  | 'buh_upr'
  | 'snab'
  | 'snab_so'
  | 'pto_so'
  | 'glinj_so'
  | 'buh_so'
  | 'glsklad'
  | 'sklad'
  | 'ruk'
  | 'dispatcher'
  | 'konstruktor'
  | 'dispatcher_umm';

export interface User {
  id: string;
  login: string;
  username?: string;
  parolHash?: string;
  passwordHash?: string;
  fullName: string;
  rol: UserRole;
  org: OrgType;
  obj?: string; // default object if prorab
  phone?: string;
  isFirstLogin?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ConstructionObject {
  id: string;
  name: string;
  org: OrgType;
  address: string;
  prorabId?: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt?: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  code?: string;
}

export type ZayavkaStatus =
  | 'new'
  | 'glinj_upr'
  | 'pto_so'
  | 'glinj_so'
  | 'snab_so'
  | 'rejected';

export interface ZayavkaPosition {
  id: string;
  materialId?: string;
  materialName: string;
  unit: string;
  qty: number;
  approvedQty?: number;
  ptoApproved?: boolean;
  ptoComment?: string;
  note?: string;
}

export interface Zayavka {
  id: string;
  docNumber: string;
  org: OrgType;
  objectId: string;
  objectName: string;
  prorabId: string;
  prorabName: string;
  status: ZayavkaStatus;
  positions: ZayavkaPosition[];
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  // Approvals tracking
  glinjUprSignedBy?: string;
  glinjUprSignedAt?: string;
  ptoSoSignedBy?: string;
  ptoSoSignedAt?: string;
  glinjSoSignedBy?: string;
  glinjSoSignedAt?: string;
  // Snab SO completion
  contractNumber?: string;
  contractDate?: string;
  invoiceFile?: string;
  invoiceFileName?: string;
  invoiceNumber?: string;
  snabSoSignedBy?: string;
  snabSoSignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type HisobotStatus = 'new' | 'pto' | 'buh' | 'glinj' | 'listed';

export interface HisobotRow {
  id: string;
  materialId?: string;
  materialName: string;
  unit: string;
  normQty: number; // planned norm
  factQty: number; // 1-ustun "Фактически" (PTO tekshiradi)
  spisanieQty: number; // 2-ustun "Списание" (Buxgalter kiritadi)
  differenceQty: number; // 3-ustun "Экономия/Перерасход" (= spisanie - fact)
  price?: number;
  note?: string;
}

export interface Hisobot {
  id: string;
  docNumber: string;
  org: OrgType;
  objectId: string;
  objectName: string;
  prorabId: string;
  prorabName: string;
  periodMonth: string; // e.g. "2026-08"
  status: HisobotStatus;
  rows: HisobotRow[];
  // Signatures
  prorabSignedAt: string;
  ptoSignedBy?: string;
  ptoSignedAt?: string;
  buhSignedBy?: string;
  buhSignedAt?: string;
  glinjSignedBy?: string;
  glinjSignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UmmStatus = 'new' | 'glinj_so' | 'umm' | 'accepted' | 'rejected';

export interface UmmZayavka {
  id: string;
  docNumber: string;
  org: OrgType;
  objectId: string;
  objectName: string;
  prorabId: string;
  prorabName: string;
  onBehalfOf?: string;
  mechanismType: string;
  dateRequired: string;
  purpose: string;
  status: UmmStatus;
  // Steps
  uprSignedBy?: string;
  uprSignedAt?: string;
  // Glinj SO
  glinjSoSignedBy?: string;
  glinjSoSignedAt?: string;
  assignedMechanismUnit?: string;
  assignedHours?: number;
  // Dispatcher UMM
  dispatcherSignedBy?: string;
  dispatcherSignedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PmuStatus = 'new' | 'upr' | 'pto_so' | 'glinj_so' | 'pmu' | 'done' | 'rejected';

export interface PmuZayavka {
  id: string;
  docNumber: string;
  org: OrgType;
  objectId: string;
  objectName: string;
  prorabId: string;
  prorabName: string;
  itemName?: string;
  constructionName?: string;
  dimensions?: string;
  quantity?: number;
  qty?: number;
  unit: string;
  drawingNumber?: string;
  drawingFile?: string; // base64 or file reference <=2MB
  drawingFileName?: string;
  deadline?: string;
  note?: string;
  status: PmuStatus;
  // Steps
  uprSignedBy?: string;
  uprSignedAt?: string;
  ptoSoSignedBy?: string;
  ptoSoSignedAt?: string;
  glinjSoSignedBy?: string;
  glinjSoSignedAt?: string;
  dispatcherSignedBy?: string;
  dispatcherSignedAt?: string;
  pmuSignedBy?: string;
  pmuSignedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PmuNakladnoy {
  id: string;
  docNumber: string;
  pmuZayavkaId?: string;
  objectId: string;
  objectName: string;
  prorabId: string;
  prorabName: string;
  konstruktorId: string;
  konstruktorName: string;
  items: Array<{
    id: string;
    itemName: string;
    unit: string;
    qty: number;
    weightKg?: number;
  }>;
  status: 'sent' | 'received';
  sentAt: string;
  receivedAt?: string;
}

export type WarehouseOwnerType = 'admin' | 'prorab' | 'expeditor';

export interface StockItem {
  id: string;
  ownerType: WarehouseOwnerType;
  ownerId: string; // 'central' for admin, user id for prorab/expeditor
  ownerName: string;
  ownerOrg?: OrgType;
  materialId?: string;
  materialName: string;
  unit: string;
  quantity?: number;
  qty?: number;
  price?: number;
  objectId?: string;
  objectName?: string;
  updatedAt: string;
}

export type NakladnoyStatus = 'new' | 'sent' | 'received' | 'approved' | 'rejected';

export interface NakladnoyItem {
  id: string;
  materialId?: string;
  materialName: string;
  unit: string;
  qty: number;
  price?: number;
  sum?: number;
}

export interface Nakladnoy {
  id: string;
  docNumber: string;
  senderType?: WarehouseOwnerType;
  senderId: string;
  senderName: string;
  senderOrg?: OrgType;
  receiverId?: string;
  receiverName?: string;
  receiverOrg?: OrgType;
  recipientType?: WarehouseOwnerType;
  recipientId?: string;
  recipientName?: string;
  recipientOrg?: OrgType;
  driverName?: string;
  vehicleNumber?: string;
  objectId: string;
  objectName: string;
  items: NakladnoyItem[];
  status: NakladnoyStatus;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string;
  receivedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SfsoRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  contractNumber: string;
  supplierName: string;
  totalSum: number;
  paidSum: number;
  remainingSum: number;
  objectId?: string;
  objectName?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAccount {
  id: string;
  org: OrgType;
  bankName: string;
  accountNumber: string;
  currency: string;
  balance: number;
  mfo?: string;
  updatedAt: string;
}

export interface SynonymMapping {
  id: string;
  vendorName: string; // Nom in supplier invoice
  standardMaterialId: string;
  standardMaterialName: string;
  createdAt: string;
}

export interface AccountInvoiceItem {
  rawName: string;
  mappedMaterialName: string;
  unit: string;
  qty: number;
  price: number;
  totalSum: number;
}

export interface AccountInvoice {
  id: string;
  docNumber: string;
  invoiceDate: string;
  supplier: string;
  org: OrgType;
  objectId?: string;
  objectName?: string;
  items: AccountInvoiceItem[];
  totalSum: number;
  importedBy: string;
  importedAt: string;
}

export interface ActivityAudit {
  id: string;
  action: string; // e.g. 'zayavka.create', 'zayavka.approve', 'invoice.approve', 'auth.login', etc.
  userId: string;
  userLogin: string;
  userName: string;
  userRole: UserRole;
  userOrg: OrgType;
  details: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

export interface MechanismCatalogueItem {
  id: string;
  name: string;
  category: string;
  model: string;
  plateNumber: string;
  status: 'available' | 'in_use' | 'maintenance';
}
