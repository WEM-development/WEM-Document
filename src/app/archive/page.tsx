"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Button,
    Input,
    Selection,
    SortDescriptor,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    addToast
} from "@heroui/react";
import ConfirmModal from "@/components/common/ConfirmModal";
import EmptyState from "@/components/common/EmptyState";
import LoadingState from "@/components/common/LoadingState";
import PageShell from "@/components/common/PageShell";
import Panel from "@/components/common/Panel";
import FolderList, { allFoldersKey, unfiledFolderKey } from "@/features/archive/components/FolderList";
import FolderNameModal from "@/features/archive/components/FolderNameModal";
import FolderPickerModal from "@/features/archive/components/FolderPickerModal";
import { ArchiveEntry, FolderSelection, InvoiceFolder } from "@/features/archive/Models";
import { Archive, Folders } from "@/features/archive/server/Repository";
import { createArchiveZipAsync, formatInvoiceCount, getFolderName, getZipFileName, resolveFolderAsync, saveBlob } from "@/features/archive/server/Service";
import { useRequireProfile } from "@/features/auth/useRequireProfile";
import { DownloadIcon, RestoreIcon, SearchIcon } from "@/features/invoice/components/Icons";
import { Invoice } from "@/features/invoice/Models";
import { Invoices } from "@/features/invoice/server/Repository";

type LoadStatus = "loading" | "error" | "ready";
type ColumnKey = "id" | "customer" | "publishDate" | "amount" | "archivedAt" | "folder";
type Progress = { done: number, total: number };

interface ArchiveRow {
    id: string;
    entry: ArchiveEntry;
    invoice: Invoice | undefined;
}

const columnDefinitions: { key: ColumnKey, name: string, className: string }[] = [
    { key: "id", name: "Číslo", className: "hidden sm:table-cell" },
    { key: "customer", name: "Odběratel", className: "" },
    { key: "publishDate", name: "Vystaveno", className: "hidden xl:table-cell" },
    { key: "folder", name: "Složka", className: "hidden md:table-cell" },
    { key: "archivedAt", name: "Archivováno", className: "hidden lg:table-cell" },
    { key: "amount", name: "Částka", className: "text-right" }
];

const currencyFormatter = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" });

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("cs-CZ");
}

function getSortValue(row: ArchiveRow, column: ColumnKey, folders: InvoiceFolder[]) : string | number {
    switch (column) {
        case "id": return row.id;
        case "customer": return (row.invoice?.customer.name ?? "").toLocaleLowerCase("cs-CZ");
        case "publishDate": return row.invoice ? new Date(row.invoice.publishDate).getTime() : 0;
        case "amount": return row.invoice?.paymentDetails.amount ?? 0;
        case "archivedAt": return row.entry.archivedAt.getTime();
        case "folder": return getFolderName(row.entry.folderId, folders).toLocaleLowerCase("cs-CZ");
    }
}

function matchesFolder(entry: ArchiveEntry, folderKey: string) {
    if (folderKey === allFoldersKey) return true;
    if (folderKey === unfiledFolderKey) return entry.folderId === null;
    return entry.folderId === folderKey;
}

