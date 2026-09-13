/**
 * HishabOS local database (Dexie / IndexedDB).
 * Local-first: all business data lives in the browser. Versioned schema + migrations.
 * Every business table carries `businessId` → multi-workspace ready (v1 ships single active workspace).
 */
import Dexie, { type Table } from 'dexie';

export type ID = string;
export type Lang = 'en' | 'bn';
export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'returned' | 'cancelled' | 'failed';
export type Channel = 'facebook' | 'instagram' | 'tiktok' | 'website' | 'marketplace' | 'whatsapp' | 'store' | 'direct';
export type PayMethod = 'cod' | 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank' | 'card' | 'other';
export type MoveType = 'opening' | 'purchase' | 'sale' | 'sale_reversal' | 'return_in' | 'damage' | 'loss' | 'adjustment';
export type ReturnCondition = 'resellable' | 'damaged' | 'defective' | 'missing' | 'partial';
export type TxnDir = 'in' | 'out';
export type TxnType = 'sale' | 'sale_reversal' | 'cogs' | 'cogs_reversal' | 'customer_payment' | 'refund' | 'purchase' | 'expense' | 'supplier_payment' | 'courier_fee' | 'return_fee' | 'capital' | 'other_income' | 'adjustment';

export interface Business { id: ID; name: string; owner?: string; phone?: string; email?: string; address?: string; type?: string; channels?: Channel[]; openingCash?: number; logo?: string; createdAt: number; seq?: number; }
export interface Product {
  id: ID; businessId: ID; name: string; sku: string; category?: string; brand?: string; supplierId?: ID;
  image?: string; sellPrice: number; discount?: number; weight?: number; reorderLevel?: number;
  stockQty: number; avgCost: number; status: 'active' | 'archived'; notes?: string; createdAt: number; updatedAt: number;
}
export interface Variant { id: ID; businessId: ID; productId: ID; name: string; sku?: string; sellPrice?: number; stockQty: number; avgCost: number; status: 'active' | 'archived'; }
export interface Purchase { id: ID; businessId: ID; supplierId?: ID; code: string; date: string; subtotal: number; extraCost: number; total: number; paid: number; status: 'paid' | 'partial' | 'unpaid'; notes?: string; createdAt: number; }
export interface PurchaseItem { id: ID; businessId: ID; purchaseId: ID; productId: ID; variantId?: ID; qty: number; unitCost: number; batchId?: ID; }
export interface Batch { id: ID; businessId: ID; productId: ID; variantId?: ID; purchaseId?: ID; date: string; qty: number; remaining: number; unitCost: number; supplierId?: ID; }
export interface Customer {
  id: ID; businessId: ID; name: string; phone: string; altPhone?: string; address?: string; district?: string; area?: string;
  notes?: string; status: 'active' | 'archived'; createdAt: number;
}
export interface Supplier { id: ID; businessId: ID; name: string; phone?: string; address?: string; notes?: string; status: 'active' | 'archived'; createdAt: number; }
export interface OrderItem { id: ID; businessId: ID; orderId: ID; productId: ID; variantId?: ID; productName: string; qty: number; unitPrice: number; unitCost: number; discount: number; }
export interface Order {
  id: ID; businessId: ID; code: string; customerId: ID; status: OrderStatus; channel: Channel;
  courierId?: ID; trackingId?: string; date: string; deliveredAt?: string;
  subtotal: number; discount: number; deliveryCharge: number; total: number; paid: number;
  payMethod: PayMethod; advance: number; courierFee: number; codFee: number;
  notes?: string; createdAt: number; updatedAt: number;
}
export interface Payment { id: ID; businessId: ID; orderId?: ID; customerId?: ID; date: string; amount: number; method: PayMethod; direction: TxnDir; kind: 'order' | 'refund' | 'advance' | 'other'; notes?: string; createdAt: number; }
export interface Expense { id: ID; businessId: ID; date: string; category: string; amount: number; paid: number; notes?: string; refType?: string; refId?: ID; createdAt: number; }
export interface Campaign { id: ID; businessId: ID; platform: 'meta' | 'facebook' | 'instagram' | 'google' | 'tiktok' | 'other'; name: string; product?: string; startDate: string; endDate?: string; spend: number; orders?: number; revenue?: number; notes?: string; createdAt: number; }
export interface Courier { id: ID; businessId: ID; name: string; kind: 'pathao' | 'steadfast' | 'redx' | 'careebee' | 'sundarban' | 'own' | 'custom'; baseFee?: number; codFee?: number; returnFee?: number; status: 'active' | 'archived'; }
export interface Settlement { id: ID; businessId: ID; courierId: ID; date: string; expected: number; received: number; fees: number; notes?: string; createdAt: number; }
export interface ReturnRec { id: ID; businessId: ID; orderId: ID; customerId: ID; date: string; condition: ReturnCondition; restocked: boolean; restockQty: number; refund: number; returnFee: number; outboundLost: number; notes?: string; createdAt: number; }
export interface DamageRec { id: ID; businessId: ID; productId: ID; variantId?: ID; date: string; qty: number; unitCost: number; reason: string; notes?: string; createdAt: number; }
export interface Move { id: ID; businessId: ID; productId: ID; variantId?: ID; date: string; type: MoveType; qty: number; balance: number; refType?: string; refId?: ID; notes?: string; createdAt: number; }
export interface Txn {
  id: ID; businessId: ID; date: string; ts: number; type: TxnType; direction: TxnDir; amount: number;
  category: string; refType?: string; refId?: ID; orderId?: ID; customerId?: ID; supplierId?: ID; productId?: ID; courierId?: ID;
  notes?: string; voidOf?: ID; voided?: boolean;
}
export interface Alert { id: ID; businessId: ID; kind: string; title: string; body: string; read: boolean; createdAt: number; }
export interface Audit { id: ID; businessId: ID; ts: number; action: string; entity: string; entityId?: string; detail?: string; }
export interface Setting { key: string; value: string; }

