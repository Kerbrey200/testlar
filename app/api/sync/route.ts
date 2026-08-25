import { NextRequest, NextResponse } from 'next/server';
import { readStore, writeStore, recordActivity, seedInitialDataIfNeeded } from '@/lib/data-store';

export async function POST(req: NextRequest) {
  try {
    seedInitialDataIfNeeded();
    const { queue, user } = await req.json();

    if (!Array.isArray(queue) || queue.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    let processedCount = 0;

    for (const item of queue) {
      const { storeName, action, data, id } = item;
      if (!storeName) continue;

      const items = readStore<Array<{ id: string }>>(storeName, []);

      if (action === 'put' && data && data.id) {
        const idx = items.findIndex((i) => i.id === data.id);
        if (idx >= 0) {
          items[idx] = data;
        } else {
          items.unshift(data);
        }
        writeStore(storeName, items);
        processedCount++;
      } else if (action === 'delete' && id) {
        const filtered = items.filter((i) => i.id !== id);
        writeStore(storeName, filtered);
        processedCount++;
      }
    }

    if (user && processedCount > 0) {
      recordActivity({
        action: 'sync.offline_batch',
        userId: user.id,
        userLogin: user.login,
        userName: user.fullName,
        userRole: user.rol,
        userOrg: user.org,
        details: `Оффлайн режимда бажарилган ${processedCount} та амал серверга муваффақиятли синxронланди`,
      });
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
