import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "くじびき",
  description: "ランダムに席順を決めるアプリ",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
