import puppeteer, { HTTPRequest } from "puppeteer";

const allowedProtocols = ["https:", "data:", "blob:", "about:"];

function isPrivateHost(hostname: string) {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host === "metadata") return true;
    if (/^(0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (host.includes(":")) return host === "::1" || /^(fc|fd|fe8|fe9|fea|feb)/.test(host) || host.startsWith("::ffff:");

    return false;
}

// The HTML comes from the browser, so keep Chromium away from internal network targets.
function isAllowedRequest(request: HTTPRequest) {
    try {
        const url = new URL(request.url());
        return allowedProtocols.includes(url.protocol) && (url.protocol !== "https:" || !isPrivateHost(url.hostname));
    } catch {
        return false;
    }
}

// Shared by e-mail and archive so both produce identical PDFs.
export async function renderInvoicePdfAsync(htmlContent: string): Promise<Uint8Array> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on("request", request => {
            if (request.isInterceptResolutionHandled()) return;

            if (isAllowedRequest(request)) {
                request.continue();
            } else {
                request.abort("blockedbyclient");
            }
        });

        // Set viewport to A4 dimensions at 96 DPI
        await page.setViewport({
            width: 794,  // 210mm at 96 DPI
            height: 1123, // 297mm at 96 DPI
            deviceScaleFactor: 2, // For crisp text
        });

        // Set content and wait for everything to load
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });

        // Generate PDF with A4 format
        return await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            scale: 1,
        });
    } finally {
        await browser.close();
    }
}
