import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FOOD_TAGS,
  GRAMS,
  MEALS,
  SOURCE_LABEL,
  bumpTally,
  mealAt,
  mealOf,
  activeDiet,
  OffError,
  entryFromFood,
  entryTotals,
  fmt,
  fmtClock,
  fmtInt,
  foodError,
  isBarcode,
  loadUsdaFoods,
  macroKcal,
  newId,
  offByBarcode,
  parseClock,
  portionText,
  portionsFor,
  previewEntry,
  quickEntry,
  recentFoodIds,
  searchFoods,
  searchOff,
  type Food,
  type FoodEntry,
  type FoodTag,
  type MealSlot,
  type Nutrients,
  type Portion,
  type Totals,
} from '@/logic';

import { Card, Field, Label, Mute } from '../components';
import { MultiSelect, Select } from '../Select';
import { useTracker } from '../store';
import { fonts, space, tabular, toneColor, useColors } from '../theme';
import { Button, LinkButton, Notice, Pill, Sheet } from './kit';

type Mode = 'search' | 'amount' | 'quick' | 'food';

/** Open Food Facts asks apps to identify themselves. Browsers don't allow setting this header. */
const OFF_HEADERS: Record<string, string> | undefined =
  Platform.OS === 'web' ? undefined : { 'User-Agent': 'TrainingTracker/1.0 (Expo app; React Native)' };

/** The built-in USDA list, loaded the first time the sheet opens. */
function useUsdaFoods(): { foods: Food[] | null; failed: boolean } {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadUsdaFoods()
      .then((f) => live && setFoods(f))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  return { foods, failed };
}

