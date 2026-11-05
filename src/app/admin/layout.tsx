import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-bold">Akses ditolak</h1>
          <p className="mb-4 mt-2 text-sm text-slate-400">
            Akun {user.email} belum memiliki role admin. Jalankan{" "}
            <code className="text-slate-200">update public.profiles set role = &apos;admin&apos;</code> di Supabase.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-800 bg-slate-950 p-4 md:w-56 md:border-b-0 md:border-r">
        <div className="mb-4 text-lg font-bold">pDOOH <span className="text-brand">CMS</span></div>
        <nav className="flex gap-2 text-sm md:flex-col">
          <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-slate-800">Screens</Link>
          <Link href="/admin/reports" className="rounded-lg px-3 py-2 hover:bg-slate-800">Reports</Link>
        </nav>
        <div className="mt-4 hidden text-xs text-slate-500 md:block">
          <p className="mb-2 truncate">{admin.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
