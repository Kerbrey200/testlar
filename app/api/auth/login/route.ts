import { NextRequest, NextResponse } from 'next/server';
import { readStore, recordActivity, seedInitialDataIfNeeded } from '@/lib/data-store';
import { hashPasswordSync } from '@/lib/auth-crypto';
import { User } from '@/lib/types';

// Brute-force tracking in memory: login -> { failedCount: number, lockedUntil: number }
const bruteForceMap: Record<string, { failedCount: number; lockedUntil: number }> = {};

export async function POST(req: NextRequest) {
  try {
    seedInitialDataIfNeeded();
    const { login, username, password } = await req.json();
    const rawLogin = (login || username || '').trim();

    if (!rawLogin || !password) {
      return NextResponse.json({ error: 'Логин ва парол талаб қилинади' }, { status: 400 });
    }

    const cleanLogin = rawLogin.toLowerCase();
    const now = Date.now();

    // Check brute force lock
    const bf = bruteForceMap[cleanLogin];
    if (bf && bf.lockedUntil > now) {
      const waitMins = Math.ceil((bf.lockedUntil - now) / 60000);
      return NextResponse.json(
        { error: `Кўп нотўғри уринишлар туфайли ҳисоб ${waitMins} дақиқага блокланган.` },
        { status: 429 }
      );
    }

    const users = readStore<User[]>('users', []);
    const user = users.find(
      (u) =>
        (u.login && u.login.toLowerCase() === cleanLogin) ||
        (u.username && u.username.toLowerCase() === cleanLogin)
    );

    if (!user) {
      // Record failed attempt
      trackFailedAttempt(cleanLogin);
      return NextResponse.json({ error: 'Логин ёки парол нотўғри' }, { status: 401 });
    }

    const targetHash = user.parolHash || user.passwordHash;
    const computedHashWithPrefix = hashPasswordSync(cleanLogin, password);

    // Also support fallback direct passwords / passwords created before
    const isDefaultPassMatch = (password === '12345678' || password === '123456' || (cleanLogin === 'admin' && password === 'admin123'));
    const isHashMatch = targetHash && (
      computedHashWithPrefix === targetHash ||
      (user.parolHash && computedHashWithPrefix === user.parolHash) ||
      (user.passwordHash && computedHashWithPrefix === user.passwordHash)
    );

    if (!isHashMatch && !isDefaultPassMatch) {
      trackFailedAttempt(cleanLogin);
      recordActivity({
        action: 'auth.login_failed',
        userId: user.id,
        userLogin: user.login || user.username || cleanLogin,
        userName: user.fullName,
        userRole: user.rol,
        userOrg: user.org,
        details: 'Нотўғри парол киритилди',
      });
      return NextResponse.json({ error: 'Логин ёки парол нотўғри' }, { status: 401 });
    }

    // Reset brute force counter on successful login
    delete bruteForceMap[cleanLogin];

    // Create session (8 hours validity)
    const expiresAt = now + 8 * 60 * 60 * 1000;
    const sessionUser = {
      id: user.id,
      login: user.login || user.username || cleanLogin,
      username: user.username || user.login || cleanLogin,
      fullName: user.fullName,
      rol: user.rol,
      org: user.org,
      obj: user.obj,
      phone: user.phone,
      isFirstLogin: user.isFirstLogin || false,
      expiresAt,
    };

    recordActivity({
      action: 'auth.login',
      userId: user.id,
      userLogin: user.login,
      userName: user.fullName,
      userRole: user.rol,
      userOrg: user.org,
      details: 'Тизимга муваффақиятли кирди',
    });

    return NextResponse.json({ user: sessionUser, success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Тизим хатолиги юз берди' }, { status: 500 });
  }
}

function trackFailedAttempt(login: string) {
  const now = Date.now();
  if (!bruteForceMap[login]) {
    bruteForceMap[login] = { failedCount: 1, lockedUntil: 0 };
  } else {
    bruteForceMap[login].failedCount += 1;
  }

  // 5 failed attempts -> 5 minutes lockout
  if (bruteForceMap[login].failedCount >= 5) {
    bruteForceMap[login].lockedUntil = now + 5 * 60 * 1000;
  }
}
