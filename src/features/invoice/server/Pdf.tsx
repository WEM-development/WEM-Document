import puppeteer, { LaunchOptions, Page } from "puppeteer-core";

const allowedProtocols = ["https:", "data:", "blob:", "about:"];

// App Hosting's runtime image lacks Chrome's system libraries; @sparticuz/chromium ships its own.
async function getLaunchOptionsAsync() : Promise<LaunchOptions> {
    if (process.env.NODE_ENV === "production" && process.platform === "linux") {
        const chromium = (await import("@sparticuz/chromium")).default;
        chromium.setGraphicsMode = false;

        return {
            executablePath: await chromium.executablePath(),
            args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
            headless: "shell"
        };
    }

    const { executablePath } = await import("puppeteer");
    return {
        executablePath: executablePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
    };
}

function isPrivateHost(hostname: string) {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host === "metadata") return true;
    if (/^(0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (host.includes(":")) return host === "::1" || /^(fc|fd|fe8|fe9|fea|feb)/.test(host) || host.startsWith("::ffff:");

    return false;
}

// Content comes from the browser, so keep Chromium and nodemailer away from internal network targets.
export function isPublicUrl(value: string) : boolean {
    try {
        const url = new URL(value);
        return allowedProtocols.includes(url.protocol) && (url.protocol !== "https:" || !isPrivateHost(url.hostname));
    } catch {
        return false;
    }
}

async function withPageAsync<T>(work: (page: Page) => Promise<T>) : Promise<T> {
    const browser = await puppeteer.launch(await getLaunchOptionsAsync());

    try {
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on("request", request => {
            if (request.isInterceptResolutionHandled()) return;

            if (isPublicUrl(request.url())) {
                request.continue();
            } else {
                request.abort("blockedbyclient");
            }
        });

        return await work(page);
    } finally {
        await browser.close();
    }
}

// Shared by e-mail and archive so both produce identical PDFs.
export async function renderInvoicePdfAsync(htmlContent: string): Promise<Uint8Array> {
    return await withPageAsync(async page => {
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
    });
}

const pngCache = new Map<string, Promise<Uint8Array | null>>();

// Gmail and Outlook do not display SVG, so logos are sent as a 2× PNG; cached per server instance.
export function renderImageAsPngAsync(url: string, height: number) : Promise<Uint8Array | null> {
    const key = `${height}:${url}`;
    if (!isPublicUrl(url)) return Promise.resolve(null);

    const cached = pngCache.get(key);
    if (cached) return cached;

    const attributeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const rendering = withPageAsync(async page => {
        await page.setViewport({ width: 1200, height: height + 40, deviceScaleFactor: 2 });
        await page.setContent(
            `<html><body style="margin:0;background:transparent"><img id="image" src="${attributeUrl}" style="display:block;height:${height}px;width:auto"></body></html>`,
            { waitUntil: "networkidle0" }
        );

        const isLoaded = await page.$eval("#image", image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0);
        const image = await page.$("#image");
        if (!isLoaded || !image) return null;

        return await image.screenshot({ type: "png", omitBackground: true });
    }).catch(error => {
        console.error(`Image ${url} could not be rendered:`, error);
        pngCache.delete(key);
        return null;
    });

    pngCache.set(key, rendering);
    return rendering;
}
