"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import s from "./dashboard.module.css";

export default function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${s.modal} ${wide ? s.modalWide : ""}`} role="dialog" aria-modal="true">
        <div className={s.modalHead}>
          <span className={s.modalTitle}>{title}</span>
          <button className={s.iconBtn} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className={s.modalBody}>{children}</div>
        {footer && <div className={s.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}
