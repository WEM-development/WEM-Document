import { createVerify, X509Certificate } from "node:crypto";
import { devUser, isDevAuthBypass } from "../devBypass";

const certificatesUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certificateCache: { certificates: Record<string, string>, expiresAt: number } | null = null;

async function getCertificatesAsync(): Promise<Record<string, string>> {
    if (certificateCache && certificateCache.expiresAt > Date.now()) {
        return certificateCache.certificates;
    }

    const response = await fetch(certificatesUrl, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Google certificates request failed with ${response.status}`);
    }

    const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 3600);
    const certificates = await response.json() as Record<string, string>;
    certificateCache = { certificates, expiresAt: Date.now() + maxAge * 1000 };

    return certificates;
}

function decodeSegment(segment: string) {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

// Verifies a Firebase ID token like firebase-admin does (RS256, aud, iss, exp) and returns the uid.
export async function verifyIdTokenAsync(idToken: string | null): Promise<string> {
    if (isDevAuthBypass) return devUser.uid;

    const sessionError = new Error("Přihlášení vypršelo. Obnovte stránku a přihlaste se znovu.");
    const segments = idToken?.split(".") ?? [];
    if (segments.length !== 3) throw sessionError;

    const [encodedHeader, encodedPayload, signature] = segments;
    let header: { alg?: string, kid?: string };
    let payload: { aud?: string, iss?: string, sub?: string, exp?: number, iat?: number };
    try {
        header = decodeSegment(encodedHeader);
        payload = decodeSegment(encodedPayload);
    } catch {
        throw sessionError;
    }

    const certificate = header.kid ? (await getCertificatesAsync())[header.kid] : undefined;
    if (header.alg !== "RS256" || !certificate) throw sessionError;

    const isSignatureValid = createVerify("RSA-SHA256")
        .update(`${encodedHeader}.${encodedPayload}`)
        .verify(new X509Certificate(certificate).publicKey, signature, "base64url");

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const now = Math.floor(Date.now() / 1000);
    const isClaimsValid = payload.aud === projectId &&
        payload.iss === `https://securetoken.google.com/${projectId}` &&
        typeof payload.sub === "string" && payload.sub.length > 0 &&
        typeof payload.exp === "number" && payload.exp > now &&
        typeof payload.iat === "number" && payload.iat <= now + 60;

    if (!isSignatureValid || !isClaimsValid) throw sessionError;

    return payload.sub!;
}
