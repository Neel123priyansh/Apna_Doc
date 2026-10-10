// app/user_height.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Dimensions, ScrollView,
    StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { authFetch } from '../src/services/authServices';

const { width, height } = Dimensions.get('window');

// ── Theme ────────────────────────────────────────────────────
const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEXT_MID = '#C8B4A0';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';

// ── Ruler config ─────────────────────────────────────────────
const MIN_CM = 100;
const MAX_CM = 250;
const MIN_IN = 39;   // ≈ 100 cm
const MAX_IN = 98;   // ≈ 250 cm

const TOTAL_STEPS = 6;
const CURRENT_STEP = 4;

const TICK_SPACING = 12;   // px between ticks
const TICK_MAJOR = 5;    // every 5th tick = whole number label

export default function HeightPickerScreen() {
    const router = useRouter();

    // ── Receive gender + age + weight/unit from previous screens ─────────────
    const params = useLocalSearchParams<{
        gender?: string;
        age?: string;
        weight?: string;
        unit?: string;
    }>();

    const scrollRef = useRef<ScrollView>(null);

    const [unit, setUnit] = useState<'cm' | 'in'>('cm');
    const [heightVal, setHeightVal] = useState(170);
    const [saving, setSaving] = useState(false);

    const MIN = unit === 'cm' ? MIN_CM : MIN_IN;
    const MAX = unit === 'cm' ? MAX_CM : MAX_IN;

    const totalTicks = (MAX - MIN) * TICK_MAJOR + 1;

    // Convert height to scroll offset
    const heightToOffset = useCallback((h: number) => {
        return (h - MIN) * TICK_MAJOR * TICK_SPACING - width / 2;
    }, [MIN]);

    // Convert scroll offset to height
    const offsetToHeight = useCallback((offset: number) => {
        const raw = (offset + width / 2) / (TICK_MAJOR * TICK_SPACING) + MIN;
        return Math.round(Math.min(MAX, Math.max(MIN, raw)));
    }, [MIN, MAX]);

    const handleScroll = (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        setHeightVal(offsetToHeight(x));
    };

    const switchUnit = (u: 'cm' | 'in') => {
        if (u === unit) return;
        const converted = u === 'in'
            ? Math.round(heightVal / 2.54)
            : Math.round(heightVal * 2.54);
        setUnit(u);
        setHeightVal(converted);
        setTimeout(() => {
            const newMin = u === 'cm' ? MIN_CM : MIN_IN;
            const offset = (converted - newMin) * TICK_MAJOR * TICK_SPACING - width / 2;
            scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
        }, 50);
    };

    // Feet/inches readable subtitle when unit === 'in'
    const feetInchesLabel = () => {
        if (unit !== 'in') return null;
        const feet = Math.floor(heightVal / 12);
        const inches = heightVal % 12;
        return `${feet}' ${inches}"`;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ── LIVE BMI — recalculates on every height/weight/unit change ─────────
    // Converts both weight and height to metric (kg / m) regardless of which
    // units the user picked, exactly like the calculation in userVitals.tsx
    // ═══════════════════════════════════════════════════════════════════════
    const bmiData = (() => {
        const rawWeight = Number(params.weight);
        const weightUnit = params.unit; // 'kg' | 'lbs'
        if (!rawWeight || !heightVal) return null;

        const wKg = weightUnit === 'lbs' ? rawWeight * 0.453592 : rawWeight;
        const hCm = unit === 'in' ? heightVal * 2.54 : heightVal;
        const hM = hCm / 100;
        if (hM <= 0) return null;

        const bmi = wKg / (hM * hM);
        const category =
            bmi < 18.5 ? 'Underweight'
                : bmi < 25 ? 'Normal weight'
                    : bmi < 30 ? 'Overweight'
                        : 'Obese';

        const color =
            bmi < 18.5 ? '#3B82F6'   // blue
                : bmi < 25 ? TEAL      // teal — healthy
                    : bmi < 30 ? '#F59E0B' // amber
                        : '#EF4444';       // red

        return { value: bmi.toFixed(1), category, color };
    })();

    // Render all ticks
    const renderTicks = () => {
        const ticks = [];
        for (let i = 0; i < totalTicks; i++) {
            const isMajor = i % TICK_MAJOR === 0;
            const value = MIN + i / TICK_MAJOR;
            const isCenter = Math.abs(value - heightVal) < 0.1;

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

    // Labels below ruler (whole numbers only, visible range)
    const renderLabels = () => {
        const labels = [];
        for (let v = MIN; v <= MAX; v++) {
            const diff = Math.abs(v - heightVal);
            if (diff > 6) {
                labels.push(<View key={v} style={{ width: TICK_SPACING * TICK_MAJOR }} />);
                continue;
            }
            labels.push(
                <View
                    key={v}
                    style={{ width: TICK_SPACING * TICK_MAJOR, alignItems: 'center' }}
                >
                    <Text style={[
                        styles.rulerLabel,
                        {
                            color: diff === 0 ? TEXT_DARK : TEXT_MID,
                            fontWeight: diff === 0 ? '700' : '400',
                            fontSize: diff === 0 ? 13 : 12,
                        },
                    ]}>
                        {v}
                    </Text>
                </View>
            );
        }
        return labels;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ── FINAL SUBMIT — sends gender, age, weight, height collected across
    //    all 4 onboarding screens to the backend in one request           ──
    // ═══════════════════════════════════════════════════════════════════════
    const handleSubmit = async () => {
        setSaving(true);
        try {
            // Normalise height to cm for storage (backend expects cm per userVitals.tsx)
            const heightCm = unit === 'in' ? Math.round(heightVal * 2.54) : heightVal;

            const res = await authFetch('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    sex: params.gender || 'Other',
                    age: Number(params.age) || undefined,
                    weight: Number(params.weight) || undefined,
                    weightUnit: params.unit || 'kg',
                    height: heightCm,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            await SecureStore.setItemAsync('hasCompletedOnboarding', 'true');
            router.replace('/');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save your vitals');
        } finally {
            setSaving(false);
        }
    };

    const handleContinue = () => {
        const heightCm = unit === 'in' ? Math.round(heightVal * 2.54) : heightVal;
        router.push({
            pathname: '/user_location',
            params: {
                gender: params.gender ?? '',
                age: params.age ?? '',
                weight: params.weight ?? '',
                unit: params.unit ?? '',
                height: heightCm.toString(),
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
                    onPress={() => router.push('/user_weight')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-back" size={18} color={TEXT_DARK} />
                </TouchableOpacity>
                <Text style={styles.topTitle}>User&apos;s Profile</Text>
                <View style={styles.stepBadge}>
                    <Text style={styles.stepText}>
                        {CURRENT_STEP} of {TOTAL_STEPS}
                    </Text>
                </View>
            </View>

            {/* ── Question ────────────────────────────────────── */}
            <Text style={styles.question}>What&apos;s your height?</Text>

            {/* ── Unit toggle ─────────────────────────────────── */}
            <View style={styles.unitToggle}>
                <TouchableOpacity
                    style={[styles.unitBtn, unit === 'cm' && styles.unitBtnActive]}
                    onPress={() => switchUnit('cm')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.unitBtnText, unit === 'cm' && styles.unitBtnTextActive]}>
                        cm
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.unitBtn, unit === 'in' && styles.unitBtnActive]}
                    onPress={() => switchUnit('in')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.unitBtnText, unit === 'in' && styles.unitBtnTextActive]}>
                        ft/in
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── Big height display ───────────────────────────── */}
            <View style={styles.displayCol}>
                <View style={styles.displayRow}>
                    <Text style={styles.heightNumber}>{heightVal}</Text>
                    <Text style={styles.heightUnit}>{unit}</Text>
                </View>
                {unit === 'in' && (
                    <Text style={styles.feetInchesLabel}>{feetInchesLabel()}</Text>
                )}
            </View>

            {/* ── Ruler ───────────────────────────────────────── */}
            <View style={styles.rulerWrap}>
                {/* Center indicator line */}
                <View style={styles.centerLine} />

                <ScrollView
                    ref={scrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    snapToInterval={TICK_SPACING}
                    decelerationRate="fast"
                    contentOffset={{ x: Math.max(0, heightToOffset(heightVal)), y: 0 }}
                    contentContainerStyle={[
                        styles.rulerContent,
                        { paddingHorizontal: width / 2 },
                    ]}
                >
                    <View style={styles.ticksRow}>
                        {renderTicks()}
                    </View>
                    <View style={styles.labelsRow}>
                        {renderLabels()}
                    </View>
                </ScrollView>
            </View>

            {/* ── LIVE BMI CARD — sits right under the ruler ───── */}
            {bmiData && (
                <View style={[styles.bmiCard, { borderColor: bmiData.color + '40', backgroundColor: bmiData.color + '12' }]}>
                    <MaterialCommunityIcons name="scale-balance" size={16} color={bmiData.color} />
                    <Text style={[styles.bmiText, { color: bmiData.color }]}>
                        BMI: {bmiData.value} — {bmiData.category}
                    </Text>
                </View>
            )}

            {/* ── Continue / Submit ────────────────────────────── */}
            <View style={styles.bottomSection}>
                <TouchableOpacity
                    style={[styles.continueBtn, saving && { opacity: 0.7 }]}
                    activeOpacity={0.85}
                    onPress={handleContinue}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.continueBtnText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </>
                    )}
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
        marginBottom: height * 0.08,
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

    // ── Height display ───────────────────────────────────
    displayCol: {
        alignItems: 'center',
        marginBottom: height * 0.035,
    },
    displayRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
    },
    heightNumber: {
        fontSize: 80,
        fontWeight: '800',
        color: TEXT_DARK,
        lineHeight: 84,
        letterSpacing: -2,
    },
    heightUnit: {
        fontSize: 29,
        fontWeight: '600',
        color: TEXT_DARK,
        marginBottom: 12,
    },
    feetInchesLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: TEXT_MID,
        marginTop: 4,
    },

    // ── Ruler ────────────────────────────────────────────
    rulerWrap: {
        height: 120,
        position: 'relative',
        marginBottom: 24,       // ↓ reduced to make room for BMI card below
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

    // ── Live BMI card ─────────────────────────────────────
    bmiCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: 'center',
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 10,
        marginBottom: 60,
    },
    bmiText: {
        fontSize: 14,
        fontWeight: '700',
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
