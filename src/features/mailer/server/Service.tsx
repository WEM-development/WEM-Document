import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { Profile } from "../../profile/Models";

export interface SmtpSettings {
    host: string;
    port: number;
    secure: boolean;
}

// `emailProvider` is "smtp.example.cz" (implicit TLS on 465) or "smtp.example.cz:587" (STARTTLS).
export function parseSmtpSettings(emailProvider: string) : SmtpSettings {
    const [host, portText] = emailProvider.trim().split(":");
    const port = Number(portText) || 465;

    return { host, port, secure: port === 465 };
}

export interface OutgoingMail {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments: Mail.Attachment[];
}

export async function sendMailAsync(sender: Profile, mail: OutgoingMail) {
    const smtp = parseSmtpSettings(sender.emailProvider);
    const transport = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: !smtp.secure,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
        auth: {
            user: sender.email,
            pass: sender.emailPass
        }
    });

    try {
        await transport.sendMail({
            from: { name: sender.supplierName, address: sender.email },
            replyTo: sender.email,
            to: mail.to,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            attachments: mail.attachments,
            disableFileAccess: true
        });
    } finally {
        transport.close();
    }
}
