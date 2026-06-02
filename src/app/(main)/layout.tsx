import { cookies } from 'next/headers';
import { verifyToken, SESSION_COOKIE } from '@/lib/session';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { RoleProvider } from '@/components/RoleProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token   = cookies().get(SESSION_COOKIE)?.value ?? '';
  const session = verifyToken(token);
  const role    = session?.role ?? 'client';
  const username = session?.username ?? '';

  return (
    <RoleProvider role={role}>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <div className="flex-1 flex flex-col ml-64">
          <TopBar role={role} username={username} />
          <main className="flex-1 p-6 lg:p-8 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
