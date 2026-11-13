# WEM – Fakturace

Next.js application for creating, previewing, printing and emailing invoices (PDF) for WEM.

## Features

- Google sign-in (Firebase Auth); access only for users with a profile in Firestore
- Invoice dashboard and editor (items, payment details, QR payment code)
- Customer lookup by IČO (ARES)
- PDF generation with Puppeteer and sending via SMTP (nodemailer) using the profile's mail settings

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Invoice dashboard |
| `/invoice-editor` | New invoice, or edit existing with `?iid=<invoiceId>` |
| `/auth` | Login |
| `/auth-error` | Shown when the signed-in user has no profile |

## Development

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Configuration

Firebase settings are read from `NEXT_PUBLIC_FIREBASE_*` environment variables (see `apphosting.yaml`). For local development, put them in `.env.local`.
