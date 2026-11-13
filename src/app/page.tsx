"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Button,
    Input,
    Selection,
    Skeleton,
    SortDescriptor,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tabs,
    addToast
} from "@heroui/react";
import EmptyState from "@/components/common/EmptyState";
import LoadingState from "@/components/common/LoadingState";
import PageShell from "@/components/common/PageShell";
import Panel from "@/components/common/Panel";
import FolderPickerModal from "@/features/archive/components/FolderPickerModal";
import { ArchiveEntry, FolderSelection, InvoiceFolder } from "@/features/archive/Models";
import { Archive, Folders } from "@/features/archive/server/Repository";
import { archiveInvoicesAsync, formatInvoiceCount, getFolderName, resolveFolderAsync } from "@/features/archive/server/Service";
import { useRequireProfile } from "@/features/auth/useRequireProfile";
import { ArchiveIcon, PlusIcon, SearchIcon } from "@/features/invoice/components/Icons";
import { Invoice } from "@/features/invoice/Models";
import { Invoices } from "@/features/invoice/server/Repository";

type LoadStatus = "loading" | "error" | "ready";
type SortColumn = "id" | "customer" | "publishDate" | "paymentDate" | "amount";
type StatusFilter = "all" | "due" | "overdue";

// Shared by header and cells so hidden columns stay aligned on small screens.
const columns: { key: SortColumn | "status", name: string, className: string }[] = [
    { key: "id", name: "Číslo", className: "hidden sm:table-cell" },
    { key: "customer", name: "Odběratel", className: "" },
    { key: "publishDate", name: "Vystaveno", className: "hidden lg:table-cell" },
    { key: "paymentDate", name: "Splatnost", className: "hidden md:table-cell" },
    { key: "amount", name: "Částka", className: "text-right" },
    { key: "status", name: "Stav", className: "hidden sm:table-cell" }
];

const columnClassName = Object.fromEntries(columns.map(column => [column.key, column.className]));

const currencyFormatter = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" });

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("cs-CZ");
}

function isOverdue(invoice: Invoice) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(invoice.paymentDate) < today;
}

function getSortValue(invoice: Invoice, column: SortColumn) : string | number {
    switch (column) {
        case "id": return invoice.id;
        case "customer": return invoice.customer.name.toLocaleLowerCase("cs-CZ");
        case "publishDate": return new Date(invoice.publishDate).getTime();
        case "paymentDate": return new Date(invoice.paymentDate).getTime();
        case "amount": return invoice.paymentDetails.amount;
    }
}

interface StatProps {
    label: string;
    value: string;
    isLoading: boolean;
    className?: string;
}

function Stat({ label, value, isLoading, className = "" }: StatProps) {
    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <dt className="text-sm text-neutral-500">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-ink">
                {isLoading ? <Skeleton className="mt-1 h-7 w-full max-w-24 rounded-md" /> : value}
            </dd>
        </div>
    );
}

interface InvoiceStatusProps {
    isOverdue: boolean;
}

function InvoiceStatus({ isOverdue }: InvoiceStatusProps) {
    return (
        <span className={`inline-flex items-center gap-2 text-sm whitespace-nowrap ${isOverdue ? "text-danger-600" : "text-neutral-600"}`}>
            <span aria-hidden="true" className={`size-1.5 rounded-full ${isOverdue ? "bg-danger" : "bg-neutral-300"}`} />
            {isOverdue ? "Po splatnosti" : "Ve splatnosti"}
        </span>
    );
}

