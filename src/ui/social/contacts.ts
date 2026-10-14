import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { Platform } from 'react-native';

export interface PickedContact {
  name: string;
  phones: string[];
}

interface WebContactsManager {
  select(props: ('name' | 'tel')[], opts: { multiple: boolean }): Promise<{ name?: string[]; tel?: string[] }[]>;
}

function webManager(): WebContactsManager | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const m = (navigator as unknown as { contacts?: WebContactsManager }).contacts;
  return m && typeof m.select === 'function' ? m : null;
}

/** Contacts can be read here: in the app, or a browser with the contact picker (Chrome on Android). */
export function contactsAvailable(): boolean {
  return Platform.OS !== 'web' || !!webManager();
}

/**
 * Contacts with phone numbers. In the app this reads the address book (after asking); in a browser it
 * opens the system picker so you choose who to share. 'denied' when permission is refused.
 */
export async function readContacts(): Promise<PickedContact[] | 'denied'> {
  const web = webManager();
  if (web) {
    const picked = await web.select(['name', 'tel'], { multiple: true });
    return picked.map((p) => ({ name: p.name?.[0] ?? '', phones: p.tel ?? [] })).filter((p) => p.phones.length);
  }
  if (Platform.OS === 'web') return [];
  const perm = await requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  const all = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES] as const);
  return all
    .map((c) => ({ name: c.fullName ?? '', phones: (c.phones ?? []).map((p) => p.number ?? '').filter(Boolean) }))
    .filter((c) => c.phones.length);
}
