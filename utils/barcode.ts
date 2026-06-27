export const PAYTECH_BARCODE_PATTERN = /^PT-[A-Z0-9]{6}-\d{4}$/i;

export const isValidPaytechBarcode = (text: string): boolean =>
  PAYTECH_BARCODE_PATTERN.test(text.trim());

export const normalizeBarcodeInput = (text: string): string =>
  text.trim().toUpperCase();
