import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { GpsFix } from '@/logic';

export type GpsProblem = 'denied' | 'unavailable' | 'insecure';

/**
 * Follow the device's position. Returns a function that stops watching. On the web this talks to the
 * browser directly so it can ask for high accuracy (GPS rather than Wi-Fi) and hear about errors.
 */
export async function watchGps(onFix: (f: GpsFix) => void, onProblem: (p: GpsProblem) => void): Promise<() => void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      onProblem('insecure');
      return () => {};
    }
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      onProblem('unavailable');
      return () => {};
    }
    const id = geo.watchPosition(
      (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, alt: p.coords.altitude, acc: p.coords.accuracy, t: p.timestamp || Date.now() }),
      (e) => onProblem(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
    return () => geo.clearWatch(id);
  }
  const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (!perm?.granted) {
    onProblem('denied');
    return () => {};
  }
  try {
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (l) => onFix({ lat: l.coords.latitude, lng: l.coords.longitude, alt: l.coords.altitude, acc: l.coords.accuracy, t: l.timestamp || Date.now() }),
      () => onProblem('unavailable'),
    );
    return () => sub.remove();
  } catch {
    onProblem('unavailable');
    return () => {};
  }
}