function ArchiveContent() {
    const { profile } = useRequireProfile();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [entries, setEntries] = useState<ArchiveEntry[]>([]);
    const [folders, setFolders] = useState<InvoiceFolder[]>([]);
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [reloadCount, setReloadCount] = useState(0);
    const [search, setSearch] = useState("");
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: "archivedAt", direction: "descending" });
    const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
    const [downloadProgress, setDownloadProgress] = useState<Progress | null>(null);
    const [isMoveOpen, setIsMoveOpen] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [isRestoreOpen, setIsRestoreOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [folderModal, setFolderModal] = useState<{ folder: InvoiceFolder | null } | null>(null);
    const [isSavingFolder, setIsSavingFolder] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<InvoiceFolder | null>(null);
    const [isDeletingFolder, setIsDeletingFolder] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        if (!profile) return;

        let isCancelled = false;

        const loadArchive = async () => {
            try {
                const [allInvoices, allEntries, allFolders] = await Promise.all([
                    Invoices.getAllInvoicesAsync(),
                    Archive.getEntriesAsync(),
                    Folders.getAllAsync()
                ]);
                if (isCancelled) return;

                setInvoices(allInvoices);
                setEntries(allEntries);
                setFolders(allFolders);
                setStatus("ready");
            } catch (error) {
                console.error("Error loading archive:", error);
                if (!isCancelled) setStatus("error");
            }
        };

        loadArchive();

        return () => {
            isCancelled = true;
        };
    }, [profile, reloadCount]);

    const requestedFolderKey = searchParams.get("folder") ?? allFoldersKey;
    const isKnownFolder = requestedFolderKey === allFoldersKey || requestedFolderKey === unfiledFolderKey || folders.some(folder => folder.id === requestedFolderKey);
    const folderKey = status !== "ready" || isKnownFolder ? requestedFolderKey : allFoldersKey;
    const currentFolder = folders.find(folder => folder.id === folderKey) ?? null;

    const counts = useMemo(() => {
        const result: Record<string, number> = { [allFoldersKey]: entries.length, [unfiledFolderKey]: 0 };
        entries.forEach(entry => {
            const key = entry.folderId ?? unfiledFolderKey;
            result[key] = (result[key] ?? 0) + 1;
        });
        return result;
    }, [entries]);

    const visibleRows = useMemo(() => {
        const invoicesById = new Map(invoices.map(invoice => [invoice.id, invoice]));
        const query = search.trim().toLocaleLowerCase("cs-CZ");

        const rows: ArchiveRow[] = entries
            .filter(entry => matchesFolder(entry, folderKey))
            .map(entry => ({ id: entry.invoiceId, entry, invoice: invoicesById.get(entry.invoiceId) }))
            .filter(row => !query ||
                row.id.toLocaleLowerCase("cs-CZ").includes(query) ||
                (row.invoice?.customer.name ?? "").toLocaleLowerCase("cs-CZ").includes(query) ||
                (row.invoice?.customer.ico ?? "").includes(query));

        const column = sortDescriptor.column as ColumnKey;
        const direction = sortDescriptor.direction === "descending" ? -1 : 1;

        return rows.sort((a, b) => {
            const first = getSortValue(a, column, folders);
            const second = getSortValue(b, column, folders);
            return (first < second ? -1 : first > second ? 1 : 0) * direction;
        });
    }, [entries, invoices, folders, folderKey, search, sortDescriptor]);

    if (!profile) {
        return <LoadingState />;
    }

    const isLoading = status === "loading";
    const columns = columnDefinitions.filter(column => column.key !== "folder" || folderKey === allFoldersKey);
    const columnClassName = Object.fromEntries(columns.map(column => [column.key, column.className])) as Record<ColumnKey, string>;
    const selectedRows = selectedKeys === "all" ? visibleRows : visibleRows.filter(row => selectedKeys.has(row.id));
    const folderLabel = folderKey === allFoldersKey ? "Vše" : getFolderName(currentFolder?.id ?? null, folders);

    const selectFolder = (key: string) => {
        setSelectedKeys(new Set());
        router.replace(key === allFoldersKey ? "/archive" : `/archive?folder=${encodeURIComponent(key)}`);
    };

    const handleDownload = async () => {
        const rows = selectedRows.length > 0 ? selectedRows : visibleRows;
        if (rows.length === 0 || downloadProgress) return;

        setDownloadProgress({ done: 0, total: rows.length });
        try {
            const zip = await createArchiveZipAsync(
                rows.map(row => row.entry),
                folders,
                folderKey === allFoldersKey,
                done => setDownloadProgress({ done, total: rows.length })
            );
            saveBlob(zip, getZipFileName(selectedRows.length > 0 ? "vyber" : folderKey === allFoldersKey ? "archiv" : folderLabel));
            addToast({ title: "ZIP připraven", description: formatInvoiceCount(rows.length), color: "success" });
        } catch (error) {
            console.error("Error creating archive ZIP:", error);
            addToast({ title: "ZIP se nepodařilo vytvořit", description: "Některé PDF se nepodařilo stáhnout. Zkontrolujte připojení a zkuste to znovu.", color: "danger" });
        } finally {
            setDownloadProgress(null);
        }
    };

    const handleMove = async (selection: FolderSelection) : Promise<boolean> => {
        const ids = selectedRows.map(row => row.id);
        setIsMoving(true);
        try {
            const { folderId, createdFolder } = await resolveFolderAsync(selection, profile.uid);
            const allFolders = createdFolder ? [...folders, createdFolder].sort((a, b) => a.name.localeCompare(b.name, "cs-CZ")) : folders;
            setFolders(allFolders);

            await Archive.moveAsync(ids, folderId);
            setEntries(current => current.map(entry => ids.includes(entry.invoiceId) ? { ...entry, folderId } : entry));
            setSelectedKeys(new Set());
            setIsMoveOpen(false);
            addToast({ title: "Faktury přesunuty", description: `${formatInvoiceCount(ids.length)} – složka ${getFolderName(folderId, allFolders)}`, color: "success" });
            return true;
        } catch (error) {
            console.error("Error moving archived invoices:", error);
            addToast({ title: "Faktury se nepodařilo přesunout", description: "Zkuste to znovu.", color: "danger" });
            return false;
        } finally {
            setIsMoving(false);
        }
    };

    const handleRestore = async () => {
        const ids = selectedRows.map(row => row.id);
        const restoredIds: string[] = [];
        setIsRestoring(true);

        for (const id of ids) {
            try {
                await Archive.restoreAsync(id);
                restoredIds.push(id);
            } catch (error) {
                console.error(`Error restoring invoice ${id}:`, error);
            }
        }

        const failedIds = ids.filter(id => !restoredIds.includes(id));
        setEntries(current => current.filter(entry => !restoredIds.includes(entry.invoiceId)));
        setSelectedKeys(new Set(failedIds));
        setIsRestoring(false);
        setIsRestoreOpen(false);

        if (restoredIds.length > 0) {
            addToast({ title: restoredIds.length === 1 ? "Faktura obnovena" : "Faktury obnoveny", description: `Zpět mezi aktivními: ${formatInvoiceCount(restoredIds.length)}.`, color: "success" });
        }
        if (failedIds.length > 0) {
            addToast({ title: `Neobnoveno: ${formatInvoiceCount(failedIds.length)}`, description: `${failedIds.join(", ")}. Zůstaly označené, zkuste to znovu.`, color: "danger" });
        }
    };

    const handleSaveFolder = async (name: string) : Promise<boolean> => {
        const folder = folderModal?.folder ?? null;
        setIsSavingFolder(true);
        try {
            if (folder) {
                await Folders.renameAsync(folder.id, name);
                setFolders(current => current.map(item => item.id === folder.id ? { ...item, name } : item).sort((a, b) => a.name.localeCompare(b.name, "cs-CZ")));
                addToast({ title: "Složka přejmenována", description: name, color: "success" });
            } else {
                const createdFolder = await Folders.addAsync(name, profile.uid);
                setFolders(current => [...current, createdFolder].sort((a, b) => a.name.localeCompare(b.name, "cs-CZ")));
                selectFolder(createdFolder.id);
                addToast({ title: "Složka vytvořena", description: name, color: "success" });
            }

            setFolderModal(null);
            return true;
        } catch (error) {
            console.error("Error saving folder:", error);
            addToast({ title: "Složku se nepodařilo uložit", description: "Zkuste to znovu.", color: "danger" });
            return false;
        } finally {
            setIsSavingFolder(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!folderToDelete) return;

        setIsDeletingFolder(true);
        try {
            await Folders.removeAsync(folderToDelete.id);
            setFolders(current => current.filter(folder => folder.id !== folderToDelete.id));
            setEntries(current => current.map(entry => entry.folderId === folderToDelete.id ? { ...entry, folderId: null } : entry));
            if (folderKey === folderToDelete.id) selectFolder(unfiledFolderKey);

            addToast({ title: "Složka smazána", description: folderToDelete.name, color: "success" });
            setFolderToDelete(null);
        } catch (error) {
            console.error("Error deleting folder:", error);
            addToast({ title: "Složku se nepodařilo smazat", description: "Zkuste to znovu.", color: "danger" });
        } finally {
            setIsDeletingFolder(false);
        }
    };

    const downloadCount = selectedRows.length > 0 ? selectedRows.length : visibleRows.length;
    const downloadButton = (
        <Button
            radius="sm"
            className="bg-ink text-white"
            startContent={!downloadProgress && <DownloadIcon size={18} />}
            isLoading={downloadProgress !== null}
            isDisabled={isLoading || downloadCount === 0}
            onPress={handleDownload}
        >
            {downloadProgress
                ? <span className="tabular-nums">Stahování {downloadProgress.done}/{downloadProgress.total}</span>
                : selectedRows.length > 0 ? `Stáhnout vybrané (${selectedRows.length})` : "Stáhnout ZIP"}
        </Button>
    );

    const renderCell = (row: ArchiveRow, columnKey: ColumnKey) => {
        switch (columnKey) {
            case "id":
                return <span className="font-mono text-sm text-neutral-600">{row.id}</span>;
            case "customer":
                return (
                    <>
                        <p className="font-medium text-ink">{row.invoice?.customer.name ?? "Neznámý odběratel"}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-neutral-500 md:hidden">
                            <span className="font-mono sm:hidden">{row.id}</span>
                            {folderKey === allFoldersKey && <span>{getFolderName(row.entry.folderId, folders)}</span>}
                        </p>
                    </>
                );
            case "publishDate":
                return <span className="tabular-nums text-neutral-600">{row.invoice ? formatDate(row.invoice.publishDate) : "–"}</span>;
            case "folder":
                return <span className="text-neutral-600">{getFolderName(row.entry.folderId, folders)}</span>;
            case "archivedAt":
                return <span className="tabular-nums text-neutral-600">{formatDate(row.entry.archivedAt)}</span>;
            case "amount":
                return (
                    <span className="font-medium tabular-nums whitespace-nowrap text-ink">
                        {row.invoice ? currencyFormatter.format(row.invoice.paymentDetails.amount) : "–"}
                    </span>
                );
        }
    };

    const emptyContent = search.trim() ? (
        <EmptyState
            title="Nic nenalezeno"
            description="Žádná archivovaná faktura neodpovídá hledání."
            action={<Button radius="sm" variant="bordered" onPress={() => setSearch("")}>Zrušit hledání</Button>}
        />
    ) : entries.length === 0 ? (
        <EmptyState
            title="Archiv je prázdný"
            description={"Na přehledu faktur je označte a\u00a0zvolte „Archivovat“. Uloží se jejich PDF."}
            action={<Button as={Link} href="/" radius="sm" variant="bordered">Přejít na faktury</Button>}
        />
    ) : (
        <EmptyState
            title="Složka je prázdná"
            description="Přesuňte sem archivované faktury z jiné složky."
        />
    );

    return (
        <PageShell
            title="Archiv"
            description="Archivované faktury s uloženým PDF, stažení po složkách jako ZIP"
            actions={downloadButton}
        >
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <FolderList
                    folders={folders}
                    counts={counts}
                    selectedKey={folderKey}
                    isLoading={isLoading}
                    onSelect={selectFolder}
                    onCreate={() => setFolderModal({ folder: null })}
                    onRename={(folder) => setFolderModal({ folder })}
                    onDelete={setFolderToDelete}
                />

                <Panel title={folderLabel}>
                    <Input
                        label="Hledat"
                        labelPlacement="outside-top"
                        placeholder="Číslo faktury, odběratel nebo IČO"
                        radius="sm"
                        variant="flat"
                        isClearable
                        className="mb-4 md:max-w-sm"
                        startContent={<SearchIcon size={18} className="text-neutral-400 shrink-0" />}
                        value={search}
                        onValueChange={setSearch}
                    />

                    {selectedRows.length > 0 && (
                        <div role="region" aria-label={"Akce s\u00a0vybranými fakturami"} className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-neutral-100 px-4 py-2">
                            <p className="text-sm font-medium text-ink tabular-nums">Vybráno: {formatInvoiceCount(selectedRows.length)}</p>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" radius="sm" variant="bordered" className="bg-white" onPress={() => setIsMoveOpen(true)}>
                                    Přesunout
                                </Button>
                                <Button size="sm" radius="sm" variant="bordered" className="bg-white" startContent={<RestoreIcon size={16} />} onPress={() => setIsRestoreOpen(true)}>
                                    Obnovit
                                </Button>
                                <Button size="sm" radius="sm" variant="light" onPress={() => setSelectedKeys(new Set())}>
                                    Zrušit výběr
                                </Button>
                            </div>
                        </div>
                    )}

                    {status === "error" ? (
                        <EmptyState
                            title="Archiv se nepodařilo načíst"
                            description="Zkontrolujte připojení a zkuste to znovu."
                            action={
                                <Button
                                    radius="sm"
                                    variant="bordered"
                                    onPress={() => {
                                        setStatus("loading");
                                        setReloadCount(count => count + 1);
                                    }}
                                >
                                    Zkusit znovu
                                </Button>
                            }
                        />
                    ) : (
                        <div className="-mx-5 md:-mx-6">
                            <Table
                                aria-label={`Archivované faktury – ${folderLabel}`}
                                removeWrapper
                                color="default"
                                selectionMode="multiple"
                                selectedKeys={selectedKeys}
                                onSelectionChange={setSelectedKeys}
                                sortDescriptor={sortDescriptor}
                                onSortChange={setSortDescriptor}
                                onRowAction={(key) => router.push(`/invoice-editor?iid=${encodeURIComponent(String(key))}`)}
                                classNames={{
                                    th: "bg-transparent text-sm font-medium text-neutral-500 border-b border-neutral-200 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6",
                                    td: "py-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6",
                                    tr: "cursor-pointer border-b border-neutral-100 last:border-0 transition-colors hover:bg-neutral-50"
                                }}
                            >
                                <TableHeader columns={columns}>
                                    {(column) => (
                                        <TableColumn key={column.key} allowsSorting className={column.className}>
                                            {column.name}
                                        </TableColumn>
                                    )}
                                </TableHeader>
                                <TableBody
                                    items={visibleRows}
                                    isLoading={isLoading}
                                    loadingContent={<LoadingState label="Načítání archivu…" isFullPage={false} />}
                                    emptyContent={isLoading ? " " : emptyContent}
                                >
                                    {(row) => (
                                        <TableRow key={row.id}>
                                            {(columnKey) => (
                                                <TableCell className={columnClassName[columnKey as ColumnKey]}>
                                                    {renderCell(row, columnKey as ColumnKey)}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Panel>
            </div>

            <FolderPickerModal
                isOpen={isMoveOpen}
                title={selectedRows.length === 1 ? "Přesunout fakturu" : `Přesunout ${formatInvoiceCount(selectedRows.length)}`}
                confirmLabel="Přesunout"
                folders={folders}
                initialFolderId={currentFolder?.id ?? null}
                isBusy={isMoving}
                onClose={() => setIsMoveOpen(false)}
                onConfirm={handleMove}
            />

            <ConfirmModal
                isOpen={isRestoreOpen}
                title={selectedRows.length === 1 ? "Obnovit fakturu?" : `Obnovit ${formatInvoiceCount(selectedRows.length)}?`}
                description={"Faktury se vrátí mezi aktivní a\u00a0půjdou znovu upravovat. Jejich uložené PDF snímky se smažou, při další archivaci vzniknou nové."}
                confirmLabel="Obnovit"
                isLoading={isRestoring}
                onClose={() => setIsRestoreOpen(false)}
                onConfirm={handleRestore}
            />

            <FolderNameModal
                isOpen={folderModal !== null}
                folder={folderModal?.folder}
                folders={folders}
                isSaving={isSavingFolder}
                onClose={() => setFolderModal(null)}
                onSubmit={handleSaveFolder}
            />

            <ConfirmModal
                isOpen={folderToDelete !== null}
                title="Smazat složku?"
                description={folderToDelete && (
                    <>
                        Složka <span className="font-medium text-ink">{folderToDelete.name}</span> se smaže.{" "}
                        Faktury v{"\u00a0"}ní ({counts[folderToDelete.id] ?? 0}) se přesunou do „Nezařazeno“, žádné PDF se neztratí.
                    </>
                )}
                confirmLabel="Smazat"
                isDestructive
                isLoading={isDeletingFolder}
                onClose={() => setFolderToDelete(null)}
                onConfirm={handleDeleteFolder}
            />
        </PageShell>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ArchiveContent />
        </Suspense>
    );
}
