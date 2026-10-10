import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';

const TOTAL_STEPS = 6;
const CURRENT_STEP = 6;

// Design baseline: ~360 x 800 dp Android phone. Everything scales from this.
const BASE_WIDTH = 360;
const BASE_HEIGHT = 800;
const MAX_CONTENT_WIDTH = 520; // keeps tablets / foldables / landscape tidy
const FONT_CAP = 1.2; // caps system font scaling so text can't break the layout

const BLOOD_TYPES = [
  ['A+', 'A-'],
  ['B+', 'B-'],
  ['O+', 'O-'],
  ['AB+', 'AB-'],
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function BloodTypeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions(); // updates on rotation / split-screen / fold
  const [selected, setSelected] = useState<string | null>(null);

  // ---------- Responsive metrics ----------
  const m = useMemo(() => {
    const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
    const s = clamp(contentWidth / BASE_WIDTH, 0.82, 1.3);
    const v = clamp(height / BASE_HEIGHT, 0.7, 1.2);
    const sp = (n: number) => Math.round(n * s);
    const vs = (n: number) => Math.round(n * v);

    const pagePad = sp(16);
    const colGap = sp(18);
    const btnWidth = Math.floor((contentWidth - pagePad * 2 - colGap) / 2);

    return {
      sp,
      vs,
      pagePad,
      colGap,
      rowGap: vs(22), // vertical gap shrinks on short screens
      btnWidth,
      btnPadV: vs(24),
      btnRadius: sp(14),
      btnFont: clamp(sp(18), 16, 22),
      titleSize: clamp(sp(28), 22, 34),
      headerTitle: clamp(sp(20), 17, 24),
    };
  }, [width, height]);

  // ---------- Logic ----------
  const handleContinue = () => {
    router.push({
      pathname: '/user_voice_analysis',
      params: { ...params, bloodType: selected || 'Unknown' },
    } as any);
  };

  const handleUnknown = () => {
    setSelected(null);
    router.push({
      pathname: '/medical_sym',
      params: { ...params, bloodType: 'Unknown' },
    } as any);
  };

  // ---------- UI ----------
  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        style={s.scroll}
        // flexGrow lets the button stay near the bottom on tall screens,
        // while short screens simply scroll to reach it.
        contentContainerStyle={[
          s.scrollContent,
          { paddingHorizontal: m.pagePad, paddingBottom: insets.bottom + m.vs(24) },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={s.column}>
          {/* Header */}
          <View style={[s.progressRow, { marginTop: m.vs(16), marginBottom: m.vs(24) }]}>
            <TouchableOpacity
              style={[s.backBtn, { width: m.sp(32), height: m.sp(32), borderRadius: m.sp(16) }]}
              onPress={() => router.push('/user_location')}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={m.sp(18)} color={TEXT_DARK} />
            </TouchableOpacity>

            <Text
              style={[s.topTitle, { fontSize: m.headerTitle }]}
              numberOfLines={1}
              maxFontSizeMultiplier={FONT_CAP}
            >
              User's Profile
            </Text>

            <View
              style={[
                s.stepBadge,
                { paddingHorizontal: m.sp(12), paddingVertical: m.sp(6), borderRadius: m.sp(20) },
              ]}
            >
              <Text style={[s.stepText, { fontSize: clamp(m.sp(12), 11, 14) }]} maxFontSizeMultiplier={FONT_CAP}>
                {CURRENT_STEP} of {TOTAL_STEPS}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            style={[
              s.title,
              {
                fontSize: m.titleSize,
                lineHeight: Math.round(m.titleSize * 1.25),
                marginTop: m.vs(28),
                marginBottom: m.vs(36),
              },
            ]}
            maxFontSizeMultiplier={FONT_CAP}
          >
            What is your blood type?
          </Text>

          {/* Grid */}
          <View style={{ gap: m.rowGap, alignItems: 'center' }}>
            {BLOOD_TYPES.map((row, ri) => (
              <View key={ri} style={[s.row, { gap: m.colGap }]}>
                {row.map(type => {
                  const active = selected === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        s.btn,
                        {
                          width: m.btnWidth,
                          paddingVertical: m.btnPadV,
                          borderRadius: m.btnRadius,
                        },
                        active && s.btnActive,
                      ]}
                      onPress={() => setSelected(type)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[s.btnText, { fontSize: m.btnFont }, active && s.btnTextActive]}
                        maxFontSizeMultiplier={FONT_CAP}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Pushes the button down on tall screens; collapses to a minimum gap on short ones */}
          <View style={[s.spacer, { minHeight: m.vs(32) }]} />

          {/* Continue */}
          <TouchableOpacity
            style={[
              s.continueBtn,
              { paddingVertical: m.sp(16), borderRadius: m.sp(30), marginBottom: m.vs(16) },
              !selected && s.continueBtnDisabled,
            ]}
            onPress={handleContinue}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={[s.continueBtnText, { fontSize: clamp(m.sp(17), 15, 19) }]} maxFontSizeMultiplier={FONT_CAP}>
              Continue
            </Text>
          </TouchableOpacity>

          {/* Don't know */}
          <TouchableOpacity
            style={s.unknownBtn}
            onPress={handleUnknown}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
          >
            <Text style={[s.unknownText, { fontSize: clamp(m.sp(14), 13, 16) }]} maxFontSizeMultiplier={FONT_CAP}>
              I don't know my blood type
            </Text>
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

  // Header
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
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: TEXT_DARK,
    marginHorizontal: 8,
  },
  stepBadge: {
    backgroundColor: PILL_BG,
  },
  stepText: {
    fontWeight: '600',
    color: TEXT_DARK,
  },

  // Title
  title: {
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  // Grid
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btn: {
    backgroundColor: '#fff',
    borderColor: '#fff',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
    shadowColor: TEAL,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  btnText: {
    fontWeight: '600',
    color: '#000',
  },
  btnTextActive: { color: '#fff' },

  spacer: {
    flexGrow: 1,
  },

  // Continue
  continueBtn: {
    backgroundColor: TEAL,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: TEAL,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0 },
  continueBtnText: { color: '#fff', fontWeight: '700' },

  // Don't know
  unknownBtn: { alignItems: 'center', paddingVertical: 8 },
  unknownText: {
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
});