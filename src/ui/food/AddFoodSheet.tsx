import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FOOD_TAGS,
  STARTER_FOODS,
  entryFromFood,
  entryTotals,
  fmt,
  fmtClock,
  fmtInt,
  foodError,
  macroKcal,
  newId,
  parseClock,
  previewEntry,
  quickEntry,
  recentFoodIds,
  searchFoods,
  type Food,
  type FoodEntry,
  type FoodTag,
  type Nutrients,
  type Totals,
} from '@/logic';

import { Field, Label, Mute } from '../components';
import { useTracker } from '../store';
import { fonts, space, tabular, toneColor, useColors } from '../theme';
import { Button, LinkButton, Notice, Pill, Sheet } from './kit';

type Mode = 'search' | 'amount' | 'quick' | 'food';

/**
 * Add something to a day's food log, or edit an entry already there.
 * Remount (change `key`) each time it opens so it starts fresh.
 */
export function AddFoodSheet({
  visible,
  day,
  isToday,
  now,
  editing,
  onClose,
}: {
  visible: boolean;
  day: string;
  isToday: boolean;
  /** Current time, minutes after midnight. */
  now: number;
  /** Entry being edited, or null to add a new one. */
  editing: FoodEntry | null;
  onClose: () => void;
}) {
  const { state, saveEntry, removeEntry, saveFood, deleteFood } = useTracker();
  const all = useMemo(() => [...STARTER_FOODS, ...state.foods], [state.foods]);
  const dayEntries = state.meals[day] ?? [];
  const others = editing ? dayEntries.filter((e) => e.id !== editing.id) : dayEntries;
  const extra = state.logs[day]?.cin ?? 0;
  const lastAt = dayEntries.length ? Math.max(...dayEntries.map((e) => e.at)) : null;
  const defaultAt = editing ? editing.at : isToday ? now : (lastAt ?? 12 * 60);

  const [mode, setMode] = useState<Mode>(editing ? 'amount' : 'search');
  const [query, setQuery] = useState('');
  const [food, setFood] = useState<Food | null>(() => (editing ? foodForEntry(editing, all) : null));
  const [qty, setQty] = useState(editing ? fmt(editing.qty) : '1');
  const [time, setTime] = useState(fmtClock(defaultAt));
  // Food being created or edited in the form (null = new).
  const [formFood, setFormFood] = useState<Food | null>(null);

  const at = parseClock(time);
  const timeOk = at != null;

  const add = (e: FoodEntry) => {
    saveEntry(day, e);
    onClose();
  };

  const back =
    mode === 'search' || (editing && mode === 'amount') ? undefined : (
      <LinkButton
        label="Back"
        onPress={() => setMode(mode === 'food' && food && formFood ? 'amount' : 'search')}
      />
    );

  const title =
    mode === 'search' ? 'Add food' : mode === 'quick' ? 'Quick add' : mode === 'food' ? (formFood ? 'Edit food' : 'New food') : editing ? 'Edit entry' : 'Add food';

  return (
    <Sheet visible={visible} title={title} onClose={onClose} left={back}>
      {mode === 'search' ? (
        <SearchView
          all={all}
          recent={recentFoodIds(state.meals)}
          query={query}
          setQuery={setQuery}
          onPick={(f) => {
            setFood(f);
            setQty('1');
            setMode('amount');
          }}
          onQuick={() => setMode('quick')}
          onCreate={() => {
            setFormFood(null);
            setMode('food');
          }}
        />
      ) : null}

      {mode === 'amount' && food ? (
        <AmountView
          food={food}
          qty={qty}
          setQty={setQty}
          time={time}
          setTime={setTime}
          isToday={isToday}
          now={now}
          preview={(q) => (timeOk ? previewEntry(state.diet, others, entryFromFood(food, q, at!), isToday ? now : null, extra) : null)}
          submitLabel={editing ? 'Save' : 'Add to log'}
          onSubmit={(q) => {
            if (!timeOk || !(q > 0)) return;
            const e = entryFromFood(food, q, at!, editing?.id);
            // An edited quick add keeps having no food id.
            if (editing && !editing.foodId) delete e.foodId;
            add(e);
          }}
          onRemove={
            editing
              ? () => {
                  removeEntry(day, editing.id);
                  onClose();
                }
              : undefined
          }
          onEditFood={
            food.custom
              ? () => {
                  setFormFood(food);
                  setMode('food');
                }
              : undefined
          }
        />
      ) : null}

      {mode === 'quick' ? (
        <QuickView
          time={time}
          setTime={setTime}
          isToday={isToday}
          now={now}
          preview={(name, n) => (timeOk ? previewEntry(state.diet, others, quickEntry(name, n, at!), isToday ? now : null, extra) : null)}
          onSubmit={(name, n) => timeOk && add(quickEntry(name, n, at!))}
        />
      ) : null}

      {mode === 'food' ? (
        <FoodForm
          initial={formFood}
          initialName={query.trim()}
          onSave={(f) => {
            saveFood(f);
            setFood({ ...f, custom: true });
            setQty(food && formFood && food.id === f.id ? qty : '1');
            setFormFood(null);
            setMode('amount');
          }}
          onDelete={
            formFood
              ? () => {
                  deleteFood(formFood.id);
                  setFormFood(null);
                  setFood(null);
                  setMode('search');
                }
              : undefined
          }
        />
      ) : null}
    </Sheet>
  );
}

