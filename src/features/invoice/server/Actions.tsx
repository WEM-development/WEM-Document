"use server"

import Mail from "nodemailer/lib/mailer";
import { verifyIdTokenAsync } from "../../auth/server/Token";
import { buildInvoiceEmail, getLogoUrl, InvoiceEmailData } from "../../mailer/Template";
import { sendMailAsync } from "../../mailer/server/Service";
import { Profile } from "../../profile/Models";
import { InvoicePaymentDetails } from "../Models";
import { isPublicUrl, renderImageAsPngAsync, renderInvoicePdfAsync } from "./Pdf";
import { getQRFetchUrl } from "./Service";

export async function renderInvoicePdfAction(idToken: string | null, htmlContent: string): Promise<string> {
    await verifyIdTokenAsync(idToken);

    const pdf = await renderInvoicePdfAsync(htmlContent);
    return Buffer.from(pdf).toString("base64");
}

export interface SendInvoiceEmailRequest {
    recipientEmail: string;
    subject: string;
    emailData: InvoiceEmailData;
    paymentDetails: InvoicePaymentDetails;
    invoiceHtml: string;
}

// Errors are returned, not thrown: Next.js hides thrown server action messages in production.
export type SendInvoiceEmailResult = { isSent: true } | { isSent: false, error: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logoCid = "logo@wem-faktury";
const qrCid = "qr@wem-faktury";

async function fetchQrPngAsync(paymentDetails: InvoicePaymentDetails) : Promise<Uint8Array | null> {
    try {
        const response = await fetch(getQRFetchUrl(paymentDetails), { signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return null;

        return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
        console.error("QR payment image could not be fetched:", error);
        return null;
    }
}

// Profile attachments are data from the browser: never allow file paths or internal URLs.
function getProfileAttachments(sender: Profile) : Mail.Attachment[] {
    return (sender.emailAttachments ?? []).flatMap((attachment): Mail.Attachment[] => {
        if (!attachment || typeof attachment.filename !== "string") return [];

        const url = [attachment.href, attachment.path].find(value => typeof value === "string" && value.startsWith("https:"));
        if (url && isPublicUrl(url)) {
            return [{ filename: attachment.filename, path: url, contentType: attachment.contentType }];
        }

        if (typeof attachment.content === "string") {
            return [{ filename: attachment.filename, content: attachment.content, encoding: attachment.encoding, contentType: attachment.contentType }];
        }

        return [];
    });
}

function getSendErrorMessage(error: unknown, smtpHost: string) : string {
    const code = (error as { code?: string, responseCode?: number })?.code;
    const responseCode = (error as { responseCode?: number })?.responseCode;

    if (code === "EAUTH" || responseCode === 535) {
        return "Přihlášení k e-mailovému serveru selhalo. Zkontrolujte e-mail a heslo v profilu.";
    }
    if (code === "EENVELOPE" || (responseCode !== undefined && responseCode >= 550 && responseCode <= 553)) {
        return "E-mailový server adresu příjemce odmítl. Zkontrolujte e-mail odběratele.";
    }
    if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET" || code === "EDNS" || code === "ECONNREFUSED") {
        return `Spojení se serverem ${smtpHost} se nepodařilo navázat. Síť nebo firewall pravděpodobně blokuje odesílání e-mailů, zkuste jinou síť nebo port 587.`;
    }

    return "E-mail se nepodařilo odeslat. Zkuste to znovu.";
}

export async function sendInvoiceEmailAction(idToken: string | null, sender: Profile, request: SendInvoiceEmailRequest) : Promise<SendInvoiceEmailResult> {
    try {
        await verifyIdTokenAsync(idToken);
    } catch {
        return { isSent: false, error: "Přihlášení vypršelo. Obnovte stránku a přihlaste se znovu." };
    }

    if (!sender.email || !sender.emailProvider || !sender.emailPass) {
        return { isSent: false, error: "V profilu chybí nastavení odesílání e-mailů (SMTP server nebo heslo)." };
    }

    const recipientEmail = request.recipientEmail.trim();
    if (!emailPattern.test(recipientEmail)) {
        return { isSent: false, error: "E-mail odběratele není platný." };
    }

    const subject = request.subject.replace(/[\r\n]+/g, " ").trim();
    if (!subject) {
        return { isSent: false, error: "Zadejte předmět e-mailu." };
    }

    let pdf: Uint8Array;
    try {
        pdf = await renderInvoicePdfAsync(request.invoiceHtml);
    } catch (error) {
        console.error("Error rendering invoice PDF:", error);
        return { isSent: false, error: "PDF faktury se nepodařilo vytvořit. Zkuste to znovu." };
    }

    const [logo, qr] = await Promise.all([
        renderImageAsPngAsync(getLogoUrl(sender), 40),
        fetchQrPngAsync(request.paymentDetails)
    ]);

    const email = buildInvoiceEmail(request.emailData, {
        logoSrc: logo ? `cid:${logoCid}` : null,
        qrSrc: qr ? `cid:${qrCid}` : null
    });

    const invoiceId = request.emailData.invoiceId.replace(/[^\w.-]/g, "-");
    const attachments: Mail.Attachment[] = [
        ...getProfileAttachments(sender),
        { filename: `Faktura-${invoiceId}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" },
        ...(logo ? [{ filename: "logo.png", content: Buffer.from(logo), contentType: "image/png", cid: logoCid, contentDisposition: "inline" as const }] : []),
        ...(qr ? [{ filename: "qr-platba.png", content: Buffer.from(qr), contentType: "image/png", cid: qrCid, contentDisposition: "inline" as const }] : [])
    ];

    try {
        await sendMailAsync(sender, { to: recipientEmail, subject, html: email.html, text: email.text, attachments });
        return { isSent: true };
    } catch (error) {
        console.error("Error sending invoice email:", error);
        return { isSent: false, error: getSendErrorMessage(error, sender.emailProvider) };
    }
}
