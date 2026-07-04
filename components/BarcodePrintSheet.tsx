import React, { useCallback, useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { InventoryUnit, BarcodeFormat } from '../types';

interface BarcodePrintSheetProps {
  itemName: string;
  itemPrice: number;
  units: InventoryUnit[];
  format: BarcodeFormat;
  onClose: () => void;
}

const formatLabelPrice = (price: number) =>
  `₱${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatLabelTitle = (name: string, price: number) =>
  `${name} ${formatLabelPrice(price)}`;

const Code128Label: React.FC<{ barcode: string; itemName: string; itemPrice: number }> = ({ barcode, itemName, itemPrice }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 1.5,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 4,
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }
  }, [barcode]);

  return (
    <div className="barcode-label border border-gray-300 rounded p-2 flex flex-col items-center bg-white">
      <div className="text-xs font-bold text-gray-900 text-center w-full mb-1 leading-tight px-1">
        {formatLabelTitle(itemName, itemPrice)}
      </div>
      <svg ref={svgRef} className="max-w-full" />
    </div>
  );
};

const QRLabel: React.FC<{ barcode: string; itemName: string; itemPrice: number }> = ({ barcode, itemName, itemPrice }) => (
  <div className="barcode-label border border-gray-300 rounded p-2 flex flex-col items-center bg-white">
    <div className="text-xs font-bold text-gray-900 text-center w-full mb-1 leading-tight px-1">
      {formatLabelTitle(itemName, itemPrice)}
    </div>
    <QRCodeSVG value={barcode} size={100} level="M" />
    <div className="text-[10px] font-mono text-gray-600 mt-1 text-center">{barcode}</div>
  </div>
);

const pxToMm = (px: number) => Math.max(15, Math.ceil((px * 25.4) / 96) + 1);

export const BarcodePrintSheet: React.FC<BarcodePrintSheetProps> = ({ itemName, itemPrice, units, format, onClose }) => {
  const printRootRef = useRef<HTMLDivElement>(null);
  const [labelPageSize, setLabelPageSize] = useState('50mm 30mm');

  const updatePageSize = useCallback(() => {
    const label = printRootRef.current?.querySelector('.barcode-label') as HTMLElement | null;
    if (!label) return;

    const { width, height } = label.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    setLabelPageSize(`${pxToMm(width)}mm ${pxToMm(height)}mm`);
  }, []);

  useEffect(() => {
    updatePageSize();
    const timer = window.setTimeout(updatePageSize, 150);
    return () => window.clearTimeout(timer);
  }, [units, format, itemName, itemPrice, updatePageSize]);

  useEffect(() => {
    const onBeforePrint = () => updatePageSize();
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, [updatePageSize]);

  const handlePrint = () => {
    updatePageSize();
    window.setTimeout(() => window.print(), 50);
  };
  const labelTitle = formatLabelTitle(itemName, itemPrice);

  return (
    <>
      <style>{`
        @page {
          size: ${labelPageSize};
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
          }
          body * { visibility: hidden; }
          #barcode-print-root, #barcode-print-root * { visibility: visible; }
          #barcode-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: auto;
            height: auto;
          }
          .no-print { display: none !important; }
          .label-page {
            page-break-after: always;
            break-after: page;
            display: block;
            width: fit-content;
            height: fit-content;
            padding: 0;
            margin: 0;
            overflow: hidden;
          }
          .label-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .barcode-label {
            border: none !important;
            border-radius: 0 !important;
            padding: 1mm !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
        @media screen {
          .label-page {
            display: inline-block;
            width: fit-content;
            border: 1px dashed #d1d5db;
            border-radius: 4px;
            padding: 0;
            margin-bottom: 12px;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print-overlay">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center no-print">
            <div>
              <h3 className="font-bold text-gray-900">Print Barcode Labels</h3>
              <p className="text-sm text-gray-500">
                {labelTitle} — {units.length} label(s), 1 per page ({labelPageSize}) — {format === 'code128' ? 'Code 128' : 'QR Code'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                In the print dialog, set Margins to None and turn off Headers and footers.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
                Print
              </button>
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium">
                Close
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-4 flex-1">
            <div id="barcode-print-root" ref={printRootRef}>
              {units.map(unit => (
                <div key={unit.id} className="label-page">
                  {format === 'code128' ? (
                    <Code128Label barcode={unit.barcode} itemName={itemName} itemPrice={itemPrice} />
                  ) : (
                    <QRLabel barcode={unit.barcode} itemName={itemName} itemPrice={itemPrice} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
