"use client";

import { useMemo, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { buildInvoiceEmail, getDefaultEmailMessage, getInvoiceEmailData, getLogoUrl } from "@/features/mailer/Template";
import { Profile } from "@/features/profile/Models";
import { Invoice } from "../Models";
import { PaperAirplaneIcon } from "./Icons";

export interface InvoiceEmailContent {
    subject: string;
    message: string;
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
    const [message, setMessage] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const defaultMessage = getDefaultEmailMessage(getInvoiceEmailData(invoice, sender, ""));
    const currentSubject = subject ?? `Faktura č.\u00a0${invoice.id}`;
    const currentMessage = message ?? defaultMessage;
    const attachmentCount = (sender.emailAttachments ?? []).length;

    // The preview is the exact e-mail layout; only images use their public URLs instead of inline attachments.
    const previewHtml = useMemo(() => buildInvoiceEmail(
        getInvoiceEmailData(invoice, sender, currentMessage),
        { logoSrc: getLogoUrl(sender), qrSrc: invoice.paymentDetails.qrFetchURL || null }
    ).html, [invoice, sender, currentMessage]);

    const handleClose = () => {
        setSubject(null);
        setMessage(null);
        setIsSubmitted(false);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => !open && !isSending && handleClose()}
            isDismissable={!isSending}
            hideCloseButton={isSending}
            placement="center"
            size="5xl"
            radius="sm"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader>Odeslat fakturu</ModalHeader>
                <ModalBody>
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                        <form
                            id="send-invoice-form"
                            noValidate
                            className="flex flex-col gap-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                setIsSubmitted(true);
                                if (isSending || !currentSubject.trim() || !currentMessage.trim()) return;

                                onSend({ subject: currentSubject.trim(), message: currentMessage.trim() });
                            }}
                        >
                            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-y-1.5 text-sm">
                                <dt className="text-neutral-500">Komu</dt>
                                <dd className="break-all text-ink">{invoice.customer.email}</dd>
                                <dt className="text-neutral-500">Přílohy</dt>
                                <dd className="text-ink">
                                    <span className="font-mono">Faktura-{invoice.id}.pdf</span>
                                    {attachmentCount > 0 && <span className="text-neutral-500"> a další ({attachmentCount})</span>}
                                </dd>
                            </dl>
                            <Input
                                isRequired
                                label="Předmět"
                                labelPlacement="outside-top"
                                variant="flat"
                                radius="sm"
                                value={currentSubject}
                                isInvalid={isSubmitted && !currentSubject.trim()}
                                errorMessage="Zadejte předmět."
                                onValueChange={setSubject}
                            />
                            <Textarea
                                isRequired
                                label="Zpráva"
                                labelPlacement="outside-top"
                                variant="flat"
                                radius="sm"
                                minRows={9}
                                maxRows={16}
                                description="Částka, splatnost, platební údaje a QR platba se doplní automaticky."
                                value={currentMessage}
                                isInvalid={isSubmitted && !currentMessage.trim()}
                                errorMessage="Napište text e-mailu."
                                onValueChange={setMessage}
                            />
                            {message !== null && message !== defaultMessage && (
                                <Button size="sm" radius="sm" variant="light" className="self-start" isDisabled={isSending} onPress={() => setMessage(null)}>
                                    Vrátit výchozí text
                                </Button>
                            )}
                        </form>

                        <section aria-label="Náhled e-mailu" className="flex min-w-0 flex-col gap-1.5">
                            <p className="text-sm text-neutral-500">Náhled</p>
                            {/* Sandboxed so the e-mail's own styles render untouched and no script can run. */}
                            <iframe
                                title="Náhled e-mailu"
                                sandbox=""
                                srcDoc={previewHtml}
                                className="h-[480px] w-full rounded-lg border border-neutral-200 bg-mist lg:h-[600px]"
                            />
                        </section>
                    </div>
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
