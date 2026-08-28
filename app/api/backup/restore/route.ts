import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  writeStore,
  recordActivity,
  ARRAY_ENTITY_STORES,
  OBJECT_ENTITY_STORES,
} from '@/lib/data-store';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

export async function POST(req: NextRequest) {
  try {
    const { filename, rawData, user } = await req.json();

    let backupData: Record<string, unknown> | null = null;
    let sourceDescription = '';

    if (filename) {
      // Path traversal security check: sanitize filename to only basename
      const safeFilename = path.basename(filename);
      const filePath = path.resolve(BACKUPS_DIR, safeFilename);

      if (!filePath.startsWith(path.resolve(BACKUPS_DIR)) || !fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Захира файли топилмади ёки рухсат берилмаган' }, { status: 404 });
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      backupData = JSON.parse(fileContent);
      sourceDescription = `Файл: ${safeFilename}`;
    } else if (rawData) {
      backupData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      sourceDescription = 'Юкланган JSON файл (Import from file)';
    }

    if (!backupData || typeof backupData !== 'object') {
      return NextResponse.json({ error: 'Захира маълумоти нотўғри ёки топилмади' }, { status: 400 });
    }

    let restoredCount = 0;

    // 1. Restore array-based data stores (users, zayavki, stocks, etc.)
    for (const entity of ARRAY_ENTITY_STORES) {
      if (backupData[entity] && Array.isArray(backupData[entity])) {
        writeStore(entity, backupData[entity]);
        restoredCount++;
      }
    }

    // 2. Restore object-based data stores (counters: Record<string, number>)
    // IMPORTANT: 'counters' is an object containing document number sequences, NOT an array!
    for (const objEntity of OBJECT_ENTITY_STORES) {
      if (
        backupData[objEntity] &&
        typeof backupData[objEntity] === 'object' &&
        !Array.isArray(backupData[objEntity])
      ) {
        writeStore(objEntity, backupData[objEntity] as Record<string, unknown>);
        restoredCount++;
      }
    }

    const auditAction = rawData && !filename ? 'backup.import_from_file' : 'backup.restore';

    recordActivity({
      action: auditAction,
      userId: user?.id || 'admin',
      userLogin: user?.login || 'admin',
      userName: user?.fullName || 'Администратор',
      userRole: user?.rol || 'admin',
      userOrg: user?.org || 'СО',
      details: `Тизим захира нусхадан тикланди (${sourceDescription}, ${restoredCount} та бўлим/жадвал)`,
    });

    return NextResponse.json({
      success: true,
      message: `${restoredCount} та маълумотлар жадвали ва ҳисоблагичлари муваффақиятли қайта тикланди`,
      restoredCount,
    });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Тиклашда хатолик юз берди' }, { status: 500 });
  }
}
