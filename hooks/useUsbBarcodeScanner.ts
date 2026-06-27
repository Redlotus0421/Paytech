import { useEffect, useRef, useState, useCallback, RefObject } from 'react';
import { isValidPaytechBarcode, normalizeBarcodeInput } from '../utils/barcode';

const SESSION_KEY = 'paytech_scanner_detected';
const IDLE_RESET_MS = 100;
const FAST_SCAN_MS = 80;
const SCAN_COOLDOWN_MS = 500;

const readScannerDetected = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistScannerDetected = (): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, 'true');
  } catch {
    // ignore
  }
};

const isExcludedTarget = (target: EventTarget | null, scanInputRef: RefObject<HTMLInputElement | null>): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (scanInputRef.current && target === scanInputRef.current) return true;
  if (target.closest('[data-pos-exclude-wedge]')) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target instanceof HTMLInputElement) {
    const type = target.type;
    if (type === 'number' || type === 'date' || type === 'password') return true;
  }
  return false;
};

interface UseUsbBarcodeScannerOptions {
  enabled: boolean;
  scanInputRef: RefObject<HTMLInputElement | null>;
  onScan: (barcode: string) => void;
  onScannerDetected?: () => void;
}

export const useUsbBarcodeScanner = ({ enabled, scanInputRef, onScan, onScannerDetected }: UseUsbBarcodeScannerOptions) => {
  const [scannerDetected, setScannerDetected] = useState(readScannerDetected);
  const onScanRef = useRef(onScan);
  const onScannerDetectedRef = useRef(onScannerDetected);
  const bufferRef = useRef('');
  const bufferStartRef = useRef(0);
  const lastKeyTimeRef = useRef(0);
  const lastScanTimeRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onScanRef.current = onScan;
  onScannerDetectedRef.current = onScannerDetected;

  const markScannerDetected = useCallback(() => {
    setScannerDetected(true);
    persistScannerDetected();
    onScannerDetectedRef.current?.();
  }, []);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    bufferStartRef.current = 0;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const submitBarcode = useCallback((raw: string) => {
    const normalized = normalizeBarcodeInput(raw);
    if (!isValidPaytechBarcode(normalized)) {
      resetBuffer();
      return;
    }

    const now = Date.now();
    if (now - lastScanTimeRef.current < SCAN_COOLDOWN_MS) {
      resetBuffer();
      return;
    }

    const elapsed = bufferStartRef.current > 0 ? now - bufferStartRef.current : FAST_SCAN_MS + 1;
    if (elapsed <= FAST_SCAN_MS) {
      markScannerDetected();
    }

    lastScanTimeRef.current = now;
    resetBuffer();
    onScanRef.current(normalized);
  }, [markScannerDetected, resetBuffer]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isExcludedTarget(e.target, scanInputRef)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        if (bufferRef.current) {
          e.preventDefault();
          submitBarcode(bufferRef.current);
        }
        return;
      }

      if (e.key.length !== 1) return;

      if (now - lastKeyTimeRef.current > IDLE_RESET_MS) {
        bufferRef.current = '';
        bufferStartRef.current = now;
      }

      lastKeyTimeRef.current = now;
      bufferRef.current += e.key;

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(resetBuffer, IDLE_RESET_MS);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [enabled, scanInputRef, submitBarcode, resetBuffer]);

  return { scannerDetected, markScannerDetected };
};
