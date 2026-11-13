import { Profile } from "../../profile/Models";
import { Invoice, InvoicePaymentDetails } from "../Models";
import { Invoices } from "./Repository";

export function getQRFetchUrl(invoicePayment: InvoicePaymentDetails) : string {
    const response =
        `https://api.paylibo.com/paylibo/generator/czech/image?accountNumber=${invoicePayment.accountNumber}&bankCode=${invoicePayment.bankCode}&amount=${invoicePayment.amount}&currency=${invoicePayment.currency}&vs=${invoicePayment.variableSymbol}&branding=false&message=${encodeURIComponent(invoicePayment.message)}`;

    return response;
}

export function recalculateInvoice(invoice: Invoice) : Invoice {
    const itemsPrice = invoice.items.reduce((sum, item) => sum + (item.price * item.amount), 0);
    const amount = invoice.configuration.isTaxRateEnabled ? itemsPrice + (itemsPrice * invoice.configuration.taxRate) : itemsPrice;
    const paymentDetails = {
        ...invoice.paymentDetails,
        variableSymbol: invoice.id,
        amount: amount
    };

    return {
        ...invoice,
        itemsPrice: itemsPrice,
        paymentDetails: {
            ...paymentDetails,
            qrFetchURL: getQRFetchUrl(paymentDetails)
        }
    };
}

export function getInvoiceIssues(invoice: Invoice, options: { forSend: boolean }) : string[] {
    const issues: string[] = [];

    if (!invoice.id.trim()) issues.push("Zadejte číslo faktury.");
    if (!invoice.customer.name.trim()) issues.push("Zadejte název odběratele.");
    if (!invoice.customer.address.trim()) issues.push("Zadejte adresu odběratele.");
    if (options.forSend && !invoice.customer.email?.trim()) issues.push("Zadejte e-mail odběratele, jinak fakturu nelze odeslat.");
    if (options.forSend && invoice.customer.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.customer.email.trim())) issues.push("E-mail odběratele není platný. Opravte ho a zkuste to znovu.");
    if (invoice.items.length === 0) issues.push("Přidejte alespoň jednu položku.");
    if (invoice.items.some(item => !item.description.trim())) issues.push("Každá položka musí mít popis.");
    if (invoice.items.some(item => !(item.amount > 0))) issues.push("Množství u každé položky musí být větší než 0.");
    if (invoice.paymentDate < startOfDay(invoice.publishDate)) issues.push("Datum splatnosti nesmí být před datem vystavení.");

    return issues;
}

function startOfDay(date: Date) : Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

export async function generateNextInvoiceId() {
    const currentDate = new Date();

    const todaysInvoicesCount = await Invoices.getInvoicesCountAsync(currentDate);
    return `${currentDate.getFullYear()}${currentDate.getDate()}${currentDate.getMonth() + 1}${todaysInvoicesCount + 1}`;
}

export function generateBlankInvoice(profile: Profile, invoiceId: string) : Invoice {
    return {
        id: invoiceId,
        publishDate: new Date(),
        paymentDate: new Date(),
        identificationOrder: null,
        supplier: {
            ico: profile.ico,
            name: profile.supplierName,
            address: profile.address,
            email: profile.email
        },
        customer: {
            ico: "",
            name: "",
            address: "",
            email: ""
        },
        items: [],
        itemsPrice: 0,
        paymentDetails: {
            accountNumber: profile.accountNumber,
            bankCode: profile.bankCode,
            amount: 0,
            currency: "CZK",
            variableSymbol: invoiceId,
            message: "",
            qrFetchURL: ""
        },
        configuration: {
            logo: profile.logo,
            signature: profile.signature,
            isTaxRateEnabled: profile.isTaxRateEnabled,
            taxRate: profile.taxRate
        }
    };
}
