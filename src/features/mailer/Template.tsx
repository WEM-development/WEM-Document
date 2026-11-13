import { Invoice } from "@/features/invoice/Models";
import { Profile } from "@/features/profile/Models";

export interface InvoiceEmailData {
    invoiceId: string;
    amount: string;
    publishDate: string;
    paymentDate: string;
    variableSymbol: string;
    accountNumber: string;
    supplierName: string;
    supplierAddress: string;
    supplierIco: string;
    supplierEmail: string;
    message: string;
}

export interface InvoiceEmailImages {
    logoSrc: string | null;
    qrSrc: string | null;
}

export const defaultLogoUrl = "https://firebasestorage.googleapis.com/v0/b/wem-website.firebasestorage.app/o/company_logos%2FWEM-logo.svg?alt=media&token=5e397b47-cc5c-4c0c-873c-1dec6f542470";

const currencyFormatter = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" });

const htmlEscapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, character => htmlEscapes[character]);
}

export function getLogoUrl(profile: Profile) : string {
    return /^(https:|data:image\/)/.test(profile.logo ?? "") ? profile.logo : defaultLogoUrl;
}

// Dates are formatted in the browser so the server's time zone cannot shift them.
export function getInvoiceEmailData(invoice: Invoice, sender: Profile, message: string) : InvoiceEmailData {
    return {
        invoiceId: invoice.id,
        amount: currencyFormatter.format(invoice.paymentDetails.amount),
        publishDate: invoice.publishDate.toLocaleDateString("cs-CZ"),
        paymentDate: invoice.paymentDate.toLocaleDateString("cs-CZ"),
        variableSymbol: invoice.paymentDetails.variableSymbol,
        accountNumber: `${invoice.paymentDetails.accountNumber}/${invoice.paymentDetails.bankCode}`,
        supplierName: sender.supplierName,
        supplierAddress: sender.address,
        supplierIco: sender.ico,
        supplierEmail: sender.email,
        message: message
    };
}

export function getDefaultEmailMessage(data: Omit<InvoiceEmailData, "message">) : string {
    return [
        "Dobrý den,",
        "",
        `v příloze Vám zasíláme fakturu č.\u00a0${data.invoiceId}. Částku ${data.amount} prosíme uhradit do ${data.paymentDate}.`,
        "",
        "Děkujeme za spolupráci.",
        "",
        "S pozdravem",
        data.supplierName
    ].join("\n");
}

function renderMessage(message: string) {
    return message
        .trim()
        .split(/\n{2,}/)
        .map(paragraph => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function renderDetailRow(label: string, value: string, isMono = false) {
    return `
        <tr>
            <td style="padding:6px 0;font-size:14px;color:#737373;">${escapeHtml(label)}</td>
            <td align="right" style="padding:6px 0 6px 12px;font-size:14px;color:#0a0a0a;font-weight:500;white-space:nowrap;${isMono ? "font-family:ui-monospace,Menlo,Consolas,monospace;" : ""}">${escapeHtml(value)}</td>
        </tr>`;
}

// Table layout with inline styles: the only markup that renders the same in Gmail, Outlook and Apple Mail.
export function buildInvoiceEmail(data: InvoiceEmailData, images: InvoiceEmailImages) : { html: string, text: string } {
    const logo = images.logoSrc
        ? `<img src="${escapeHtml(images.logoSrc)}" alt="${escapeHtml(data.supplierName)}" height="40" style="display:block;height:40px;width:auto;border:0;">`
        : `<span style="font-size:18px;font-weight:600;color:#0a0a0a;">${escapeHtml(data.supplierName)}</span>`;

    const qr = images.qrSrc
        ? `
            <tr>
                <td style="padding-top:16px;border-top:1px solid #e5e5e5;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td valign="middle" style="padding-right:16px;">
                                <img src="${escapeHtml(images.qrSrc)}" alt="QR platba" width="112" height="112" style="display:block;width:112px;height:112px;border:0;">
                            </td>
                            <td valign="middle" style="font-size:13px;line-height:20px;color:#737373;">
                                <strong style="display:block;color:#0a0a0a;font-weight:600;">QR platba</strong>
                                Naskenujte kód v&nbsp;aplikaci své banky, údaje se vyplní samy.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>`
        : "";

    const supplierLine = [data.supplierAddress, data.supplierIco ? `IČO ${data.supplierIco}` : ""].filter(Boolean).map(escapeHtml).join(" · ");

    const html = `<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Faktura ${escapeHtml(data.invoiceId)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;">
    <div style="display:none;max-height:0;overflow:hidden;">Faktura ${escapeHtml(data.invoiceId)} – ${escapeHtml(data.amount)}, splatnost ${escapeHtml(data.paymentDate)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
                    <tr>
                        <td style="height:4px;background-color:#fdc746;border-radius:8px 8px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td valign="middle">${logo}</td>
                                    <td valign="middle" align="right">
                                        <p style="margin:0;font-size:12px;color:#737373;">Faktura</p>
                                        <p style="margin:2px 0 0;font-size:16px;font-weight:600;font-family:ui-monospace,Menlo,Consolas,monospace;">${escapeHtml(data.invoiceId)}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px 8px;font-size:15px;line-height:24px;color:#262626;">
                            ${renderMessage(data.message)}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e5e5e5;border-radius:8px;">
                                <tr>
                                    <td style="padding:20px 24px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td valign="top">
                                                    <p style="margin:0;font-size:13px;color:#737373;">Částka k úhradě</p>
                                                    <p style="margin:4px 0 16px;font-size:28px;line-height:34px;font-weight:600;color:#0a0a0a;white-space:nowrap;">${escapeHtml(data.amount)}</p>
                                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e5e5;margin-bottom:12px;">
                                                        ${renderDetailRow("Datum splatnosti", data.paymentDate)}
                                                        ${renderDetailRow("Datum vystavení", data.publishDate)}
                                                        ${renderDetailRow("Variabilní symbol", data.variableSymbol, true)}
                                                        ${renderDetailRow("Číslo účtu", data.accountNumber, true)}
                                                    </table>
                                                </td>
                                            </tr>
                                            ${qr}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 32px 28px;font-size:13px;line-height:20px;color:#737373;">
                            Fakturu najdete v&nbsp;příloze jako PDF (Faktura-${escapeHtml(data.invoiceId)}.pdf).
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px;border-top:1px solid #e5e5e5;font-size:12px;line-height:18px;color:#737373;">
                            <strong style="color:#404040;">${escapeHtml(data.supplierName)}</strong><br>
                            ${supplierLine}${supplierLine ? "<br>" : ""}
                            <a href="mailto:${escapeHtml(data.supplierEmail)}" style="color:#404040;text-decoration:underline;">${escapeHtml(data.supplierEmail)}</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const text = [
        data.message.trim(),
        "",
        `Faktura: ${data.invoiceId}`,
        `Částka k úhradě: ${data.amount}`,
        `Datum splatnosti: ${data.paymentDate}`,
        `Datum vystavení: ${data.publishDate}`,
        `Variabilní symbol: ${data.variableSymbol}`,
        `Číslo účtu: ${data.accountNumber}`,
        "",
        `Faktura je v příloze jako PDF (Faktura-${data.invoiceId}.pdf).`,
        "",
        "--",
        data.supplierName,
        ...[data.supplierAddress, data.supplierIco ? `IČO ${data.supplierIco}` : "", data.supplierEmail].filter(Boolean)
    ].join("\n");

    return { html, text };
}
