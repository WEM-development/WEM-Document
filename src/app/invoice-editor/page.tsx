"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import EmptyState from "@/components/common/EmptyState";
import LoadingState from "@/components/common/LoadingState";
import PageShell from "@/components/common/PageShell";
import Panel from "@/components/common/Panel";
import { ArchiveEntry, InvoiceFolder } from "@/features/archive/Models";
import { Archive, Folders } from "@/features/archive/server/Repository";
import { useRequireProfile } from "@/features/auth/useRequireProfile";
import InvoiceEditor from "@/features/invoice/components/InvoiceEditor";
import { Invoice } from "@/features/invoice/Models";
import { Invoices } from "@/features/invoice/server/Repository";
import { generateBlankInvoice, generateNextInvoiceId } from "@/features/invoice/server/Service";

type LoadResult = { iid: string | null, invoice: Invoice | null, archiveEntry: ArchiveEntry | null, folders: InvoiceFolder[], hasFailed: boolean };

function InvoiceEditorContent() {
    const { profile } = useRequireProfile();
    const [result, setResult] = useState<LoadResult | null>(null);
    const [reloadCount, setReloadCount] = useState(0);
    const searchParams = useSearchParams();
    const iid = searchParams.get("iid");

    useEffect(() => {
        if (!profile) return;

        let isCancelled = false;

        const loadInvoice = async () => {
            try {
                const [invoice, archiveEntry, folders] = await Promise.all([
                    iid !== null
                        ? Invoices.getInvoiceAsync(iid)
                        : generateNextInvoiceId().then(invoiceId => generateBlankInvoice(profile, invoiceId)),
                    iid !== null ? Archive.getEntryAsync(iid) : Promise.resolve(null),
                    Folders.getAllAsync()
                ]);

                if (!isCancelled) setResult({ iid, invoice, archiveEntry, folders, hasFailed: false });
            } catch (error) {
                console.error("Error loading invoice:", error);
                if (!isCancelled) setResult({ iid, invoice: null, archiveEntry: null, folders: [], hasFailed: true });
            }
        };

        loadInvoice();

        return () => {
            isCancelled = true;
        };
    }, [profile, iid, reloadCount]);

    // After the first save the URL gains ?iid of the same invoice; keep the editor mounted.
    const isStale = result === null || (result.iid !== iid && result.invoice?.id !== iid);

    if (!profile || isStale) {
        return <LoadingState label={iid ? "Načítání faktury…" : "Příprava nové faktury…"} />;
    }

    if (result.hasFailed || !result.invoice) {
        return (
            <PageShell title="Faktura" backHref="/">
                <Panel>
                    <EmptyState
                        title={result.hasFailed ? "Fakturu se nepodařilo načíst" : "Faktura neexistuje"}
                        description={result.hasFailed
                            ? "Zkontrolujte připojení a zkuste to znovu."
                            : `Faktura č. ${iid} nebyla nalezena. Možná byla smazána nebo je odkaz chybný.`}
                        action={
                            <div className="flex flex-wrap justify-center gap-2">
                                {result.hasFailed && (
                                    <Button
                                        radius="sm"
                                        variant="bordered"
                                        onPress={() => {
                                            setResult(null);
                                            setReloadCount(count => count + 1);
                                        }}
                                    >
                                        Zkusit znovu
                                    </Button>
                                )}
                                <Button as={Link} href="/" radius="sm" variant="light">
                                    Zpět na faktury
                                </Button>
                            </div>
                        }
                    />
                </Panel>
            </PageShell>
        );
    }

    return (
        <InvoiceEditor
            key={result.invoice.id}
            loadInvoice={result.invoice}
            loadProfile={profile}
            isSaved={result.iid !== null}
            archiveEntry={result.archiveEntry}
            folders={result.folders}
        />
    );
}

export default function Page() {
    return (
        <Suspense fallback={<LoadingState />}>
            <InvoiceEditorContent />
        </Suspense>
    );
}
