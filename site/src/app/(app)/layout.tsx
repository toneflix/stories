import { AppNav } from '@/components/AppNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <AppNav />
      <main className="app-main">{children}</main>
    </div>
  );
}
