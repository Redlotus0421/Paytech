import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { isValidPaytechBarcode, normalizeBarcodeInput } from '../utils/barcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const stopScannerSafely = async (scanner: Html5Qrcode | null): Promise<void> => {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch {
    // Scanner may already be stopped
  }
  try {
    scanner.clear();
  } catch {
    // clear() can fail if DOM node is gone — safe to ignore
  }
};

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const processingRef = useRef(false);
  const [error, setError] = useState('');
  const [isStarting, setIsStarting] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const handleClose = useCallback(async () => {
    await stopScannerSafely(scannerRef.current);
    scannerRef.current = null;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    const scannerId = 'barcode-scanner-region';
    let mounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.7;
            return { width: Math.floor(size), height: Math.floor(size) };
          },
          aspectRatio: 1.0,
        };

        const onDecode = (decodedText: string) => {
          if (!mounted || processingRef.current) return;

          const normalized = normalizeBarcodeInput(decodedText);
          if (!isValidPaytechBarcode(normalized)) return;

          processingRef.current = true;
          setStatusMessage(`Found: ${normalized}`);
          onScanRef.current(normalized);

          setTimeout(() => {
            processingRef.current = false;
            if (mounted) setStatusMessage('');
          }, 2000);
        };

        // Prefer rear camera on mobile via facingMode
        try {
          await scanner.start(
            { facingMode: 'environment' },
            config,
            onDecode,
            () => {}
          );
        } catch {
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
          await scanner.start(cameraId, config, onDecode, () => {});
        }

        if (mounted) setIsStarting(false);
      } catch (e: unknown) {
        console.error('Scanner start error:', e);
        if (mounted) {
          const msg = e instanceof Error ? e.message : 'Failed to start camera. Check permissions.';
          setError(msg);
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      stopScannerSafely(scanner);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold">
            <Camera size={20} />
            Scan Barcode
          </div>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-white">
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
              <div id="barcode-scanner-region" className="w-full rounded overflow-hidden min-h-[240px]" />
              {isStarting && (
                <p className="text-center text-sm text-gray-500 mt-2">Starting camera...</p>
              )}
              {statusMessage && (
                <p className="text-center text-sm text-green-600 mt-2 font-medium">{statusMessage}</p>
              )}
              <p className="text-center text-xs text-gray-400 mt-3">
                Point camera at a Paytech label (PT-XXXXXX-0001)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