/** The food an entry came from, or one rebuilt from the entry (quick adds, deleted foods). */
function foodForEntry(e: FoodEntry, all: Food[]): Food {
  const f = e.foodId ? all.find((x) => x.id === e.foodId) : undefined;
  return f ?? { id: e.foodId ?? e.id, name: e.name, serving: e.serving, n: e.n, tags: e.tags };
}

// ---------- Search ----------

function SearchView({
  all,
  recent,
  query,
  setQuery,
  onPick,
  onQuick,
  onCreate,
}: {
  all: Food[];
  recent: string[];
  query: string;
  setQuery: (q: string) => void;
  onPick: (f: Food) => void;
  onQuick: () => void;
  onCreate: () => void;
}) {
  const c = useColors();
  const results = searchFoods(all, query, recent);
  const recentSet = new Set(recent);
  const showRecent = !query.trim() && recent.length > 0;
  return (
    <View>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search foods"
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search foods"
        clearButtonMode="while-editing"
      />
      <View style={st.row}>
        <Pill label="Quick add calories" selected={false} onPress={onQuick} />
        <Pill label="Create a food" selected={false} onPress={onCreate} />
      </View>

      {results.length === 0 ? (
        <View style={{ marginTop: space.xl, gap: space.md }}>
          <Mute>{`No foods match “${query.trim()}”.`}</Mute>
          <Button label={`Create “${query.trim()}”`} onPress={onCreate} />
        </View>
      ) : (
        <View style={{ marginTop: space.lg }}>
          {results.map((f, i) => {
            const header =
              showRecent && i === 0 ? 'Recent' : showRecent && !recentSet.has(f.id) && recentSet.has(results[i - 1]?.id) ? 'All foods' : null;
            return (
              <View key={f.id}>
                {header ? <Label style={{ marginTop: i ? space.lg : 0 }}>{header}</Label> : null}
                <Pressable
                  onPress={() => onPick(f)}
                  accessibilityRole="button"
                  accessibilityLabel={`${f.name}, ${f.serving}, ${f.n.kcal} calories`}
                  style={({ pressed }) => [st.result, { borderTopColor: c.line, opacity: pressed ? 0.6 : 1 }, i === 0 || header ? { borderTopWidth: 0 } : null]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{f.name}</Text>
                    <Text style={{ color: c.mute, fontSize: 13 }}>
                      {[f.brand, f.serving, f.custom ? 'My food' : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>
                    {fmtInt(f.n.kcal)}
                    <Text style={{ color: c.mute, fontWeight: '400', fontSize: 13 }}> kcal</Text>
                  </Text>
                </Pressable>
              </View>
            );
          })}
          <Mute style={{ marginTop: space.lg, fontSize: 13 }}>
            Starter list for now. The full food database is coming; foods you create are saved on this device.
          </Mute>
        </View>
      )}
    </View>
  );
}

// ---------- Amount ----------

function TimeRow({ time, setTime, isToday, now }: { time: string; setTime: (t: string) => void; isToday: boolean; now: number }) {
  const c = useColors();
  const ok = parseClock(time) != null;
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={st.lbl(c.mute)}>Time eaten</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Field
          value={time}
          onChangeText={setTime}
          onEndEditing={() => {
            const m = parseClock(time);
            if (m != null) setTime(fmtClock(m));
          }}
          placeholder="e.g. 12:30 PM"
          autoCorrect={false}
          accessibilityLabel="Time eaten"
          style={{ flex: 1, minWidth: 0, borderColor: ok ? undefined : c.bad }}
        />
        {isToday ? <Pill label="Now" selected={false} onPress={() => setTime(fmtClock(now))} /> : null}
      </View>
      {!ok ? <Text style={{ color: c.bad, fontSize: 13 }}>Enter a time like 7:30 AM or 19:30.</Text> : null}
    </View>
  );
}

function AmountView({
  food,
  qty,
  setQty,
  time,
  setTime,
  isToday,
  now,
  preview,
  submitLabel,
  onSubmit,
  onRemove,
  onEditFood,
}: {
  food: Food;
  qty: string;
  setQty: (q: string) => void;
  time: string;
  setTime: (t: string) => void;
  isToday: boolean;
  now: number;
  preview: (q: number) => ReturnType<typeof previewEntry>;
  submitLabel: string;
  onSubmit: (q: number) => void;
  onRemove?: () => void;
  onEditFood?: () => void;
}) {
  const c = useColors();
  const q = parseFloat(qty);
  const qOk = Number.isFinite(q) && q > 0;
  const t = entryTotals({ n: food.n, qty: qOk ? q : 0 });
  const step = (d: number) => setQty(fmt(Math.max(0.25, Math.round(((qOk ? q : 1) + d) * 4) / 4)));
  const p = qOk ? preview(q) : null;

  return (
    <View>
      <Text style={[st.name, { color: c.ink }]}>{food.name}</Text>
      <Mute>{[food.brand, `1 serving = ${food.serving}`].filter(Boolean).join(' · ')}</Mute>
      {onEditFood ? (
        <View style={{ marginTop: space.sm, flexDirection: 'row' }}>
          <LinkButton label="Edit this food" onPress={onEditFood} />
        </View>
      ) : null}

      <View style={[st.row, { marginTop: space.lg, alignItems: 'flex-start' }]}>
        <View style={{ gap: 6 }}>
          <Text style={st.lbl(c.mute)}>Servings</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Pill label="−" selected={false} onPress={() => step(-0.5)} style={{ paddingHorizontal: 14 }} />
            <Field
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              accessibilityLabel="Servings"
              style={{ width: 64, textAlign: 'center', fontWeight: '700', borderColor: qOk ? undefined : c.bad }}
            />
            <Pill label="+" selected={false} onPress={() => step(0.5)} style={{ paddingHorizontal: 14 }} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: space.md }}>
        <TimeRow time={time} setTime={setTime} isToday={isToday} now={now} />
      </View>

      <NutritionSummary t={t} />

      {p ? (
        <Notice tone={p.tone} style={{ marginTop: space.lg }}>
          {p.lines.map((l, i) => (
            <Text key={i} style={{ color: i === 0 ? toneColor(c, p.tone) : c.ink, fontWeight: i === 0 ? '700' : '400', fontSize: 15, lineHeight: 21 }}>
              {l}
            </Text>
          ))}
        </Notice>
      ) : null}

      <Button label={submitLabel} primary onPress={() => onSubmit(q)} style={{ marginTop: space.xl, opacity: qOk && parseClock(time) != null ? 1 : 0.4 }} />
      {onRemove ? <Button label="Remove from log" danger onPress={onRemove} style={{ marginTop: space.md }} /> : null}
    </View>
  );
}

