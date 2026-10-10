// app/user_current_medication.tsx
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const BORDER = '#E7DED2';
const CARD_BG = '#FFFFFF';
const SAGE = '#7FA267';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 6;

// Design was made for a ~360 x 800 dp Android phone. Everything scales from that.
const BASE_WIDTH = 360;
const BASE_HEIGHT = 800;
const MAX_CONTENT_WIDTH = 520; // keeps tablets / foldables / landscape tidy
const FONT_CAP = 1.2; // caps system font scaling so text can't break the layout

type MedOption = {
    key: 'prescribed' | 'otc' | 'none' | 'skip';
    label: string;
    icon: string;
    exclusive?: boolean;
};

type MedicationType = 'prescribed' | 'otc';

type MedicationEntry = {
    type: MedicationType;
    value: string;
};

const OPTIONS: MedOption[] = [
    { key: 'prescribed', label: 'Prescribed\nMedications', icon: 'pill' },
    { key: 'otc', label: 'Over the Counter\nSupplements', icon: 'leaf' },
    { key: 'none', label: "I'm not taking any", icon: 'cancel', exclusive: true },
    { key: 'skip', label: 'Prefer not to say', icon: 'close', exclusive: true },
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function MedicationsQuestionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const [selected, setSelected] = useState<string[]>([]);
    const [showMedicationModal, setShowMedicationModal] = useState(false);
    const [activeMedicationType, setActiveMedicationType] = useState<MedicationType | null>(null);
    const [medicationInput, setMedicationInput] = useState('');
    const [medicationEntries, setMedicationEntries] = useState<MedicationEntry[]>([]);

    // ---------- Responsive metrics ----------
    const m = useMemo(() => {
        const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
        const s = clamp(contentWidth / BASE_WIDTH, 0.82, 1.3); // horizontal scale
        const v = clamp(height / BASE_HEIGHT, 0.7, 1.2); // vertical scale (short screens shrink spacing)
        const sp = (n: number) => Math.round(n * s);
        const vs = (n: number) => Math.round(n * v);

        const pagePad = sp(16);
        const gap = sp(14);
        const cardWidth = Math.floor((contentWidth - pagePad * 2 - gap) / 2);

        return {
            sp,
            vs,
            pagePad,
            gap,
            cardWidth,
            cardRadius: sp(28),
            cardPad: sp(16),
            iconBox: sp(42),
            iconSize: sp(26),
            labelSize: clamp(sp(15), 13, 18),
            questionSize: clamp(sp(28), 22, 34),
            titleSize: clamp(sp(20), 17, 24),
        };
    }, [width, height]);

    // ---------- Logic ----------
    const closeModal = () => {
        // If the user cancels on a freshly selected card that has no saved entry, un-select it.
        if (activeMedicationType && !medicationEntries.some(e => e.type === activeMedicationType)) {
            const type = activeMedicationType;
            setSelected(prev => prev.filter(item => item !== type));
        }
        setShowMedicationModal(false);
        setMedicationInput('');
        setActiveMedicationType(null);
    };

    const openMedicationModal = (type: MedicationType) => {
        const existing = medicationEntries.find(entry => entry.type === type)?.value || '';
        setActiveMedicationType(type);
        setMedicationInput(existing);
        setShowMedicationModal(true);
    };

    const getOptionActive = (key: string) =>
        selected.includes(key) || medicationEntries.some(entry => entry.type === key);

    const syncSelection = (key: string, isActive: boolean) => {
        setSelected(prev => {
            const withoutExclusives = prev.filter(item => !OPTIONS.find(o => o.key === item)?.exclusive);
            const withoutKey = withoutExclusives.filter(item => item !== key);
            return isActive ? [...withoutKey, key] : withoutKey;
        });
    };

    const toggleOption = (option: MedOption) => {
        if (option.exclusive) {
            const isActive = selected.includes(option.key);
            setMedicationEntries([]);
            setSelected(isActive ? [] : [option.key]);
            return;
        }

        if (option.key !== 'prescribed' && option.key !== 'otc') return;

        if (getOptionActive(option.key)) {
            openMedicationModal(option.key);
            return;
        }

        setSelected(prev => {
            const filtered = prev.filter(item => !OPTIONS.find(opt => opt.key === item)?.exclusive);
            return [...filtered, option.key];
        });
        openMedicationModal(option.key);
    };

    const handleModalSave = () => {
        const value = medicationInput.trim();
        if (!activeMedicationType) return;

        if (!value) {
            Alert.alert('Medication required', 'Please enter the medication name before continuing.');
            return;
        }

        const type = activeMedicationType;
        syncSelection(type, true);
        setMedicationEntries(prev => [...prev.filter(entry => entry.type !== type), { type, value }]);
        setShowMedicationModal(false);
        setMedicationInput('');
        setActiveMedicationType(null);
    };

    const canContinue = selected.length > 0 || medicationEntries.length > 0;

    const handleContinue = () => {
        if (!canContinue) return;

        const medicationSummary = medicationEntries.length
            ? medicationEntries
                .map(item => `${item.type === 'prescribed' ? 'Prescribed' : 'OTC'}: ${item.value}`)
                .join(' | ')
            : selected.join(',');

        router.push({
            pathname: '/user_allergies_familyhistory',
            params: { ...params, medications: medicationSummary },
        } as any);
    };

    // ---------- UI ----------
    return (
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor={BG} />

            <ScrollView
                style={styles.scroll}
                // flexGrow lets the button sit at the bottom on tall screens,
                // while short screens simply scroll.
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingHorizontal: m.pagePad, paddingBottom: Math.max(insets.bottom, 0) + m.vs(24) },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
            >
                <View style={styles.column}>
                    {/* Header */}
                    <View style={[styles.progressRow, { marginTop: m.vs(16), marginBottom: m.vs(28) }]}>
                        <TouchableOpacity
                            style={[
                                styles.backBtn,
                                { width: m.sp(32), height: m.sp(32), borderRadius: m.sp(16) },
                            ]}
                            onPress={() => router.push('/user_location')}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={m.sp(18)} color={TEXT_DARK} />
                        </TouchableOpacity>

                        <Text
                            style={[styles.topTitle, { fontSize: m.titleSize }]}
                            numberOfLines={1}
                            maxFontSizeMultiplier={FONT_CAP}
                        >
                            User's Profile
                        </Text>

                        <View
                            style={[
                                styles.stepBadge,
                                { paddingHorizontal: m.sp(12), paddingVertical: m.sp(6), borderRadius: m.sp(20) },
                            ]}
                        >
                            <Text
                                style={[styles.stepText, { fontSize: clamp(m.sp(12), 11, 14) }]}
                                maxFontSizeMultiplier={FONT_CAP}
                            >
                                {CURRENT_STEP} of {TOTAL_STEPS}
                            </Text>
                        </View>
                    </View>

                    <View style={{ marginBottom: m.vs(28) }}>
                        <Text
                            style={[
                                styles.question,
                                { fontSize: m.questionSize, lineHeight: Math.round(m.questionSize * 1.22) },
                            ]}
                            maxFontSizeMultiplier={FONT_CAP}
                        >
                            Are you taking any{'\n'}medications?
                        </Text>
                    </View>

                    {/* Option grid */}
                    <View style={[styles.grid, { gap: m.gap }]}>
                        {OPTIONS.map(option => {
                            const active = getOptionActive(option.key);

                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    activeOpacity={0.9}
                                    onPress={() => toggleOption(option)}
                                    style={[
                                        styles.card,
                                        {
                                            width: m.cardWidth,
                                            // aspectRatio keeps cards proportional; minHeight guards large fonts
                                            aspectRatio: 1 / 1.08,
                                            minHeight: m.sp(150),
                                            borderRadius: m.cardRadius,
                                            padding: m.cardPad,
                                        },
                                        active && styles.cardActive,
                                    ]}
                                >
                                    <View style={styles.cardHeader}>
                                        <View
                                            style={[
                                                styles.iconWrap,
                                                {
                                                    width: m.iconBox,
                                                    height: m.iconBox,
                                                    borderRadius: m.sp(14),
                                                },
                                                active && styles.iconWrapActive,
                                            ]}
                                        >
                                            <MaterialCommunityIcons
                                                name={option.icon as any}
                                                size={m.iconSize}
                                                color={active ? '#FFFFFF' : TEXT_DARK}
                                            />
                                        </View>

                                        {active && (
                                            <View
                                                style={[
                                                    styles.checkBadge,
                                                    { width: m.sp(22), height: m.sp(22), borderRadius: m.sp(11) },
                                                ]}
                                            >
                                                <Ionicons name="checkmark" size={m.sp(12)} color={SAGE} />
                                            </View>
                                        )}
                                    </View>

                                    <Text
                                        style={[
                                            styles.cardLabel,
                                            { fontSize: m.labelSize, lineHeight: Math.round(m.labelSize * 1.33) },
                                            active && styles.cardLabelActive,
                                        ]}
                                        maxFontSizeMultiplier={FONT_CAP}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.8}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Pushes the button to the bottom on tall screens; collapses on short ones */}
                    <View style={[styles.spacer, { minHeight: m.vs(24) }]} />

                    <TouchableOpacity
                        style={[
                            styles.continueBtn,
                            { paddingVertical: m.sp(16), borderRadius: m.sp(30) },
                            !canContinue && styles.continueBtnDisabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleContinue}
                        disabled={!canContinue}
                    >
                        <Text style={[styles.continueBtnText, { fontSize: clamp(m.sp(16), 15, 18) }]} maxFontSizeMultiplier={FONT_CAP}>
                            Continue
                        </Text>
                        <Ionicons name="arrow-forward" size={m.sp(20)} color="#fff" />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Modal */}
            <Modal
                transparent
                visible={showMedicationModal}
                animationType="fade"
                statusBarTranslucent
                onRequestClose={closeModal}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ScrollView
                        contentContainerStyle={[styles.modalScrollContent, { paddingHorizontal: m.pagePad + 4 }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.modalCard, { padding: m.sp(20), borderRadius: m.sp(24) }]}>
                            <Text style={[styles.modalTitle, { fontSize: clamp(m.sp(21), 18, 26) }]} maxFontSizeMultiplier={FONT_CAP}>
                                {activeMedicationType === 'prescribed' ? 'Prescribed medication' : 'Over the counter supplement'}
                            </Text>

                            <Text style={[styles.modalSubtitle, { fontSize: clamp(m.sp(14), 13, 16) }]} maxFontSizeMultiplier={FONT_CAP}>
                                Please enter the medication name or supplement you are taking.
                            </Text>

                            <TextInput
                                value={medicationInput}
                                onChangeText={setMedicationInput}
                                placeholder={activeMedicationType === 'prescribed' ? 'e.g. Metformin' : 'e.g. Vitamin D'}
                                placeholderTextColor="#A59D92"
                                style={[styles.modalInput, { minHeight: m.vs(90), fontSize: clamp(m.sp(15), 14, 17) }]}
                                autoFocus
                                multiline
                                maxFontSizeMultiplier={FONT_CAP}
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalBtn, styles.modalSecondaryBtn]} onPress={closeModal}>
                                    <Text style={styles.modalSecondaryText} maxFontSizeMultiplier={FONT_CAP}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.modalBtn, styles.modalPrimaryBtn]} onPress={handleModalSave}>
                                    <Text style={styles.modalPrimaryText} maxFontSizeMultiplier={FONT_CAP}>Continue</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

