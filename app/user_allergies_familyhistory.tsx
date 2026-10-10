import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    StatusBar,
    TextInput,
    KeyboardAvoidingView,
    Keyboard,
    Alert,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ── Theme ────────────────────────────────────────────────────
const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';
const INPUT_BORDER = '#C2D4A8';

const TOTAL_STEPS = 6;
const CURRENT_STEP = 6;
const MAX_CONDITIONS = 10;

// Design was built against a 390dp-wide baseline (a very common Android
// width). Scale relative to that, then clamp so text/spacing never gets
// unreadably small on tiny devices or absurdly large on tablets/foldables.
const BASE_WIDTH = 390;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function MedicalSymptomsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    // Scale factor clamped so very narrow (~320dp) or very wide (~800dp+)
    // screens don't distort the design — 0.85x–1.25x covers virtually every
    // Android phone/tablet in real-world use.
    const scaleFactor = clamp(width / BASE_WIDTH, 0.85, 1.25);
    const rs = (size: number) => Math.round(size * scaleFactor);

    // ── Receive parameters from previous onboarding steps ─────────────
    const params = useLocalSearchParams<{
        gender?: string;
        age?: string;
        weight?: string;
        unit?: string;
        height?: string;
    }>();

    const [allergyConditions, setAllergyConditions] = useState<string[]>([]);
    const [familyHistoryConditions, setFamilyHistoryConditions] = useState<string[]>([]);
    const [allergyInputText, setAllergyInputText] = useState('');
    const [familyHistoryInputText, setFamilyHistoryInputText] = useState('');

    // ── Keyboard-aware bottom padding ───────────────────────────────────
    // Guarantees the Continue button is always reachable by scrolling —
    // even when the keyboard is open and covering part of the screen,
    // scrolling to the bottom of the content will clear the keyboard and
    // reveal the button, rather than the button being stuck underneath it.
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates?.height ?? 0);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Toggle a common condition pill
    const toggleCondition = (condition: string, listType: 'allergy' | 'family') => {
        const target = listType === 'allergy' ? allergyConditions : familyHistoryConditions;
        const setTarget = listType === 'allergy' ? setAllergyConditions : setFamilyHistoryConditions;

        if (target.includes(condition)) {
            setTarget(prev => prev.filter(item => item !== condition));
        } else {
            if (target.length >= MAX_CONDITIONS) {
                Alert.alert('Limit Reached', `You can select up to ${MAX_CONDITIONS} conditions.`);
                return;
            }
            setTarget(prev => [...prev, condition]);
        }
    };

    // Add custom condition typed in TextInput
    const handleAddCustomCondition = (listType: 'allergy' | 'family') => {
        const trimmed = (listType === 'allergy' ? allergyInputText : familyHistoryInputText).trim();
        if (!trimmed) return;

        const current = listType === 'allergy' ? allergyConditions : familyHistoryConditions;
        const setTarget = listType === 'allergy' ? setAllergyConditions : setFamilyHistoryConditions;
        const setInput = listType === 'allergy' ? setAllergyInputText : setFamilyHistoryInputText;

        if (current.includes(trimmed)) {
            setInput('');
            return;
        }

        if (current.length >= MAX_CONDITIONS) {
            Alert.alert('Limit Reached', `You can select up to ${MAX_CONDITIONS} conditions.`);
            return;
        }

        setTarget(prev => [...prev, trimmed]);
        setInput('');
    };

    // Remove a condition tag
    const handleRemoveCondition = (condition: string, listType: 'allergy' | 'family') => {
        const setTarget = listType === 'allergy' ? setAllergyConditions : setFamilyHistoryConditions;
        setTarget(prev => prev.filter(item => item !== condition));
    };

    const handleSubmit = () => {
        const finalAllergies = [...allergyConditions];
        const finalFamilyHistory = [...familyHistoryConditions];

        const allergyTrimmed = allergyInputText.trim();
        if (allergyTrimmed && !finalAllergies.includes(allergyTrimmed) && finalAllergies.length < MAX_CONDITIONS) {
            finalAllergies.push(allergyTrimmed);
        }

        const familyTrimmed = familyHistoryInputText.trim();
        if (familyTrimmed && !finalFamilyHistory.includes(familyTrimmed) && finalFamilyHistory.length < MAX_CONDITIONS) {
            finalFamilyHistory.push(familyTrimmed);
        }

        router.push({
            pathname: '/user_bloodType',
            params: {
                ...params,
                allergies: finalAllergies.join(','),
                familyHistory: finalFamilyHistory.join(','),
            },
        } as any);
    };

    const styles = makeStyles(rs);

    return (
        <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom }]}>
            <StatusBar hidden barStyle="dark-content" backgroundColor={BG} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[
                        styles.scrollContent,
                        // Extra bottom space = keyboard height (when open) + a
                        // comfortable buffer, so scrolling all the way down
                        // always fully clears the Continue button — it can
                        // never end up hidden behind the keyboard or the
                        // bottom edge of the screen.
                        { paddingBottom: keyboardHeight + 48 },
                    ]}
                >
                    {/* Centers and caps content width on tablets/foldables,
                        while staying full-width on phones. */}
                    <View style={styles.contentWrap}>

                        {/* ── Top bar ─────────────────────────────────────── */}
                        <View style={styles.progressRow}>
                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={() => router.push('/user_current_medication')}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="chevron-back" size={rs(18)} color={TEXT_DARK} />
                            </TouchableOpacity>
                            <Text style={styles.topTitle} numberOfLines={1}>User's Profile</Text>
                            <View style={styles.stepBadge}>
                                <Text style={styles.stepText}>
                                    {CURRENT_STEP} of {TOTAL_STEPS}
                                </Text>
                            </View>
                        </View>

                        {/* ── Question ────────────────────────────────────── */}
                        <Text style={styles.question}>
                            Do you have any allergies?
                        </Text>

                        {/* ── Custom Condition Input Box & Selected Tags ──── */}
                        <View style={styles.inputCard}>
                            <View style={styles.tagsAndInputWrap}>
                                {allergyConditions.map((item, index) => (
                                    <TouchableOpacity
                                        key={`allergy-${index}`}
                                        style={styles.selectedPill}
                                        onPress={() => handleRemoveCondition(item, 'allergy')}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.selectedPillText} numberOfLines={1}>{item}</Text>
                                    </TouchableOpacity>
                                ))}

                                <TextInput
                                    style={styles.textInput}
                                    placeholder={
                                        allergyConditions.length === 0
                                            ? 'e.g. Penicillin, Sulfa Drugs'
                                            : 'type more...'
                                    }
                                    placeholderTextColor="#A59D92"
                                    value={allergyInputText}
                                    onChangeText={setAllergyInputText}
                                    onSubmitEditing={() => handleAddCustomCondition('allergy')}
                                    returnKeyType="done"
                                />
                            </View>
                        </View>

                        {/* ── Question ────────────────────────────────────── */}
                        <Text style={styles.questionTwo}>
                            Do you have any family history?
                        </Text>

                        {/* ── Custom Condition Input Box & Selected Tags ──── */}
                        <View style={styles.inputCard}>
                            <View style={styles.tagsAndInputWrap}>
                                {familyHistoryConditions.map((item, index) => (
                                    <TouchableOpacity
                                        key={`family-${index}`}
                                        style={styles.selectedPill}
                                        onPress={() => handleRemoveCondition(item, 'family')}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.selectedPillText} numberOfLines={1}>{item}</Text>
                                    </TouchableOpacity>
                                ))}

                                <TextInput
                                    style={styles.textInput}
                                    placeholder={
                                        familyHistoryConditions.length === 0
                                            ? 'e.g. Father - heart disease, Mother - diabetes'
                                            : 'type more...'
                                    }
                                    placeholderTextColor="#A59D92"
                                    value={familyHistoryInputText}
                                    onChangeText={setFamilyHistoryInputText}
                                    onSubmitEditing={() => handleAddCustomCondition('family')}
                                    returnKeyType="done"
                                />
                            </View>
                        </View>

                        {/* ── Continue Button ────────────────────────────── */}
                        <View style={styles.bottomSection}>
                            <TouchableOpacity
                                style={styles.continueBtn}
                                activeOpacity={0.85}
                                onPress={handleSubmit}
                            >
                                <Text style={styles.continueBtnText}>Continue</Text>
                                <Ionicons name="arrow-forward" size={rs(20)} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

