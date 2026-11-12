import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trazo — mini-lenguaje en español que dibuja",
  description: "Compilador e intérprete hecho a mano en TypeScript. Proyecto final de Compiladores, UCC Pasto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
