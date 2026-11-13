"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Button,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Tab,
    Tabs,
    Tooltip,
    addToast
} from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import ConfirmModal from "@/components/common/ConfirmModal";
import PageShell from "@/components/common/PageShell";
import FolderPickerModal from "@/features/archive/components/FolderPickerModal";
import { ArchiveEntry, FolderSelection, InvoiceFolder } from "@/features/archive/Models";
import { Archive } from "@/features/archive/server/Repository";
import { archiveInvoiceHtmlAsync, getFolderName, resolveFolderAsync, saveBlob, toSafeFileName } from "@/features/archive/server/Service";
import { getIdTokenAsync } from "@/features/auth/getIdToken";
import { Profile } from "@/features/profile/Models";
import { Invoice, InvoiceItem } from "../Models";
import { sendInvoiceEmailAction } from "../server/Actions";
import { Invoices } from "../server/Repository";
import { getInvoiceIssues, recalculateInvoice } from "../server/Service";
import { ArchiveIcon, DownloadIcon, PaperAirplaneIcon, PrinterIcon, RestoreIcon } from "./Icons";
import InvoiceForm from "./InvoiceForm";
import InvoiceItemsForm from "./InvoiceItemsForm";
import InvoiceModal, { InvoiceEmailContent } from "./InvoiceModal";
import InvoicePreview from "./InvoicePreview";

type EditorTab = "form" | "preview";

