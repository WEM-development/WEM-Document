"use client";

import { Input, Textarea } from "@heroui/react";
import { Client } from "../Models";

interface ClientFormFieldsProps {
    client: Client;
    isEmailInvalid?: boolean;
    onChange: (client: Client) => void;
}

export default function ClientFormFields({ client, isEmailInvalid = false, onChange }: ClientFormFieldsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Input
                isRequired
                label="Název"
                labelPlacement="outside-top"
                variant="flat"
                radius="sm"
                autoComplete="organization"
                value={client.name}
                onValueChange={(value: string) => onChange({ ...client, name: value })}
            />
            <Input
                label="E-mail"
                labelPlacement="outside-top"
                variant="flat"
                radius="sm"
                type="email"
                autoComplete="email"
                description="Na tuto adresu se faktura odešle."
                isInvalid={isEmailInvalid}
                errorMessage="Zadejte platný e-mail, např. faktury@firma.cz."
                value={client.email ?? ""}
                onValueChange={(value: string) => onChange({ ...client, email: value })}
            />
            <Textarea
                isRequired
                label="Adresa"
                labelPlacement="outside-top"
                variant="flat"
                radius="sm"
                minRows={2}
                className="md:col-span-2"
                value={client.address}
                onValueChange={(value: string) => onChange({ ...client, address: value })}
            />
        </div>
    );
}
