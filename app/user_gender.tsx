// app/user_gender.tsx
import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, StatusBar, Image, ImageSourcePropType, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ── Brand tokens ───────────────────────────────────────────────────────────
const CREAM = '#F5F0E8';
const TEAL = '#1FA97F';
const DARK_TEXT = '#2B2118';
const MUTED = '#9A9184';
const BORDER = '#E8DFD3';

const TOTAL_STEPS = 6;
const CURRENT_STEP = 1;

type GenderOption = {
    key: string;
    label: string;
    symbol: string;
    image?: ImageSourcePropType;
};

const OPTIONS: GenderOption[] = [
    {
        key: 'Male',
        label: 'I am Male',
        symbol: '♂',
        image: require('../assets/images/male.png'),
    },
    {
        key: 'Female',
        label: 'I am Female',
        symbol: '♀',
        image: require('../assets/images/female.png'),
    },
];

export default function GenderQuestionScreen() {
    const router = useRouter();
    const [selected, setSelected] = useState<string>('');

    // ── Continue: requires a selection, carries it forward as `gender` ──────
    const handleContinue = () => {
        if (!selected) {
            return Alert.alert('Select an option', 'Please choose your gender to continue.');
        }
        router.push({
            pathname: '/user_age',
            params: { gender: selected },
        } as any);
    };

    // ── Skip: still moves forward, but with gender left blank/"Other" ───────
    const handleSkip = () => {
        router.push({
            pathname: '/user_age',
            params: { gender: 'Other' },
        } as any);
    };

    return (
        <SafeAreaView style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={CREAM} />

            {/* ── Progress row ──────────────────────────────────────────── */}
            <View style={s.progressRow}>
                <Text style={s.progressLabel}>User's Profile</Text>
                <View style={s.progressPill}>
                    <Text style={s.progressPillText}>
                        {CURRENT_STEP} of {TOTAL_STEPS}
                    </Text>
                </View>
            </View>

            {/* ── Question ──────────────────────────────────────────────── */}
            <Text style={s.question}>What's your official{'\n'}gender?</Text>

            {/* ── Options ───────────────────────────────────────────────── */}
            <View style={s.optionsWrap}>
                {OPTIONS.map(opt => {
                    const active = selected === opt.key;
                    return (
                        <TouchableOpacity
                            key={opt.key}
                            style={[s.optionCard, active && s.optionCardActive]}
                            onPress={() => setSelected(opt.key)}
                            activeOpacity={0.85}
                        >
                            {/* Left: label + symbol */}
                            <View style={s.optionLeft}>
                                <Text style={s.optionLabel}>{opt.label}</Text>
                                <Text style={s.optionSymbol}>{opt.symbol}</Text>
                            </View>

                            {/* ── ILLUSTRATION SPACE ── */}
                            <View style={s.illustrationBox}>
                                {opt.image ? (
                                    <Image
                                        source={opt.image}
                                        style={s.illustrationImage}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <View style={s.placeholderInner}>
                                        <MaterialCommunityIcons
                                            name="image-plus"
                                            size={26}
                                            color={MUTED}
                                        />
                                        <Text style={s.placeholderText}>
                                            Add image
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Selected checkmark */}
                            {active && (
                                <View style={s.checkBadge}>
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Spacer pushes button to bottom ────────────────────────── */}
            <View style={{ flex: 1 }} />

            {/* ── Continue button ───────────────────────────────────────── */}
            <View style={s.bottomBlock}>
                <TouchableOpacity
                    style={s.thnksBtn}
                    onPress={handleSkip}
                    activeOpacity={0.85}
                >
                    <Text style={s.continueText}>Prefer to skip, thanks</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.continueBtn, !selected && s.continueBtnDisabled]}
                    onPress={handleContinue}
                    activeOpacity={0.85}
                >
                    <Text style={s.continueText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: CREAM,
        paddingHorizontal: 14,
        paddingVertical: 20,
    },

    // ── Progress ──────────────────────────────────────────────────────────────
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 48,
        marginTop: 35,
    },
    progressLabel: {
        fontSize: 20,
        fontWeight: '600',
        color: '#121212',
    },
    progressPill: {
        backgroundColor: '#EDE6D8',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    progressPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: DARK_TEXT,
    },

    // ── Question ──────────────────────────────────────────────────────────────
    question: {
        fontSize: 30,
        fontWeight: '800',
        color: '#121212',
        textAlign: 'center',
        lineHeight: 34,
        marginBottom: 58,
        letterSpacing: -0.3,
    },

    // ── Options ───────────────────────────────────────────────────────────────
    optionsWrap: {
        gap: 30,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: BORDER,
        paddingLeft: 30,
        paddingVertical: 0,
        minHeight: 118,
        position: 'relative',
    },
    optionCardActive: {
        borderColor: TEAL,
        shadowColor: TEAL,
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },

    optionLeft: {
        gap: 60,
    },
    optionLabel: {
        fontSize: 17,
        zIndex: 10,
        overflow: 'hidden',
        position: 'relative',
        fontWeight: '700',
        color: DARK_TEXT,
    },
    optionSymbol: {
        fontSize: 40,
        color: MUTED,
        fontWeight: '400',
    },

    illustrationBox: {
        width: 290,
        height: 195,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 1,
        flexShrink: 0,
    },
    illustrationImage: {
        width: 300,
        zIndex: 1,
        height: 300,
    },
    placeholderInner: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    placeholderText: {
        fontSize: 10,
        color: MUTED,
        fontWeight: '600',
    },

    checkBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: TEAL,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Bottom ────────────────────────────────────────────────────────────────
    bottomBlock: {
        paddingBottom: 48,
        alignItems: 'center',
    },
    continueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 18,
        width: '100%',
        shadowColor: TEAL,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    continueBtnDisabled: {
        backgroundColor: '#B7CFC3',
        shadowOpacity: 0,
        elevation: 0,
    },
    continueText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    homeIndicator: {
        width: 100,
        height: 4,
        borderRadius: 2,
        backgroundColor: DARK_TEXT,
        opacity: 0.7,
        marginTop: 18,
    },

    thnksBtn: {
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#121212',
        borderRadius: 30,
        paddingVertical: 17,
        width: '100%',
        shadowColor: TEAL,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    }
});
