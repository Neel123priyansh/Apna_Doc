// app/user_weight.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Dimensions, ScrollView,
    Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ── Theme ────────────────────────────────────────────────────
const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEXT_MID = '#C8B4A0';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';

// ── Ruler config ─────────────────────────────────────────────
const MIN_KG = 30;
const MAX_KG = 250;
const MIN_LBS = 66;
const MAX_LBS = 551;

const TOTAL_STEPS = 6;
const CURRENT_STEP = 3;

const TICK_SPACING = 12;      // px between ticks
const TICK_MAJOR = 5;       // every 5th tick is major (whole number label)

export default function WeightPickerScreen() {
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);

    // ── Receive gender + age from previous screens ───────────────────────────
    const params = useLocalSearchParams<{ gender?: string; age?: string }>();

    const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
    const [weight, setWeight] = useState(128);

    const MIN = unit === 'kg' ? MIN_KG : MIN_LBS;
    const MAX = unit === 'kg' ? MAX_KG : MAX_LBS;

    // Total ticks = (MAX - MIN) * TICK_MAJOR  (+1 for the last value)
    const totalTicks = (MAX - MIN) * TICK_MAJOR + 1;

    // Convert weight to scroll offset
    const weightToOffset = useCallback((w: number) => {
        return (w - MIN) * TICK_MAJOR * TICK_SPACING - width / 2;
    }, [MIN]);

    // Convert scroll offset to weight
    const offsetToWeight = useCallback((offset: number) => {
        const raw = (offset + width / 2) / (TICK_MAJOR * TICK_SPACING) + MIN;
        return Math.round(Math.min(MAX, Math.max(MIN, raw)));
    }, [MIN, MAX]);

    const handleScroll = (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        setWeight(offsetToWeight(x));
    };

    const switchUnit = (u: 'kg' | 'lbs') => {
        if (u === unit) return;
        const converted = u === 'lbs'
            ? Math.round(weight * 2.20462)
            : Math.round(weight / 2.20462);
        setUnit(u);
        setWeight(converted);
        setTimeout(() => {
            const newMin = u === 'kg' ? MIN_KG : MIN_LBS;
            const offset = (converted - newMin) * TICK_MAJOR * TICK_SPACING - width / 2;
            scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
        }, 50);
    };

    // Render all ticks
    const renderTicks = () => {
        const ticks = [];
        for (let i = 0; i < totalTicks; i++) {
            const isMajor = i % TICK_MAJOR === 0;
            const value = MIN + i / TICK_MAJOR;
            const isCenter = Math.abs(value - weight) < 0.1;

            ticks.push(
                <View
                    key={i}
                    style={[
                        styles.tick,
                        isMajor ? styles.tickMajor : styles.tickMinor,
                        isCenter && styles.tickCenter,
                    ]}
                />
            );
        }
        return ticks;
    };

    // Labels below ruler (whole numbers only, every 1 kg/lbs)
    const renderLabels = () => {
        const labels = [];
        for (let v = MIN; v <= MAX; v++) {
            const diff = Math.abs(v - weight);
            if (diff > 6) {
                labels.push(<View key={v} style={{ width: TICK_SPACING * TICK_MAJOR }} />);
                continue;
            }
            labels.push(
                <View
                    key={v}
                    style={{
                        width: TICK_SPACING * TICK_MAJOR,
                        alignItems: 'center',
                    }}
                >
                    <Text style={[
                        styles.rulerLabel,
                        {
                            color: diff === 0 ? TEXT_DARK : TEXT_MID,
                            fontWeight: diff === 0 ? '700' : '400',
                            fontSize: diff === 0 ? 13 : 12
                        },
                    ]}>
                        {v}
                    </Text>
                </View>
            );
        }
        return labels;
    };

    // ── Continue: forward gender + age (received) + weight/unit (chosen) ────
    const handleContinue = () => {
        router.push({
            pathname: '/user_height',
            params: {
                gender: params.gender ?? '',
                age: params.age ?? '',
                weight: weight.toString(),
                unit,
            },
        } as any);
    };

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={BG} />

            {/* ── Top bar ─────────────────────────────────────── */}
            <View style={styles.progressRow}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.push('/user_age')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-back" size={18} color={TEXT_DARK} />
                </TouchableOpacity>
                <Text style={styles.topTitle}>User's Profile</Text>
                <View style={styles.stepBadge}>
                    <Text style={styles.stepText}>
                        {CURRENT_STEP} of {TOTAL_STEPS}
                    </Text>
                </View>
            </View>

            {/* ── Question ────────────────────────────────────── */}
            <Text style={styles.question}>What's your weight?</Text>

            {/* ── Unit toggle ─────────────────────────────────── */}
            <View style={styles.unitToggle}>
                <TouchableOpacity
                    style={[styles.unitBtn, unit === 'kg' && styles.unitBtnActive]}
                    onPress={() => switchUnit('kg')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.unitBtnText, unit === 'kg' && styles.unitBtnTextActive]}>
                        kg
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.unitBtn, unit === 'lbs' && styles.unitBtnActive]}
                    onPress={() => switchUnit('lbs')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.unitBtnText, unit === 'lbs' && styles.unitBtnTextActive]}>
                        lbs
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── Big weight display ───────────────────────────── */}
            <View style={styles.displayRow}>
                <Text style={styles.weightNumber}>{weight}</Text>
                <Text style={styles.weightUnit}>{unit}</Text>
            </View>

            {/* ── Ruler ───────────────────────────────────────── */}
            <View style={styles.rulerWrap}>
                {/* Center indicator line */}
                <View style={styles.centerLine} />

                {/* Scrollable ticks */}
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    snapToInterval={TICK_SPACING}
                    decelerationRate="fast"
                    contentOffset={{ x: Math.max(0, weightToOffset(weight)), y: 0 }}
                    contentContainerStyle={[
                        styles.rulerContent,
                        { paddingHorizontal: width / 2 },
                    ]}
                >
                    {/* Ticks row */}
                    <View style={styles.ticksRow}>
                        {renderTicks()}
                    </View>
                    {/* Labels row */}
                    <View style={styles.labelsRow}>
                        {renderLabels()}
                    </View>
                </ScrollView>
            </View>

            {/* ── Continue ────────────────────────────────────── */}
            <View style={styles.bottomSection}>
                <TouchableOpacity
                    style={styles.continueBtn}
                    activeOpacity={0.85}
                    onPress={handleContinue}
                >
                    <Text style={styles.continueBtnText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: BG,
        paddingHorizontal: 14,
        paddingVertical: 20,
    },

    // ── Top bar ──────────────────────────────────────────
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 48,
        marginTop: 35,
    },
    backBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.2,
        borderColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    stepBadge: {
        backgroundColor: PILL_BG,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    stepText: {
        fontSize: 12,
        fontWeight: '600',
        color: TEXT_DARK,
    },

    // ── Question ─────────────────────────────────────────
    question: {
        fontSize: 30,
        fontWeight: '800',
        color: TEXT_DARK,
        textAlign: 'center',
        lineHeight: 34,
        marginBottom: 32,
        letterSpacing: -0.3,
    },

    // ── Unit toggle ──────────────────────────────────────
    unitToggle: {
        flexDirection: 'row',
        alignSelf: 'center',
        backgroundColor: '#EDE8E0',
        borderRadius: 50,
        padding: 4,
        marginBottom: height * 0.10,
        width: width * 0.9,
    },
    unitBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unitBtnActive: {
        backgroundColor: TEAL,
        shadowColor: TEAL,
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    unitBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: TEXT_MID,
    },
    unitBtnTextActive: {
        color: '#fff',
        fontWeight: '700',
    },

    // ── Weight display ───────────────────────────────────
    displayRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginBottom: height * 0.04,
        gap: 6,
    },
    weightNumber: {
        fontSize: 80,
        fontWeight: '800',
        color: TEXT_DARK,
        lineHeight: 84,
        letterSpacing: -2,
    },
    weightUnit: {
        fontSize: 29,
        fontWeight: '600',
        color: TEXT_DARK,
        marginBottom: 12,
    },

    // ── Ruler ────────────────────────────────────────────
    rulerWrap: {
        height: 120,
        position: 'relative',
        marginBottom: 100,
    },
    centerLine: {
        position: 'absolute',
        left: width / 2 - 1.5,
        top: 0,
        bottom: 28,
        width: 7,
        backgroundColor: TEAL,
        borderRadius: 7,
        zIndex: 10,
    },
    rulerContent: {
        alignItems: 'flex-start',
    },
    ticksRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 55,
    },
    tick: {
        width: 2,
        marginHorizontal: TICK_SPACING / 2 - 0.75,
        borderRadius: 1,
    },
    tickMajor: {
        height: 32,
        backgroundColor: '#D5B89A',
    },
    tickMinor: {
        height: 18,
        backgroundColor: '#E0CEBF',
    },
    tickCenter: {
        backgroundColor: TEAL,
        width: 2.5,
    },
    labelsRow: {
        flexDirection: 'row',
        marginTop: 6,
        height: 22,
    },
    rulerLabel: {
        fontSize: 12,
        color: TEXT_MID,
        textAlign: 'center',
    },

    // ── Bottom ───────────────────────────────────────────
    bottomSection: {
        paddingBottom: 48,
        alignItems: 'center',
        width: '100%',
    },
    continueBtn: {
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 17,
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
    continueBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
