"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Mail, Lock, User, Loader2, LogIn, UserPlus } from "lucide-react";
import { useMapStore } from "@/stores/map-store";
import { ROLE_META } from "@/lib/nav";
import { BrandMark } from "./BrandMark";
import { Tabs } from "@/components/ui/kit";

const AUTH_MODES = [
  { key: "login", label: "Connexion" },
  { key: "register", label: "Inscription" },
];

export function AuthModal() {
  const { authOpen, setAuthOpen, login, register } = useMapStore();
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === "register" && form.password !== form.confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res =
      mode === "login"
        ? await login(form.email, form.password)
        : await register({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Redirection vers l'espace du rôle (staff) après connexion.
    const home = ROLE_META[res.user?.role]?.home;
    if (home && home !== "/carte") router.push(home);
  };

  return (
    <AnimatePresence>
      {authOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setAuthOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.94, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 14, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-sm rounded-2xl p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <BrandMark />
              <button onClick={() => setAuthOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2">
                <X size={16} />
              </button>
            </div>

            <Tabs
              items={AUTH_MODES}
              value={mode}
              onChange={(m) => { setMode(m); setError(null); }}
              variant="segment"
              className="mb-4 rounded-xl bg-surface-2 p-1"
            />

            <form onSubmit={submit} className="space-y-2.5">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-2">
                  <IconInput icon={<User size={15} />} placeholder="Prénom" value={form.firstName} onChange={set("firstName")} />
                  <IconInput icon={<User size={15} />} placeholder="Nom" value={form.lastName} onChange={set("lastName")} required />
                </div>
              )}
              <IconInput icon={<Mail size={15} />} type="email" placeholder="E-mail" value={form.email} onChange={set("email")} required />
              <IconInput icon={<Lock size={15} />} type="password" placeholder="Mot de passe" value={form.password} onChange={set("password")} required />
              {mode === "register" && (
                <IconInput icon={<Lock size={15} />} type="password" placeholder="Confirmer le mot de passe" value={form.confirm} onChange={set("confirm")} required />
              )}

              {error && <p className="text-xs font-medium text-uncovered">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
                {mode === "login" ? "Se connecter" : "Créer mon compte"}
              </button>
            </form>

            <p className="mt-3 text-center text-[11px] text-muted">
              L'authentification permet d'exporter des données et de recevoir des notifications.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IconInput({ icon, ...props }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 focus-within:border-artci-green">
      <span className="text-muted">{icon}</span>
      <input {...props} className="w-full bg-transparent text-sm outline-none placeholder:text-muted" />
    </div>
  );
}
