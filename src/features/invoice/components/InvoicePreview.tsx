"use client"

import { Image } from "@heroui/react";
import { Invoice } from "../Models";
import WEMLogo from "@/components/common/WEMLogo";

interface InvoicePreviewProps {
    invoice: Invoice;
}

export default function InvoicePreview({ invoice }: InvoicePreviewProps) {

    // Pagination logic
    const ITEMS_PER_FIRST_PAGE = 8;
    const ITEMS_PER_PAGE = 18;
    
    const pages = [];
    const items = [...invoice.items];
    
    // First page
    pages.push({
        items: items.slice(0, ITEMS_PER_FIRST_PAGE),
        pageNumber: 1,
        isFirst: true,
        isLast: items.length <= ITEMS_PER_FIRST_PAGE
    });
    
    // Subsequent pages
    for (let i = ITEMS_PER_FIRST_PAGE; i < items.length; i += ITEMS_PER_PAGE) {
        const chunk = items.slice(i, i + ITEMS_PER_PAGE);
        pages.push({
            items: chunk,
            pageNumber: pages.length + 1,
            isFirst: false,
            isLast: i + ITEMS_PER_PAGE >= items.length
        });
    }

    return (
        <div id="print-area">
            {pages.map((page, index) => (
                <div 
                    key={index}
                    className={`flex flex-col min-h-[297mm] bg-white w-full max-w-[210mm] rounded-lg border-1 border-gray-200 print:border-none p-8 print:p-6 shadow-sm print:shadow-none text-sm relative ${index < pages.length - 1 ? 'mb-8 print:mb-0' : ''}`}
                    style={index < pages.length - 1 ? { pageBreakAfter: 'always' } : {}}
                >
                    {/* Header */}
                    {page.isFirst ? (
                        <>
                            <div className="flex justify-between items-start mb-8 print:mb-4">
                                <div className="flex items-center gap-4">
                                    <WEMLogo
                                        width={96}
                                        height={96}
                                    />
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-800">FAKTURA</h1>
                                        <p className="text-gray-700">č. {invoice.id}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p><span className="font-semibold">Datum vystavení:</span> {invoice.publishDate.toLocaleDateString('cs-CZ')}</p>
                                    <p><span className="font-semibold">Datum splatnosti:</span> {invoice.paymentDate.toLocaleDateString('cs-CZ')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 print:gap-4 mb-8 print:mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b border-gray-600 pb-1 mb-2">Dodavatel</h3>
                                    <p className="font-semibold">{invoice.supplier.name}</p>
                                    <p>{invoice.supplier.address}</p>
                                    <p>{invoice.supplier.ico != "" ? "IČO:" + invoice.supplier.ico : ""}</p>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b border-gray-600 pb-1 mb-2">Odběratel</h3>
                                    <p className="font-semibold">{invoice.customer.name}</p>
                                    <p>{invoice.customer.address}</p>
                                    <p>{invoice.customer.ico != "" ? "IČO:" + invoice.customer.ico : ""}</p>
                                    <p>{invoice.customer.email}</p>
                                    {(invoice.identificationOrder && <p>{"Číslo objednávky: " +  invoice.identificationOrder}</p>)}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between mb-8 print:mb-4 border-b pb-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">FAKTURA - pokračování</h1>
                                <p className="text-gray-700">č. {invoice.id} - Strana {page.pageNumber}</p>
                            </div>
                            <div className="text-right">
                                <p><span className="font-semibold">Datum vystavení:</span> {invoice.publishDate.toLocaleDateString('cs-CZ')}</p>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex flex-col flex-grow">
                        {page.isFirst && (
                            <div className="w-full h-auto flex flex-row gap-8 items-center justify-between mb-4">
                                <div className="float-left w-full h-auto p-6 print:p-4 bg-gray-100 rounded-lg grid grid-cols-4 grid-rows-2 gap-8 print:gap-4">
                                    <div className="col-span-2">
                                        <p className="font-bold border-b border-gray-400 pb-1 mb-2 text-gray-800">Bankovní účet</p>
                                        <p className="text-m">{invoice.paymentDetails.accountNumber}/{invoice.paymentDetails.bankCode}</p>
                                    </div>
                                    <div className="col-span-1">
                                        <p className="font-bold border-b border-gray-400 pb-1 mb-2 text-gray-800">Var. symbol</p>
                                        <p className="text-m">{invoice.paymentDetails.variableSymbol}</p>
                                    </div>

                                    <div className="col-span-1">
                                        <p className="font-bold border-b border-gray-400 pb-1 mb-2 text-gray-800">Cena</p>
                                        <p className="text-m">{invoice.paymentDetails.amount.toLocaleString('cs-CZ')} {invoice.paymentDetails.currency}</p>
                                    </div>

                                    <div className="col-span-4">
                                        <p className="font-bold border-b border-gray-400 pb-1 mb-2 text-gray-800">Zpráva pro příjemce</p>
                                        <p className="text-m">{invoice.paymentDetails.message}</p>
                                    </div>
                                </div>
                                {invoice.paymentDetails.qrFetchURL && (
                                    <div className="float-right">
                                        <Image
                                            alt="QR platba"
                                            src={invoice.paymentDetails.qrFetchURL}
                                            width={235}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex-grow">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b-2 border-gray-600">
                                        <th className="py-2">Položka</th>
                                        <th className="py-2 text-right">Množství</th>
                                        <th className="py-2 text-right">Cena/ks</th>
                                        <th className="py-2 text-right">Celkem bez DPH</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {page.items.map((item, index) => (
                                        <tr key={index} className="border-b border-gray-300">
                                            <td className="py-2">{item.description}</td>
                                            <td className="py-2 text-right">{item.amount}</td>
                                            <td className="py-2 text-right">{item.price.toLocaleString('cs-CZ')} Kč</td>
                                            <td className="py-2 text-right font-medium">{(item.amount * item.price).toLocaleString('cs-CZ')} Kč</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {page.isLast && (
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-600">
                                            <td colSpan={3} className="py-2 text-right text-gray-800">Mezisoučet bez DPH:</td>
                                            <td className="py-2 text-right font-medium">
                                                {invoice.itemsPrice.toLocaleString('cs-CZ')} Kč
                                            </td>
                                        </tr>
                                        {invoice.configuration.isTaxRateEnabled && (<tr>
                                            <td colSpan={3} className="py-2 text-right text-gray-800">DPH (21%):</td>
                                            <td className="py-2 text-right font-medium">
                                                {(invoice.itemsPrice * invoice.configuration.taxRate).toLocaleString('cs-CZ')} Kč
                                            </td>
                                        </tr>)}
                                        <tr className="bg-gray-100">
                                            <td colSpan={3} className="py-4 text-right font-bold text-lg">Celkem k úhradě:</td>
                                            <td className="py-4 text-right font-bold text-lg text-primary">
                                                {invoice.paymentDetails.amount.toLocaleString('cs-CZ')} Kč
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {page.isLast && (
                        <div className="mt-8 mb-8 print:mt-4 print:mb-4 grid grid-cols-2 gap-8">
                            <div>
                                {/* Optional: Notes or payment details */}
                            </div>
                            <div className="flex flex-col items-center justify-end">
                                <div className="h-24 print:h-16 w-48 border-b-1 border-gray-400 mb-1">
                                    {invoice.configuration.signature && (
                                        <Image
                                            alt="Profile signature"
                                            src={invoice.configuration.signature}
                                            width={235}
                                            className="mt-1"
                                        />
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 mt-2">Podpis dodavatele</p>
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-auto w-full text-right text-gray-400 text-xs">
                        Strana {page.pageNumber} z {pages.length}
                    </div>
                </div>
            ))}
        </div>
    );
}
