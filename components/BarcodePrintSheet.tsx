import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bluetooth, Loader2 } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { InventoryUnit, BarcodeFormat } from '../types';
import { isNiimbotSupported, printLabelsToNiimbot } from '../utils/niimbotPrint';

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

const LabelPages: React.FC<{
  units: InventoryUnit[];
  format: BarcodeFormat;
  itemName: string;
  itemPrice: number;
}> = ({ units, format, itemName, itemPrice }) => (
  <>
    {units.map(unit => (
      <div key={unit.id} className="label-page">
        {format === 'code128' ? (
          <Code128Label barcode={unit.barcode} itemName={itemName} itemPrice={itemPrice} />
        ) : (
          <QRLabel barcode={unit.barcode} itemName={itemName} itemPrice={itemPrice} />
        )}
      </div>
    ))}
  </>
);

export const BarcodePrintSheet: React.FC<BarcodePrintSheetProps> = ({ itemName, itemPrice, units, format, onClose }) => {
  const printRootRef = useRef<HTMLDivElement>(null);
  const [labelPageSize, setLabelPageSize] = useState('50mm 30mm');
  const [niimbotStatus, setNiimbotStatus] = useState<string | null>(null);
  const [isNiimbotPrinting, setIsNiimbotPrinting] = useState(false);
  const niimbotAvailable = isNiimbotSupported();

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
    window.setTimeout(() => window.print(), 300);
  };

  const handleNiimbotPrint = async () => {
    setIsNiimbotPrinting(true);
    setNiimbotStatus('Starting…');
    try {
      await printLabelsToNiimbot({
        itemName,
        itemPrice,
        barcodes: units.map(unit => unit.barcode),
        format,
        onProgress: setNiimbotStatus,
      });
      setNiimbotStatus('Done! Labels sent to Niimbot.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Niimbot print failed';
      setNiimbotStatus(message);
      alert(message);
    } finally {
      setIsNiimbotPrinting(false);
    }
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
            overflow: visible !important;
          }
          body > *:not(#barcode-print-root) {
            display: none !important;
          }
          #barcode-print-root {
            display: block !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            visibility: visible !important;
          }
          #barcode-print-root * {
            visibility: visible !important;
          }
          .label-page {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            display: block !important;
            width: fit-content;
            height: fit-content;
            padding: 0;
            margin: 0;
            overflow: visible;
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
          #barcode-print-root {
            position: fixed;
            left: -10000px;
            top: 0;
            width: auto;
            height: auto;
            overflow: visible;
            pointer-events: none;
            visibility: hidden;
          }
          .label-preview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 12px;
          }
          .label-preview-grid .label-page {
            display: inline-block;
            width: fit-content;
            border: 1px dashed #d1d5db;
            border-radius: 4px;
            padding: 0;
          }
        }
      `}</style>

      {createPortal(
        <div id="barcode-print-root" ref={printRootRef}>
          <LabelPages units={units} format={format} itemName={itemName} itemPrice={itemPrice} />
        </div>,
        document.body
      )}

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900">Print Barcode Labels</h3>
              <p className="text-sm text-gray-500">
                {labelTitle} — {units.length} label(s), 1 per page ({labelPageSize}) — {format === 'code128' ? 'Code 128' : 'QR Code'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {niimbotAvailable
                  ? 'Use Print to Niimbot for direct Bluetooth printing (Chrome/Edge). Browser Print is for PDF or regular printers.'
                  : 'Browser print works for PDF or regular printers. Niimbot direct print needs Chrome or Edge over HTTPS.'}
              </p>
              {niimbotStatus && (
                <p className={`text-xs mt-1 ${isNiimbotPrinting ? 'text-blue-600' : 'text-gray-500'}`}>
                  {isNiimbotPrinting && <Loader2 size={12} className="inline animate-spin mr-1" />}
                  {niimbotStatus}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {niimbotAvailable && (
                <button
                  onClick={handleNiimbotPrint}
                  disabled={isNiimbotPrinting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isNiimbotPrinting ? <Loader2 size={16} className="animate-spin" /> : <Bluetooth size={16} />}
                  Print to Niimbot
                </button>
              )}
              <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
                Browser Print
              </button>
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium">
                Close
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-4 flex-1">
            <div className="label-preview-grid">
              <LabelPages units={units} format={format} itemName={itemName} itemPrice={itemPrice} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
