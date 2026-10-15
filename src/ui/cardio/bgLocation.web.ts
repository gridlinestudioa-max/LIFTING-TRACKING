// Browsers can't track location in the background: GPS stops when the screen locks or the tab is
// hidden. On the web the recorder follows GPS while the page is open, keeps the screen awake, saves the
// recording as it goes, and picks it back up when the page comes back.

export const REC_TASK = 'record-activity-location';

export const backgroundCapable = false;

export async function startBackground(): Promise<boolean> {
  return false;
}

export async function stopBackground(): Promise<void> {}
