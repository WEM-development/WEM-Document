"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { ArrowLeftIcon } from "@/features/invoice/components/Icons";

interface PageShellProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    backHref?: string;
    onBack?: () => void;
    isHeaderSticky?: boolean;
    children: React.ReactNode;
}

export default function PageShell({ title, description, actions, backHref, onBack, isHeaderSticky = false, children }: PageShellProps) {
    const hasBack = Boolean(backHref || onBack);
    const stickyClassName = "sticky top-16 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 -mt-6 md:-mt-8 py-3 md:py-4 bg-mist border-b border-neutral-200";

    return (
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            <header className={`mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 print:hidden ${isHeaderSticky ? stickyClassName : ""}`}>
                <div className="flex min-w-0 items-center gap-2">
                    {hasBack && (
                        <Button
                            isIconOnly
                            radius="sm"
                            variant="light"
                            aria-label="Zpět"
                            className="-ml-2 shrink-0"
                            {...(backHref ? { as: Link, href: backHref } : { onPress: onBack })}
                        >
                            <ArrowLeftIcon size={20} />
                        </Button>
                    )}
                    <div className="min-w-0">
                        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-ink">{title}</h1>
                        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
                    </div>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </header>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                {children}
            </motion.div>
        </div>
    );
}
