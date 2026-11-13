"use client";

import { Spinner } from "@heroui/react";

interface LoadingStateProps {
    label?: string;
    isFullPage?: boolean;
}

export default function LoadingState({ label = "Načítání…", isFullPage = true }: LoadingStateProps) {
    return (
        <div role="status" className={`flex flex-col items-center justify-center gap-3 ${isFullPage ? "min-h-[60vh]" : "py-12"}`}>
            <Spinner color="default" aria-hidden="true" />
            <p className="text-sm text-neutral-500">{label}</p>
        </div>
    );
}
