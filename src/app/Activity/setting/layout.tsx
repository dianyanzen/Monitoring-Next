// 📄 src/app/setting/ChangePass/layout.tsx
import "../../globals.css";    
import MainLayout from "./mainlayout";

export const metadata = {
   title: "Monalisa System - Dashboard",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="/assets/material-design-iconic-font/css/materialdesignicons.min.css"
        />
      </head>
      <body className="bg-[#0b0b0d] text-gray-100 min-h-screen overflow-x-hidden">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
