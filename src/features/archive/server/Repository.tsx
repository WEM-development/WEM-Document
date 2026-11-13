import { deleteDoc, doc, DocumentData, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, WriteBatch, writeBatch } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { InvoiceArchiveScheme, InvoiceFolderScheme } from "../../firebase/collections";
import { database, storage } from "../../firebase/config";
import { getCollection, getReferenceObject } from "../../firebase/utilities";
import { ArchiveEntry, InvoiceFolder } from "../Models";

function toDate(value: unknown) : Date {
    return value instanceof Timestamp ? value.toDate() : new Date();
}

const batchLimit = 450;

async function commitInBatchesAsync<T>(items: T[], write: (batch: WriteBatch, item: T) => void) {
    for (let start = 0; start < items.length; start += batchLimit) {
        const batch = writeBatch(database);
        items.slice(start, start + batchLimit).forEach(item => write(batch, item));
        await batch.commit();
    }
}

function mapEntry(invoiceId: string, data: DocumentData) : ArchiveEntry {
    return {
        invoiceId: invoiceId,
        folderId: data.folderId ?? null,
        archivedAt: toDate(data.archivedAt),
        archivedBy: data.archivedBy ?? "",
        pdfPath: data.pdfPath,
        pdfSize: data.pdfSize ?? 0
    };
}

export interface ArchiveRepository {
    getEntriesAsync() : Promise<ArchiveEntry[]>;
    getEntryAsync(invoiceId: string) : Promise<ArchiveEntry | null>;
    archiveAsync(invoiceId: string, folderId: string | null, pdf: Uint8Array<ArrayBuffer>, uid: string) : Promise<ArchiveEntry>;
    restoreAsync(invoiceId: string) : Promise<void>;
    moveAsync(invoiceIds: string[], folderId: string | null) : Promise<void>;
    getPdfAsync(entry: ArchiveEntry) : Promise<ArrayBuffer>;
}

export interface FolderRepository {
    getAllAsync() : Promise<InvoiceFolder[]>;
    addAsync(name: string, uid: string) : Promise<InvoiceFolder>;
    renameAsync(folderId: string, name: string) : Promise<void>;
    removeAsync(folderId: string) : Promise<void>;
}

class FirebaseArchiveRepository implements ArchiveRepository {
    async getEntriesAsync() : Promise<ArchiveEntry[]> {
        const snapshot = await getDocs(getCollection(InvoiceArchiveScheme));
        return snapshot.docs.map(document => mapEntry(document.id, document.data()));
    }

    async getEntryAsync(invoiceId: string) : Promise<ArchiveEntry | null> {
        const snapshot = await getDoc(getReferenceObject(InvoiceArchiveScheme, invoiceId));
        return snapshot.exists() ? mapEntry(snapshot.id, snapshot.data()) : null;
    }

    // The PDF is stored before the entry, so an existing entry always has its snapshot.
    async archiveAsync(invoiceId: string, folderId: string | null, pdf: Uint8Array<ArrayBuffer>, uid: string) : Promise<ArchiveEntry> {
        const pdfPath = `invoice_pdfs/${encodeURIComponent(invoiceId)}.pdf`;
        await uploadBytes(ref(storage, pdfPath), pdf, { contentType: "application/pdf" });

        const entry: ArchiveEntry = {
            invoiceId: invoiceId,
            folderId: folderId,
            archivedAt: new Date(),
            archivedBy: uid,
            pdfPath: pdfPath,
            pdfSize: pdf.byteLength
        };

        await setDoc(getReferenceObject(InvoiceArchiveScheme, invoiceId), {
            folderId: entry.folderId,
            archivedAt: Timestamp.fromDate(entry.archivedAt),
            archivedBy: entry.archivedBy,
            pdfPath: entry.pdfPath,
            pdfSize: entry.pdfSize
        });

        return entry;
    }

    async restoreAsync(invoiceId: string) : Promise<void> {
        const entry = await this.getEntryAsync(invoiceId);
        await deleteDoc(getReferenceObject(InvoiceArchiveScheme, invoiceId));

        if (!entry) return;

        try {
            await deleteObject(ref(storage, entry.pdfPath));
        } catch (error) {
            // An orphaned snapshot is harmless and gets overwritten by the next archive.
            console.error(`Archived PDF ${entry.pdfPath} was not deleted:`, error);
        }
    }

    async moveAsync(invoiceIds: string[], folderId: string | null) : Promise<void> {
        await commitInBatchesAsync(invoiceIds, (batch, invoiceId) => {
            batch.update(getReferenceObject(InvoiceArchiveScheme, invoiceId), { folderId: folderId });
        });
    }

    async getPdfAsync(entry: ArchiveEntry) : Promise<ArrayBuffer> {
        return await getBytes(ref(storage, entry.pdfPath));
    }
}

class FirebaseFolderRepository implements FolderRepository {
    async getAllAsync() : Promise<InvoiceFolder[]> {
        const snapshot = await getDocs(getCollection(InvoiceFolderScheme));
        return snapshot.docs
            .map(document => ({ id: document.id, name: document.data().name ?? "", createdAt: toDate(document.data().idt) }))
            .sort((a, b) => a.name.localeCompare(b.name, "cs-CZ"));
    }

    async addAsync(name: string, uid: string) : Promise<InvoiceFolder> {
        const reference = doc(getCollection(InvoiceFolderScheme));
        const folder: InvoiceFolder = { id: reference.id, name: name, createdAt: new Date() };

        await setDoc(reference, { name: folder.name, idt: Timestamp.fromDate(folder.createdAt), createdBy: uid });
        return folder;
    }

    async renameAsync(folderId: string, name: string) : Promise<void> {
        await updateDoc(getReferenceObject(InvoiceFolderScheme, folderId), { name: name });
    }

    // Invoices of a removed folder move to „Nezařazeno“; nothing is deleted from the archive.
    async removeAsync(folderId: string) : Promise<void> {
        const entries = await getDocs(query(getCollection(InvoiceArchiveScheme), where("folderId", "==", folderId)));
        await commitInBatchesAsync(entries.docs, (batch, entry) => batch.update(entry.ref, { folderId: null }));
        await deleteDoc(getReferenceObject(InvoiceFolderScheme, folderId));
    }
}

export const Archive: ArchiveRepository = new FirebaseArchiveRepository();
export const Folders: FolderRepository = new FirebaseFolderRepository();
