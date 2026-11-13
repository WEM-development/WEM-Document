"use client";

import {
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Select,
    SelectItem,
    Skeleton
} from "@heroui/react";
import Panel from "@/components/common/Panel";
import { ArchiveIcon, FolderIcon, MoreIcon, PlusIcon } from "@/features/invoice/components/Icons";
import { InvoiceFolder, unfiledFolderName } from "../Models";

export const allFoldersKey = "all";
export const unfiledFolderKey = "unfiled";

interface FolderActionsProps {
    folder: InvoiceFolder;
    onRename: (folder: InvoiceFolder) => void;
    onDelete: (folder: InvoiceFolder) => void;
}

function FolderActions({ folder, onRename, onDelete }: FolderActionsProps) {
    return (
        <Dropdown placement="bottom-end" radius="sm">
            <DropdownTrigger>
                <Button isIconOnly size="sm" radius="sm" variant="light" aria-label={`Akce složky ${folder.name}`} className="shrink-0 text-neutral-500">
                    <MoreIcon size={18} />
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label={`Akce složky ${folder.name}`}>
                <DropdownItem key="rename" onPress={() => onRename(folder)}>
                    Přejmenovat
                </DropdownItem>
                <DropdownItem key="delete" color="danger" className="text-danger" onPress={() => onDelete(folder)}>
                    Smazat
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );
}

interface FolderListProps {
    folders: InvoiceFolder[];
    counts: Record<string, number>;
    selectedKey: string;
    isLoading: boolean;
    onSelect: (key: string) => void;
    onCreate: () => void;
    onRename: (folder: InvoiceFolder) => void;
    onDelete: (folder: InvoiceFolder) => void;
}

export default function FolderList({ folders, counts, selectedKey, isLoading, onSelect, onCreate, onRename, onDelete }: FolderListProps) {
    const items = [
        { key: allFoldersKey, label: "Vše", folder: null },
        { key: unfiledFolderKey, label: unfiledFolderName, folder: null },
        ...folders.map(folder => ({ key: folder.id, label: folder.name, folder: folder as InvoiceFolder | null }))
    ];
    const selectedFolder = folders.find(folder => folder.id === selectedKey) ?? null;

    const createButton = (
        <Button isIconOnly radius="sm" variant="bordered" aria-label="Nová složka" onPress={onCreate}>
            <PlusIcon size={18} />
        </Button>
    );

    return (
        <>
            {/* Below lg the list collapses into a select so the table stays first on screen. */}
            <div className="flex items-end gap-2 lg:hidden">
                <Select
                    label="Složka"
                    labelPlacement="outside"
                    variant="flat"
                    radius="sm"
                    disallowEmptySelection
                    className="min-w-0 flex-1 bg-white"
                    isLoading={isLoading}
                    items={items}
                    selectedKeys={[selectedKey]}
                    onSelectionChange={(keys) => {
                        const key = Array.from(keys)[0];
                        if (key !== undefined) onSelect(String(key));
                    }}
                >
                    {(item) => (
                        <SelectItem key={item.key} textValue={item.label} endContent={<span className="text-sm text-neutral-500 tabular-nums">{counts[item.key] ?? 0}</span>}>
                            {item.label}
                        </SelectItem>
                    )}
                </Select>
                {selectedFolder && <FolderActions folder={selectedFolder} onRename={onRename} onDelete={onDelete} />}
                {createButton}
            </div>

            <Panel title="Složky" actions={createButton} className="hidden lg:block lg:sticky lg:top-24">
                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        {[0, 1, 2].map(index => <Skeleton key={index} className="h-9 rounded-md" />)}
                    </div>
                ) : (
                    <nav aria-label="Složky archivu" className="-mx-2">
                        <ul className="flex flex-col gap-0.5">
                            {items.map(item => {
                                const isSelected = item.key === selectedKey;
                                const Icon = item.key === allFoldersKey ? ArchiveIcon : FolderIcon;

                                return (
                                    <li key={item.key} className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            aria-current={isSelected ? "page" : undefined}
                                            className={`relative flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors ${isSelected ? "bg-neutral-100 font-medium text-ink" : "text-neutral-600 hover:bg-neutral-50 hover:text-ink"}`}
                                            onClick={() => onSelect(item.key)}
                                        >
                                            {isSelected && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />}
                                            <Icon size={18} className="shrink-0 text-neutral-500" />
                                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                            <span className="text-neutral-500 tabular-nums">{counts[item.key] ?? 0}</span>
                                        </button>
                                        {item.folder
                                            ? <FolderActions folder={item.folder} onRename={onRename} onDelete={onDelete} />
                                            : <span aria-hidden="true" className="w-8 shrink-0" />}
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                )}
            </Panel>
        </>
    );
}
