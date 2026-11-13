export interface ZipFile {
    path: string;
    data: Uint8Array<ArrayBuffer>;
    modifiedAt?: Date;
}

const utf8NameFlag = 0x0800;
const zipVersion = 20;

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let crc = n;
        for (let bit = 0; bit < 8; bit++) {
            crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        table[n] = crc >>> 0;
    }
    return table;
})();

export function crc32(data: Uint8Array) : number {
    let crc = 0xffffffff;
    for (let index = 0; index < data.length; index++) {
        crc = crcTable[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
}

// Stored (uncompressed) ZIP: PDFs are already compressed, so deflate would gain almost nothing.
export function createZip(files: ZipFile[]) : Blob {
    const encoder = new TextEncoder();
    const localParts: BlobPart[] = [];
    const centralParts: BlobPart[] = [];
    let offset = 0;
    let centralSize = 0;

    for (const file of files) {
        const name = encoder.encode(file.path);
        const size = file.data.byteLength;
        const checksum = crc32(file.data);
        const { time, date } = toDosDateTime(file.modifiedAt ?? new Date());

        if (offset + 30 + name.length + size > 0xffffffff) {
            throw new Error("ZIP archive exceeds 4 GB");
        }

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, zipVersion, true);
        local.setUint16(6, utf8NameFlag, true);
        local.setUint16(8, 0, true);
        local.setUint16(10, time, true);
        local.setUint16(12, date, true);
        local.setUint32(14, checksum, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);
        localParts.push(local.buffer, name, file.data);

        const central = new DataView(new ArrayBuffer(46));
        central.setUint32(0, 0x02014b50, true);
        central.setUint16(4, zipVersion, true);
        central.setUint16(6, zipVersion, true);
        central.setUint16(8, utf8NameFlag, true);
        central.setUint16(10, 0, true);
        central.setUint16(12, time, true);
        central.setUint16(14, date, true);
        central.setUint32(16, checksum, true);
        central.setUint32(20, size, true);
        central.setUint32(24, size, true);
        central.setUint16(28, name.length, true);
        central.setUint16(30, 0, true);
        central.setUint16(32, 0, true);
        central.setUint16(34, 0, true);
        central.setUint16(36, 0, true);
        central.setUint32(38, 0, true);
        central.setUint32(42, offset, true);
        centralParts.push(central.buffer, name);

        offset += 30 + name.length + size;
        centralSize += 46 + name.length;
    }

    if (files.length > 0xffff) {
        throw new Error("ZIP archive has too many files");
    }

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end.buffer], { type: "application/zip" });
}
