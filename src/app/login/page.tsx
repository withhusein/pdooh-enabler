import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Login | pDOOH Enabler" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-bold">pDOOH CMS</h1>
        <p className="mb-5 mt-1 text-sm text-slate-400">Login khusus admin.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
