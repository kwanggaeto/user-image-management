import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "고객 업로드 이미지 관리",
  description: "국립중앙도서관 고객 업로드 이미지 관리 서버",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
