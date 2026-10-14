import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, space, useColors } from './theme';

export interface Option<T> {
  value: T;
  label: string;
  /** A second line under the label in the list. */
  hint?: string;
}

const ROW = 52;

/** The closed control: looks like a text field, shows the current choice and a chevron. */
function Trigger({ text, placeholder, label, onPress, style }: { text: string; placeholder: string; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text || placeholder}`}
      accessibilityHint="Opens a list to choose from"
      style={({ pressed }) => [st.trigger, { backgroundColor: c.card, borderColor: c.line, opacity: pressed ? 0.75 : 1 }, style]}>
      <Text style={{ flex: 1, fontSize: 17, color: text ? c.ink : c.mute }} numberOfLines={1}>
        {text || placeholder}
      </Text>
      <Text style={{ color: c.mute, fontSize: 14, marginLeft: space.sm }}>▾</Text>
    </Pressable>
  );
}

/** The open list, in a dialog over the page. */
function ListDialog<T>({
  visible,
  title,
  options,
  isSelected,
  onPick,
  onClose,
  multi,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  isSelected: (v: T) => boolean;
  onPick: (v: T) => void;
  onClose: () => void;
  multi?: boolean;
}) {
  const c = useColors();
  const first = Math.max(0, options.findIndex((o) => isSelected(o.value)));
  const hinted = options.some((o) => o.hint);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Close list">
        {/* Taps inside the panel don't close it. */}
        <Pressable style={[st.panel, { backgroundColor: c.card, borderColor: c.line }]} onPress={() => {}}>
          <View style={[st.head, { borderBottomColor: c.line }]}>
            <Text style={[st.title, { color: c.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>{multi ? 'Done' : 'Close'}</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o, i) => `${String(o.value)}-${i}`}
            initialScrollIndex={!hinted && first > 3 ? first - 2 : undefined}
            getItemLayout={hinted ? undefined : (_, i) => ({ length: ROW, offset: ROW * i, index: i })}
            renderItem={({ item, index }) => {
              const on = isSelected(item.value);
              return (
                <Pressable
                  onPress={() => onPick(item.value)}
                  accessibilityRole={multi ? 'checkbox' : 'button'}
                  accessibilityState={multi ? { checked: on } : { selected: on }}
                  accessibilityLabel={item.label}
                  style={({ pressed }) => [
                    st.row,
                    hinted ? { paddingVertical: space.md } : { height: ROW },
                    index > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                    { backgroundColor: pressed ? c.soft : on && !multi ? c.accentbg : 'transparent' },
                  ]}>
                  {multi ? (
                    <View style={[st.box, { borderColor: on ? c.ink : c.mute, backgroundColor: on ? c.ink : 'transparent' }]}>
                      {on ? <Text style={{ color: c.onAccent, fontWeight: '800', fontSize: 13, lineHeight: 16 }}>✓</Text> : null}
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16, fontWeight: on ? '700' : '500' }}>{item.label}</Text>
                    {item.hint ? <Text style={{ color: c.mute, fontSize: 13, marginTop: 2 }}>{item.hint}</Text> : null}
                  </View>
                  {!multi && on ? <Text style={{ color: c.ink, fontWeight: '800' }}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Pick one from a list. */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  style,
}: {
  /** Names the control for screen readers and titles the list. */
  label: string;
  value: T | null | undefined;
  options: Option<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Trigger text={current?.label ?? ''} placeholder={placeholder} label={label} onPress={() => setOpen(true)} style={style} />
      <ListDialog
        visible={open}
        title={label}
        options={options}
        isSelected={(v) => v === value}
        onPick={(v) => {
          setOpen(false);
          onChange(v);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** Pick any number from a list. The field shows the choices, joined. */
export function MultiSelect<T extends string | number>({
  label,
  values,
  options,
  onChange,
  placeholder = 'None',
  style,
}: {
  label: string;
  values: T[];
  options: Option<T>[];
  onChange: (v: T[]) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const text = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');
  return (
    <>
      <Trigger text={text} placeholder={placeholder} label={label} onPress={() => setOpen(true)} style={style} />
      <ListDialog
        visible={open}
        multi
        title={label}
        options={options}
        isSelected={(v) => values.includes(v)}
        onPick={(v) => {
          onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const st = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md - 2,
    paddingHorizontal: space.md, minHeight: 46,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: space.lg },
  panel: { borderWidth: 1, borderRadius: radius.lg, maxHeight: '80%', width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1 },
  title: { flex: 1, fontFamily: fonts.semi, fontSize: 21, lineHeight: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
