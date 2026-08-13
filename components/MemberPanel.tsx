"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

type Language = "tr" | "en" | "ru";

type MemberCheckoutProfile = {
  full_name: string | null;
  phone: string | null;
  default_delivery_zone_id: number | null;
  default_address: string | null;
};

type Props = {
  language: Language;
  onMemberChange?: (profile: MemberCheckoutProfile | null) => void;
};

type CustomerProfile = {
  full_name: string | null;
  email: string | null;
  discount_percent: number | null;
  discount_active: boolean | null;
  phone: string | null;
  default_delivery_zone_id: number | null;
  default_address: string | null;
};

const copy = {
  tr: {
    login: "Üye Girişi",
    signup: "Üye Ol",
    loginDescription:
      "Hesabınıza giriş yapın. Tanımlı üye indiriminiz varsa sepetinize otomatik uygulanır.",
    signupDescription:
      "Üye olarak size özel tanımlanan indirimlerden yararlanabilirsiniz.",
    fullName: "Ad Soyad",
    email: "E-posta",
    password: "Şifre",
    signIn: "Giriş Yap",
    signUp: "Üye Ol",
    noAccount: "Üye değil misiniz? Kayıt olun",
    haveAccount: "Zaten üye misiniz? Giriş yapın",
    signOut: "Çıkış",
    memberDiscount: "Üye indirimi",
    welcome: "Merhaba",
    wait: "Bekleyin...",
    badLogin: "E-posta veya şifreyi kontrol edin.",
    registered:
      "Bu e-posta adresiyle üyelik oluşturulabiliyorsa doğrulama bağlantısını gönderdik. Zaten üyeyseniz giriş yapabilirsiniz.",
  },
  en: {
    login: "Member Login",
    signup: "Become a Member",
    loginDescription:
      "Sign in to your account. If you have a member discount, it will be applied to your cart automatically.",
    signupDescription:
      "Become a member to use discounts assigned specifically to your account.",
    fullName: "Full Name",
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    signUp: "Sign Up",
    noAccount: "Not a member? Sign up",
    haveAccount: "Already a member? Sign in",
    signOut: "Sign Out",
    memberDiscount: "Member discount",
    welcome: "Hello",
    wait: "Please wait...",
    badLogin: "Please check your email and password.",
    registered:
      "If an account can be created with this email, we’ve sent a confirmation link. If you’re already a member, you can sign in.",
  },
  ru: {
    login: "Вход",
    signup: "Регистрация",
    loginDescription:
      "Войдите в аккаунт. Если для вас действует скидка участника, она будет автоматически применена к корзине.",
    signupDescription:
      "Зарегистрируйтесь, чтобы пользоваться персональными скидками.",
    fullName: "Имя и фамилия",
    email: "Эл. почта",
    password: "Пароль",
    signIn: "Войти",
    signUp: "Зарегистрироваться",
    noAccount: "Нет аккаунта? Зарегистрироваться",
    haveAccount: "Уже есть аккаунт? Войти",
    signOut: "Выйти",
    memberDiscount: "Скидка участника",
    welcome: "Здравствуйте",
    wait: "Подождите...",
    badLogin: "Проверьте адрес эл. почты и пароль.",
    registered:
      "Если для этого адреса можно создать аккаунт, мы отправили ссылку для подтверждения. Если вы уже зарегистрированы, войдите в аккаунт.",
  },
} satisfies Record<Language, Record<string, string>>;

export default function MemberPanel({ language, onMemberChange }: Props) {
  const t = copy[language];

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  async function loadMember() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    setUserId(user?.id ?? null);

    if (!user) {
      setProfile(null);
      onMemberChange?.(null);
      return;
    }

    const profileSelect =
      "full_name,email,discount_percent,discount_active,phone,default_delivery_zone_id,default_address";

    let { data: profileData, error: profileError } = await supabase
      .from("customer_profiles")
      .select(profileSelect)
      .eq("user_id", user.id)
      .maybeSingle();

    // Eski üyelerde profil kaydı yoksa auth metadata'dan oluştur.
    if (!profileData && !profileError) {
      const fallbackName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "";

      const { data: createdProfile, error: createError } = await supabase
        .from("customer_profiles")
        .insert({
          user_id: user.id,
          email: user.email ?? null,
          full_name: fallbackName || null,
        })
        .select(profileSelect)
        .single();

      if (!createError) profileData = createdProfile;
    }

    const nextProfile = (profileData ?? null) as CustomerProfile | null;
    setProfile(nextProfile);
    onMemberChange?.(
      nextProfile
        ? {
            full_name: nextProfile.full_name,
            phone: nextProfile.phone,
            default_delivery_zone_id: nextProfile.default_delivery_zone_id,
            default_address: nextProfile.default_address,
          }
        : null
    );
  }

  useEffect(() => {
    setMounted(true);
    void loadMember();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadMember();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim(), language },
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        // E-posta doğrulaması kapalıysa oturum hemen açılır ve profili yükleriz.
        if (signUpData.session) {
          await loadMember();
          setOpen(false);
        } else {
          setMessage(t.registered);
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(t.badLogin);
        return;
      }

      setOpen(false);
      await loadMember();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUserId(null);
    setProfile(null);
    onMemberChange?.(null);
  }

  const discount =
    profile?.discount_active && Number(profile.discount_percent || 0) > 0
      ? Number(profile.discount_percent || 0)
      : 0;

  return (
    <>
      {userId ? (
        <div className="flex items-center gap-2 rounded-full border border-[#6e1f12]/15 bg-white/70 px-3 py-2">
          <div className="max-w-[150px]">
            <p className="truncate text-xs font-bold text-[#6e1f12]">
              {t.welcome}
              {profile?.full_name
                ? `, ${profile.full_name.split(" ")[0]}`
                : ""}
            </p>

            {discount > 0 && (
              <p className="text-[10px] font-semibold text-green-700">
                {t.memberDiscount} %{discount}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-[10px] font-bold"
          >
            {t.signOut}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setMessage("");
            setOpen(true);
          }}
          className="relative z-10 rounded-full border border-[#6e1f12]/15 bg-white/70 px-3 py-2 text-xs font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white sm:px-4 sm:text-sm"
        >
          {t.login}
        </button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/55 p-4 sm:p-6"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647,
            }}
            role="dialog"
            aria-modal="true"
            aria-label={mode === "login" ? t.login : t.signup}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <div
              className="my-auto w-full max-w-[460px] max-h-[90dvh] overflow-y-auto rounded-[28px] bg-[#f4efe5] p-5 shadow-2xl sm:p-6"
              onMouseDown={(event) => event.stopPropagation()}
            >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#6e1f12]">
                  {mode === "login" ? t.login : t.signup}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#292821]/55">
                  {mode === "login"
                    ? t.loginDescription
                    : t.signupDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="mt-4">
              {mode === "signup" && (
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={t.fullName}
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/50"
                />
              )}

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.email}
                autoComplete="email"
                required
                className={`${mode === "signup" ? "mt-3" : ""} w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/50`}
              />

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.password}
                minLength={6}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/50"
              />

              {message && (
                <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-5">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-4 w-full rounded-2xl bg-[#6e1f12] px-5 py-3.5 font-bold text-white disabled:opacity-50"
              >
                {busy
                  ? t.wait
                  : mode === "login"
                    ? t.signIn
                    : t.signUp}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setMessage("");
                }}
                className="mt-3 w-full rounded-2xl border border-[#6e1f12]/15 bg-white px-5 py-3 text-sm font-bold text-[#6e1f12]"
              >
                {mode === "login" ? t.noAccount : t.haveAccount}
              </button>
            </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}