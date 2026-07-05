export interface NiimbotModel {
  label?: string;
  id?: number;
  dpi?: number;
  protocol?: string;
  task: string;
  density: number;
  label_type: number;
  speed: number;
  name_prefixes: string[];
}

export interface NiimbotLabelSize {
  label?: string;
  code?: string;
  w_mm?: number;
  h_mm?: number;
  w_px: number;
  h_px: number;
  margin?: number;
  offset_y_px?: number;
  dpi?: number;
}

export interface NiimbotPrinterInfo {
  modelId: number;
  protocolVersion: number;
  label: string;
  task: string;
  dpi: number;
}

export interface NiimbotPrintOptions {
  model: NiimbotModel;
  size: NiimbotLabelSize;
  copies?: number;
  offsetY?: number;
  onProgress?: (status: string) => void;
}

export interface NiimbotApi {
  VERSION: string;
  DEBUG: boolean;
  printer: NiimbotPrinterInfo | null;
  isSupported(): boolean;
  identify(model: NiimbotModel): Promise<NiimbotPrinterInfo | null>;
  printImage(url: string, opts: NiimbotPrintOptions): Promise<void>;
  printBatch(urls: string[], opts: NiimbotPrintOptions): Promise<void>;
  disconnect(): Promise<void>;
}

declare global {
  interface Window {
    Niimbot?: NiimbotApi;
  }
}

export {};
