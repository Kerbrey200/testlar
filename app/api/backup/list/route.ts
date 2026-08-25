import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

export async function GET() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return NextResponse.json({ backups: [] });
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ backups });
  } catch (error) {
    console.error('List backups error:', error);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}
