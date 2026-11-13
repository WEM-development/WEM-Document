"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { FirebaseError } from "firebase/app";
import { browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { motion } from "framer-motion";
import { auth } from "@/features/firebase/config";
import { Profiles } from "@/features/profile/server/Repository";

const dismissedPopupCodes = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

function GoogleIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
    );
}

export default function Page() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver);
            const profile = await Profiles.getProfileAsync(result.user.uid);

            router.push(profile ? "/" : `/auth-error?uid=${result.user.uid}`);
        } catch (error) {
            setIsLoading(false);
            if (error instanceof FirebaseError && dismissedPopupCodes.includes(error.code)) return;

            console.error("Auth error:", error);
            setError("Přihlášení se nezdařilo. Zkuste to znovu.");
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full max-w-sm bg-white border border-neutral-200 rounded-lg p-8"
            >
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Přihlášení</h1>
                <p className="mt-1 text-sm text-neutral-500">Správa faktur WEM. Přihlaste se firemním účtem Google.</p>

                {error && (
                    <p role="alert" className="mt-4 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
                        {error}
                    </p>
                )}

                <Button
                    fullWidth
                    radius="sm"
                    variant="bordered"
                    className="mt-6 h-12 font-medium"
                    startContent={!isLoading && <GoogleIcon />}
                    isLoading={isLoading}
                    onPress={handleGoogleSignIn}
                >
                    Pokračovat přes Google
                </Button>
            </motion.div>
        </div>
    );
}
