import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    const scannerId = 'barcode-scanner-region';
    let mounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (cameras.length === 0) {
          setError('No camera found on this device.');
          setIsStarting(false);
          return;
        }

        const rearCamera = cameras.find(c =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
        );
        const cameraId = rearCamera?.id || cameras[cameras.length - 1].id;

        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText.trim());
          },
          () => {}
        );

        if (mounted) setIsStarting(false);
      } catch (e: any) {
        console.error('Scanner start error:', e);
        if (mounted) {
          setError(e?.message || 'Failed to start camera. Check permissions.');
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold">
            <Camera size={20} />
            Scan Barcode
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-2">{error}</p>
              <p className="text-sm text-gray-500">Use a USB scanner or type the barcode in the search field.</p>
            </div>
          ) : (
            <>
              <div id="barcode-scanner-region" className="w-full rounded overflow-hidden" />
              {isStarting && (
                <p className="text-center text-sm text-gray-500 mt-2">Starting camera...</p>
              )}
              <p className="text-center text-xs text-gray-400 mt-3">Point camera at barcode or QR code</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
