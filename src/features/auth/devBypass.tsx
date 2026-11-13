import { User } from "firebase/auth";
import { Profile } from "@/features/profile/Models";

// Local UI preview only: never active in production builds.
export const isDevAuthBypass = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export const devUser = {
    uid: "dev-preview",
    email: "nahled@localhost",
    displayName: "Náhled (vývoj)",
    photoURL: null
} as User;

export const devProfile: Profile = {
    uid: "dev-preview",
    ico: "12345678",
    supplierName: "Testovací dodavatel",
    address: "Testovací 1, 700 30 Ostrava",
    email: "nahled@localhost",
    emailTemplate: "<p>Dobrý den,</p><p>v příloze zasíláme fakturu č. {{invoiceNumber}} se splatností {{paymentDate}}.</p><p>{{companyName}}</p>",
    emailProvider: "",
    emailPass: "",
    emailAttachments: [],
    signature: "",
    logo: "",
    isTaxRateEnabled: true,
    taxRate: 0.21,
    accountNumber: "123456789",
    bankCode: "0100"
};
