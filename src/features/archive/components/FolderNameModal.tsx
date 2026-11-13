"use client";

import { useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { InvoiceFolder } from "../Models";

const maxNameLength = 60;

export function getFolderNameError(name: string, folders: InvoiceFolder[], currentFolderId?: string) : string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Zadejte název složky.";
    if (trimmed.length > maxNameLength) return `Název může mít nejvýše ${maxNameLength} znaků.`;

    const isTaken = folders.some(folder => folder.id !== currentFolderId && folder.name.toLocaleLowerCase("cs-CZ") === trimmed.toLocaleLowerCase("cs-CZ"));
    return isTaken ? "Složka s tímto názvem už existuje." : null;
}

interface FolderNameModalProps {
    isOpen: boolean;
    folder?: InvoiceFolder | null;
    folders: InvoiceFolder[];
    isSaving: boolean;
    onClose: () => void;
    onSubmit: (name: string) => Promise<boolean>;
}

export default function FolderNameModal({ isOpen, folder = null, folders, isSaving, onClose, onSubmit }: FolderNameModalProps) {
    const [name, setName] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const currentName = name ?? folder?.name ?? "";
    const error = getFolderNameError(currentName, folders, folder?.id);

    const reset = () => {
        setName(null);
        setIsSubmitted(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => !open && !isSaving && handleClose()}
            isDismissable={!isSaving}
            hideCloseButton={isSaving}
            placement="center"
            radius="sm"
        >
            <ModalContent>
                <ModalHeader>{folder ? "Přejmenovat složku" : "Nová složka"}</ModalHeader>
                <ModalBody>
                    <form
                        id="folder-name-form"
                        noValidate
                        onSubmit={async (event) => {
                            event.preventDefault();
                            setIsSubmitted(true);
                            if (!error && !isSaving && await onSubmit(currentName.trim())) reset();
                        }}
                    >
                        <Input
                            autoFocus
                            isRequired
                            label="Název složky"
                            labelPlacement="outside-top"
                            placeholder="Například Klienti 2026"
                            variant="flat"
                            radius="sm"
                            maxLength={maxNameLength}
                            value={currentName}
                            isInvalid={isSubmitted && error !== null}
                            errorMessage={error}
                            onValueChange={setName}
                        />
                    </form>
                </ModalBody>
                <ModalFooter>
                    <Button radius="sm" variant="light" isDisabled={isSaving} onPress={handleClose}>
                        Zrušit
                    </Button>
                    <Button type="submit" form="folder-name-form" radius="sm" className="bg-ink text-white" isLoading={isSaving}>
                        {folder ? "Přejmenovat" : "Vytvořit"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
