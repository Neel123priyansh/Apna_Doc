// App/app/insights.tsx
import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authFetch } from '../src/services/authServices';
import PremiumOverlay from '../components/PremiumOverlay';
import { useAuth } from '../context/AuthContext';

// ─────────────────────── Types ────────────────────────────────────────────────
type PlanDetail = {
    title: string;
    subtitle: string;
    items: string[];
};

type AIHealthPlan = {
    hasReport: boolean;
    summary?: string;
    dietPlan?: PlanDetail;
    exercisePlan?: PlanDetail;
    sleepPlan?: PlanDetail;
};

type UIPlanSection = {
    id: string;
    icon: string;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle: string;
    items: { icon: string; iconColor: string; text: string }[];
};

// ─────────────────────── Decorative background blobs ─────────────────────────
// Fixed behind the ScrollView (not inside it) so they read as page texture,
// matching the soft organic circles in the reference — not scroll-bound content.
function BackgroundBlobs() {
    return (
        <View style={s.blobLayer} pointerEvents="none">
            <View style={[s.blob, { width: 260, height: 260, top: -50, right: -80 }]} />
            <View style={[s.blob, { width: 320, height: 320, bottom: 60, left: -110, opacity: 0.55 }]} />
            <View style={[s.blob, { width: 200, height: 200, bottom: -60, right: -60, opacity: 0.4 }]} />
        </View>
    );
}

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function PlanScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<AIHealthPlan | null>(null);

    const { user } = useAuth();
    const isPremium = user?.isPremium;
    const firstName = (user?.name || 'there').split(' ')[0];

    const loadHealthPlan = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/ai/health-plan');
            if (!res.ok) throw new Error('Failed to load health plan');
            const data = await res.json();
            setPlan(data);
        } catch (error: any) {
            console.error('Error fetching health plan:', error);
            Alert.alert('Error', error.message || 'Unable to fetch health plan.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHealthPlan();
    }, []);

    // Helper to map backend plan object to UI format
    const getUISections = (data: AIHealthPlan): UIPlanSection[] => {
        const sections: UIPlanSection[] = [];

        if (data.dietPlan) {
            sections.push({
                id: 'diet',
                icon: 'food-fork-drink',
                iconBg: '#FBEEDC',
                iconColor: '#E08A3E',
                title: data.dietPlan.title || 'Personalized Diet Plan',
                subtitle: data.dietPlan.subtitle || 'Low-GI & Anti-Inflammatory Focus',
                items: (data.dietPlan.items || []).map(item => ({
                    icon: 'check-circle-outline',
                    iconColor: '#5B4FE0',
                    text: item
                }))
            });
        }

        if (data.exercisePlan) {
            sections.push({
                id: 'exercise',
                icon: 'weight-lifter',
                iconBg: '#EDE9FB',
                iconColor: '#5B4FE0',
                title: data.exercisePlan.title || 'Exercise Routine',
                subtitle: data.exercisePlan.subtitle || 'Metabolic Conditioning',
                items: (data.exercisePlan.items || []).map(item => ({
                    icon: 'check-circle-outline',
                    iconColor: '#5B4FE0',
                    text: item
                }))
            });
        }

        if (data.sleepPlan) {
            sections.push({
                id: 'sleep',
                icon: 'moon-waning-crescent',
                iconBg: '#F1EAFB',
                iconColor: '#8B5CF6',
                title: data.sleepPlan.title || 'Sleep & Recovery',
                subtitle: data.sleepPlan.subtitle || 'Restorative Focus',
                items: (data.sleepPlan.items || []).map(item => ({
                    icon: 'check-circle-outline',
                    iconColor: '#5B4FE0',
                    text: item
                }))
            });
        }

        return sections;
    };

    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F6F2E7" />
            <BackgroundBlobs />

            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Greeting row ───────────────────────────────────────── */}
                <View style={s.greetingRow}>
                    <View>
                        <Text style={s.greetingText}>Hi {firstName}</Text>
                        <Text style={s.greetingSub}>Wellness Insights</Text>
                    </View>
                    <TouchableOpacity style={s.bellBtn} activeOpacity={0.7} onPress={loadHealthPlan}>
                        <Ionicons name="notifications-outline" size={19} color="#3A362C" />
                        <View style={s.bellDot} />
                    </TouchableOpacity>
                </View>

                {/* ── Page title ─────────────────────────────────────────── */}
                <Text style={s.pageTitle}>Your Personalized{'\n'}Health Plan</Text>

                {loading ? (
                    <View style={s.loadingCard}>
                        <ActivityIndicator size="large" color="#5B4FE0" />
                        <Text style={s.loadingText}>Generating your personalized health insights...</Text>
                    </View>
                ) : plan && plan.hasReport ? (
                    <>
                        <Text style={s.pageSub}>Updated dynamically based on your latest medical report analysis.</Text>

                        {/* ── Key Insight banner ──────────────────────────────── */}
                        <View style={s.insightBanner}>
                            <View style={s.insightIconBox}>
                                <MaterialCommunityIcons name="head-cog-outline" size={22} color="#5B4FE0" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.insightEyebrow}>KEY HEALTH INSIGHT</Text>
                                <Text style={s.insightText}>
                                    {plan.summary || 'Improving metabolic health through lifestyle adjustments.'}
                                </Text>
                            </View>
                        </View>

                        {/* ── Plan sections with premium paywall after first card ── */}
                        {getUISections(plan).length > 0 ? (
                            <View style={s.sectionsWrapper}>
                                {getUISections(plan).map((section, idx, arr) => (
                                    <View key={section.id} style={[s.planCard, idx < arr.length - 1 && { marginBottom: 14 }]}>
                                        {/* Section header */}
                                        <View style={s.planCardHeader}>
                                            <View style={[s.planIconBox, { backgroundColor: section.iconBg }]}>
                                                <MaterialCommunityIcons
                                                    name={section.icon as any}
                                                    size={24}
                                                    color={section.iconColor}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.planTitle}>{section.title}</Text>
                                                <Text style={s.planSubtitle}>{section.subtitle}</Text>
                                            </View>
                                        </View>

                                        {/* Divider */}
                                        <View style={s.planDivider} />

                                        {/* Items */}
                                        <View style={s.planItems}>
                                            {section.items.map((item, i) => (
                                                <View key={i} style={s.planItem}>
                                                    <MaterialCommunityIcons
                                                        name={item.icon as any}
                                                        size={18}
                                                        color={item.iconColor}
                                                        style={s.planItemIcon}
                                                    />
                                                    <Text style={s.planItemText}>{item.text}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ))}

                                {/* Premium overlay covers exercise & sleep plans (everything after diet) */}
                                {!isPremium && getUISections(plan).length > 1 && (
                                    <PremiumOverlay
                                        title={'Unlock Your Full\nWellness Plan'}
                                        bullets={[
                                            '✦  Personalized exercise routine for your vitals',
                                            '✦  AI-optimized sleep & recovery schedule',
                                            '✦  Medication-aware health recommendations',
                                            '✦  Weekly plan regeneration with your latest data',
                                        ]}
                                        height={340}
                                        style={s.sectionsOverlay}
                                    />
                                )}
                            </View>
                        ) : null}

                        {/* ── AI Regenerate button ──────────────────────────── */}
                        <TouchableOpacity style={s.regenBtn} activeOpacity={0.85} onPress={loadHealthPlan}>
                            <MaterialCommunityIcons name="refresh" size={18} color="#5B4FE0" />
                            <Text style={s.regenBtnText}>Regenerate Plan with AI</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    /* ── Empty State / Upload Prompt ────────────────────────── */
                    <View style={s.emptyCard}>
                        <View style={s.emptyIconBox}>
                            <MaterialCommunityIcons name="file-document-outline" size={46} color="#8A8578" />
                        </View>
                        <Text style={s.emptyTitle}>No Medical Report Analyzed Yet</Text>
                        <Text style={s.emptySub}>
                            To generate your personalized diet plan, exercise routine, and recovery schedule, please upload your latest medical report (PDF) on the Home dashboard first.
                        </Text>
                        <TouchableOpacity
                            style={s.uploadBtn}
                            activeOpacity={0.85}
                            onPress={() => router.replace('/')}
                        >
                            <Ionicons name="home-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={s.uploadBtnText}>Go to Home Page</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

// ─────────────────────────── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F6F2E7',
        overflow: 'hidden',
    },

    // ── Decorative background blobs ─────────────────────────────────────────
    blobLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    blob: {
        position: 'absolute',
        borderRadius: 999,
        backgroundColor: '#ECE2CB',
        opacity: 0.7,
    },

    scroll: {
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingHorizontal: 22,
        paddingBottom: 100, // bottom padding for floating tab bar
    },

    // ── Greeting row ─────────────────────────────────────────────────────────
    greetingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 22,
    },
    greetingText: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1E1B16',
        letterSpacing: -0.4,
    },
    greetingSub: {
        fontSize: 14,
        color: '#8A8578',
        fontWeight: '500',
        marginTop: 3,
    },
    bellBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#EDE7D8',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    bellDot: {
        position: 'absolute',
        top: 8,
        right: 9,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#22C55E',
    },

    // ── Page title ───────────────────────────────────────────────────────────
    pageTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1E1B16',
        letterSpacing: -0.6,
        lineHeight: 38,
        marginBottom: 22,
    },
    pageSub: {
        fontSize: 13,
        color: '#8A8578',
        lineHeight: 19,
        marginTop: -8,
        marginBottom: 20,
    },

    // ── Loading state ───────────────────────────────────────────────────────
    loadingCard: {
        backgroundColor: '#fff',
        borderRadius: 28,
        paddingVertical: 60,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3A362C',
        shadowOpacity: 0.06,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
    },
    loadingText: {
        marginTop: 14,
        fontSize: 14,
        color: '#8A8578',
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: 10,
    },

    // ── Key insight banner ──────────────────────────────────────────────────
    insightBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#EDE9FB',
        borderRadius: 20,
        padding: 16,
        marginBottom: 22,
    },
    insightIconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#5B4FE0',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    insightEyebrow: {
        fontSize: 10,
        fontWeight: '800',
        color: '#5B4FE0',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    insightText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E1B16',
        lineHeight: 20,
    },

    // ── Plan cards ───────────────────────────────────────────────────────────
    planCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 18,
        shadowColor: '#3A362C',
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
        marginTop: 14,
    },
    planCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 14,
    },
    planIconBox: {
        width: 50,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    planTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1E1B16',
        letterSpacing: -0.2,
        marginBottom: 3,
    },
    planSubtitle: {
        fontSize: 12,
        color: '#A6A08F',
        fontWeight: '500',
    },
    planDivider: {
        height: 1,
        backgroundColor: '#F2EEE3',
        marginBottom: 14,
    },
    planItems: {
        gap: 12,
    },
    planItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    planItemIcon: {
        marginTop: 1,
        flexShrink: 0,
    },
    planItemText: {
        flex: 1,
        fontSize: 14,
        color: '#3A362C',
        lineHeight: 20,
        fontWeight: '500',
    },

    // ── Regenerate button ────────────────────────────────────────────────────
    regenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: '#D9CEFB',
        borderRadius: 16,
        paddingVertical: 14,
        backgroundColor: '#fff',
        marginTop: 20,
    },
    regenBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#5B4FE0',
    },

    // ── Premium sections wrapper ────────────────────────────────────────────
    sectionsWrapper: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        marginBottom: 8,
    },
    sectionsOverlay: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },

    // ── Empty state card ─────────────────────────────────────────────────────
    emptyCard: {
        backgroundColor: '#fff',
        borderRadius: 28,
        paddingVertical: 40,
        paddingHorizontal: 26,
        alignItems: 'center',
        shadowColor: '#3A362C',
        shadowOpacity: 0.07,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 4,
    },
    emptyIconBox: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#EDE7D8',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 22,
    },
    emptyTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#1E1B16',
        marginBottom: 10,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    emptySub: {
        fontSize: 14,
        color: '#8A8578',
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 26,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#5B4FE0',
        borderRadius: 16,
        paddingHorizontal: 26,
        paddingVertical: 15,
        width: '100%',
        shadowColor: '#5B4FE0',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    uploadBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
