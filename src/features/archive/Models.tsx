export interface InvoiceFolder {
    id: string;
    name: string;
    createdAt: Date;
}

export interface ArchiveEntry {
    invoiceId: string;
    folderId: string | null;
    archivedAt: Date;
    archivedBy: string;
    pdfPath: string;
    pdfSize: number;
}

export interface FolderSelection {
    folderId: string | null;
    newFolderName: string | null;
}

export const unfiledFolderName = "Nezařazeno";
