import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { recordActivity } from '@/lib/data-store';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Файл номи кўрсатилмаган' }, { status: 400 });
    }

    // Path traversal sanitization
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(BACKUPS_DIR, safeFilename);

    if (!filePath.startsWith(path.resolve(BACKUPS_DIR)) || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Файл топилмади ёки рухсат берилмаган' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Audit download
    const userHeader = req.headers.get('x-user');
    let userObj: { id?: string; login?: string; fullName?: string; rol?: string; org?: string } | null = null;
    if (userHeader) {
      try {
        userObj = JSON.parse(decodeURIComponent(userHeader));
      } catch {
        // ignore
      }
    }

    recordActivity({
      action: 'backup.download',
      userId: userObj?.id || 'admin',
      userLogin: userObj?.login || 'admin',
      userName: userObj?.fullName || 'Администратор',
      userRole: (userObj?.rol as any) || 'admin',
      userOrg: (userObj?.org as any) || 'СО',
      details: `Захира нусха файли юклаб олинди: ${safeFilename}`,
    });

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Файлни юклаб олишда хатолик' }, { status: 500 });
  }
}
