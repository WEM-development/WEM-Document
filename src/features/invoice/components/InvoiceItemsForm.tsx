"use client";

import { useState } from "react";
import { Button, Input, NumberInput } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import EmptyState from "@/components/common/EmptyState";
import Panel from "@/components/common/Panel";
import { Invoice, InvoiceItem } from "../Models";
import { PlusIcon, TrashIcon } from "./Icons";

const currencyFormatter = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" });

interface InvoiceItemsFormProps {
    invoice: Invoice;
    onChange: (items: InvoiceItem[]) => void;
}

export default function InvoiceItemsForm({ invoice, onChange }: InvoiceItemsFormProps) {
    const items = invoice.items;
    const [addedItemId, setAddedItemId] = useState<number | null>(null);

    const addItem = () => {
        const id = Date.now();
        setAddedItemId(id);
        onChange([...items, { id: id, description: "", amount: 1, price: 0 }]);
    };

    const updateItem = (index: number, changes: Partial<InvoiceItem>) => {
        onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, itemIndex) => itemIndex !== index));
    };

    const addButton = (
        <Button radius="sm" variant="bordered" startContent={<PlusIcon size={18} />} onPress={addItem}>
            Přidat položku
        </Button>
    );

    if (items.length === 0) {
        return (
            <Panel title="Položky">
                <EmptyState title="Zatím žádné položky" description={"Přidejte alespoň jednu položku, kterou fakturujete."} action={addButton} />
            </Panel>
        );
    }

    return (
        <Panel title="Položky">
            <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                    {items.map((item, index) => {
                        // Labels stay visible on phones; from md the first row labels the columns.
                        const labelClassNames = index > 0 ? { label: "md:sr-only", base: "md:!mt-0" } : {};

                        return (
                            <motion.div
                                key={item.id ?? index}
                                layout
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 border-b border-neutral-100 pb-3 md:grid-cols-[minmax(0,1fr)_6rem_8rem_7rem_2.5rem] md:border-0 md:pb-0"
                            >
                                <Input
                                    isRequired
                                    label="Popis"
                                    labelPlacement="outside"
                                    placeholder="Popis položky"
                                    variant="flat"
                                    radius="sm"
                                    className="col-span-3 md:col-span-1"
                                    classNames={labelClassNames}
                                    autoFocus={item.id !== undefined && item.id === addedItemId}
                                    value={item.description}
                                    onValueChange={(value: string) => updateItem(index, { description: value })}
                                />
                                <NumberInput
                                    isRequired
                                    hideStepper
                                    label="Množství"
                                    labelPlacement="outside"
                                    placeholder="0"
                                    variant="flat"
                                    radius="sm"
                                    minValue={0}
                                    classNames={labelClassNames}
                                    value={item.amount}
                                    onValueChange={(value: number) => updateItem(index, { amount: Number.isNaN(value) ? 0 : value })}
                                />
                                <NumberInput
                                    isRequired
                                    hideStepper
                                    label="Cena za kus"
                                    labelPlacement="outside"
                                    placeholder="0"
                                    variant="flat"
                                    radius="sm"
                                    minValue={0}
                                    formatOptions={{ maximumFractionDigits: 2 }}
                                    endContent={<span className="text-sm text-neutral-400">Kč</span>}
                                    classNames={labelClassNames}
                                    value={item.price}
                                    onValueChange={(value: number) => updateItem(index, { price: Number.isNaN(value) ? 0 : value })}
                                />
                                <p className="col-span-3 -mt-1 flex justify-between text-sm md:col-span-1 md:mt-0 md:flex md:h-10 md:items-center md:justify-end">
                                    <span className="text-neutral-500 md:sr-only">Celkem za položku</span>
                                    <span className="font-medium tabular-nums whitespace-nowrap text-ink">{currencyFormatter.format(item.amount * item.price)}</span>
                                </p>
                                <div className="row-start-2 col-start-3 flex items-end md:row-start-auto md:col-start-auto">
                                    <Button
                                        isIconOnly
                                        radius="sm"
                                        variant="light"
                                        aria-label={`Odstranit položku ${index + 1}`}
                                        className="text-neutral-400 data-[hover=true]:text-danger"
                                        onPress={() => removeItem(index)}
                                    >
                                        <TrashIcon size={18} />
                                    </Button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                <div className="mt-2 flex flex-col-reverse gap-5 md:flex-row md:items-start md:justify-between">
                    {addButton}

                    {/* Summary */}
                    <dl className="grid w-full grid-cols-[1fr_auto] gap-x-8 gap-y-1.5 text-sm md:w-auto md:min-w-64">
                        <dt className="text-neutral-500">Bez DPH</dt>
                        <dd className="text-right tabular-nums">{currencyFormatter.format(invoice.itemsPrice)}</dd>
                        {invoice.configuration.isTaxRateEnabled && (
                            <>
                                <dt className="text-neutral-500">DPH {Math.round(invoice.configuration.taxRate * 100)}&nbsp;%</dt>
                                <dd className="text-right tabular-nums">{currencyFormatter.format(invoice.itemsPrice * invoice.configuration.taxRate)}</dd>
                            </>
                        )}
                        <dt className="pt-1.5 font-semibold text-ink">Celkem</dt>
                        <dd className="pt-1.5 text-right text-base font-semibold tabular-nums text-ink">
                            {currencyFormatter.format(invoice.paymentDetails.amount)}
                        </dd>
                    </dl>
                </div>
            </div>
        </Panel>
    );
}
