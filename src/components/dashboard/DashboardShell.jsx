"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, ChevronDown } from "lucide-react";
import { navForRole, ROLE_META, BACK_TO_MAP } from "@/lib/nav";
import s from "./dashboard.module.css";

function initials(u) {
  const a = (u.firstName || "").trim();
  const b = (u.lastName || "").trim();
  return ((a[0] || "") + (b[0] || u.email[0] || "")).toUpperCase();
}

export default function DashboardShell({ user, title, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const meta = ROLE_META[user.role] || ROLE_META.CLIENT;
  const nav = navForRole(user.role);

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/carte");
    router.refresh();
  }

  return (
    <div className={s.shell}>
      {open && <div className={s.scrim} onClick={() => setOpen(false)} />}

      <aside className={`${s.sidebar} ${open ? s.sidebarOpen : ""}`}>
        <div className={s.brand}>
          <div className={s.brandMark}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z" /><path d="M9 7v13M15 4v13" />
            </svg>
          </div>
          <div className={s.brandText}>
            <span className={s.brandName}>CARTODONNEES</span>
            <span className={s.brandSpace}>{meta.space}</span>
          </div>
        </div>

        <nav className={s.nav}>
          {nav.map((group) => (
            <div key={group.heading} className={s.navGroup}>
              <div className={s.navHeading}>{group.heading}</div>
              {group.items.map((item) =>
                item.children ? (
                  <NavFolder
                    key={item.label}
                    item={item}
                    isActive={isActive}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <NavLink key={item.href} item={item} active={isActive(item)} onNavigate={() => setOpen(false)} />
                ),
              )}
            </div>
          ))}
        </nav>

        <div className={s.sidebarFoot}>
          <Link href={BACK_TO_MAP.href} className={s.navItem} onClick={() => setOpen(false)}>
            <BACK_TO_MAP.icon className={s.navIcon} />
            {BACK_TO_MAP.label}
          </Link>
          <button className={s.navItem} style={{ width: "100%", border: 0, background: "transparent", cursor: "pointer" }} onClick={logout}>
            <LogOut className={s.navIcon} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className={s.main}>
        <header className={s.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button className={`${s.iconBtn} ${s.burger}`} onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className={s.topTitle}>{title || meta.space}</span>
          </div>
          <div className={s.topActions}>
            <div className={s.userChip}>
              <span className={s.avatar}>{initials(user)}</span>
              <span className={s.userMeta}>
                <span className={s.userName}>{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}</span>
                <span className={s.userRole}>{meta.label}{user.operator ? ` · ${user.operator.name}` : ""}</span>
              </span>
            </div>
            <button className={s.iconBtn} onClick={logout} aria-label="Déconnexion" title="Déconnexion">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}

/** Entrée simple de la barre latérale. */
function NavLink({ item, active, onNavigate, sub }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`${sub ? s.navSubItem : s.navItem} ${active ? s.navItemActive : ""}`}
    >
      {Icon && <Icon className={s.navIcon} />}
      {item.label}
    </Link>
  );
}

/**
 * Entrée dépliante (« Données géographiques », « Comptes et profils »…).
 * Le groupe contenant la page courante s'ouvre de lui-même ; l'utilisateur
 * reste libre de le replier ou d'en ouvrir un autre.
 */
function NavFolder({ item, isActive, onNavigate }) {
  const holdsCurrent = item.children.some((c) => isActive(c));
  const [open, setOpen] = useState(holdsCurrent);

  // Suit la navigation : ouvrir le groupe de la page atteinte par un autre chemin.
  useEffect(() => {
    if (holdsCurrent) setOpen(true);
  }, [holdsCurrent]);

  const Icon = item.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${s.navItem} ${s.navFolder} ${!open && holdsCurrent ? s.navFolderActive : ""}`}
      >
        {Icon && <Icon className={s.navIcon} />}
        <span className={s.navFolderLabel}>{item.label}</span>
        <ChevronDown className={`${s.navChevron} ${open ? s.navChevronOpen : ""}`} />
      </button>
      {open && (
        <div className={s.navSub}>
          {item.children.map((c) => (
            <NavLink key={c.href} item={c} active={isActive(c)} onNavigate={onNavigate} sub />
          ))}
        </div>
      )}
    </div>
  );
}
