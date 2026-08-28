import { NextRequest, NextResponse } from 'next/server';
import { getNextDocNumber, seedInitialDataIfNeeded } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    seedInitialDataIfNeeded();
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get('entity');
    const period = searchParams.get('period') || undefined;

    if (!entity) {
      return NextResponse.json({ error: 'Entity parameter is required' }, { status: 400 });
    }

    const result = getNextDocNumber(entity, period);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error generating doc number:', error);
    return NextResponse.json({ error: 'Failed to generate document number' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    seedInitialDataIfNeeded();
    const body = await req.json().catch(() => ({}));
    const entity = body.entity;
    const period = body.period || undefined;

    if (!entity) {
      return NextResponse.json({ error: 'Entity parameter is required' }, { status: 400 });
    }

    const result = getNextDocNumber(entity, period);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error generating doc number:', error);
    return NextResponse.json({ error: 'Failed to generate document number' }, { status: 500 });
  }
}
