"use server"

import { verifyIdTokenAsync } from "../../auth/server/Token";
import { sendInvoiceModalAsync } from "../../mailer/server/Service";
import { Profile } from "../../profile/Models";
import { renderInvoicePdfAsync } from "./Pdf";

export async function renderInvoicePdfAction(idToken: string | null, htmlContent: string): Promise<string> {
    await verifyIdTokenAsync(idToken);

    const pdf = await renderInvoicePdfAsync(htmlContent);
    return Buffer.from(pdf).toString("base64");
}

export async function sendInvoiceEmailAction(
    idToken: string | null,
    sender: Profile,
    recipientEmail: string,
    emailContent: { header: string, content: string },
    htmlContent: string,
    invoiceId: string
) {
    await verifyIdTokenAsync(idToken);

    // Validate sender profile has email configuration
    if (!sender.email || !sender.emailProvider || !sender.emailPass) {
        throw new Error("Sender profile is missing email configuration. Please configure your email settings in the profile.");
    }

    if (!recipientEmail) {
        throw new Error("Recipient email address is required.");
    }

    try {
        const pdfBuffer = await renderInvoicePdfAsync(htmlContent);

        const result = await sendInvoiceModalAsync(sender, recipientEmail, {
            ...emailContent,
            attachments: [
                ...(sender.emailAttachments || []),
                {
                    filename: `Faktura-${invoiceId}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                    encoding: 'base64'
                }
            ]
        });

        return result;
    } catch (error) {
        console.error('Error sending invoice email:', error);
        throw error;
    }
}
