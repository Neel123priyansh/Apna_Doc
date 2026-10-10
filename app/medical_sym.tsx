import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    ScrollView,
    Platform,
    StatusBar,
    Image,
    TextInput,
    KeyboardAvoidingView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { authFetch } from '../src/services/authServices';
import LoadingScreen from '../components/loadingScreen';

const { width, height } = Dimensions.get('window');

// ── Theme ────────────────────────────────────────────────────
const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEXT_MID = '#C8B4A0';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';
const ORANGE_PILL = '#EB6A2A';
const BROWN_BTN = '#452C1E';
const INPUT_BORDER = '#C2D4A8';

const TOTAL_STEPS = 6;
const CURRENT_STEP = 6;
const MAX_CONDITIONS = 10;

const MOST_COMMON_CONDITIONS = [
    'Hypertension',
    'Diabetes Type 2',
    'Diabetes Type 1',
    'Asthma',
    'Heart Disease',
    'Thyroid',
    'Migraine',
    'High Cholesterol',
    'Arthritis',
    'Allergies',
];

export default function MedicalSymptomsScreen() {
    const router = useRouter();

    // ── Receive parameters from previous onboarding steps ─────────────
    const params = useLocalSearchParams<{
        gender?: string;
        age?: string;
        weight?: string;
        unit?: string;
        height?: string;
        medications?: string;
        allergies?: string;
        familyHistory?: string;
        bloodType?: string;
    }>();

    const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const [saving, setSaving] = useState(false);

    // Toggle a common condition pill
    const toggleCondition = (condition: string) => {
        if (selectedConditions.includes(condition)) {
            setSelectedConditions(prev => prev.filter(item => item !== condition));
        } else {
            if (selectedConditions.length >= MAX_CONDITIONS) {
                Alert.alert('Limit Reached', `You can select up to ${MAX_CONDITIONS} conditions.`);
                return;
            }
            setSelectedConditions(prev => [...prev, condition]);
        }
    };

    // Add custom condition typed in TextInput
    const handleAddCustomCondition = () => {
        const trimmed = inputText.trim();
        if (!trimmed) return;

        if (selectedConditions.includes(trimmed)) {
            setInputText('');
            return;
        }

        if (selectedConditions.length >= MAX_CONDITIONS) {
            Alert.alert('Limit Reached', `You can select up to ${MAX_CONDITIONS} conditions.`);
            return;
        }

        setSelectedConditions(prev => [...prev, trimmed]);
        setInputText('');
    };

    // Remove a condition tag
    const handleRemoveCondition = (condition: string) => {
        setSelectedConditions(prev => prev.filter(item => item !== condition));
    };

    // Save profile and finish onboarding
    const handleSubmit = async () => {
        let finalConditions = [...selectedConditions];
        const trimmed = inputText.trim();
        if (trimmed && !finalConditions.includes(trimmed) && finalConditions.length < MAX_CONDITIONS) {
            finalConditions.push(trimmed);
        }

        setSaving(true);
        const startTime = Date.now();

        try {
            const sex = params.gender || 'Other';
            const age = params.age ? Number(params.age) : undefined;
            const weight = params.weight ? Number(params.weight) : undefined;
            const weightUnit = params.unit || 'kg';
            const heightVal = params.height ? Number(params.height) : undefined;

            const res = await authFetch('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    sex,
                    age,
                    weight,
                    weightUnit,
                    height: heightVal,
                    conditions: finalConditions,
                    medications: params.medications || '',
                    allergies: params.allergies || '',
                    familyHistory: params.familyHistory || '',
                    bloodType: params.bloodType || 'Unknown',
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to update profile');
            }

            await SecureStore.setItemAsync('hasCompletedOnboarding', 'true');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save medical details. Continuing...');
            await SecureStore.setItemAsync('hasCompletedOnboarding', 'true');
        } finally {
            // Keep loading screen displayed for 7 seconds total
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, 10000 - elapsedTime);
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            setSaving(false);
            router.replace('/');
        }
    };

    if (saving) {
        return <LoadingScreen />;
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={BG} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── Top bar ─────────────────────────────────────── */}
                    <View style={styles.progressRow}>
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => router.push('/user_location')}
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
                    <Text style={styles.question}>
                        Do you have any medical history?
                    </Text>

                    {/* ── Tension Image ──────────────────────────────── */}
                    <View style={styles.imageWrap}>
                        <View style={styles.imageBgCircle}>
                            <Image
                                source={require('../assets/images/Tension.png')}
                                style={styles.tensionImg}
                                resizeMode="contain"
                            />
                        </View>
                    </View>

                    {/* ── Custom Condition Input Box & Selected Tags ──── */}
                    <View style={styles.inputCard}>
                        <View style={styles.tagsAndInputWrap}>
                            {selectedConditions.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.selectedPill}
                                    onPress={() => handleRemoveCondition(item)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.selectedPillText}>{item}</Text>
                                </TouchableOpacity>
                            ))}

                            <TextInput
                                style={styles.textInput}
                                placeholder={
                                    selectedConditions.length === 0
                                        ? 'Type or select medical conditions...'
                                        : ', type more...'
                                }
                                placeholderTextColor="#A59D92"
                                value={inputText}
                                onChangeText={setInputText}
                                onSubmitEditing={handleAddCustomCondition}
                                returnKeyType="done"
                            />
                        </View>

                        {/* Bottom counter */}
                        <View style={styles.counterRow}>
                            <Ionicons name="document-text-outline" size={16} color="#8A8277" />
                            <Text style={styles.counterText}>
                                {selectedConditions.length}/{MAX_CONDITIONS}
                            </Text>
                        </View>
                    </View>

                    {/* ── Most Common Conditions ─────────────────────── */}
                    <View style={styles.mostCommonSection}>
                        <Text style={styles.mostCommonLabel}>Most Common:</Text>
                        <View style={styles.commonChipsWrap}>
                            {MOST_COMMON_CONDITIONS.map((cond) => {
                                const isSelected = selectedConditions.includes(cond);
                                return (
                                    <TouchableOpacity
                                        key={cond}
                                        style={[
                                            styles.commonChip,
                                            isSelected && styles.commonChipSelected,
                                        ]}
                                        onPress={() => toggleCondition(cond)}
                                        activeOpacity={0.8}
                                    >
                                        <Text
                                            style={[
                                                styles.commonChipText,
                                                isSelected && styles.commonChipTextSelected,
                                            ]}
                                        >
                                            {cond}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="close" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* ── Continue Button ────────────────────────────── */}
                    <View style={styles.bottomSection}>
                        <TouchableOpacity
                            style={[styles.continueBtn, saving && { opacity: 0.7 }]}
                            activeOpacity={0.85}
                            onPress={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.continueBtnText}>Finish</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        marginBottom: 28,
        marginTop: 35
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

    // ── Image Wrap ───────────────────────────────────────
    imageWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    imageBgCircle: {
        width: 220,
        height: 220,
        borderRadius: 110,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    tensionImg: {
        width: 410,
        height: 410,
    },

    // ── Input Card ───────────────────────────────────────
    inputCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 2,
        borderColor: INPUT_BORDER,
        padding: 16,
        minHeight: 140,
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    tagsAndInputWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
    },
    selectedPill: {
        backgroundColor: '#EBF4E8',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    selectedPillText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B633F',
    },
    textInput: {
        flex: 1,
        minWidth: 140,
        fontSize: 15,
        color: TEXT_DARK,
        paddingVertical: 6,
    },
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 12,
    },
    counterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8A8277',
    },

    // ── Most Common Section ──────────────────────────────
    mostCommonSection: {
        marginBottom: 32,
    },
    mostCommonLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: TEXT_DARK,
        marginBottom: 12,
    },
    commonChipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    commonChip: {
        backgroundColor: PILL_BG,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    commonChipSelected: {
        backgroundColor: ORANGE_PILL,
    },
    commonChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_DARK,
    },
    commonChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },

    // ── Continue Button ──────────────────────────────────
    bottomSection: {
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