/** The portion an entry was logged with, found again on its food. */
function portionForEntry(food: Food, e: FoodEntry): Portion | null {
  if (!food.per100) return null;
  if (e.serving === '1 g') return GRAMS;
  return portionsFor(food).find((p) => portionText(p) === e.serving) ?? null;
}

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
  meal: mealProp,
  onClose,
}: {
  visible: boolean;
  day: string;
  isToday: boolean;
  /** Current time, minutes after midnight. */
  now: number;
  /** Entry being edited, or null to add a new one. */
  editing: FoodEntry | null;
  /** The meal it was opened from. Otherwise the meal follows the time eaten until one is picked. */
  meal?: MealSlot;
  onClose: () => void;
}) {
  const { state, saveEntry, removeEntry, setEntries, saveFood, deleteFood } = useTracker();
  const usda = useUsdaFoods();
  const diet = activeDiet(state.diet, state.profile);
  // Saved foods (yours, and branded foods you've logged) first, then USDA.
  // A USDA food kept on the device (for the tally) is listed once.
  const all = useMemo(() => {
    const mine = new Set(state.foods.map((f) => f.id));
    return [...state.foods, ...(usda.foods ?? []).filter((f) => !mine.has(f.id))];
  }, [state.foods, usda.foods]);
  const dayEntries = state.meals[day] ?? [];
  const others = editing ? dayEntries.filter((e) => e.id !== editing.id) : dayEntries;
  const extra = state.days[day]?.cin ?? 0;
  const lastAt = dayEntries.length ? Math.max(...dayEntries.map((e) => e.at)) : null;
  const defaultAt = editing ? editing.at : isToday ? now : (lastAt ?? 12 * 60);

  const [mode, setMode] = useState<Mode>(editing ? 'amount' : 'search');
  const [query, setQuery] = useState('');
  const [food, setFood] = useState<Food | null>(() => (editing ? foodForEntry(editing, all) : null));
  const [portion, setPortion] = useState<Portion | null>(() => (editing && food ? portionForEntry(food, editing) : null));
  const [qty, setQty] = useState(editing ? fmt(Math.round(editing.qty * 100) / 100) : '1');
  const [time, setTime] = useState(fmtClock(defaultAt));
  // Food being created or edited in the form (null = new).
  const [formFood, setFormFood] = useState<Food | null>(null);
  const [mealSet, setMeal] = useState<MealSlot | null>(editing ? mealOf(editing) : (mealProp ?? null));

  // Editing an entry from a USDA food: once the list has loaded, switch to the real food so the
  // measure can be changed. (Adjusting state during render, once.)
  const [upgraded, setUpgraded] = useState(false);
  if (!upgraded && usda.foods && editing?.foodId) {
    setUpgraded(true);
    const f = all.find((x) => x.id === editing.foodId);
    const p = f && !food?.per100 ? portionForEntry(f, editing) : null;
    if (f && p) {
      setFood(f);
      setPortion(p);
    }
  }

  const at = parseClock(time);
  const timeOk = at != null;
  const meal = mealSet ?? mealAt(at ?? defaultAt);
  const when = <WhenRows meal={meal} setMeal={setMeal} time={time} setTime={setTime} isToday={isToday} now={now} />;

  const add = (e: FoodEntry) => {
    saveEntry(day, e);
    onClose();
  };

  const pick = (f: Food) => {
    setFood(f);
    setPortion(f.per100 ? portionsFor(f)[0] : null);
    setQty('1');
    setMode('amount');
  };

  const back =
    mode === 'search' || (editing && mode === 'amount') ? undefined : (
      <LinkButton label="Back" onPress={() => setMode(mode === 'food' && food && formFood ? 'amount' : 'search')} />
    );

  const title =
    mode === 'search' ? 'Add food' : mode === 'quick' ? 'Quick add' : mode === 'food' ? (formFood ? 'Edit food' : 'New food') : editing ? 'Edit entry' : 'Add food';

  const entryFor = (q: number, id?: string) => ({ ...entryFromFood(food!, q, at!, id, portion ?? undefined), meal });

  return (
    <Sheet visible={visible} title={title} onClose={onClose} left={back}>
      {mode === 'search' ? (
        <SearchView
          all={all}
          usdaLoading={!usda.foods && !usda.failed}
          recent={recentFoodIds(state.meals)}
          query={query}
          setQuery={setQuery}
          onPick={pick}
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
          portion={portion}
          setPortion={(p) => {
            // Switching to grams starts at 100 g; back to a portion starts at 1.
            if ((p === GRAMS) !== (portion === GRAMS)) setQty(p === GRAMS ? '100' : '1');
            setPortion(p);
          }}
          qty={qty}
          setQty={setQty}
          when={when}
          timeOk={timeOk}
          totals={(q) => entryTotals(entryFor(q, 'preview'))}
          preview={(q) => (timeOk ? previewEntry(diet, others, entryFor(q, 'preview'), isToday ? now : null, extra) : null)}
          submitLabel={editing ? 'Save' : 'Add to log'}
          onSubmit={(q) => {
            if (!timeOk || !(q > 0)) return;
            const e = entryFor(q, editing?.id);
            // An edited quick add keeps having no food id.
            if (editing && !editing.foodId) delete e.foodId;
            // Keep branded foods on the device so they show in recents and work offline.
            if (food.src === 'off') saveFood(food);
            add(e);
          }}
          onTally={
            editing
              ? undefined
              : (q) => {
                  if (!timeOk) return;
                  const f: Food = { ...food, tally: true };
                  if (portion && portion !== GRAMS) f.tallyPortion = portion;
                  else delete f.tallyPortion;
                  saveFood(f);
                  setEntries(day, (list) => bumpTally(list, f, Math.max(1, Math.round(q)), at!));
                  onClose();
                }
          }
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
          when={when}
          preview={(name, n) => (timeOk ? previewEntry(diet, others, quickEntry(name, n, at!), isToday ? now : null, extra) : null)}
          onSubmit={(name, n) => timeOk && add({ ...quickEntry(name, n, at!), meal })}
        />
      ) : null}

      {mode === 'food' ? (
        <FoodForm
          initial={formFood}
          initialName={query.trim()}
          onSave={(f) => {
            saveFood(f);
            setFood(f);
            setPortion(null);
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
  return f ?? { id: e.foodId ?? e.id, name: e.name, serving: e.serving, n: e.n, tags: e.tags, ...(e.note ? { note: e.note } : {}) };
}

// ---------- Search ----------

type OffState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; foods: Food[] }
  | { status: 'error'; query: string; message: string };

function FoodRow({ f, first, onPress }: { f: Food; first: boolean; onPress: () => void }) {
  const c = useColors();
  const meta = [f.brand, f.serving, f.custom ? 'My food' : f.src === 'off' ? SOURCE_LABEL.off : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${f.name}${f.note ? `, ${f.note}` : ''}${f.brand ? `, ${f.brand}` : ''}, ${f.serving}, ${fmtInt(f.n.kcal)} calories`}
      style={({ pressed }) => [st.result, { borderTopColor: c.line, opacity: pressed ? 0.6 : 1 }, first ? { borderTopWidth: 0 } : null]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{f.name}</Text>
        {f.note ? <Text style={{ color: c.ink, fontSize: 13.5 }}>{f.note}</Text> : null}
        <Text style={{ color: c.mute, fontSize: 13 }}>{meta}</Text>
      </View>
      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>
        {fmtInt(f.n.kcal)}
        <Text style={{ color: c.mute, fontWeight: '400', fontSize: 13 }}> kcal</Text>
      </Text>
    </Pressable>
  );
}

/** Branded results already fetched, by query, so retyping a search doesn't spend another request. */
const offCache = new Map<string, Food[]>();

/**
 * One search over everything: your foods, the built-in USDA list (instant) and Open Food Facts (online,
 * a moment after you stop typing). Results are merged and ranked together. A barcode looks up that product.
 */
function SearchView({
  all,
  usdaLoading,
  recent,
  query,
  setQuery,
  onPick,
  onQuick,
  onCreate,
}: {
  all: Food[];
  usdaLoading: boolean;
  recent: string[];
  query: string;
  setQuery: (q: string) => void;
  onPick: (f: Food) => void;
  onQuick: () => void;
  onCreate: () => void;
}) {
  const c = useColors();
  const q = query.trim();
  const key = q.toLowerCase();
  const barcode = isBarcode(q);
  const [off, setOff] = useState<OffState>({ status: 'idle' });
  const [retry, setRetry] = useState(0);
  const cached = offCache.get(key);

  // Search Open Food Facts once typing pauses. It allows about 10 searches a minute, so wait, and reuse results.
  useEffect(() => {
    if ((!barcode && q.length < 3) || offCache.has(key)) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setOff({ status: 'loading', query: key });
      const opts = { fetch: (u: string, i?: RequestInit) => fetch(u, i), headers: OFF_HEADERS, signal: ctl.signal };
      const job = barcode ? offByBarcode(q, opts).then((f) => [f]) : searchOff(q, opts);
      job
        .then((foods) => {
          if (ctl.signal.aborted) return;
          offCache.set(key, foods);
          setOff({ status: 'done', query: key, foods });
        })
        .catch((e) => {
          if (ctl.signal.aborted) return;
          setOff({ status: 'error', query: key, message: e instanceof OffError ? e.message : 'Couldn’t reach Open Food Facts.' });
        });
    }, barcode ? 0 : 700);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [key, q, barcode, retry]);

  const branded = useMemo(() => {
    const mine = new Set(all.map((f) => f.id));
    return (cached ?? []).filter((f) => !mine.has(f.id));
  }, [cached, all]);
  const results = useMemo(
    () => (barcode ? branded : searchFoods([...all, ...branded], q, recent, 50)),
    [all, branded, q, recent, barcode],
  );
  const loadingHere = off.status === 'loading' && off.query === key;
  const errorHere = off.status === 'error' && off.query === key ? off.message : null;

  return (
    <View>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search foods, brands or a barcode"
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

      {!q ? (
        results.length ? (
          <View style={{ marginTop: space.lg }}>
            <Label style={{ marginTop: 0 }}>Recent</Label>
            {results.map((f, i) => (
              <FoodRow key={f.id} f={f} first={i === 0} onPress={() => onPick(f)} />
            ))}
          </View>
        ) : null
      ) : (
        <>
          <View style={{ marginTop: space.lg }}>
            {results.map((f, i) => (
              <FoodRow key={f.id} f={f} first={i === 0} onPress={() => onPick(f)} />
            ))}
            {usdaLoading || loadingHere ? (
              <Mute style={{ marginTop: space.sm }}>{results.length ? 'Looking for more…' : 'Searching…'}</Mute>
            ) : errorHere ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm }}>
                <Text style={{ color: c.mute, fontSize: 14, flex: 1 }}>Branded foods didn’t load.</Text>
                <LinkButton label="Try again" onPress={() => setRetry((n) => n + 1)} />
              </View>
            ) : !results.length && (cached || q.length < 3) ? (
              <Mute>{`No matches for “${q}”.`}</Mute>
            ) : null}
          </View>

          <Button label={`Create “${q}”`} onPress={onCreate} style={{ marginTop: space.xl }} />
        </>
      )}
    </View>
  );
}

// ---------- Amount ----------

/** Which meal, and the time eaten. */
function WhenRows({
  meal,
  setMeal,
  ...time
}: {
  meal: MealSlot;
  setMeal: (m: MealSlot) => void;
  time: string;
  setTime: (t: string) => void;
  isToday: boolean;
  now: number;
}) {
  const c = useColors();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <Text style={st.lbl(c.mute)}>Meal</Text>
        <Select label="Meal" value={meal} options={MEALS.map((m) => ({ value: m.id, label: m.id === 'snack' ? 'Snack' : m.label }))} onChange={setMeal} />
      </View>
      <TimeRow {...time} />
    </View>
  );
}

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
  portion,
  setPortion,
  qty,
  setQty,
  when,
  timeOk,
  totals,
  preview,
  submitLabel,
  onSubmit,
  onTally,
  onRemove,
  onEditFood,
}: {
  food: Food;
  /** Chosen measure, for foods with weights (null for foods with one fixed serving). */
  portion: Portion | null;
  setPortion: (p: Portion) => void;
  qty: string;
  setQty: (q: string) => void;
  /** Meal and time fields. */
  when: ReactNode;
  timeOk: boolean;
  totals: (q: number) => Totals;
  preview: (q: number) => ReturnType<typeof previewEntry>;
  submitLabel: string;
  onSubmit: (q: number) => void;
  /** Put the food on the Tally list and count this many. */
  onTally?: (q: number) => void;
  onRemove?: () => void;
  onEditFood?: () => void;
}) {
  const c = useColors();
  const q = parseFloat(qty);
  const qOk = Number.isFinite(q) && q > 0;
  const t = totals(qOk ? q : 0);
  const byWeight = portion === GRAMS;
  const step = (d: number) =>
    setQty(
      byWeight
        ? fmt(Math.max(1, Math.round((qOk ? q : 100) + d)))
        : fmt(Math.max(0.25, Math.round(((qOk ? q : 1) + d) * 4) / 4)),
    );
  const p = qOk ? preview(q) : null;
  const options = portionsFor(food);
  const source = food.custom ? 'My food' : food.src ? SOURCE_LABEL[food.src] : null;

  return (
    <View>
      <Text style={[st.name, { color: c.ink }]}>{food.name}</Text>
      {food.note ? <Text style={{ color: c.ink, fontSize: 15, marginTop: 2 }}>{food.note}</Text> : null}
      <Mute>{[food.brand, source].filter(Boolean).join(' · ') || ' '}</Mute>
      {onEditFood ? (
        <View style={{ marginTop: space.sm, flexDirection: 'row' }}>
          <LinkButton label="Edit this food" onPress={onEditFood} />
        </View>
      ) : null}

      <Card style={{ marginTop: space.lg }}>
      {options.length ? (
        <View style={{ gap: 6 }}>
          <Text style={st.lbl(c.mute)}>Measure</Text>
          <Select
            label="Measure"
            value={portion ? options.indexOf(portion) : null}
            options={options.map((o, i) => ({ value: i, label: o === GRAMS ? 'Grams' : portionText(o) }))}
            onChange={(i) => setPortion(options[i])}
          />
        </View>
      ) : (
        <Mute>1 serving = {food.serving}</Mute>
      )}

      <View style={[st.row, { marginTop: space.lg, alignItems: 'flex-start' }]}>
        <View style={{ gap: 6 }}>
          <Text style={st.lbl(c.mute)}>{byWeight ? 'Grams' : options.length ? 'How many' : 'Servings'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Pill label="−" selected={false} onPress={() => step(byWeight ? -10 : -0.5)} style={{ paddingHorizontal: 14 }} />
            <Field
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              accessibilityLabel={byWeight ? 'Grams' : 'Servings'}
              style={{ width: 76, textAlign: 'center', fontWeight: '700', borderColor: qOk ? undefined : c.bad }}
            />
            <Pill label="+" selected={false} onPress={() => step(byWeight ? 10 : 0.5)} style={{ paddingHorizontal: 14 }} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: space.md }}>{when}</View>
      </Card>

      <Card style={{ marginBottom: 0 }}>
        <NutritionSummary t={t} />
      </Card>

      {p ? (
        <Notice tone={p.tone} style={{ marginTop: space.lg }}>
          {p.lines.map((l, i) => (
            <Text key={i} style={{ color: i === 0 ? toneColor(c, p.tone) : c.ink, fontWeight: i === 0 ? '700' : '400', fontSize: 15, lineHeight: 21 }}>
              {l}
            </Text>
          ))}
        </Notice>
      ) : null}

      <Button label={submitLabel} primary onPress={() => onSubmit(q)} style={{ marginTop: space.xl, opacity: qOk && timeOk ? 1 : 0.4 }} />
      {onTally && !byWeight ? (
        <View style={{ marginTop: space.md, gap: 6 }}>
          <Button label="Add to Tally list" onPress={() => qOk && onTally(q)} style={{ opacity: qOk && timeOk ? 1 : 0.4 }} />
        </View>
      ) : null}
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
    <View style={st.nutri}>
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
  when,
  preview,
  onSubmit,
}: {
  when: ReactNode;
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
      <View style={{ gap: 6 }}>
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
      <View style={{ marginTop: space.md }}>{when}</View>
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
  const [note, setNote] = useState(initial?.note ?? '');
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
      <View style={{ gap: 6 }}>
        <Text style={st.lbl(c.mute)}>Name</Text>
        <Field value={name} onChangeText={setName} placeholder="e.g. Protein bar, chocolate" accessibilityLabel="Food name" />
      </View>
      <View style={{ marginTop: space.md, gap: 6 }}>
        <Text style={st.lbl(c.mute)}>Details (optional)</Text>
        <Field
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Homemade, with olive oil"
          maxLength={120}
          accessibilityLabel="Details"
        />
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
      <View style={{ marginTop: 6 }}>
        <MultiSelect label="Contains" values={tags} options={FOOD_TAGS.map((t) => ({ value: t.id, label: t.label }))} onChange={setTags} />
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
          if (note.trim()) food.note = note.trim();
          if (initial?.tally) food.tally = true;
          onSave(food);
        }}
      />
      {onDelete ? (
        confirmDelete ? (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Mute>Delete this food? Past entries stay in your log.</Mute>
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
    nutri: {},
    kcal: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, ...tabular },
    macro: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, ...tabular },
  }),
  lbl: (color: string) => ({ fontSize: 13, fontWeight: '600' as const, color }),
};
