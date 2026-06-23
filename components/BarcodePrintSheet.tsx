import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { InventoryUnit, BarcodeFormat } from '../types';

interface BarcodePrintSheetProps {
  itemName: string;
  units: InventoryUnit[];
  format: BarcodeFormat;
  onClose: () => void;
}

const Code128Label: React.FC<{ barcode: string; itemName: string }> = ({ barcode, itemName }) => {
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
    <div className="barcode-label border border-gray-300 rounded p-2 flex flex-col items-center bg-white break-inside-avoid">
      <div className="text-xs font-semibold text-gray-800 text-center truncate w-full mb-1">{itemName}</div>
      <svg ref={svgRef} className="max-w-full" />
    </div>
  );
};

const QRLabel: React.FC<{ barcode: string; itemName: string }> = ({ barcode, itemName }) => (
  <div className="barcode-label border border-gray-300 rounded p-2 flex flex-col items-center bg-white break-inside-avoid">
    <div className="text-xs font-semibold text-gray-800 text-center truncate w-full mb-1">{itemName}</div>
    <QRCodeSVG value={barcode} size={100} level="M" />
    <div className="text-[10px] font-mono text-gray-600 mt-1 text-center">{barcode}</div>
  </div>
);

export const BarcodePrintSheet: React.FC<BarcodePrintSheetProps> = ({ itemName, units, format, onClose }) => {
  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #barcode-print-root, #barcode-print-root * { visibility: visible; }
          #barcode-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print { display: none !important; }
          .barcode-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
        }
        @media screen {
          .barcode-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print-overlay">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center no-print">
            <div>
              <h3 className="font-bold text-gray-900">Print Barcode Labels</h3>
              <p className="text-sm text-gray-500">{itemName} — {units.length} label(s) — {format === 'code128' ? 'Code 128' : 'QR Code'}</p>
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
            <div id="barcode-print-root">
              <div className="barcode-grid">
                {units.map(unit => (
                  format === 'code128' ? (
                    <Code128Label key={unit.id} barcode={unit.barcode} itemName={itemName} />
                  ) : (
                    <QRLabel key={unit.id} barcode={unit.barcode} itemName={itemName} />
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
