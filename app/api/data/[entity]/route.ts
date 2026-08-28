import { NextRequest, NextResponse } from 'next/server';
import { readStore, writeStore, recordActivity, seedInitialDataIfNeeded } from '@/lib/data-store';
import { Nakladnoy, StockItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    seedInitialDataIfNeeded();
    const { entity } = await params;
    const storeKey = entity === 'nakladnoylar' ? 'nakladnoy' : entity;
    const data = readStore<unknown[]>(storeKey, []);
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
    const storeKey = entity === 'nakladnoylar' ? 'nakladnoy' : entity;
    const body = await req.json();
    const { item, auditInfo } = body;

    if (!item) {
      return NextResponse.json({ error: 'Item data required' }, { status: 400 });
    }

    const items = readStore<Array<{ id: string }>>(storeKey, []);
    const existingIndex = items.findIndex((i) => i.id === item.id);

    // Special Business Logic: Nakladnoy receipt transfers stocks between warehouses
    if (storeKey === 'nakladnoy') {
      const nakladnoy = item as Nakladnoy;
      const oldNakladnoy = existingIndex >= 0 ? (items[existingIndex] as Nakladnoy) : null;

      // When transitioning to 'received' (or 'approved' for backwards compatibility)
      const isNowReceived = nakladnoy.status === 'received' || nakladnoy.status === 'approved';
      const wasAlreadyReceived = oldNakladnoy && (oldNakladnoy.status === 'received' || oldNakladnoy.status === 'approved');

      if (isNowReceived && !wasAlreadyReceived && Array.isArray(nakladnoy.items)) {
        const stocks = readStore<StockItem[]>('stocks', []);
        const senderId = nakladnoy.senderId || 'central';
        const recipientId = nakladnoy.receiverId || nakladnoy.recipientId || '';
        const recipientName = nakladnoy.receiverName || nakladnoy.recipientName || '';
        const recipientOrg = nakladnoy.receiverOrg || nakladnoy.recipientOrg || 'РМУ';

        const isItemMatch = (s: StockItem, it: { materialId?: string; materialName: string }) => {
          if (it.materialId && s.materialId) {
            return s.materialId === it.materialId;
          }
          return s.materialName.trim().toLowerCase() === it.materialName.trim().toLowerCase();
        };

        for (const it of nakladnoy.items) {
          const requestedQty = Number(it.qty) || 0;
          if (requestedQty <= 0) continue;

          // 1. Find Sender stock
          const senderStockIndex = stocks.findIndex(
            (s) =>
              (s.ownerId === senderId || (senderId === 'central' && s.ownerType === 'admin')) &&
              isItemMatch(s, it)
          );

          const currentSenderQty = senderStockIndex >= 0
            ? (stocks[senderStockIndex].quantity ?? stocks[senderStockIndex].qty ?? 0)
            : 0;

          // Deduct only what is actually available - no phantom quantities!
          const actualTransferQty = Math.min(requestedQty, currentSenderQty);

          if (senderStockIndex >= 0) {
            const newSenderQty = Math.max(0, currentSenderQty - actualTransferQty);
            stocks[senderStockIndex].quantity = newSenderQty;
            stocks[senderStockIndex].qty = newSenderQty;
            stocks[senderStockIndex].updatedAt = new Date().toISOString();
          }

          if (actualTransferQty < requestedQty) {
            recordActivity({
              action: 'stock.insufficient_transfer',
              userId: auditInfo?.userId || 'system',
              userLogin: auditInfo?.userLogin || 'system',
              userName: auditInfo?.userName || 'Система',
              userRole: auditInfo?.userRole || 'admin',
              userOrg: auditInfo?.userOrg || 'СО',
              details: `Омборда қолдиқ етишмади: "${it.materialName}" бўйича сўралган ${requestedQty} ${it.unit}, аммо мавжуд фақат ${actualTransferQty} ${it.unit} ўтказилди`,
              entityType: 'nakladnoy',
              entityId: nakladnoy.id,
            });
          }

          // 2. Add only the actual transferred quantity to Recipient
          if (actualTransferQty > 0) {
            const recipientStockIndex = stocks.findIndex(
              (s) =>
                s.ownerId === recipientId &&
                (nakladnoy.objectId ? s.objectId === nakladnoy.objectId : true) &&
                isItemMatch(s, it)
            );

            if (recipientStockIndex >= 0) {
              const currentRecipientQty =
                stocks[recipientStockIndex].quantity ?? stocks[recipientStockIndex].qty ?? 0;
              const newRecipientQty = currentRecipientQty + actualTransferQty;
              stocks[recipientStockIndex].quantity = newRecipientQty;
              stocks[recipientStockIndex].qty = newRecipientQty;
              stocks[recipientStockIndex].updatedAt = new Date().toISOString();
            } else {
              stocks.push({
                id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                ownerType: nakladnoy.receiverOrg ? 'prorab' : (nakladnoy.recipientType || 'prorab'),
                ownerId: recipientId,
                ownerName: recipientName,
                ownerOrg: recipientOrg,
                objectId: nakladnoy.objectId,
                objectName: nakladnoy.objectName,
                materialId: it.materialId || '',
                materialName: it.materialName.trim(),
                unit: it.unit,
                quantity: actualTransferQty,
                qty: actualTransferQty,
                price: it.price || 0,
                updatedAt: new Date().toISOString(),
              });
            }
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

    writeStore(storeKey, items);

    // Record audit if provided
    if (auditInfo) {
      recordActivity({
        action: auditInfo.action || `${storeKey}.update`,
        userId: auditInfo.userId || 'system',
        userLogin: auditInfo.userLogin || 'system',
        userName: auditInfo.userName || 'System',
        userRole: auditInfo.userRole || 'admin',
        userOrg: auditInfo.userOrg || 'СО',
        details: auditInfo.details || `Item ${item.id} updated in ${storeKey}`,
        entityType: storeKey,
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
    const storeKey = entity === 'nakladnoylar' ? 'nakladnoy' : entity;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const items = readStore<Array<{ id: string }>>(storeKey, []);
    const filtered = items.filter((i) => i.id !== id);
    writeStore(storeKey, filtered);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('DELETE entity error:', error);
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
  }
}
