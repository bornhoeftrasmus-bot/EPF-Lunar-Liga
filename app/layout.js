import "./globals.css";

export const metadata = {
  title: "EPF Hold & Ligaer",
  description: "Følg Esbjerg Padel Forenings aktive hold, spillere, kampe og stillinger på tværs af ligaer."
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
