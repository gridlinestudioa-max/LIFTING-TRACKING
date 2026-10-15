import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { GpsFix } from '@/logic';

import { addFixes } from './recStore';

// Recording keeps going with the screen locked or another app open: the operating system delivers
// locations to this task, which adds them to the saved recording. On Android a notification shows while
// it runs (a foreground service); on iOS the blue location indicator does. Only "while using the app"
// location permission is needed, because recording always starts from the app.

export const REC_TASK = 'record-activity-location';

// Tasks must be defined when the app's code first loads (it may be started in the background).
if (!TaskManager.isTaskDefined(REC_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(REC_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const fixes: GpsFix[] = data.locations.map((l) => ({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      alt: l.coords.altitude,
      acc: l.coords.accuracy,
      t: l.timestamp || Date.now(),
    }));
    await addFixes(fixes);
  });
}

/** True where the app records in the background (the installed app; not a browser). */
export const backgroundCapable = true;

export async function startBackground(): Promise<boolean> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return false;
    if (await Location.hasStartedLocationUpdatesAsync(REC_TASK).catch(() => false)) return true;
    await Location.startLocationUpdatesAsync(REC_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Recording your activity',
        notificationBody: 'Tracking your route. Open the app to pause or finish.',
        notificationColor: '#fc4c02',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackground(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(REC_TASK)) await Location.stopLocationUpdatesAsync(REC_TASK);
  } catch {
    // Already stopped.
  }
}
