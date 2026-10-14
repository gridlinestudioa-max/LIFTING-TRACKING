import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '../components';
import { fonts, radius, space } from '../theme';
import { Button, LinkButton } from './kit';

/** Food packaging uses these: EAN-13 and EAN-8 worldwide, UPC-A and UPC-E in North America. */
const FOOD_CODES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

/**
 * Full-screen camera that reads a food barcode and hands back its digits. Works in the app and in
 * browsers with camera access. A typed number is the fallback when the camera can't be used.
 */
export function BarcodeScanner({ visible, onScan, onClose }: { visible: boolean; onScan: (code: string) => void; onClose: () => void }) {
  const [perm, requestPerm] = useCameraPermissions();
  const done = useRef(false);
  const [typed, setTyped] = useState('');
  const [camErr, setCamErr] = useState<string | null>(null);

  const finish = (code: string) => {
    if (done.current) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length < 8) return;
    done.current = true;
    onScan(digits);
  };

  const denied = perm && !perm.granted && !perm.canAskAgain;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={st.bar}>
            <Text style={st.title}>Scan a barcode</Text>
            <LinkButton label="Cancel" onPress={onClose} color="#fff" />
          </View>

          {perm?.granted && !camErr ? (
            <View style={{ flex: 1 }}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: FOOD_CODES }}
                onBarcodeScanned={(r) => finish(r.data)}
                onMountError={() => setCamErr('The camera couldn’t start. You can type the barcode number below instead.')}
              />
              <View pointerEvents="none" style={st.overlay}>
                <View style={st.frame} />
                <Text style={st.hint}>Line up the barcode inside the box</Text>
              </View>
            </View>
          ) : (
            <View style={st.center}>
              <Text style={st.msg}>
                {camErr
                  ? camErr
                  : denied
                    ? 'Camera access is off for this app.'
                    : 'Allow camera access to scan barcodes on food packaging.'}
              </Text>
              {!camErr && !denied ? <Button label="Allow camera" primary onPress={requestPerm} style={{ alignSelf: 'stretch' }} /> : null}
              {denied && Platform.OS !== 'web' ? <Button label="Open settings" primary onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} /> : null}
            </View>
          )}

          <View style={st.manual}>
            <Text style={st.manualLbl}>Or type the number under the barcode</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Field
                value={typed}
                onChangeText={setTyped}
                keyboardType="number-pad"
                placeholder="e.g. 0123456789012"
                accessibilityLabel="Barcode number"
                onSubmitEditing={() => finish(typed)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button label="Look up" onPress={() => finish(typed)} style={{ width: 100 }} />
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  title: { color: '#fff', fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  frame: { width: '78%', height: 170, borderWidth: 3, borderColor: '#fff', borderRadius: radius.md },
  hint: { color: '#fff', fontSize: 15, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  msg: { color: '#fff', fontSize: 17, textAlign: 'center', lineHeight: 24 },
  manual: { padding: space.lg, gap: space.sm, backgroundColor: '#111' },
  manualLbl: { color: '#bbb', fontSize: 13, fontWeight: '600' },
});
