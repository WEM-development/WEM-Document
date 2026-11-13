import { auth } from "@/features/firebase/config";
import { isDevAuthBypass } from "./devBypass";

export async function getIdTokenAsync(): Promise<string | null> {
    if (isDevAuthBypass) return null;

    const user = auth.currentUser;
    if (!user) {
        throw new Error("Přihlášení vypršelo. Obnovte stránku a přihlaste se znovu.");
    }

    return await user.getIdToken();
}
