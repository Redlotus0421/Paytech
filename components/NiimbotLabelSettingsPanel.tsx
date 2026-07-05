import React from 'react';
import type { NiimbotLabelSettings } from '../types';
import { formatNiimbotSizeSummary, NIIMBOT_LABEL_PRESETS } from '../utils/niimbotLabelSizes';

interface NiimbotLabelSettingsPanelProps {
  settings: NiimbotLabelSettings;
  onChange: (settings: NiimbotLabelSettings) => void;
  onPresetChange: (presetId: string) => void;
  compact?: boolean;
}

export const NiimbotLabelSettingsPanel: React.FC<NiimbotLabelSettingsPanelProps> = ({
  settings,
  onChange,
  onPresetChange,
  compact = false,
}) => {
  const update = (patch: Partial<NiimbotLabelSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className={`space-y-2 ${compact ? '' : 'rounded-lg border border-emerald-100 bg-emerald-50/40 p-3'}`}>
      {!compact && (
        <p className="text-xs font-semibold text-emerald-800">Niimbot label roll</p>
      )}
      <div className={`flex flex-wrap gap-3 ${compact ? 'items-end' : 'items-end'}`}>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Label roll size</label>
          <select
            value={settings.presetId}
            onChange={e => onPresetChange(e.target.value)}
            className="p-2 border border-gray-300 rounded text-sm bg-white min-w-[140px]"
          >
            {NIIMBOT_LABEL_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1" title="How far the printer advances between labels">
            Feed pitch adjust (mm)
          </label>
          <input
            type="number"
            step="0.5"
            min="-15"
            max="10"
            value={settings.feedAdjustMm}
            onChange={e => update({ feedAdjustMm: Number(e.target.value) || 0 })}
            className="w-24 p-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Vertical offset (px)</label>
          <input
            type="number"
            step="1"
            min="-20"
            max="40"
            value={settings.offsetYPx}
            onChange={e => update({ offsetYPx: Number(e.target.value) || 0 })}
            className="w-24 p-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>
      {!compact && (
        <>
          <p className="text-xs text-gray-500">
            Effective: {formatNiimbotSizeSummary(settings)}
          </p>
          <p className="text-xs text-gray-400">
            Match label roll size to your physical stickers. If the printer skips a blank label between prints,
            decrease Feed pitch adjust (try -5 to -10 mm). If labels overlap or get cut off, increase it.
            Use Vertical offset if content sits too high or low on one label.
          </p>
        </>
      )}
    </div>
  );
};
