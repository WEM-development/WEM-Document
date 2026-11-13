"use client";

import { useState } from "react";
import { Button, DatePicker, DateValue, Input, addToast } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";
import Panel from "@/components/common/Panel";
import ClientFormFields from "@/features/company_client/components/ClientFormFields";
import { Client } from "@/features/company_client/Models";
import { GetCompanyClient } from "@/features/company_client/server/Route";
import { Invoice } from "../Models";

type LookupStatus = "idle" | "loading" | "notFound" | "failed";

const dayInMs = 24 * 60 * 60 * 1000;
const paymentTerms = [7, 14, 30];

function toCalendarDate(date: Date) {
    return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function toDate(value: DateValue) {
    return new Date(value.year, value.month - 1, value.day);
}

function addDays(date: Date, days: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getDaysBetween(from: Date, to: Date) {
    return Math.round((toDate(toCalendarDate(to)).getTime() - toDate(toCalendarDate(from)).getTime()) / dayInMs);
}

interface InvoiceFormProps {
    invoice: Invoice;
    isIdReadOnly: boolean;
    onChange: (invoice: Invoice) => void;
}

export default function InvoiceForm({ invoice, isIdReadOnly, onChange }: InvoiceFormProps) {
    const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
    const ico = invoice.customer.ico;
    const isIcoComplete = /^\d{8}$/.test(ico);
    const email = invoice.customer.email ?? "";
    const isEmailInvalid = email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const paymentTermDays = getDaysBetween(invoice.publishDate, invoice.paymentDate);

    const handleLookup = async () => {
        if (!isIcoComplete || lookupStatus === "loading") return;

        setLookupStatus("loading");
        try {
            const client = await GetCompanyClient(ico);
            if (!client) {
                setLookupStatus("notFound");
                return;
            }

            onChange({
                ...invoice,
                customer: { ...invoice.customer, ...client, email: invoice.customer.email ?? "" }
            });
            setLookupStatus("idle");
            addToast({ title: "Údaje načteny z ARES", description: client.name, color: "success" });
        } catch (error) {
            console.error("ARES lookup failed:", error);
            setLookupStatus("failed");
        }
    };

    return (
        <>
            {/* Customer */}
            <Panel title="Odběratel">
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[minmax(0,18rem)_auto] md:justify-start">
                        <Input
                            label="IČO"
                            labelPlacement="outside-top"
                            variant="flat"
                            radius="sm"
                            inputMode="numeric"
                            maxLength={8}
                            classNames={{ input: "tabular-nums" }}
                            description="Název a adresu doplní ARES."
                            value={ico}
                            isInvalid={lookupStatus === "notFound" || lookupStatus === "failed"}
                            errorMessage={lookupStatus === "failed"
                                ? "ARES není dostupný. Zkuste to znovu nebo vyplňte údaje ručně."
                                : "Firma nebyla v ARES nalezena. Zkontrolujte IČO."}
                            onValueChange={(value: string) => {
                                setLookupStatus("idle");
                                onChange({
                                    ...invoice,
                                    customer: { ...invoice.customer, ico: value.replace(/\D/g, "") }
                                });
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleLookup();
                                }
                            }}
                        />
                        <Button
                            radius="sm"
                            variant="bordered"
                            aria-label="Načíst z ARES"
                            className="mt-7 shrink-0"
                            isDisabled={!isIcoComplete}
                            isLoading={lookupStatus === "loading"}
                            onPress={handleLookup}
                        >
                            <span className="sm:hidden">Načíst</span>
                            <span className="hidden sm:inline">Načíst z ARES</span>
                        </Button>
                    </div>
                    <ClientFormFields
                        client={invoice.customer}
                        isEmailInvalid={isEmailInvalid}
                        onChange={(client: Client) => {
                            onChange({
                                ...invoice,
                                customer: client
                            });
                        }}
                    />
                </div>
            </Panel>

            {/* Invoice details */}
            <Panel title="Faktura">
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        isRequired
                        isReadOnly={isIdReadOnly}
                        label="Číslo faktury"
                        labelPlacement="outside-top"
                        variant="flat"
                        radius="sm"
                        inputMode="numeric"
                        classNames={{ input: `font-mono ${isIdReadOnly ? "text-neutral-500" : ""}` }}
                        value={invoice.id}
                        onValueChange={(value: string) => {
                            onChange({
                                ...invoice,
                                id: value.trim()
                            });
                        }}
                    />
                    <Input
                        label="Číslo objednávky"
                        labelPlacement="outside-top"
                        variant="flat"
                        radius="sm"
                        value={invoice.identificationOrder ?? ""}
                        onValueChange={(value: string) => {
                            onChange({
                                ...invoice,
                                identificationOrder: value || null
                            });
                        }}
                    />
                    <DatePicker
                        isRequired
                        label="Datum vystavení"
                        labelPlacement="outside"
                        variant="flat"
                        radius="sm"
                        value={toCalendarDate(invoice.publishDate)}
                        onChange={(value: DateValue | null) => {
                            if (value) {
                                const publishDate = toDate(value);
                                // Keep the payment term when the issue date moves.
                                onChange({
                                    ...invoice,
                                    publishDate: publishDate,
                                    paymentDate: addDays(publishDate, Math.max(paymentTermDays, 0))
                                });
                            }
                        }}
                    />
                    <div className="flex flex-col gap-2">
                        <DatePicker
                            isRequired
                            label="Datum splatnosti"
                            labelPlacement="outside"
                            variant="flat"
                            radius="sm"
                            minValue={toCalendarDate(invoice.publishDate)}
                            errorMessage="Splatnost nesmí být před datem vystavení."
                            value={toCalendarDate(invoice.paymentDate)}
                            onChange={(value: DateValue | null) => {
                                if (value) {
                                    onChange({
                                        ...invoice,
                                        paymentDate: toDate(value)
                                    });
                                }
                            }}
                        />
                        <div role="group" aria-label="Rychlá volba splatnosti" className="flex flex-wrap items-center gap-2">
                            {paymentTerms.map(days => {
                                const isSelected = paymentTermDays === days;
                                return (
                                    <Button
                                        key={days}
                                        size="sm"
                                        radius="sm"
                                        variant={isSelected ? "flat" : "bordered"}
                                        aria-pressed={isSelected}
                                        className={`h-7 min-w-0 px-2.5 tabular-nums ${isSelected ? "font-medium text-ink" : "text-neutral-600"}`}
                                        onPress={() => onChange({ ...invoice, paymentDate: addDays(invoice.publishDate, days) })}
                                    >
                                        Za {days} dní
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Panel>
        </>
    );
}
