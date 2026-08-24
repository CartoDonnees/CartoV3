import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/pwa/PWARegister";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "CARTODONNEES - Observatoire cartographique ARTCI",
  description:
    "Observatoire cartographique des réseaux de télécommunications de Côte d'Ivoire. Couverture réseau, zones blanches et infrastructures télécoms par l'ARTCI.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#159a4e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
