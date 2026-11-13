"use client";

import { useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { Profile } from "@/features/profile/Models";
import { Invoice } from "../Models";
import { PaperAirplaneIcon } from "./Icons";

export interface InvoiceEmailContent {
    header: string;
    content: string;
}

const htmlEscapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, character => htmlEscapes[character]);
}

// The template comes from the trusted profile; only the inserted values are escaped.
function fillTemplate(template: string, data: Record<string, string>) {
    return template.replace(/{{(\w+)}}/g, (_, key) => escapeHtml(data[key] ?? ""));
}

interface InvoiceModalProps {
    invoice: Invoice;
    sender: Profile;
    isOpen: boolean;
    isSending: boolean;
    onClose: () => void;
    onSend: (emailContent: InvoiceEmailContent) => void;
}

export default function InvoiceModal({ invoice, sender, isOpen, isSending, onClose, onSend }: InvoiceModalProps) {
    const [subject, setSubject] = useState<string | null>(null);
    const currentSubject = subject ?? `Faktura č. ${invoice.id}`;

    const emailBody = fillTemplate(sender.emailTemplate, {
        invoiceNumber: invoice.id,
        publishDate: invoice.publishDate.toLocaleDateString("cs-CZ"),
        paymentDate: invoice.paymentDate.toLocaleDateString("cs-CZ"),
        companyName: sender.supplierName,
        supportEmail: sender.email,
        invoiceTotal: invoice.paymentDetails.amount.toLocaleString("cs-CZ"),
        currentYear: new Date().getFullYear().toString()
    });

    const handleClose = () => {
        setSubject(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => !open && handleClose()}
            isDismissable={!isSending}
            hideCloseButton={isSending}
            placement="center"
            size="2xl"
            radius="md"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader className="text-lg font-semibold">Odeslat fakturu</ModalHeader>
                <ModalBody>
                    <form
                        id="send-invoice-form"
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onSend({ header: currentSubject.trim(), content: emailBody });
                        }}
                    >
                        <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1.5 text-sm">
                            <dt className="text-neutral-500">Komu</dt>
                            <dd className="text-ink break-all">{invoice.customer.email}</dd>
                            <dt className="text-neutral-500">Příloha</dt>
                            <dd className="text-ink">Faktura-{invoice.id}.pdf</dd>
                        </dl>
                        <Input
                            isRequired
                            label="Předmět"
                            labelPlacement="outside-top"
                            variant="flat"
                            radius="sm"
                            errorMessage="Zadejte předmět."
                            value={currentSubject}
                            onValueChange={setSubject}
                        />
                        <div
                            className="max-h-72 overflow-auto rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700"
                            dangerouslySetInnerHTML={{ __html: emailBody }}
                        />
                    </form>
                </ModalBody>
                <ModalFooter>
                    <Button radius="sm" variant="light" isDisabled={isSending} onPress={handleClose}>
                        Zrušit
                    </Button>
                    <Button
                        type="submit"
                        form="send-invoice-form"
                        radius="sm"
                        className="bg-ink text-white"
                        endContent={!isSending && <PaperAirplaneIcon size={18} />}
                        isLoading={isSending}
                    >
                        Odeslat
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
