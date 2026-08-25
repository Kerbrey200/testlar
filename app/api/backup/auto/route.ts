import { NextResponse } from 'next/server';
import { performAutoBackup, recordActivity } from '@/lib/data-store';

export async function POST() {
  try {
    const result = performAutoBackup();
    if (result.success) {
      recordActivity({
        action: 'backup.auto',
        userId: 'system',
        userLogin: 'system',
        userName: 'Автомат Тизим',
        userRole: 'admin',
        userOrg: 'СО',
        details: `Автоматик захира нусха яратилди: ${result.filename} (${result.removedOldCount} та 10 кундан эски нусха ўчирилди)`,
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ success: false, error: 'Backup failed' }, { status: 500 });
  } catch (error) {
    console.error('Backup auto error:', error);
    return NextResponse.json({ success: false, error: 'Backup internal error' }, { status: 500 });
  }
}
