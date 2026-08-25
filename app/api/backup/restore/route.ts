import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeStore, recordActivity } from '@/lib/data-store';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

export async function POST(req: NextRequest) {
  try {
    const { filename, rawData, user } = await req.json();

    let backupData: Record<string, unknown> | null = null;

    if (filename) {
      const filePath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Файл топилмади' }, { status: 404 });
      }
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      backupData = JSON.parse(fileContent);
    } else if (rawData) {
      backupData = rawData;
    }

    if (!backupData) {
      return NextResponse.json({ error: 'Захира маълумоти топилмади' }, { status: 400 });
    }

    const entities = [
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
    ];

    let restoredCount = 0;
    for (const entity of entities) {
      if (backupData[entity] && Array.isArray(backupData[entity])) {
        writeStore(entity, backupData[entity]);
        restoredCount++;
      }
    }

    recordActivity({
      action: 'backup.restore',
      userId: user?.id || 'admin',
      userLogin: user?.login || 'admin',
      userName: user?.fullName || 'Администратор',
      userRole: user?.rol || 'admin',
      userOrg: user?.org || 'СО',
      details: `Тизим захира нусхадан тикланди (${filename || 'Yuklangan fayl'}, ${restoredCount} та жадвал)`,
    });

    return NextResponse.json({ success: true, message: `${restoredCount} та жадвал муваффақиятли тикланди` });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Тиклашда хатолик юз берди' }, { status: 500 });
  }
}
