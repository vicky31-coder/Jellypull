import type { Metadata } from "next";
import "./globals.css";
import { MduiProvider } from "@/components/MduiProvider";

export const metadata: Metadata = {
  title: "Jellypull",
  description: "Material Design torrent discovery and qBittorrent control center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="mdui-theme-auto">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
      </head>
      <body>
        <MduiProvider>{children}</MduiProvider>
      </body>
    </html>
  );
}
