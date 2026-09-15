import { useCallback, useState } from 'react';
import type { AppData } from './types';
import { loadData, saveData } from './storage';

export function useAppData(): [AppData, (updater: (prev: AppData) => AppData) => void] {
  const [data, setData] = useState<AppData>(() => loadData());

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  return [data, updateData];
}
