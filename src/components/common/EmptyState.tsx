import React from "react";

interface EmptyStateProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
            <div className="flex max-w-sm flex-col gap-1">
                <p className="text-base font-semibold text-ink">{title}</p>
                {description && <p className="text-sm text-neutral-500">{description}</p>}
            </div>
            {action}
        </div>
    );
}
