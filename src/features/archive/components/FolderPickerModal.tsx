"use client";

import { useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Progress, Select, SelectItem } from "@heroui/react";
import { FolderSelection, InvoiceFolder, unfiledFolderName } from "../Models";
import { getFolderNameError } from "./FolderNameModal";

const unfiledKey = "__unfiled";
const newFolderKey = "__new";

interface FolderPickerModalProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel: string;
    folders: InvoiceFolder[];
    initialFolderId?: string | null;
    isBusy: boolean;
    progress?: { done: number, total: number } | null;
    onClose: () => void;
    onConfirm: (selection: FolderSelection) => Promise<boolean>;
}

export default function FolderPickerModal({
    isOpen,
    title,
    description,
    confirmLabel,
    folders,
    initialFolderId = null,
    isBusy,
    progress = null,
    onClose,
    onConfirm
}: FolderPickerModalProps) {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    const currentKey = selectedKey ?? initialFolderId ?? unfiledKey;
    const isNewFolder = currentKey === newFolderKey;
    const nameError = isNewFolder ? getFolderNameError(newFolderName, folders) : null;

    const options = [
        { key: unfiledKey, label: unfiledFolderName },
        ...folders.map(folder => ({ key: folder.id, label: folder.name })),
        { key: newFolderKey, label: "Nová složka…" }
    ];

    const reset = () => {
        setSelectedKey(null);
        setNewFolderName("");
        setIsSubmitted(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => !open && !isBusy && handleClose()}
            isDismissable={!isBusy}
            hideCloseButton={isBusy}
            placement="center"
            radius="sm"
        >
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalBody>
                    <form
                        id="folder-picker-form"
                        noValidate
                        className="flex flex-col gap-4"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            setIsSubmitted(true);
                            if (nameError || isBusy) return;

                            const isDone = await onConfirm({
                                folderId: isNewFolder || currentKey === unfiledKey ? null : currentKey,
                                newFolderName: isNewFolder ? newFolderName.trim() : null
                            });
                            if (isDone) reset();
                        }}
                    >
                        {description && <p className="text-sm text-neutral-600">{description}</p>}
                        <Select
                            label="Složka"
                            labelPlacement="outside"
                            placeholder="Vyberte složku"
                            variant="flat"
                            radius="sm"
                            disallowEmptySelection
                            isDisabled={isBusy}
                            items={options}
                            selectedKeys={[currentKey]}
                            onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0];
                                if (key !== undefined) setSelectedKey(String(key));
                            }}
                        >
                            {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
                        </Select>
                        {isNewFolder && (
                            <Input
                                autoFocus
                                isRequired
                                label="Název nové složky"
                                labelPlacement="outside-top"
                                placeholder="Například Klienti 2026"
                                variant="flat"
                                radius="sm"
                                isDisabled={isBusy}
                                value={newFolderName}
                                isInvalid={isSubmitted && nameError !== null}
                                errorMessage={nameError}
                                onValueChange={setNewFolderName}
                            />
                        )}
                        {progress && (
                            <Progress
                                aria-label="Průběh"
                                label={`Hotovo ${progress.done} z ${progress.total}`}
                                size="sm"
                                radius="sm"
                                value={progress.done}
                                maxValue={progress.total}
                                classNames={{ indicator: "bg-ink", label: "text-sm text-neutral-600 tabular-nums" }}
                            />
                        )}
                    </form>
                </ModalBody>
                <ModalFooter>
                    <Button radius="sm" variant="light" isDisabled={isBusy} onPress={handleClose}>
                        Zrušit
                    </Button>
                    <Button type="submit" form="folder-picker-form" radius="sm" className="bg-ink text-white" isLoading={isBusy}>
                        {confirmLabel}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
