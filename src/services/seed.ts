/** DEMO DATA — realistic sample business, fully ledger-consistent (built via service layer). */
import { db, DEFAULT_COURIERS, type ID, type Channel } from '../db/db';
import { uid } from '../lib/id';
import { ymd, addDays } from '../lib/dates';
import { toPaisa } from '../lib/money';
import { createOrder, addOrderPayment } from './orders';
import { createPurchase } from './purchases';
import { createExpense, createCampaign } from './expenses';
import { processReturn, recordDamage } from './returns';

// deterministic PRNG
function rng(seed: number) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

const PRODUCTS = [
  { name: 'Premium Chiffon Hijab', sku: 'HB-001', category: 'Fashion', cost: 180, price: 350 },
  { name: 'Silk Hijab — Luxury', sku: 'HB-002', category: 'Fashion', cost: 260, price: 520 },
  { name: 'Cotton 3-Piece (Unstitched)', sku: 'DR-101', category: 'Dresses', cost: 620, price: 1150 },
  { name: 'Georgette 4-Piece Party Dress', sku: 'DR-102', category: 'Dresses', cost: 980, price: 1850 },
  { name: 'Lawn 2-Piece Kurti', sku: 'DR-103', category: 'Dresses', cost: 450, price: 850 },
  { name: 'Matte Lipstick Set (6 pc)', sku: 'CS-201', category: 'Cosmetics', cost: 320, price: 650 },
  { name: 'Vitamin C Face Serum', sku: 'CS-202', category: 'Cosmetics', cost: 280, price: 590 },
  { name: 'Waterproof Eyeliner Duo', sku: 'CS-203', category: 'Cosmetics', cost: 120, price: 280 },
  { name: 'Leather Wallet (Men)', sku: 'AC-301', category: 'Accessories', cost: 240, price: 490 },
  { name: 'Ladies Handbag — Tote', sku: 'AC-302', category: 'Accessories', cost: 520, price: 990 },
  { name: 'Smart Watch X2', sku: 'EL-401', category: 'Electronics', cost: 1150, price: 1950 },
  { name: 'Wireless Earbuds Pro', sku: 'EL-402', category: 'Electronics', cost: 680, price: 1290 },
  { name: 'Baby Winter Set', sku: 'KB-501', category: 'Kids', cost: 380, price: 720 },
  { name: 'Kitchen Storage Combo (12 pc)', sku: 'HM-601', category: 'Home', cost: 540, price: 1050 },
];
const NAMES = ['Fatema Akter','Nusrat Jahan','Tanvir Hasan','Rahim Uddin','Sharmin Sultana','Arif Chowdhury','Mim Akter','Sakib Al Hasan','Priya Das','Rina Begum','Mehedi Hasan','Sumaiya Islam','Karim Sheikh','Lima Akter','Rakib Khan','Tania Rahman','Imran Hossain','Shila Rani','Nabil Ahmed','Dipa Moni','Fahim Reza','Keya Akter','Hasan Mahmud','Ritu Parvin','Sabbir Khan','Mitu Akter','Jahidul Islam','Popy Begum','Al Amin','Shanta Islam'];
const AREAS: [string, string][] = [['Dhaka','Mirpur'],['Dhaka','Uttara'],['Dhaka','Dhanmondi'],['Chattogram','GEC'],['Sylhet','Zindabazar'],['Rajshahi','Shaheb Bazar'],['Khulna','Sonadanga'],['Barishal','Sadar'],['Rangpur','Jahaj Company'],['Mymensingh','Ganginar Par']];
const CHANNELS: Channel[] = ['facebook','facebook','facebook','instagram','tiktok','website','whatsapp','marketplace'];

