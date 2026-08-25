import { NextRequest, NextResponse } from 'next/server';
import { readStore, writeStore, recordActivity, seedInitialDataIfNeeded } from '@/lib/data-store';
import { Nakladnoy, StockItem } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    seedInitialDataIfNeeded();
    const { entity } = await params;
    const data = readStore<unknown[]>(entity, []);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET entity error:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    seedInitialDataIfNeeded();
    const { entity } = await params;
    const body = await req.json();
    const { item, auditInfo } = body;

    if (!item) {
      return NextResponse.json({ error: 'Item data required' }, { status: 400 });
    }

    const items = readStore<Array<{ id: string }>>(entity, []);
    const existingIndex = items.findIndex((i) => i.id === item.id);

    // Special Business Logic: Nakladnoy approval transfers stocks between warehouses
    if (entity === 'nakladnoy') {
      const nakladnoy = item as Nakladnoy;
      const oldNakladnoy = existingIndex >= 0 ? (items[existingIndex] as Nakladnoy) : null;

      // When transitioning to 'approved'
      if (nakladnoy.status === 'approved' && (!oldNakladnoy || oldNakladnoy.status !== 'approved')) {
        const stocks = readStore<StockItem[]>('stocks', []);

        for (const it of nakladnoy.items) {
          // 1. Deduct from Sender
          const senderStockIndex = stocks.findIndex(
            (s) => s.ownerId === nakladnoy.senderId && (s.materialId === it.materialId || s.materialName === it.materialName)
          );
          if (senderStockIndex >= 0) {
            const currentQty = stocks[senderStockIndex].quantity ?? stocks[senderStockIndex].qty ?? 0;
            stocks[senderStockIndex].quantity = Math.max(0, currentQty - it.qty);
            stocks[senderStockIndex].qty = stocks[senderStockIndex].quantity;
            stocks[senderStockIndex].updatedAt = new Date().toISOString();
          } else {
            // If sender didn't have explicit record, create one with 0
            stocks.push({
              id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
              ownerType: nakladnoy.senderType || 'admin',
              ownerId: nakladnoy.senderId,
              ownerName: nakladnoy.senderName,
              materialId: it.materialId || '',
              materialName: it.materialName,
              unit: it.unit,
              quantity: 0,
              qty: 0,
              updatedAt: new Date().toISOString(),
            });
          }

          // 2. Add to Recipient
          const recipientStockIndex = stocks.findIndex(
            (s) => s.ownerId === nakladnoy.recipientId && (s.materialId === it.materialId || s.materialName === it.materialName)
          );
          if (recipientStockIndex >= 0) {
            const currentQty = stocks[recipientStockIndex].quantity ?? stocks[recipientStockIndex].qty ?? 0;
            stocks[recipientStockIndex].quantity = currentQty + it.qty;
            stocks[recipientStockIndex].qty = stocks[recipientStockIndex].quantity;
            stocks[recipientStockIndex].updatedAt = new Date().toISOString();
          } else {
            stocks.push({
              id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
              ownerType: nakladnoy.recipientType || 'prorab',
              ownerId: nakladnoy.recipientId || '',
              ownerName: nakladnoy.recipientName || '',
              materialId: it.materialId || '',
              materialName: it.materialName,
              unit: it.unit,
              quantity: it.qty,
              qty: it.qty,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        writeStore('stocks', stocks);
      }
    }

    if (existingIndex >= 0) {
      items[existingIndex] = item;
    } else {
      items.unshift(item);
    }

    writeStore(entity, items);

    // Record audit if provided
    if (auditInfo) {
      recordActivity({
        action: auditInfo.action || `${entity}.update`,
        userId: auditInfo.userId || 'system',
        userLogin: auditInfo.userLogin || 'system',
        userName: auditInfo.userName || 'System',
        userRole: auditInfo.userRole || 'admin',
        userOrg: auditInfo.userOrg || 'СО',
        details: auditInfo.details || `Item ${item.id} updated in ${entity}`,
        entityType: entity,
        entityId: item.id,
      });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('POST entity error:', error);
    return NextResponse.json({ error: 'Failed to write data' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    seedInitialDataIfNeeded();
    const { entity } = await params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const items = readStore<Array<{ id: string }>>(entity, []);
    const filtered = items.filter((i) => i.id !== id);
    writeStore(entity, filtered);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('DELETE entity error:', error);
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
  }
}
