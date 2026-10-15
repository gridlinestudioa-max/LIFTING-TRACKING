import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Profile pictures are stored this size, square. */
const SIZE = 320;

export type PickedPhoto = { jpeg: Uint8Array; preview: string } | 'canceled' | 'denied';

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Lets the person choose a photo, then crops it to a square from the middle and shrinks it to a small JPEG. */
export async function pickPhoto(): Promise<PickedPhoto> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'denied';
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (r.canceled || !r.assets?.length) return 'canceled';
  const a = r.assets[0];
  const side = Math.min(a.width, a.height);
  let ctx = ImageManipulator.manipulate(a.uri);
  if (side > 0 && a.width !== a.height) ctx = ctx.crop({ originX: Math.floor((a.width - side) / 2), originY: Math.floor((a.height - side) / 2), width: side, height: side });
  const img = await (await ctx.resize({ width: SIZE, height: SIZE }).renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!img.base64) throw new Error('Couldn’t read that photo.');
  return { jpeg: fromBase64(img.base64), preview: `data:image/jpeg;base64,${img.base64}` };
}
