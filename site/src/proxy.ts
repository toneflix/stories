import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isReleased } from '@/content/stories';
import { hasEarlyAccess } from '@/lib/access';

// Videos and live player files of unreleased stories are only served to early-access accounts.
export async function proxy(req: NextRequest) {
  const id = req.nextUrl.pathname.split('/')[req.nextUrl.pathname.startsWith('/play/') ? 3 : 2];
  if (!id || isReleased(id)) return NextResponse.next();
  const session = await auth();
  if (await hasEarlyAccess(session?.user?.id)) return NextResponse.next();
  return new NextResponse(null, { status: 404 });
}

export const config = { matcher: ['/media/:id/:path*', '/play/stories/:id/:path*'] };
