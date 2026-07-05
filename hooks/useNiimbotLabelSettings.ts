import { useCallback, useEffect, useState } from 'react';
import type { NiimbotLabelSettings } from '../types';
import {
  DEFAULT_NIIMBOT_LABEL_SETTINGS,
  NIIMBOT_LABEL_SETTINGS_STORAGE_KEY,
  parseStoredNiimbotLabelSettings,
  settingsFromPreset,
} from '../utils/niimbotLabelSizes';

export const useNiimbotLabelSettings = () => {
  const [labelSettings, setLabelSettingsState] = useState<NiimbotLabelSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_NIIMBOT_LABEL_SETTINGS;
    return parseStoredNiimbotLabelSettings(localStorage.getItem(NIIMBOT_LABEL_SETTINGS_STORAGE_KEY));
  });

  useEffect(() => {
    localStorage.setItem(NIIMBOT_LABEL_SETTINGS_STORAGE_KEY, JSON.stringify(labelSettings));
  }, [labelSettings]);

  const setLabelSettings = useCallback((next: NiimbotLabelSettings) => {
    setLabelSettingsState(next);
  }, []);

  const updateLabelSettings = useCallback((patch: Partial<NiimbotLabelSettings>) => {
    setLabelSettingsState(prev => ({ ...prev, ...patch }));
  }, []);

  const setPreset = useCallback((presetId: string) => {
    setLabelSettingsState(prev => settingsFromPreset(presetId, prev));
  }, []);

  return {
    labelSettings,
    setLabelSettings,
    updateLabelSettings,
    setPreset,
  };
};
