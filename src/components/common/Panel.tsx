import React from "react";

interface PanelProps {
    title?: string;
    actions?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export default function Panel({ title, actions, className = "", children }: PanelProps) {
    return (
        <section className={`bg-white border border-neutral-200 rounded-lg p-5 md:p-6 ${className}`}>
            {(title || actions) && (
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5">
                    {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            {children}
        </section>
    );
}