export default function Page() {
    const { profile, isLoading: isProfileLoading } = useRequireProfile();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);
    const [folders, setFolders] = useState<InvoiceFolder[]>([]);
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: "publishDate", direction: "descending" });
    const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [archiveProgress, setArchiveProgress] = useState<{ done: number, total: number } | null>(null);
    const [reloadCount, setReloadCount] = useState(0);
    const router = useRouter();

    useEffect(() => {
        if (!profile) return;

        let isCancelled = false;

        const loadInvoices = async () => {
            try {
                const [allInvoices, entries, allFolders] = await Promise.all([
                    Invoices.getAllInvoicesAsync(),
                    Archive.getEntriesAsync(),
                    Folders.getAllAsync()
                ]);
                if (isCancelled) return;

                setInvoices(allInvoices);
                setArchiveEntries(entries);
                setFolders(allFolders);
                setStatus("ready");
            } catch (error) {
                console.error("Error loading invoices:", error);
                if (!isCancelled) setStatus("error");
            }
        };

        loadInvoices();

        return () => {
            isCancelled = true;
        };
    }, [profile, reloadCount]);

    const activeInvoices = useMemo(() => {
        const archivedIds = new Set(archiveEntries.map(entry => entry.invoiceId));
        return invoices.filter(invoice => !archivedIds.has(invoice.id));
    }, [invoices, archiveEntries]);

    const visibleInvoices = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("cs-CZ");
        const filtered = activeInvoices.filter(invoice => {
            if (statusFilter !== "all" && isOverdue(invoice) !== (statusFilter === "overdue")) return false;
            if (!query) return true;

            return invoice.id.toLocaleLowerCase("cs-CZ").includes(query) ||
                invoice.customer.name.toLocaleLowerCase("cs-CZ").includes(query) ||
                invoice.customer.ico.includes(query);
        });

        const column = sortDescriptor.column as SortColumn;
        const direction = sortDescriptor.direction === "descending" ? -1 : 1;

        return [...filtered].sort((a, b) => {
            const first = getSortValue(a, column);
            const second = getSortValue(b, column);
            return (first < second ? -1 : first > second ? 1 : 0) * direction;
        });
    }, [activeInvoices, search, statusFilter, sortDescriptor]);

    if (isProfileLoading || !profile) {
        return <LoadingState />;
    }

    const isLoading = status === "loading";
    const isFiltered = search.trim() !== "" || statusFilter !== "all";
    const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.paymentDetails.amount, 0);
    const overdueCount = activeInvoices.filter(isOverdue).length;
    const selectedInvoices = selectedKeys === "all"
        ? visibleInvoices
        : visibleInvoices.filter(invoice => selectedKeys.has(invoice.id));

    const resetFilters = () => {
        setSearch("");
        setStatusFilter("all");
    };

    const handleArchive = async (selection: FolderSelection) : Promise<boolean> => {
        const targets = selectedInvoices;
        setArchiveProgress({ done: 0, total: targets.length });

        try {
            const { folderId, createdFolder } = await resolveFolderAsync(selection, profile.uid);
            const allFolders = createdFolder ? [...folders, createdFolder] : folders;
            if (createdFolder) setFolders(allFolders);

            const { archived, failedIds } = await archiveInvoicesAsync(targets, folderId, profile.uid, done => {
                setArchiveProgress({ done, total: targets.length });
            });

            setArchiveEntries(current => [...current.filter(entry => !archived.some(item => item.invoiceId === entry.invoiceId)), ...archived]);
            setSelectedKeys(new Set(failedIds));
            setIsArchiveOpen(false);

            if (archived.length > 0) {
                addToast({
                    title: archived.length === 1 ? "Faktura archivována" : "Faktury archivovány",
                    description: `${formatInvoiceCount(archived.length)} – složka ${getFolderName(folderId, allFolders)}`,
                    color: "success"
                });
            }
            if (failedIds.length > 0) {
                addToast({
                    title: `Nearchivováno: ${formatInvoiceCount(failedIds.length)}`,
                    description: `${failedIds.join(", ")}. Zůstaly označené, zkuste to znovu.`,
                    color: "danger"
                });
            }

            return true;
        } catch (error) {
            console.error("Error archiving invoices:", error);
            addToast({ title: "Faktury se nepodařilo archivovat", description: "Zkuste to znovu.", color: "danger" });
            return false;
        } finally {
            setArchiveProgress(null);
        }
    };

    const newInvoiceButton = (
        <Button as={Link} href="/invoice-editor" radius="sm" className="bg-ink text-white" startContent={<PlusIcon size={18} />}>
            Nová faktura
        </Button>
    );

    return (
        <PageShell title="Faktury" description="Přehled vystavených faktur a jejich splatnosti" actions={newInvoiceButton}>
            <div className="flex flex-col gap-6">
                <Panel>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                        <Stat label="Aktivní faktury" value={`${activeInvoices.length}`} isLoading={isLoading} />
                        <Stat label="Po splatnosti" value={`${overdueCount}`} isLoading={isLoading} className="border-l border-neutral-200 pl-6" />
                        <Stat
                            label="Celkový obrat"
                            value={currencyFormatter.format(totalRevenue)}
                            isLoading={isLoading}
                            className="col-span-2 border-t border-neutral-200 pt-5 sm:col-span-1 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6"
                        />
                    </dl>
                </Panel>

                <Panel>
                    <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <Input
                            label="Hledat"
                            labelPlacement="outside-top"
                            placeholder="Číslo faktury, odběratel nebo IČO"
                            radius="sm"
                            variant="flat"
                            isClearable
                            className="md:max-w-sm"
                            startContent={<SearchIcon size={18} className="text-neutral-400 shrink-0" />}
                            value={search}
                            onValueChange={setSearch}
                        />
                        <Tabs
                            aria-label="Filtrovat podle stavu"
                            radius="sm"
                            classNames={{ base: "w-full md:w-auto", tabList: "w-full md:w-auto", tab: "px-2 sm:px-3" }}
                            selectedKey={statusFilter}
                            onSelectionChange={(key) => setStatusFilter(key as StatusFilter)}
                        >
                            <Tab key="all" title="Vše" />
                            <Tab key="due" title="Ve splatnosti" />
                            <Tab key="overdue" title="Po splatnosti" />
                        </Tabs>
                    </div>

                    {selectedInvoices.length > 0 && (
                        <div role="region" aria-label="Akce s vybranými fakturami" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-neutral-100 px-4 py-2">
                            <p className="text-sm font-medium text-ink tabular-nums">Vybráno: {formatInvoiceCount(selectedInvoices.length)}</p>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" radius="sm" variant="bordered" className="bg-white" startContent={<ArchiveIcon size={16} />} onPress={() => setIsArchiveOpen(true)}>
                                    Archivovat
                                </Button>
                                <Button size="sm" radius="sm" variant="light" onPress={() => setSelectedKeys(new Set())}>
                                    Zrušit výběr
                                </Button>
                            </div>
                        </div>
                    )}

                    {status === "error" ? (
                        <EmptyState
                            title="Faktury se nepodařilo načíst"
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
                                aria-label="Faktury"
                                removeWrapper
                                color="default"
                                selectionMode="multiple"
                                selectedKeys={selectedKeys}
                                onSelectionChange={setSelectedKeys}
                                sortDescriptor={sortDescriptor}
                                onSortChange={setSortDescriptor}
                                onRowAction={(key) => router.push(`/invoice-editor?iid=${key}`)}
                                classNames={{
                                    th: "bg-transparent text-sm font-medium text-neutral-500 border-b border-neutral-200 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6",
                                    td: "py-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6",
                                    tr: "cursor-pointer border-b border-neutral-100 last:border-0 transition-colors hover:bg-neutral-50"
                                }}
                            >
                                <TableHeader columns={columns}>
                                    {(column) => (
                                        <TableColumn
                                            key={column.key}
                                            allowsSorting={column.key !== "status"}
                                            className={column.className}
                                        >
                                            {column.name}
                                        </TableColumn>
                                    )}
                                </TableHeader>
                                <TableBody
                                    items={visibleInvoices}
                                    isLoading={isLoading}
                                    loadingContent={<LoadingState label="Načítání faktur…" isFullPage={false} />}
                                    emptyContent={isLoading ? " " : isFiltered ? (
                                        <EmptyState
                                            title="Nic nenalezeno"
                                            description="Žádná faktura neodpovídá hledání ani filtru."
                                            action={<Button radius="sm" variant="bordered" onPress={resetFilters}>Zrušit filtry</Button>}
                                        />
                                    ) : activeInvoices.length === 0 && archiveEntries.length > 0 ? (
                                        <EmptyState
                                            title="Žádné aktivní faktury"
                                            description="Všechny faktury jsou v archivu."
                                            action={
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    <Button as={Link} href="/archive" radius="sm" variant="bordered">Otevřít archiv</Button>
                                                    {newInvoiceButton}
                                                </div>
                                            }
                                        />
                                    ) : (
                                        <EmptyState
                                            title="Zatím žádné faktury"
                                            description={"Vystavte první fakturu a\u00a0odešlete ji odběrateli."}
                                            action={newInvoiceButton}
                                        />
                                    )}
                                >
                                    {(invoice) => {
                                        const overdue = isOverdue(invoice);
                                        return (
                                            <TableRow key={invoice.id}>
                                                <TableCell className={`font-mono text-sm text-neutral-600 ${columnClassName.id}`}>{invoice.id}</TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-ink">{invoice.customer.name}</p>
                                                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-neutral-500 sm:hidden">
                                                        <span className="font-mono">{invoice.id}</span>
                                                        <span className={`tabular-nums ${overdue ? "text-danger-600" : ""}`}>
                                                            {overdue ? "Po splatnosti" : "Splatnost"} {formatDate(invoice.paymentDate)}
                                                        </span>
                                                    </p>
                                                </TableCell>
                                                <TableCell className={`tabular-nums text-neutral-600 ${columnClassName.publishDate}`}>{formatDate(invoice.publishDate)}</TableCell>
                                                <TableCell className={`tabular-nums text-neutral-600 ${columnClassName.paymentDate}`}>{formatDate(invoice.paymentDate)}</TableCell>
                                                <TableCell className={`font-medium tabular-nums whitespace-nowrap text-ink ${columnClassName.amount}`}>
                                                    {currencyFormatter.format(invoice.paymentDetails.amount)}
                                                </TableCell>
                                                <TableCell className={columnClassName.status}>
                                                    <InvoiceStatus isOverdue={overdue} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Panel>
            </div>

            <FolderPickerModal
                isOpen={isArchiveOpen}
                title={selectedInvoices.length === 1 ? "Archivovat fakturu" : `Archivovat ${formatInvoiceCount(selectedInvoices.length)}`}
                description={selectedInvoices.length === 1
                    ? "Uloží se PDF snímek faktury. Archivovanou fakturu nelze upravovat ani odeslat, dokud ji neobnovíte."
                    : "Uloží se PDF snímky faktur. Archivované faktury nelze upravovat ani odeslat, dokud je neobnovíte."}
                confirmLabel="Archivovat"
                folders={folders}
                isBusy={archiveProgress !== null}
                progress={archiveProgress && archiveProgress.total > 1 ? archiveProgress : null}
                onClose={() => setIsArchiveOpen(false)}
                onConfirm={handleArchive}
            />
        </PageShell>
    );
}
