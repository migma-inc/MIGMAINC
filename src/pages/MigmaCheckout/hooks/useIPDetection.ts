import { useState, useEffect } from 'react';
import type { IPRegion } from '../types';

export function useIPDetection() {
  const [region, setRegion] = useState<IPRegion>('OTHER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dev: localhost → treat as BR (shows Parcelow by default)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setRegion('BR');
      setLoading(false);
      return;
    }
    fetch('/api/detect-region')
      .then(r => r.json())
      .then((data: { region: IPRegion }) => setRegion(data.region))
      .catch(() => setRegion('OTHER'))
      .finally(() => setLoading(false));
  }, []);

  return { region, loading };
}