// Only static (non-size) styles live here; all dimensions are computed above.
const styles = StyleSheet.create({
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
        fontWeight: '700',
        color: TEXT_DARK,
    },
    question: {
        fontWeight: '800',
        color: TEXT_DARK,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    card: {
        backgroundColor: CARD_BG,
        borderWidth: 1.5,
        borderColor: BORDER,
        justifyContent: 'space-between',
    },
    cardActive: {
        backgroundColor: TEAL,
        borderColor: SAGE,
        shadowColor: SAGE,
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapActive: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    cardLabel: {
        fontWeight: '700',
        color: TEXT_DARK,
    },
    cardLabelActive: {
        color: '#FFFFFF',
    },
    checkBadge: {
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spacer: {
        flexGrow: 1,
    },
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
    continueBtnDisabled: {
        opacity: 0.5,
    },
    continueBtnText: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(18,18,18,0.4)',
    },
    modalScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 24,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        maxWidth: 480,
    },
    modalTitle: {
        fontWeight: '800',
        color: TEXT_DARK,
        marginBottom: 8,
    },
    modalSubtitle: {
        color: '#5D544E',
        marginBottom: 16,
        lineHeight: 20,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#D9D1C6',
        borderRadius: 14,
        backgroundColor: '#F8F4EE',
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: TEXT_DARK,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 18,
    },
    modalBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    modalSecondaryBtn: {
        backgroundColor: '#F1EDE6',
    },
    modalSecondaryText: {
        fontSize: 14,
        fontWeight: '700',
        color: TEXT_DARK,
    },
    modalPrimaryBtn: {
        backgroundColor: TEAL,
    },
    modalPrimaryText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});