export function NutritionSummary({ t }: { t: Totals }) {
  const c = useColors();
  const cell = (label: string, v: number) => (
    <View style={{ flex: 1 }}>
      <Text style={[st.macro, { color: c.ink }]}>
        {fmt(Math.round(v * 10) / 10)}
        <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: c.mute }}> g</Text>
      </Text>
      <Text style={{ color: c.mute, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
  return (
    <View style={[st.nutri, { borderColor: c.line }]}>
      <Text style={[st.kcal, { color: c.ink }]}>
        {fmtInt(t.kcal)}
        <Text style={{ fontFamily: fonts.semi, fontSize: 18, color: c.mute }}> kcal</Text>
      </Text>
      <View style={{ flexDirection: 'row', marginTop: space.sm }}>
        {cell('Protein', t.protein)}
        {cell('Net carbs', t.netCarbs)}
        {cell('Fat', t.fat)}
      </View>
      <Text style={{ color: c.mute, fontSize: 13, marginTop: space.sm, ...tabular }}>
        Carbs {fmt(Math.round(t.carbs * 10) / 10)} g · Fiber {fmt(Math.round(t.fiber * 10) / 10)} g · Sugar {fmt(Math.round(t.sugar * 10) / 10)} g
      </Text>
    </View>
  );
}

// ---------- Quick add ----------

/** Parse an optional grams field: empty = 0, junk = NaN. */
const grams = (v: string) => (v.trim() === '' ? 0 : Number(v));

function QuickView({
  time,
  setTime,
  isToday,
  now,
  preview,
  onSubmit,
}: {
  time: string;
  setTime: (t: string) => void;
  isToday: boolean;
  now: number;
  preview: (name: string, n: Nutrients) => ReturnType<typeof previewEntry>;
  onSubmit: (name: string, n: Nutrients) => void;
}) {
  const c = useColors();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [cb, setCb] = useState('');
  const [f, setF] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const n: Nutrients = { kcal: kcal.trim() === '' ? NaN : Number(kcal), protein: grams(p), carbs: grams(cb), fat: grams(f) };
  const valid = foodError({ name: 'x', serving: 'x', n }) == null;
  const pv = valid ? preview(name, n) : null;

  return (
    <View>
      <Mute>For a meal out or anything not in the list. Only calories are required.</Mute>
      <View style={{ marginTop: space.md, gap: 6 }}>
        <Text style={st.lbl(c.mute)}>What was it? (optional)</Text>
        <Field value={name} onChangeText={setName} placeholder="e.g. Lunch out" accessibilityLabel="Name" />
      </View>
      <View style={[st.row, { marginTop: space.md }]}>
        <NumField label="Calories" value={kcal} onChange={setKcal} unit="kcal" />
        <NumField label="Protein" value={p} onChange={setP} unit="g" />
      </View>
      <View style={[st.row, { marginTop: space.md }]}>
        <NumField label="Carbs" value={cb} onChange={setCb} unit="g" />
        <NumField label="Fat" value={f} onChange={setF} unit="g" />
      </View>
      <View style={{ marginTop: space.md }}>
        <TimeRow time={time} setTime={setTime} isToday={isToday} now={now} />
      </View>
      {pv ? (
        <Notice tone={pv.tone} style={{ marginTop: space.lg }}>
          {pv.lines.map((l, i) => (
            <Text key={i} style={{ color: i === 0 ? toneColor(c, pv.tone) : c.ink, fontWeight: i === 0 ? '700' : '400', fontSize: 15 }}>
              {l}
            </Text>
          ))}
        </Notice>
      ) : null}
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button
        label="Add to log"
        primary
        style={{ marginTop: space.xl }}
        onPress={() => {
          if (!Number.isFinite(n.kcal)) return setErr('Enter the calories.');
          const e = foodError({ name: 'x', serving: 'x', n });
          if (e) return setErr(e);
          onSubmit(name, n);
        }}
      />
    </View>
  );
}

function NumField({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={st.lbl(c.mute)}>
        {label} <Text style={{ fontWeight: '400' }}>({unit})</Text>
      </Text>
      <Field value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" accessibilityLabel={label} />
    </View>
  );
}

// ---------- Create / edit a food ----------

function FoodForm({
  initial,
  initialName,
  onSave,
  onDelete,
}: {
  initial: Food | null;
  /** Name to start with for a new food (what was searched for). */
  initialName: string;
  onSave: (f: Food) => void;
  onDelete?: () => void;
}) {
  const c = useColors();
  const str = (v: number | undefined) => (v != null ? fmt(v) : '');
  const [name, setName] = useState(initial?.name ?? initialName);
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [serving, setServing] = useState(initial?.serving ?? '');
  const [kcal, setKcal] = useState(str(initial?.n.kcal));
  const [p, setP] = useState(str(initial?.n.protein));
  const [cb, setCb] = useState(str(initial?.n.carbs));
  const [f, setF] = useState(str(initial?.n.fat));
  const [fiber, setFiber] = useState(str(initial?.n.fiber));
  const [sugar, setSugar] = useState(str(initial?.n.sugar));
  const [tags, setTags] = useState<FoodTag[]>(initial?.tags ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const n: Nutrients = { kcal: kcal.trim() === '' ? NaN : Number(kcal), protein: grams(p), carbs: grams(cb), fat: grams(f) };
  if (fiber.trim()) n.fiber = Number(fiber);
  if (sugar.trim()) n.sugar = Number(sugar);
  const est = macroKcal(n);
  const mismatch = Number.isFinite(n.kcal) && Number.isFinite(est) && est > 0 && Math.abs(est - n.kcal) > Math.max(20, n.kcal * 0.2);

  return (
    <View>
      <Mute>Copy the numbers from the nutrition label. Values are for one serving.</Mute>
      <View style={{ marginTop: space.md, gap: 6 }}>
        <Text style={st.lbl(c.mute)}>Name</Text>
        <Field value={name} onChangeText={setName} placeholder="e.g. Protein bar, chocolate" accessibilityLabel="Food name" />
      </View>
      <View style={[st.row, { marginTop: space.md }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={st.lbl(c.mute)}>Brand (optional)</Text>
          <Field value={brand} onChangeText={setBrand} accessibilityLabel="Brand" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={st.lbl(c.mute)}>Serving size</Text>
          <Field value={serving} onChangeText={setServing} placeholder="e.g. 1 bar (60 g)" accessibilityLabel="Serving size" />
        </View>
      </View>
      <View style={[st.row, { marginTop: space.md }]}>
        <NumField label="Calories" value={kcal} onChange={setKcal} unit="kcal" />
        <NumField label="Protein" value={p} onChange={setP} unit="g" />
      </View>
      <View style={[st.row, { marginTop: space.md }]}>
        <NumField label="Carbs" value={cb} onChange={setCb} unit="g" />
        <NumField label="Fat" value={f} onChange={setF} unit="g" />
      </View>
      <View style={[st.row, { marginTop: space.md }]}>
        <NumField label="Fiber" value={fiber} onChange={setFiber} unit="g" />
        <NumField label="Sugar" value={sugar} onChange={setSugar} unit="g" />
      </View>
      {mismatch ? (
        <Notice tone="warn" style={{ marginTop: space.md }}>
          <Text style={{ color: c.ink, fontSize: 14 }}>
            {`The macros add up to about ${fmtInt(est)} kcal, not ${fmtInt(n.kcal)}. Double-check the label (alcohol and sugar alcohols can explain a gap).`}
          </Text>
        </Notice>
      ) : null}

      <Text style={[st.lbl(c.mute), { marginTop: space.lg }]}>Contains (used by diets like vegan or paleo)</Text>
      <View style={[st.row, { flexWrap: 'wrap', marginTop: 6 }]}>
        {FOOD_TAGS.map((t) => (
          <Pill
            key={t.id}
            label={t.label}
            selected={tags.includes(t.id)}
            onPress={() => setTags(tags.includes(t.id) ? tags.filter((x) => x !== t.id) : [...tags, t.id])}
          />
        ))}
      </View>

      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button
        label={initial ? 'Save food' : 'Save and log it'}
        primary
        style={{ marginTop: space.xl }}
        onPress={() => {
          if (!Number.isFinite(n.kcal)) return setErr('Enter the calories.');
          const draft = { name: name.trim(), serving: serving.trim(), n };
          const e = foodError(draft);
          if (e) return setErr(e);
          const food: Food = { id: initial?.id ?? newId('f'), ...draft, tags, custom: true };
          if (brand.trim()) food.brand = brand.trim();
          onSave(food);
        }}
      />
      {onDelete ? (
        confirmDelete ? (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Mute>Delete this food? Entries already logged keep their numbers.</Mute>
            <Button label="Delete food" danger onPress={onDelete} />
            <Button label="Keep it" onPress={() => setConfirmDelete(false)} />
          </View>
        ) : (
          <Button label="Delete food" danger onPress={() => setConfirmDelete(true)} style={{ marginTop: space.md }} />
        )
      ) : null}
    </View>
  );
}

const st = {
  ...StyleSheet.create({
    row: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: 1 },
    name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
    nutri: { marginTop: space.lg, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: space.md },
    kcal: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, ...tabular },
    macro: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, ...tabular },
  }),
  lbl: (color: string) => ({ fontSize: 13, fontWeight: '600' as const, color }),
};
