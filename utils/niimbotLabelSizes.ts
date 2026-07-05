import type { NiimbotLabelSettings } from '../types';
import type { NiimbotLabelSize } from '../types/niimbot';

export interface NiimbotLabelPreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

/** B1 Pro calibrated scales from registry T50x30 (584×354 px). */
const WIDTH_PX_PER_MM = 584 / 50;
const HEIGHT_PX_PER_MM = 354 / 30;

export const NIIMBOT_LABEL_PRESETS: NiimbotLabelPreset[] = [
  { id: '50x30', label: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { id: '50x25', label: '50 × 25 mm', widthMm: 50, heightMm: 25 },
  { id: '50x40', label: '50 × 40 mm', widthMm: 50, heightMm: 40 },
  { id: '40x30', label: '40 × 30 mm', widthMm: 40, heightMm: 30 },
  { id: '40x20', label: '40 × 20 mm', widthMm: 40, heightMm: 20 },
  { id: '30x20', label: '30 × 20 mm', widthMm: 30, heightMm: 20 },
];

export const DEFAULT_NIIMBOT_LABEL_SETTINGS: NiimbotLabelSettings = {
  presetId: '50x30',
  widthMm: 50,
  heightMm: 30,
  feedAdjustMm: 0,
  offsetYPx: 0,
};

export const NIIMBOT_LABEL_SETTINGS_STORAGE_KEY = 'paytech-niimbot-label-settings';

const mmToWidthPx = (mm: number) => Math.max(100, Math.round(mm * WIDTH_PX_PER_MM));
const mmToHeightPx = (mm: number) => Math.max(80, Math.round(mm * HEIGHT_PX_PER_MM));

export const buildNiimbotSize = (
  settings: NiimbotLabelSettings,
  dpi = 300
): NiimbotLabelSize => {
  const effectiveHeightMm = settings.heightMm + settings.feedAdjustMm;
  const w_px = mmToWidthPx(settings.widthMm);
  const h_px = mmToHeightPx(effectiveHeightMm);
  const margin = Math.max(6, Math.round(Math.min(w_px, h_px) * 0.03));

  return {
    label: `${settings.widthMm} × ${settings.heightMm} mm`,
    w_mm: settings.widthMm,
    h_mm: effectiveHeightMm,
    w_px,
    h_px,
    margin,
    offset_y_px: settings.offsetYPx,
    dpi,
  };
};

export const formatNiimbotSizeSummary = (settings: NiimbotLabelSettings, dpi = 300): string => {
  const size = buildNiimbotSize(settings, dpi);
  const feedNote = settings.feedAdjustMm !== 0 ? `, feed ${settings.feedAdjustMm > 0 ? '+' : ''}${settings.feedAdjustMm} mm` : '';
  return `${settings.widthMm} × ${settings.heightMm} mm (${size.w_px} × ${size.h_px} px${feedNote})`;
};

export const getPresetById = (presetId: string): NiimbotLabelPreset | undefined =>
  NIIMBOT_LABEL_PRESETS.find(p => p.id === presetId);

export const settingsFromPreset = (presetId: string, current?: NiimbotLabelSettings): NiimbotLabelSettings => {
  const preset = getPresetById(presetId);
  if (!preset) return current ?? DEFAULT_NIIMBOT_LABEL_SETTINGS;

  return {
    presetId: preset.id,
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    feedAdjustMm: current?.feedAdjustMm ?? 0,
    offsetYPx: current?.offsetYPx ?? 0,
  };
};

export const parseStoredNiimbotLabelSettings = (raw: string | null): NiimbotLabelSettings => {
  if (!raw) return DEFAULT_NIIMBOT_LABEL_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<NiimbotLabelSettings>;
    return {
      presetId: parsed.presetId ?? DEFAULT_NIIMBOT_LABEL_SETTINGS.presetId,
      widthMm: Number(parsed.widthMm) || DEFAULT_NIIMBOT_LABEL_SETTINGS.widthMm,
      heightMm: Number(parsed.heightMm) || DEFAULT_NIIMBOT_LABEL_SETTINGS.heightMm,
      feedAdjustMm: Number(parsed.feedAdjustMm) || 0,
      offsetYPx: Number(parsed.offsetYPx) || 0,
    };
  } catch {
    return DEFAULT_NIIMBOT_LABEL_SETTINGS;
  }
};
