"use client";

import "./globals.css";
import React from "react";
import { useRouter } from "next/navigation";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { MotionConfig } from "framer-motion";
import AppNavbar from "@/components/navigation/AppNavbar";
import { geistMono, geistSans } from "@/config/fonts";
import { AuthProvider } from "@/features/auth/AuthContext";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const router = useRouter();

    return (
        <html lang="cs" suppressHydrationWarning>
            <head>
                <title>WEM – Fakturace</title>
                <meta name="description" content="Správa a odesílání faktur WEM" />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <HeroUIProvider locale="cs-CZ" navigate={router.push}>
                    <ToastProvider placement="bottom-right" />
                    <AuthProvider>
                        <MotionConfig reducedMotion="user">
                            <div className="min-h-screen bg-mist">
                                <AppNavbar />
                                <main>
                                    {children}
                                </main>
                            </div>
                        </MotionConfig>
                    </AuthProvider>
                </HeroUIProvider>
            </body>
        </html>
    );
}
