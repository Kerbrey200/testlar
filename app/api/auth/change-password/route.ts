import { NextRequest, NextResponse } from 'next/server';
import { readStore, writeStore, recordActivity } from '@/lib/data-store';
import { hashPasswordSync } from '@/lib/auth-crypto';
import { User } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { userId, oldPassword, newPassword } = await req.json();

    if (!userId || !oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Барча майдонларни тўлдиринг' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Янги парол камида 8 белгидан иборат бўлиши керак' }, { status: 400 });
    }

    const users = readStore<User[]>('users', []);
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return NextResponse.json({ error: 'Фойдаланувчи топилмади' }, { status: 404 });
    }

    const user = users[userIndex];
    const oldComputedHash = hashPasswordSync(user.login.toLowerCase(), oldPassword);

    if (oldComputedHash !== user.parolHash) {
      return NextResponse.json({ error: 'Эски парол нотўғри киритилди' }, { status: 400 });
    }

    const newHash = hashPasswordSync(user.login.toLowerCase(), newPassword);
    users[userIndex] = {
      ...user,
      parolHash: newHash,
    };

    writeStore('users', users);

    recordActivity({
      action: 'auth.change_password',
      userId: user.id,
      userLogin: user.login,
      userName: user.fullName,
      userRole: user.rol,
      userOrg: user.org,
      details: 'Парол муваффақиятли янгиланди',
    });

    return NextResponse.json({ success: true, message: 'Парол муваффақиятли ўзгартирилди' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Хатолик юз берди' }, { status: 500 });
  }
}
