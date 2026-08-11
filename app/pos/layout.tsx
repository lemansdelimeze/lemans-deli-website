"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

export default function PosLayout({ children }: { children: ReactNode }) {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setLoggedIn(Boolean(session));
      setSessionLoading(false);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setLoggedIn(Boolean(session));
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginError(null);
    setLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoginError("E-posta veya şifre hatalı.");
      setLoggingIn(false);
      return;
    }

    setLoggingIn(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-5 text-[#292821]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#6e1f12]/15 border-t-[#6e1f12]" />
          <p
            className="text-lg text-[#6e1f12]"
            style={{ fontFamily: BRAND_FONT }}
          >
            POS hazırlanıyor...
          </p>
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-5 text-[#292821]">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-[#6e1f12]/12 bg-white p-7 shadow-sm"
        >
          <div className="text-center">
            <img
              src="/logo-horizontal.png"
              alt="Leman's Deli"
              className="mx-auto h-16 w-auto max-w-[230px] object-contain"
            />

            <h1
              className="mt-5 text-2xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              POS Girişi
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Menü yönetiminde kullandığınız hesapla giriş yapabilirsiniz.
            </p>
          </div>

          <label className="mt-7 block">
            <span className="mb-2 block text-sm font-semibold">E-posta</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/60"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold">Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/60"
            />
          </label>

          {loginError && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={loggingIn}
            className="mt-6 w-full rounded-xl bg-[#6e1f12] px-5 py-3.5 font-bold text-white disabled:opacity-50"
          >
            {loggingIn ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[100] print:hidden">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-full border border-black/10 bg-white/95 px-4 py-2 text-xs font-semibold text-[#6e1f12] shadow-md backdrop-blur"
        >
          Çıkış
        </button>
      </div>

      {children}
    </>
  );
}