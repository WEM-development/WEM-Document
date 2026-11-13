"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, addToast } from "@heroui/react";
import { motion } from "framer-motion";
import LoadingState from "@/components/common/LoadingState";
import { CopyIcon } from "@/features/invoice/components/Icons";

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const uid = searchParams.get("uid");

    const copyUid = async () => {
        if (!uid) return;

        try {
            await navigator.clipboard.writeText(uid);
            addToast({ title: "ID zkopírováno", color: "success" });
        } catch (error) {
            console.error("Clipboard error:", error);
            addToast({ title: "ID se nepodařilo zkopírovat", color: "danger" });
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full max-w-md bg-white border border-neutral-200 rounded-lg p-8"
            >
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Účet není aktivní</h1>
                <p className="mt-2 text-sm text-neutral-600">Váš účet zatím nemá přístup. Pošlete správci své ID, po aktivaci se můžete přihlásit znovu.</p>

                {uid && (
                    <div className="mt-6 flex items-center gap-2 rounded-lg bg-neutral-100 py-1.5 pl-4 pr-1.5">
                        <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{uid}</code>
                        <Button isIconOnly size="sm" radius="sm" variant="light" aria-label="Kopírovat ID" onPress={copyUid}>
                            <CopyIcon size={18} />
                        </Button>
                    </div>
                )}

                <div className="mt-6 flex flex-col gap-1 text-sm">
                    <a href="mailto:msestaubr@gmail.com" className="w-fit text-ink hover:underline underline-offset-4">msestaubr@gmail.com</a>
                    <a href="tel:+420775128978" className="w-fit text-ink tabular-nums whitespace-nowrap hover:underline underline-offset-4">+420 775 128 978</a>
                </div>

                <Button as={Link} href="/auth" radius="sm" variant="bordered" className="mt-8">
                    Zpět na přihlášení
                </Button>
            </motion.div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<LoadingState />}>
            <AuthErrorContent />
        </Suspense>
    );
}
