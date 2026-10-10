// app/user_age.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ── Brand tokens ───────────────────────────────────────────────────────────
const TEAL = '#1FA97F';
const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEXT_MID = '#B7AA98';
const TEXT_LIGHT = '#D8CEC0';
const PILL_BG = '#EDE6D8';
const TOTAL_STEPS = 6;
const CURRENT_STEP = 2;

// Design baseline: ~360 x 800 dp Android phone. Everything scales from this.
const BASE_WIDTH = 360;
const BASE_HEIGHT = 800;
const MAX_CONTENT_WIDTH = 520; // keeps tablets / foldables / landscape tidy
const FONT_CAP = 1.2; // caps system font scaling so text can't break the layout

// Wheel picker limits
const MIN_ITEM_HEIGHT = 56;
const MAX_ITEM_HEIGHT = 120;
const DEFAULT_AGE = 18;

// Ages 1–100
const AGES = Array.from({ length: 100 }, (_, i) => i + 1);
const DEFAULT_INDEX = AGES.indexOf(DEFAULT_AGE);

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function AgePickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions(); // updates on rotation / split-screen / fold
  const listRef = useRef<ScrollView>(null);

  // ── Receive gender from the previous screen ──────────────────────────────
  const params = useLocalSearchParams<{ gender?: string }>();

  const [centerIndex, setCenterIndex] = useState(DEFAULT_INDEX);
  const centerRef = useRef(DEFAULT_INDEX); // latest index, safe to read inside callbacks

  // ---------- Responsive metrics ----------
  const m = useMemo(() => {
    const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
    const s = clamp(contentWidth / BASE_WIDTH, 0.82, 1.3);
    const v = clamp(height / BASE_HEIGHT, 0.7, 1.2);
    const sp = (n: number) => Math.round(n * s);
    const vs = (n: number) => Math.round(n * v);

    const pagePad = sp(16);
    const questionSize = clamp(sp(28), 22, 34);
    const questionLine = Math.round(questionSize * 1.22);

    // Space taken by everything except the picker (header, question, button, gaps, insets)
    const reserved =
      insets.top +
      insets.bottom +
      vs(16) + sp(32) + vs(24) + // header
      questionLine + vs(20) + // question
      vs(20) + // gap above button
      sp(52) + vs(24); // button + bottom padding
    const available = height - reserved;

    // 5 rows when there is room, otherwise 3 rows. If it still doesn't fit, the page scrolls.
    const rows = available >= MIN_ITEM_HEIGHT * 5 ? 5 : 3;
    const itemHeight = clamp(Math.floor(available / rows), MIN_ITEM_HEIGHT, MAX_ITEM_HEIGHT);

    return {
      sp,
      vs,
      pagePad,
      questionSize,
      questionLine,
      headerTitle: clamp(sp(20), 17, 24),
      itemHeight,
      pickerHeight: itemHeight * rows,
      selectedFont: clamp(Math.round(itemHeight * 0.8), 44, 100),
      nearFont: clamp(Math.round(itemHeight * 0.22), 18, 26),
      midFont: clamp(Math.round(itemHeight * 0.18), 16, 22),
      farFont: clamp(Math.round(itemHeight * 0.15), 14, 18),
    };
  }, [width, height, insets.top, insets.bottom]);

  const ITEM_HEIGHT = m.itemHeight;

  // ── Track which row is centred while scrolling ───────────────────────────
  const indexFromOffset = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      return clamp(idx, 0, AGES.length - 1);
    },
    [ITEM_HEIGHT],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = indexFromOffset(e);
      if (idx !== centerRef.current) {
        centerRef.current = idx;
        setCenterIndex(idx);
      }
    },
    [indexFromOffset],
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = indexFromOffset(e);
      centerRef.current = idx;
      setCenterIndex(idx);
    },
    [indexFromOffset],
  );

  const scrollToIndex = (index: number) => {
    listRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    centerRef.current = index;
    setCenterIndex(index);
  };

  // Restore the selected row whenever the picker is (re)mounted or resized
  const handlePickerLayout = () => {
    listRef.current?.scrollTo({ y: centerRef.current * ITEM_HEIGHT, animated: false });
  };

  const selectedAge = AGES[centerIndex];

  // ── Continue: forward gender (received) + age (chosen here) ─────────────
  const handleContinue = () => {
    router.push({
      pathname: '/user_weight',
      params: {
        gender: params.gender ?? '',
        age: selectedAge.toString(),
      },
    } as any);
  };

  // ── Row styling — size/colour depend on distance from the centre ────────
  const rowStyle = (distance: number) => {
    if (distance === 0) return { fontSize: m.selectedFont, color: '#fff', fontWeight: '800' as const };
    if (distance === 1) return { fontSize: m.nearFont, color: TEXT_MID, fontWeight: '600' as const };
    if (distance === 2) return { fontSize: m.midFont, color: TEXT_LIGHT, fontWeight: '400' as const };
    return { fontSize: m.farFont, color: TEXT_LIGHT, fontWeight: '400' as const };
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        style={s.scroll}
        // flexGrow lets the button sit at the bottom on tall screens,
        // while short screens (e.g. landscape) simply scroll to reach it.
        contentContainerStyle={[
          s.scrollContent,
          { paddingHorizontal: m.pagePad, paddingBottom: insets.bottom + m.vs(24) },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
      >
        <View style={s.column}>
          {/* ── Header: back button + progress ─────────────────────────── */}
          <View style={[s.progressRow, { marginTop: m.vs(16), marginBottom: m.vs(24) }]}>
            <TouchableOpacity
              style={[s.backBtn, { width: m.sp(32), height: m.sp(32), borderRadius: m.sp(16) }]}
              onPress={() => router.push('/user_gender')}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={m.sp(18)} color={TEXT_DARK} />
            </TouchableOpacity>

            <Text
              style={[s.progressLabel, { fontSize: m.headerTitle }]}
              numberOfLines={1}
              maxFontSizeMultiplier={FONT_CAP}
            >
              User's Profile
            </Text>

            <View
              style={[
                s.progressPill,
                { paddingHorizontal: m.sp(12), paddingVertical: m.sp(6), borderRadius: m.sp(20) },
              ]}
            >
              <Text
                style={[s.progressPillText, { fontSize: clamp(m.sp(12), 11, 14) }]}
                maxFontSizeMultiplier={FONT_CAP}
              >
                {CURRENT_STEP} of {TOTAL_STEPS}
              </Text>
            </View>
          </View>

          {/* ── Question ───────────────────────────────────────────────── */}
          <Text
            style={[
              s.question,
              { fontSize: m.questionSize, lineHeight: m.questionLine, marginBottom: m.vs(20) },
            ]}
            maxFontSizeMultiplier={FONT_CAP}
          >
            What's your age?
          </Text>

          {/* ── Wheel picker ───────────────────────────────────────────── */}
          <View style={[s.pickerWrap, { height: m.pickerHeight }]}>
            {/* Green selection pill — sits behind the centred row */}
            <View
              pointerEvents="none"
              style={[
                s.selectionPill,
                {
                  top: (m.pickerHeight - ITEM_HEIGHT) / 2,
                  height: ITEM_HEIGHT,
                  borderRadius: ITEM_HEIGHT / 2,
                },
              ]}
            />

            <ScrollView
              // Re-mount when the row size changes (rotation, fold) so snapping stays aligned
              key={`${ITEM_HEIGHT}-${m.pickerHeight}`}
              ref={listRef}
              style={{ height: m.pickerHeight, width: '100%' }}
              contentContainerStyle={{ paddingVertical: (m.pickerHeight - ITEM_HEIGHT) / 2 }}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              nestedScrollEnabled // lets the wheel scroll inside the page ScrollView on Android
              onLayout={handlePickerLayout}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
            >
              {AGES.map((age, index) => {
                const distance = Math.abs(index - centerIndex);
                return (
                  <TouchableOpacity
                    key={age}
                    activeOpacity={0.8}
                    onPress={() => scrollToIndex(index)}
                    style={[s.row, { height: ITEM_HEIGHT }]}
                  >
                    <Text
                      style={[
                        rowStyle(distance),
                        { includeFontPadding: false, textAlignVertical: 'center' },
                      ]}
                      maxFontSizeMultiplier={FONT_CAP}
                    >
                      {age}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Pushes the button down on tall screens; collapses to a minimum gap on short ones */}
          <View style={[s.spacer, { minHeight: m.vs(20) }]} />

          {/* ── Continue ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.continueBtn, { paddingVertical: m.sp(16), borderRadius: m.sp(30) }]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text
              style={[s.continueText, { fontSize: clamp(m.sp(16), 15, 18) }]}
              maxFontSizeMultiplier={FONT_CAP}
            >
              Continue
            </Text>
            <Ionicons name="arrow-forward" size={m.sp(18)} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Only static (non-size) styles live here; all dimensions are computed in the component.
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1, // lets content fill the screen so the spacer can push the button down
    alignItems: 'center',
  },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    borderWidth: 1.2,
    borderColor: TEXT_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLabel: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: TEXT_DARK,
    marginHorizontal: 8,
  },
  progressPill: {
    backgroundColor: PILL_BG,
  },
  progressPillText: {
    fontWeight: '600',
    color: TEXT_DARK,
  },

  // ── Question ──────────────────────────────────────────────────────────────
  question: {
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  // ── Picker ────────────────────────────────────────────────────────────────
  pickerWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionPill: {
    position: 'absolute',
    width: '80%',
    backgroundColor: TEAL,
    shadowColor: TEAL,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  spacer: {
    flexGrow: 1,
  },

  // ── Continue ──────────────────────────────────────────────────────────────
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TEAL,
    width: '100%',
    shadowColor: TEAL,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueText: {
    fontWeight: '700',
    color: '#fff',
  },
});