export const DEFAULT_COURIERS = [
  { name: 'Steadfast', kind: 'steadfast' }, { name: 'Pathao', kind: 'pathao' }, { name: 'RedX', kind: 'redx' },
  { name: 'CareeBee', kind: 'careebee' }, { name: 'Sundarban', kind: 'sundarban' }, { name: 'Own Delivery', kind: 'own' },
] as const;

export const EXPENSE_CATEGORIES = ['advertising','packaging','label','courier','delivery','rent','salary','utilities','internet','phone','transport','import','customs','warehouse','equipment','software','marketing','refund','damage','fee','misc'] as const;

export class HishabDB extends Dexie {
  businesses!: Table<Business, ID>;
  products!: Table<Product, ID>;
  variants!: Table<Variant, ID>;
  purchases!: Table<Purchase, ID>;
  purchaseItems!: Table<PurchaseItem, ID>;
  batches!: Table<Batch, ID>;
  customers!: Table<Customer, ID>;
  suppliers!: Table<Supplier, ID>;
  orders!: Table<Order, ID>;
  orderItems!: Table<OrderItem, ID>;
  payments!: Table<Payment, ID>;
  expenses!: Table<Expense, ID>;
  campaigns!: Table<Campaign, ID>;
  couriers!: Table<Courier, ID>;
  settlements!: Table<Settlement, ID>;
  returns!: Table<ReturnRec, ID>;
  damages!: Table<DamageRec, ID>;
  moves!: Table<Move, ID>;
  txns!: Table<Txn, ID>;
  alerts!: Table<Alert, ID>;
  audit!: Table<Audit, ID>;
  settings!: Table<Setting, string>;

  constructor() {
    super('hishabos');
    this.version(1).stores({
      businesses: 'id, name, createdAt',
      products: 'id, businessId, sku, name, category, status, supplierId, [businessId+status], [businessId+name], [businessId+sku]',
      variants: 'id, businessId, productId, [businessId+productId]',
      purchases: 'id, businessId, supplierId, date, [businessId+date]',
      purchaseItems: 'id, businessId, purchaseId, productId, [businessId+purchaseId]',
      batches: 'id, businessId, productId, purchaseId, [businessId+productId]',
      customers: 'id, businessId, phone, name, status, [businessId+phone], [businessId+name]',
      suppliers: 'id, businessId, name, status',
      orders: 'id, businessId, code, customerId, status, channel, courierId, date, [businessId+status], [businessId+date], [businessId+customerId], [businessId+courierId]',
      orderItems: 'id, businessId, orderId, productId, [businessId+orderId]',
      payments: 'id, businessId, orderId, customerId, date, [businessId+date], [businessId+orderId]',
      expenses: 'id, businessId, date, category, [businessId+date], [businessId+category]',
      campaigns: 'id, businessId, platform, startDate, [businessId+platform]',
      couriers: 'id, businessId, status',
      settlements: 'id, businessId, courierId, date, [businessId+courierId]',
      returns: 'id, businessId, orderId, date, [businessId+date]',
      damages: 'id, businessId, productId, date, [businessId+date]',
      moves: 'id, businessId, productId, date, type, [businessId+productId], [businessId+date]',
      txns: 'id, businessId, date, type, direction, category, refId, orderId, customerId, [businessId+date], [businessId+type], [businessId+category]',
      alerts: 'id, businessId, read, createdAt, [businessId+read]',
      audit: 'id, businessId, ts, entity, [businessId+ts]',
      settings: 'key',
    });
    // v2: index expense.refId for campaign-linked expense updates (auto-migrates, no data loss)
    this.version(2).stores({
      expenses: 'id, businessId, date, category, refId, [businessId+date], [businessId+category]',
    });
  }
}

export const db = new HishabDB();

// ---- tiny settings helpers (localStorage-free: settings table + in-memory cache) ----
const cache = new Map<string, string>();
export async function getSetting(key: string, fallback = ''): Promise<string> {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const s = await db.settings.get(key);
    const v = s?.value ?? fallback;
    cache.set(key, v);
    return v;
  } catch { return localStorage.getItem(`hishab.${key}`) ?? fallback; }
}
export async function setSetting(key: string, value: string): Promise<void> {
  cache.set(key, value);
  try { await db.settings.put({ key, value }); } catch { /* ignore */ }
  try { localStorage.setItem(`hishab.${key}`, value); } catch { /* ignore */ }
}
export function getSettingSync(key: string, fallback = ''): string {
  return cache.get(key) ?? (() => { try { return localStorage.getItem(`hishab.${key}`) ?? fallback; } catch { return fallback; } })();
}
export function setSettingSync(key: string, value: string): void {
  cache.set(key, value);
  try { localStorage.setItem(`hishab.${key}`, value); } catch { /* ignore */ }
  void db.settings.put({ key, value }).catch(() => undefined);
}
