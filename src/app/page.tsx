import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
        Programmatic DOOH Tech Enabler
      </div>
      <h1 className="text-4xl font-bold tracking-tight">pDOOH Enabler</h1>
      <p className="text-slate-400">
        Ubah videotron konvensional menjadi layar dinamis berbasis data: cuaca, skor olahraga, kurs,
        dan waktu, tanpa ganti hardware.
      </p>
      <Link href="/admin" className="btn">
        Masuk ke CMS
      </Link>
    </main>
  );
}