async function getInvoiceHTML(): Promise<string> {
    const element = document.getElementById("print-area");
    if (!element) {
        throw new Error("Print area not found");
    }

    const styles = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
            } catch {
                return '';
            }
        })
        .join('\n');

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <style>${styles}</style>
            </head>
            <body>
                ${element.outerHTML}
            </body>
        </html>
    `;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Zkuste to znovu.";
}

interface InvoiceEditorProps {
    loadInvoice: Invoice;
    loadProfile: Profile;
    isSaved: boolean;
    archiveEntry: ArchiveEntry | null;
    folders: InvoiceFolder[];
}

export default function InvoiceEditor({ loadInvoice, loadProfile, isSaved: isInitiallySaved, archiveEntry: initialArchiveEntry, folders: initialFolders }: InvoiceEditorProps) {
    const [invoice, setInvoice] = useState<Invoice>(() => recalculateInvoice(loadInvoice));
    const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(recalculateInvoice(loadInvoice)));
    const [isSaved, setIsSaved] = useState(isInitiallySaved);
    const [issues, setIssues] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<EditorTab>("form");
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSendOpen, setIsSendOpen] = useState(false);
    const [leaveHref, setLeaveHref] = useState<string | null>(null);
    const [archiveEntry, setArchiveEntry] = useState(initialArchiveEntry);
    const [folders, setFolders] = useState(initialFolders);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isRestoreOpen, setIsRestoreOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const router = useRouter();

    const isArchived = archiveEntry !== null;
    const isBusy = isSaving || isSending || isArchiving;
    const isDirty = JSON.stringify(invoice) !== savedSnapshot;

    useEffect(() => {
        if (!isDirty) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };

        // Client-side links (navbar, logo) skip beforeunload, so confirm them here.
        const handleLinkClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const anchor = (event.target as Element | null)?.closest("a[href]");
            if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.origin !== window.location.origin) return;
            if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;

            event.preventDefault();
            event.stopPropagation();
            setLeaveHref(`${anchor.pathname}${anchor.search}`);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("click", handleLinkClick, true);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("click", handleLinkClick, true);
        };
    }, [isDirty]);

    const updateInvoice = (nextInvoice: Invoice) => {
        setInvoice(recalculateInvoice(nextInvoice));
        if (issues.length > 0) {
            setIssues([]);
        }
    };

    const showIssues = (foundIssues: string[]) => {
        setIssues(foundIssues);
        setActiveTab("form");
        window.scrollTo({ top: 0, behavior: "smooth" });
        addToast({ title: "Faktura není kompletní", color: "danger" });
    };

    // Returns false when the invoice is incomplete; throws when persisting fails.
    const saveAsync = async (): Promise<boolean> => {
        const foundIssues = getInvoiceIssues(invoice, { forSend: false });
        if (!isSaved && invoice.id.trim() && await Invoices.invoiceExistsAsync(invoice.id)) {
            foundIssues.unshift(`Faktura s číslem ${invoice.id} už existuje. Zvolte jiné číslo.`);
        }

        if (foundIssues.length > 0) {
            showIssues(foundIssues);
            return false;
        }

        const isStored = await Invoices.addInvoiceAsync(invoice);
        if (!isStored) {
            throw new Error("Faktura nebyla uložena. Zkuste to znovu.");
        }

        setSavedSnapshot(JSON.stringify(invoice));
        if (!isSaved) {
            setIsSaved(true);
            router.replace(`/invoice-editor?iid=${invoice.id}`);
        }

        return true;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (await saveAsync()) {
                addToast({ title: "Faktura uložena", color: "success" });
            }
        } catch (error) {
            console.error("Error saving invoice:", error);
            addToast({ title: "Fakturu se nepodařilo uložit", description: getErrorMessage(error), color: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendRequest = () => {
        const foundIssues = getInvoiceIssues(invoice, { forSend: true });
        if (foundIssues.length > 0) {
            showIssues(foundIssues);
            return;
        }

        setIsSendOpen(true);
    };

    const handleSend = async (emailContent: InvoiceEmailContent) => {
        setIsSending(true);
        try {
            const htmlContent = await getInvoiceHTML();

            if (!await saveAsync()) {
                setIsSendOpen(false);
                return;
            }

            await sendInvoiceEmailAction(await getIdTokenAsync(), loadProfile, invoice.customer.email!, emailContent, htmlContent, invoice.id);

            addToast({ title: "Faktura odeslána", description: invoice.customer.email, color: "success" });
            setIsSendOpen(false);
            router.push("/");
        } catch (error) {
            console.error("Error sending invoice:", error);
            addToast({ title: "Fakturu se nepodařilo odeslat", description: getErrorMessage(error), color: "danger" });
        } finally {
            setIsSending(false);
        }
    };

    const handleBack = () => {
        if (isDirty) {
            setLeaveHref("/");
        } else {
            router.push(isArchived ? "/archive" : "/");
        }
    };

    const handleArchiveRequest = () => {
        const foundIssues = getInvoiceIssues(invoice, { forSend: false });
        if (foundIssues.length > 0) {
            showIssues(foundIssues);
            return;
        }

        setIsArchiveOpen(true);
    };

    const handleArchive = async (selection: FolderSelection) : Promise<boolean> => {
        setIsArchiving(true);
        try {
            const htmlContent = await getInvoiceHTML();

            if ((isDirty || !isSaved) && !await saveAsync()) {
                setIsArchiveOpen(false);
                return false;
            }

            const { folderId, createdFolder } = await resolveFolderAsync(selection, loadProfile.uid);
            const allFolders = createdFolder ? [...folders, createdFolder] : folders;
            setFolders(allFolders);

            setArchiveEntry(await archiveInvoiceHtmlAsync(invoice.id, htmlContent, folderId, loadProfile.uid));
            setIsArchiveOpen(false);
            addToast({ title: "Faktura archivována", description: `Složka ${getFolderName(folderId, allFolders)}`, color: "success" });
            return true;
        } catch (error) {
            console.error("Error archiving invoice:", error);
            addToast({ title: "Fakturu se nepodařilo archivovat", description: "Zkuste to znovu.", color: "danger" });
            return false;
        } finally {
            setIsArchiving(false);
        }
    };

    const handleRestore = async () => {
        setIsRestoring(true);
        try {
            await Archive.restoreAsync(invoice.id);
            setArchiveEntry(null);
            setIsRestoreOpen(false);
            addToast({ title: "Faktura obnovena", description: "Fakturu můžete znovu upravovat a odeslat.", color: "success" });
        } catch (error) {
            console.error("Error restoring invoice:", error);
            addToast({ title: "Fakturu se nepodařilo obnovit", description: "Zkuste to znovu.", color: "danger" });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!archiveEntry) return;

        setIsDownloading(true);
        try {
            const pdf = await Archive.getPdfAsync(archiveEntry);
            saveBlob(new Blob([pdf], { type: "application/pdf" }), `Faktura-${toSafeFileName(invoice.id)}.pdf`);
        } catch (error) {
            console.error("Error downloading archived PDF:", error);
            addToast({ title: "PDF se nepodařilo stáhnout", description: "Zkontrolujte připojení a zkuste to znovu.", color: "danger" });
        } finally {
            setIsDownloading(false);
        }
    };

    const saveShortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘S" : "Ctrl+S";

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                if (!isBusy && !isArchived) handleSave();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    return (
        <PageShell
            isHeaderSticky
            onBack={handleBack}
            title={
                <span className="flex items-center gap-3">
                    {isSaved ? <span className="font-mono">{invoice.id}</span> : "Nová faktura"}
                    {isArchived && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-200 px-2 py-0.5 text-sm font-normal tracking-normal text-neutral-700">
                            <ArchiveIcon size={14} />
                            Archivováno
                        </span>
                    )}
                    <AnimatePresence>
                        {isDirty && (
                            <motion.span
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                className="inline-flex items-center gap-1.5 text-sm font-normal tracking-normal text-neutral-500"
                            >
                                <span className="size-2 rounded-full bg-brand" />
                                <span className="sr-only sm:not-sr-only">Neuloženo</span>
                            </motion.span>
                        )}
                    </AnimatePresence>
                </span>
            }
            actions={isArchived ? (
                <>
                    <Tooltip content="Tisk" radius="sm" delay={300}>
                        <Button isIconOnly radius="sm" variant="light" aria-label="Tisk" onPress={() => window.print()}>
                            <PrinterIcon size={20} />
                        </Button>
                    </Tooltip>
                    <Button radius="sm" variant="bordered" startContent={!isDownloading && <DownloadIcon size={18} />} isLoading={isDownloading} onPress={handleDownloadPdf}>
                        Stáhnout PDF
                    </Button>
                    <Button radius="sm" className="bg-ink text-white" startContent={<RestoreIcon size={18} />} onPress={() => setIsRestoreOpen(true)}>
                        Obnovit
                    </Button>
                </>
            ) : (
                <>
                    <Tooltip content="Tisk" radius="sm" delay={300}>
                        <Button isIconOnly radius="sm" variant="light" aria-label="Tisk" onPress={() => window.print()}>
                            <PrinterIcon size={20} />
                        </Button>
                    </Tooltip>
                    <Tooltip content="Archivovat" radius="sm" delay={300}>
                        <Button isIconOnly radius="sm" variant="light" aria-label="Archivovat" isDisabled={isBusy} onPress={handleArchiveRequest}>
                            <ArchiveIcon size={20} />
                        </Button>
                    </Tooltip>
                    <Tooltip content={`Uložit (${saveShortcut})`} radius="sm" delay={300}>
                        <Button radius="sm" variant="bordered" isLoading={isSaving} isDisabled={isSending || isArchiving} onPress={handleSave}>
                            Uložit
                        </Button>
                    </Tooltip>
                    <Button
                        radius="sm"
                        className="bg-ink text-white"
                        endContent={<PaperAirplaneIcon size={18} />}
                        isDisabled={isBusy}
                        onPress={handleSendRequest}
                    >
                        Odeslat
                    </Button>
                </>
            )}
        >
            {isArchived ? (
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between print:hidden">
                        <p>
                            Faktura je archivovaná ve složce <span className="font-medium text-ink">{getFolderName(archiveEntry.folderId, folders)}</span> od{"\u00a0"}
                            <span className="tabular-nums">{archiveEntry.archivedAt.toLocaleDateString("cs-CZ")}</span>. Pro úpravy ji obnovte.
                        </p>
                        <Button
                            as={Link}
                            href={`/archive?folder=${archiveEntry.folderId ?? "unfiled"}`}
                            size="sm"
                            radius="sm"
                            variant="light"
                            className="self-start sm:self-auto"
                        >
                            Otevřít složku
                        </Button>
                    </div>

                    {/* Read-only: the archived PDF snapshot is the source of truth. */}
                    <div className="overflow-x-auto print:overflow-visible">
                        <div className="mx-auto w-fit [zoom:0.42] sm:[zoom:0.72] md:[zoom:0.85] lg:[zoom:1] print:![zoom:1]">
                            <InvoicePreview invoice={invoice} />
                        </div>
                    </div>
                </div>
            ) : (
            <div className="flex flex-col gap-6">
                <Tabs
                    aria-label="Zobrazení editoru"
                    className="xl:hidden print:hidden"
                    classNames={{ tabList: "bg-white border border-neutral-200" }}
                    radius="sm"
                    selectedKey={activeTab}
                    onSelectionChange={(key) => setActiveTab(key as EditorTab)}
                >
                    <Tab key="form" title="Údaje" />
                    <Tab key="preview" title="Náhled" />
                </Tabs>

                <AnimatePresence initial={false}>
                    {issues.length > 0 && (
                        <motion.div
                            role="alert"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden print:hidden"
                        >
                            <div className="rounded-lg border border-danger-200 bg-danger-50 px-5 py-4 text-sm text-danger-700">
                                <p className="font-semibold">Fakturu nelze dokončit, doplňte:</p>
                                <ul className="mt-2 list-disc space-y-1 pl-4">
                                    {issues.map(issue => <li key={issue}>{issue}</li>)}
                                </ul>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] items-start">
                    {/* Form */}
                    <div className={`${activeTab === "form" ? "flex" : "hidden"} xl:flex flex-col gap-6 min-w-0 print:hidden`}>
                        <InvoiceForm
                            invoice={invoice}
                            isIdReadOnly={isSaved}
                            onChange={updateInvoice}
                        />
                        <InvoiceItemsForm
                            invoice={invoice}
                            onChange={(items: InvoiceItem[]) => updateInvoice({ ...invoice, items: items })}
                        />
                    </div>

                    {/* Preview – the zoom wrapper stays outside #print-area so the PDF is unaffected */}
                    <div className={`${activeTab === "preview" ? "block" : "hidden"} xl:block print:!block min-w-0`}>
                        <div className="overflow-x-auto print:overflow-visible">
                            <div className="w-fit [zoom:0.42] sm:[zoom:0.72] md:[zoom:0.85] lg:[zoom:1] xl:[zoom:0.75] 2xl:[zoom:1] print:![zoom:1]">
                                <InvoicePreview invoice={invoice} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            <FolderPickerModal
                isOpen={isArchiveOpen}
                title="Archivovat fakturu"
                description={isDirty || !isSaved
                    ? "Faktura se nejdřív uloží. Pak se uloží její PDF snímek a fakturu nepůjde upravovat ani odeslat, dokud ji neobnovíte."
                    : "Uloží se PDF snímek faktury. Archivovanou fakturu nelze upravovat ani odeslat, dokud ji neobnovíte."}
                confirmLabel="Archivovat"
                folders={folders}
                isBusy={isArchiving}
                onClose={() => setIsArchiveOpen(false)}
                onConfirm={handleArchive}
            />

            <ConfirmModal
                isOpen={isRestoreOpen}
                title="Obnovit fakturu?"
                description="Faktura se vrátí mezi aktivní a půjde znovu upravovat. Uložený PDF snímek se smaže, při další archivaci vznikne nový."
                confirmLabel="Obnovit"
                isLoading={isRestoring}
                onClose={() => setIsRestoreOpen(false)}
                onConfirm={handleRestore}
            />

            <InvoiceModal
                invoice={invoice}
                sender={loadProfile}
                isOpen={isSendOpen}
                isSending={isSending}
                onClose={() => setIsSendOpen(false)}
                onSend={handleSend}
            />

            <Modal isOpen={leaveHref !== null} onOpenChange={(open) => !open && setLeaveHref(null)} radius="sm">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Zahodit neuložené změny?</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-neutral-600">Změny ve faktuře se ztratí. Pokud je chcete zachovat, zůstaňte a fakturu uložte.</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button radius="sm" variant="light" onPress={onClose}>
                                    Zůstat
                                </Button>
                                <Button radius="sm" color="danger" variant="flat" onPress={() => router.push(leaveHref ?? "/")}>
                                    Zahodit
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </PageShell>
    );
}
