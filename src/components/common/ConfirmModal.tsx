"use client";

import React from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    isDestructive?: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function ConfirmModal({ isOpen, title, description, confirmLabel, isDestructive = false, isLoading = false, onClose, onConfirm }: ConfirmModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => !open && !isLoading && onClose()}
            isDismissable={!isLoading}
            hideCloseButton={isLoading}
            placement="center"
            radius="sm"
        >
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalBody>
                    <div className="text-sm text-neutral-600">{description}</div>
                </ModalBody>
                <ModalFooter>
                    <Button radius="sm" variant="light" isDisabled={isLoading} onPress={onClose}>
                        Zrušit
                    </Button>
                    <Button
                        radius="sm"
                        {...(isDestructive ? { color: "danger", variant: "flat" } : { className: "bg-ink text-white" })}
                        isLoading={isLoading}
                        onPress={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