// Styles are a function of the responsive scale (rs) so every screen —
// small phones, large phones, tablets, foldables — gets proportionally
// correct sizing instead of one fixed pixel design.
const makeStyles = (rs: (n: number) => number) => StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: BG,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: rs(14),
    },
    contentWrap: {
        width: '100%',
        maxWidth: 480,      // keeps things readable/centered on tablets
        alignSelf: 'center',
        flex: 1,
    },

    // ── Top bar ──────────────────────────────────────────
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: rs(20),
        marginTop: rs(8),
        gap: 8,
    },
    backBtn: {
        width: rs(30),
        height: rs(30),
        borderRadius: rs(15),
        borderWidth: 1.2,
        borderColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    topTitle: {
        fontSize: rs(20),
        fontWeight: '600',
        color: TEXT_DARK,
        flexShrink: 1,
        textAlign: 'center',
    },
    stepBadge: {
        backgroundColor: PILL_BG,
        borderRadius: 20,
        paddingHorizontal: rs(12),
        paddingVertical: rs(5),
        flexShrink: 0,
    },
    stepText: {
        fontSize: rs(12),
        fontWeight: '600',
        color: TEXT_DARK,
    },

    // ── Question ─────────────────────────────────────────
    question: {
        fontSize: rs(28),
        fontWeight: '800',
        color: TEXT_DARK,
        textAlign: 'center',
        lineHeight: rs(34),
        marginBottom: rs(28),
        letterSpacing: -0.3,
        marginTop: rs(24),
    },
    questionTwo: {
        fontSize: rs(28),
        fontWeight: '800',
        color: TEXT_DARK,
        textAlign: 'center',
        lineHeight: rs(34),
        marginBottom: rs(28),
        letterSpacing: -0.3,
        marginTop: rs(32),
    },

    // ── Input Card ───────────────────────────────────────
    inputCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: rs(28),
        borderWidth: 2,
        borderColor: INPUT_BORDER,
        padding: rs(16),
        minHeight: rs(120),
        justifyContent: 'center',
        marginBottom: rs(20),
    },
    tagsAndInputWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: rs(8),
    },
    selectedPill: {
        backgroundColor: '#EBF4E8',
        borderRadius: 20,
        paddingHorizontal: rs(14),
        paddingVertical: rs(8),
        maxWidth: '100%',
    },
    selectedPillText: {
        fontSize: rs(14),
        fontWeight: '600',
        color: '#4B633F',
    },
    textInput: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: rs(100),
        fontSize: rs(15),
        color: TEXT_DARK,
        paddingVertical: rs(6),
    },

    // ── Continue Button ──────────────────────────────────
    bottomSection: {
        alignItems: 'center',
        width: '100%',
        marginTop: rs(12),
    },
    continueBtn: {
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: rs(17),
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
        fontSize: rs(16),
        fontWeight: '700',
        color: '#fff',
    },
});