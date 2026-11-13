import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getIdTokenAsync } from "@/features/auth/getIdToken";
import InvoicePreview from "@/features/invoice/components/InvoicePreview";
import { Invoice } from "@/features/invoice/Models";
import { renderInvoicePdfAction } from "@/features/invoice/server/Actions";
import { recalculateInvoice } from "@/features/invoice/server/Service";
import { ArchiveEntry, FolderSelection, InvoiceFolder, unfiledFolderName } from "../Models";
import { Archive, Folders } from "./Repository";
import { createZip, ZipFile } from "./Zip";

const imageTimeoutMs = 8000;
const downloadConcurrency = 4;

const pluralRules = new Intl.PluralRules("cs-CZ");

export function formatInvoiceCount(count: number) : string {
    const category = pluralRules.select(count);
    const noun = category === "one" ? "faktura" : category === "few" ? "faktury" : "faktur";
    return `${count}\u00a0${noun}`;
}

export function getFolderName(folderId: string | null, folders: InvoiceFolder[]) : string {
    return folders.find(folder => folder.id === folderId)?.name ?? unfiledFolderName;
}

export async function resolveFolderAsync(selection: FolderSelection, uid: string) : Promise<{ folderId: string | null, createdFolder: InvoiceFolder | null }> {
    if (!selection.newFolderName) {
        return { folderId: selection.folderId, createdFolder: null };
    }

    const createdFolder = await Folders.addAsync(selection.newFolderName, uid);
    return { folderId: createdFolder.id, createdFolder };
}

export function toSafeFileName(value: string) : string {
    return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim() || "Bez názvu";
}

// Mirrors getInvoiceHTML() in InvoiceEditor.tsx so archived PDFs match the sent ones.
export function getInvoiceDocumentHTML(element: Element) : string {
    const styles = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
            } catch {
                return '';
            }
        })
        .join('\n');

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <style>${styles}</style>
            </head>
            <body>
                ${element.outerHTML}
            </body>
        </html>
    `;
}

// HeroUI images stay transparent until their load handler runs, so wait for it before capturing.
async function waitForImagesAsync(container: HTMLElement) {
    const deadline = Date.now() + imageTimeoutMs;
    const isReady = () => Array.from(container.querySelectorAll("img")).every(image => {
        if (!image.complete) return false;
        if (image.naturalWidth === 0) return true;
        return !image.className.includes("data-[loaded=true]") || image.dataset.loaded === "true";
    });

    while (!isReady() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// Renders the frozen InvoicePreview off screen and returns the same document the editor sends.
export async function captureInvoiceHtmlAsync(invoice: Invoice) : Promise<string> {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = "position:fixed;top:0;left:-10000px;width:210mm;pointer-events:none;";
    document.body.appendChild(container);

    const root = createRoot(container);
    try {
        flushSync(() => root.render(<InvoicePreview invoice={recalculateInvoice(invoice)} />));
        await waitForImagesAsync(container);

        const element = container.querySelector("#print-area");
        if (!element) {
            throw new Error("Print area not found");
        }

        return getInvoiceDocumentHTML(element);
    } finally {
        root.unmount();
        container.remove();
    }
}

export async function archiveInvoiceHtmlAsync(invoiceId: string, html: string, folderId: string | null, uid: string) : Promise<ArchiveEntry> {
    const pdfBase64 = await renderInvoicePdfAction(await getIdTokenAsync(), html);
    const pdf = Uint8Array.from(atob(pdfBase64), character => character.charCodeAt(0));

    return await Archive.archiveAsync(invoiceId, folderId, pdf, uid);
}

export async function archiveInvoicesAsync(
    invoices: Invoice[],
    folderId: string | null,
    uid: string,
    onProgress?: (done: number) => void
) : Promise<{ archived: ArchiveEntry[], failedIds: string[] }> {
    const archived: ArchiveEntry[] = [];
    const failedIds: string[] = [];

    for (const [index, invoice] of invoices.entries()) {
        try {
            const html = await captureInvoiceHtmlAsync(invoice);
            archived.push(await archiveInvoiceHtmlAsync(invoice.id, html, folderId, uid));
        } catch (error) {
            console.error(`Error archiving invoice ${invoice.id}:`, error);
            failedIds.push(invoice.id);
        }

        onProgress?.(index + 1);
    }

    return { archived, failedIds };
}

export async function createArchiveZipAsync(
    entries: ArchiveEntry[],
    folders: InvoiceFolder[],
    isGroupedByFolder: boolean,
    onProgress?: (done: number) => void
) : Promise<Blob> {
    const files: ZipFile[] = new Array(entries.length);
    let nextIndex = 0;
    let done = 0;

    const downloadNextAsync = async () => {
        while (nextIndex < entries.length) {
            const index = nextIndex++;
            const entry = entries[index];
            const fileName = `Faktura-${toSafeFileName(entry.invoiceId)}.pdf`;

            files[index] = {
                path: isGroupedByFolder ? `${toSafeFileName(getFolderName(entry.folderId, folders))}/${fileName}` : fileName,
                data: new Uint8Array(await Archive.getPdfAsync(entry)),
                modifiedAt: entry.archivedAt
            };

            onProgress?.(++done);
        }
    };

    await Promise.all(Array.from({ length: Math.min(downloadConcurrency, entries.length) }, downloadNextAsync));
    return createZip(files);
}

export function saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function getZipFileName(label: string) : string {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return `Faktury-${toSafeFileName(label).replace(/ /g, "-")}-${date}.zip`;
}
