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
  { id: '50x20', label: '50 × 20 mm', widthMm: 50, heightMm: 20 },
  { id: '50x15', label: '50 × 15 mm', widthMm: 50, heightMm: 15 },
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

export interface BuiltNiimbotLabel {
  printSize: NiimbotLabelSize;
  contentHeightPx: number;
  feedHeightPx: number;
}

export const buildNiimbotLabel = (
  settings: NiimbotLabelSettings,
  dpi = 300
): BuiltNiimbotLabel => {
  const w_px = mmToWidthPx(settings.widthMm);
  const contentHeightPx = mmToHeightPx(settings.heightMm);
  const feedHeightPx = mmToHeightPx(settings.heightMm + settings.feedAdjustMm);
  const margin = Math.max(6, Math.round(Math.min(w_px, feedHeightPx) * 0.03));

  return {
    contentHeightPx: Math.min(contentHeightPx, feedHeightPx),
    feedHeightPx,
    printSize: {
      label: `${settings.widthMm} × ${settings.heightMm} mm`,
      w_mm: settings.widthMm,
      h_mm: settings.heightMm + settings.feedAdjustMm,
      w_px,
      h_px: feedHeightPx,
      margin,
      offset_y_px: settings.offsetYPx,
      dpi,
    },
  };
};

/** @deprecated Use buildNiimbotLabel — kept for summary text */
export const buildNiimbotSize = (
  settings: NiimbotLabelSettings,
  dpi = 300
): NiimbotLabelSize => buildNiimbotLabel(settings, dpi).printSize;

export const formatNiimbotSizeSummary = (settings: NiimbotLabelSettings, dpi = 300): string => {
  const built = buildNiimbotLabel(settings, dpi);
  const { printSize, contentHeightPx, feedHeightPx } = built;
  const feedNote =
    settings.feedAdjustMm !== 0
      ? `, feed pitch ${settings.feedAdjustMm > 0 ? '+' : ''}${settings.feedAdjustMm} mm`
      : '';
  if (feedHeightPx !== contentHeightPx) {
    return `${settings.widthMm} × ${settings.heightMm} mm content (${contentHeightPx}px), feed ${feedHeightPx}px${feedNote}`;
  }
  return `${settings.widthMm} × ${settings.heightMm} mm (${printSize.w_px} × ${feedHeightPx}px${feedNote})`;
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