export async function seedDemo(bid: ID, onProgress?: (p: number) => void): Promise<void> {
  const R = rng(42);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(R() * arr.length)];
  const today = ymd();
  // couriers
  const courierIds: ID[] = [];
  for (const c of DEFAULT_COURIERS) {
    const id = uid('co');
    await db.couriers.add({ id, businessId: bid, name: c.name, kind: c.kind as never, baseFee: toPaisa(60), codFee: toPaisa(10), returnFee: toPaisa(60), status: 'active' });
    courierIds.push(id);
  }
  // supplier
  const supId = uid('su');
  await db.suppliers.add({ id: supId, businessId: bid, name: 'Chawkbazar Wholesale', phone: '01811223344', address: 'Dhaka', status: 'active', createdAt: Date.now() });
  // products + opening purchases
  const prodIds: { id: ID; price: number }[] = [];
  for (const p of PRODUCTS) {
    const id = uid('pr');
    await db.products.add({ id, businessId: bid, name: p.name, sku: p.sku, category: p.category, supplierId: supId, sellPrice: toPaisa(p.price), discount: 0, stockQty: 0, avgCost: 0, reorderLevel: 8, status: 'active', createdAt: Date.now(), updatedAt: Date.now() });
    prodIds.push({ id, price: toPaisa(p.price) });
    const qty = 60 + Math.floor(R() * 120);
    await createPurchase(bid, { supplierId: supId, date: addDays(today, -70), items: [{ productId: id, qty, unitCost: toPaisa(p.cost) }], extraCost: toPaisa(Math.round(qty * p.cost * 0.06)), paid: toPaisa(Math.round(qty * p.cost * 1.06)), notes: 'Opening stock' });
  }
  // customers
  const custIds: ID[] = [];
  for (let i = 0; i < 30; i++) {
    const id = uid('cu');
    const [district, area] = pick(AREAS);
    await db.customers.add({ id, businessId: bid, name: NAMES[i], phone: `01${3 + Math.floor(R() * 7)}${String(10000000 + Math.floor(R() * 89999999))}`, address: `House ${1 + Math.floor(R() * 40)}, Road ${1 + Math.floor(R() * 12)}`, district, area, status: 'active', createdAt: Date.now() });
    custIds.push(id);
  }
  // campaigns
  await createCampaign(bid, { platform: 'meta', name: 'Hijab — September Boost', startDate: addDays(today, -45), endDate: addDays(today, -15), spend: toPaisa(18000), orders: 64, revenue: toPaisa(52000), notes: 'Manual attribution' });
  await createCampaign(bid, { platform: 'tiktok', name: 'Serum Launch', startDate: addDays(today, -30), endDate: addDays(today, -5), spend: toPaisa(12000), orders: 41, revenue: toPaisa(31000) });
  await createCampaign(bid, { platform: 'google', name: 'Brand Search', startDate: addDays(today, -20), spend: toPaisa(5000), orders: 12, revenue: toPaisa(14000) });
  // expenses
  const exs: [string, number, number][] = [['rent', 15000, -32],['salary', 20000, -30],['packaging', 4500, -25],['utilities', 2800, -28],['transport', 3200, -18],['internet', 1200, -27],['salary', 20000, -2],['rent', 15000, -3],['packaging', 3800, -6],['equipment', 8500, -12]];
  for (const [cat, amt, d] of exs) await createExpense(bid, { category: cat, amount: toPaisa(amt), date: addDays(today, d) });
  // orders over 60 days
  const deliveredIds: ID[] = [];
  let n = 0;
  for (let d = 60; d >= 0; d--) {
    const date = addDays(today, -d);
    const count = d === 0 ? 2 : 1 + Math.floor(R() * 4);
    for (let k = 0; k < count; k++) {
      const itemCount = 1 + Math.floor(R() * 2);
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const pr = pick(prodIds);
        items.push({ productId: pr.id, qty: 1 + Math.floor(R() * 2) });
      }
      const roll = R();
      const status = d <= 1 ? (roll < 0.5 ? 'pending' : roll < 0.8 ? 'shipped' : 'confirmed')
        : roll < 0.72 ? 'delivered' : roll < 0.82 ? 'returned' : roll < 0.90 ? 'shipped' : roll < 0.95 ? 'cancelled' : 'pending';
      const dc = R() < 0.7 ? 60 : 120;
      const total_est = items.reduce((a, i) => a + i.qty * (prodIds.find((p) => p.id === i.productId)?.price ?? 0), 0);
      const adv = R() < 0.3 ? Math.min(toPaisa(dc), total_est) : 0;
      try {
        const id = await createOrder(bid, {
          customerId: pick(custIds), items, channel: pick(CHANNELS), date, status: status === 'returned' ? 'delivered' : (status as never),
          deliveryCharge: toPaisa(dc), advance: adv, courierId: pick(courierIds), courierFee: toPaisa(60), payMethod: 'cod',
        });
        const o = await db.orders.get(id);
        if (o && (status === 'delivered' || status === 'shipped') && R() < 0.75) {
          const due = o.total - o.paid;
          if (due > 0) { await addOrderPayment(bid, id, R() < 0.8 ? due : Math.round(due / 2), 'cash', 'order', undefined, date); }
        }
        if (status === 'returned' && o) { deliveredIds.push(id); }
        n++;
      } catch { /* stock short — skip */ }
    }
    onProgress?.(Math.round(((60 - d) / 62) * 100));
  }
  // convert some to returns
  for (const id of deliveredIds.slice(0, Math.min(12, deliveredIds.length))) {
    try { await processReturn(bid, { orderId: id, condition: R() < 0.7 ? 'resellable' : 'damaged', refund: 0, returnFee: toPaisa(60) }); } catch { /* ignore */ }
  }
  // damages
  try { await recordDamage(bid, { productId: prodIds[5].id, qty: 3, reason: 'courier', date: addDays(today, -9), notes: 'Broken in transit' }); } catch { /* ignore */ }
  onProgress?.(100);
}
