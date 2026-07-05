import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import registry from 'niimbot-web-bluetooth/registry.json';
import 'niimbot-web-bluetooth/src/niimbot.js';
import { BarcodeFormat, NiimbotLabelSettings } from '../types';
import type { NiimbotLabelSize, NiimbotModel, NiimbotPrinterInfo } from '../types/niimbot';
import { buildNiimbotLabel } from './niimbotLabelSizes';

const MODEL_SIZE_MAP: Record<string, keyof typeof registry.sizes> = {
  b1pro: 'T50x30',
  b1: 'T50x30_b1',
  m2h: 'T50x30_m2h',
};

const formatLabelPrice = (price: number) =>
  `₱${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatLabelTitle = (name: string, price: number) =>
  `${name} ${formatLabelPrice(price)}`;

export const isNiimbotSupported = () => !!window.Niimbot?.isSupported();

const getNiimbot = () => {
  const api = window.Niimbot;
  if (!api?.isSupported()) {
    throw new Error('Niimbot printing requires Chrome or Edge over HTTPS.');
  }
  return api;
};

const findModelKeyById = (modelId: number): keyof typeof registry.models | null => {
  const match = Object.entries(registry.models).find(([, model]) => model.id === modelId);
  return match ? (match[0] as keyof typeof registry.models) : null;
};

export const resolveNiimbotConfig = (printerInfo?: NiimbotPrinterInfo | null) => {
  const defaultModelKey = registry.default_model as keyof typeof registry.models;
  const modelKey = (printerInfo?.modelId && findModelKeyById(printerInfo.modelId)) || defaultModelKey;
  const sizeKey = MODEL_SIZE_MAP[modelKey] || registry.default_size;
  const model = registry.models[modelKey] as NiimbotModel;
  const size = registry.sizes[sizeKey] as NiimbotLabelSize;

  return { modelKey, model, size, modelLabel: model.label || 'Niimbot printer' };
};

export async function renderLabelToBlobUrl(options: {
  itemName: string;
  itemPrice: number;
  barcode: string;
  format: BarcodeFormat;
  size: NiimbotLabelSize;
  contentHeightPx?: number;
}): Promise<string> {
  const { itemName, itemPrice, barcode, format, size } = options;
  const { w_px, h_px } = size;
  const layoutH = options.contentHeightPx ?? h_px;
  const margin = size.margin ?? 10;

  const canvas = document.createElement('canvas');
  canvas.width = w_px;
  canvas.height = h_px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create label canvas');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w_px, h_px);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let y = margin;
  const title = formatLabelTitle(itemName, itemPrice);
  const titleFontSize = Math.max(14, Math.round(w_px * 0.045));
  ctx.font = `bold ${titleFontSize}px Arial, sans-serif`;
  ctx.fillText(title, w_px / 2, y);
  y += titleFontSize + Math.round(margin / 2);

  if (format === 'code128') {
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, barcode, {
      format: 'CODE128',
      width: Math.max(1, Math.round(w_px / 320)),
      height: Math.round(layoutH * 0.34),
      displayValue: true,
      fontSize: Math.max(12, Math.round(layoutH * 0.07)),
      margin: 2,
      background: '#ffffff',
      lineColor: '#000000',
    });
    ctx.drawImage(barcodeCanvas, (w_px - barcodeCanvas.width) / 2, y);
  } else {
    const qrSize = Math.min(w_px - margin * 2, Math.round(layoutH * 0.45));
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, barcode, {
      width: qrSize,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    ctx.drawImage(qrCanvas, (w_px - qrCanvas.width) / 2, y);
    y += qrCanvas.height + 6;
    ctx.font = `${Math.max(10, Math.round(layoutH * 0.05))}px monospace`;
    ctx.fillText(barcode, w_px / 2, y);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error('Failed to create label image'));
    }, 'image/png');
  });

  return URL.createObjectURL(blob);
}

export async function printLabelsToNiimbot(options: {
  itemName: string;
  itemPrice: number;
  barcodes: string[];
  format: BarcodeFormat;
  labelSettings: NiimbotLabelSettings;
  onProgress?: (status: string) => void;
}) {
  const { itemName, itemPrice, barcodes, format, labelSettings, onProgress } = options;
  const niimbot = getNiimbot();
  const probeModel = registry.models[registry.default_model as keyof typeof registry.models] as NiimbotModel;

  onProgress?.('Connecting to Niimbot…');
  const printerInfo = await niimbot.identify(probeModel);
  const { model, modelLabel } = resolveNiimbotConfig(printerInfo);
  const dpi = printerInfo?.dpi ?? model.dpi ?? 300;
  const { printSize: size, contentHeightPx } = buildNiimbotLabel(labelSettings, dpi);

  onProgress?.(`Connected: ${printerInfo?.label || modelLabel}. Preparing ${barcodes.length} label(s)…`);

  const imageUrls: string[] = [];
  try {
    for (let i = 0; i < barcodes.length; i++) {
      onProgress?.(`Rendering label ${i + 1}/${barcodes.length}…`);
      imageUrls.push(
        await renderLabelToBlobUrl({
          itemName,
          itemPrice,
          barcode: barcodes[i],
          format,
          size,
          contentHeightPx,
        })
      );
    }

    await niimbot.printBatch(imageUrls, {
      model,
      size,
      offsetY: labelSettings.offsetYPx,
      onProgress,
    });
  } finally {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
  }
}
