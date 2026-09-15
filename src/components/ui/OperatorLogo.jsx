"use client";

import { useState } from "react";
import { operatorLogo } from "@/lib/operators";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Logo d'un opérateur, avec repli sur sa pastille de couleur.
 *
 * Un logo peut manquer (opérateur créé sans logo) ou ne pas se charger
 * (fichier téléversé puis supprimé) : dans les deux cas la pastille prend le
 * relais, pour que la couleur reste lisible partout où elle sert de repère.
 *
 * @param {object} operator  { code|key, name, color, imagePath }
 * @param {number} size      côté du carré, en pixels
 * @param {boolean} dim      atténué quand l'opérateur n'est pas retenu par le filtre
 */
export function OperatorLogo({ operator, size = 18, dim = false, className = "" }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : mediaUrl(operatorLogo(operator));
  const name = operator?.name ?? operator?.code ?? "";

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface transition-opacity",
        dim && "opacity-30",
        className,
      )}
      style={{ width: size, height: size }}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="h-full w-full" style={{ background: operator?.color ?? "#94a3b8" }} />
      )}
    </span>
  );
}
