import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authFetch } from '../src/services/authServices';
import PremiumOverlay from '../components/PremiumOverlay';
import { useAuth } from '../context/AuthContext';

// ─────────────────────── Types ────────────────────────────────────────────────
type Recommendation = {
    doctorId: string;
    name: string;
    specialty: string;
    degrees?: string[];
    yearsExperience?: number;
    description?: string;
    reason: string;
    matchScore: number;
    urgency: 'Routine' | 'Soon' | 'Urgent';
    available: boolean;
    isDoctorRecomm?: boolean;
};

type AIResult = {
    summary: string;
    recommendations: Recommendation[];
};

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function DocRecomScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AIResult | null>(null);

    const { user } = useAuth();
    const isPremium = user?.isPremium;

    const fetchRecommendations = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/ai/doctor-recommendations', {
                method: 'POST',
            });
            if (!res.ok) throw new Error('Failed to load doctor recommendations');
            const json = await res.json();
            setData(json);
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', error.message || 'Unable to fetch recommendations.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, []);

    // Helper for Urgency colors
    const getUrgencyStyles = (urgency: string) => {
        switch (urgency) {
            case 'Urgent':
                return { bg: '#FEF2F2', text: '#EF4444', border: '#FCA5A5' };
            case 'Soon':
                return { bg: '#FFF7ED', text: '#F97316', border: '#FED7AA' };
            default:
                return { bg: '#F0FDF4', text: '#22C55E', border: '#BBF7D0' };
        }
    };

    function BackgroundBlobs() {
        return (
            <View style={s.blobLayer} pointerEvents="none">
                <View style={[s.blob, { width: 260, height: 260, top: -50, right: -80 }]} />
                <View style={[s.blob, { width: 320, height: 320, bottom: 60, left: -110, opacity: 0.55 }]} />
                <View style={[s.blob, { width: 200, height: 200, bottom: -60, right: -60, opacity: 0.4 }]} />
            </View>
        );
    }

    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F6F2E7" />
            <BackgroundBlobs />

            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Top bar ────────────────────────────────────────────── */}
                <View style={s.topBar}>
                    <View>
                        <Text style={s.pageTitle}>Recommended{'\n'}Specialists</Text>
                    </View>
                    <TouchableOpacity style={s.bellBtn} activeOpacity={0.7} onPress={fetchRecommendations}>
                        <Ionicons name="refresh" size={20} color="#2A4DD0" />
                    </TouchableOpacity>
                </View>

                <Text style={s.pageSub}>AI-driven recommendations matching your vitals, medical conditions, and uploaded records.</Text>

                {loading ? (
                    <View style={s.loadingContainer}>
                        <ActivityIndicator size="large" color="#2A4DD0" />
                        <Text style={s.loadingText}>Analyzing health profile...</Text>
                    </View>
                ) : data ? (
                    <>
                        {/* ── Summary Insight banner ─────────────────────────────────── */}
                        <View style={s.insightBanner}>
                            <View style={s.insightIconBox}>
                                <MaterialCommunityIcons name="shield-heart-outline" size={24} color="#2A4DD0" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.insightEyebrow}>HEALTH FOCUS SUMMARY</Text>
                                <Text style={s.insightText}>
                                    {data.summary || 'Consult specialists recommended below according to your medical status.'}
                                </Text>
                            </View>
                        </View>

                        {/* ── Recommendation Cards ──────────────────────────────── */}
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionTitle}>AI Matching Specialists</Text>
                        </View>

                        {data.recommendations && data.recommendations.length > 0 ? (
                            <View style={s.cardsWrapper}>
                                {data.recommendations.map((doc, idx) => {
                                    const urg = getUrgencyStyles(doc.urgency);
                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            style={s.doctorCard}
                                            activeOpacity={0.95}
                                            onPress={() => router.push({
                                                pathname: '/doctor-profile',
                                                params: { id: doc.doctorId },
                                            } as any)}
                                        >
                                            {/* Avatar & Specialty */}
                                            <View
                                                style={s.doctorHeader}
                                            >
                                                <View style={s.doctorAvatarBox}>
                                                    <MaterialCommunityIcons name="doctor" size={32} color="#2A4DD0" />
                                                </View>

                                                <View style={s.doctorInfo}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <Text style={s.doctorName}>{doc.name}</Text>
                                                        {doc.isDoctorRecomm && (
                                                            <View style={s.doctorRecBadge}>
                                                                <MaterialCommunityIcons name="stethoscope" size={10} color="#2A4DD0" />
                                                                <Text style={s.doctorRecBadgeText}>In-House Doc Recomm.</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={s.doctorSpecialty}>{doc.specialty}</Text>

                                                    <View style={s.matchRow}>
                                                        <MaterialCommunityIcons name="bullseye-arrow" size={14} color="#2A4DD0" />
                                                        <Text style={s.matchText}>{doc.isDoctorRecomm ? 'Doctor Referred' : `${doc.matchScore}% AI Match Score`}</Text>
                                                    </View>
                                                </View>

                                                {/* Urgency Badge */}
                                                <View style={[s.urgencyBadge, { backgroundColor: urg.bg, borderColor: urg.border }]}>
                                                    <Text style={[s.urgencyText, { color: urg.text }]}>{doc.urgency}</Text>
                                                </View>
                                            </View>

                                            {/* Divider */}
                                            <View style={s.cardDivider} />

                                            {/* Reason */}
                                            <View style={s.reasonRow}>
                                                <MaterialCommunityIcons name="information-outline" size={16} color="#64748b" style={{ marginTop: 2 }} />
                                                <Text style={s.doctorReason}>{doc.reason}</Text>
                                            </View>

                                            {/* Availability / Action */}
                                            <View style={s.doctorActions}>
                                                <View style={s.availContainer}>
                                                    <View style={[s.availDot, { backgroundColor: doc.available ? '#22c55e' : '#ef4444' }]} />
                                                    <Text style={[s.availText, { color: doc.available ? '#16a34a' : '#dc2626' }]}>
                                                        {doc.available ? 'Available' : 'Busy'}
                                                    </Text>
                                                </View>

                                                <TouchableOpacity
                                                    style={[s.bookBtn, !doc.available && s.bookBtnDisabled]}
                                                    activeOpacity={0.8}
                                                    disabled={!doc.available}
                                                    onPress={() => router.push({
                                                        pathname: '/specialist_doc/booking_doc',
                                                        params: {
                                                            doctorName: doc.name,
                                                            specialty: doc.specialty,
                                                        },
                                                    } as any)}
                                                >
                                                    <Text style={[s.bookBtnText, !doc.available && { color: '#94a3b8' }]}>Book Consultation</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}

                                {/* Premium overlay covers everything after the first card */}
                                {!isPremium && data.recommendations.length > 1 && (
                                    <PremiumOverlay
                                        title={'Unlock All\nSpecialist Matches'}
                                        bullets={[
                                            '✦  See all AI-matched specialists for you',
                                            '✦  Full urgency ratings & availability',
                                            '✦  One-tap consultation booking',
                                            '✦  Priority access to Ezzmed network',
                                        ]}
                                        height={340}
                                        style={s.cardsOverlay}
                                    />
                                )}
                            </View>
                        ) : (
                            <View style={s.emptyContainer}>
                                <Text style={s.emptyText}>No specialist recommendations generated.</Text>
                            </View>
                        )}

                        {/* ── AI Regenerate button ───────────────────────────────── */}
                        <TouchableOpacity style={s.regenBtn} activeOpacity={0.85} onPress={fetchRecommendations}>
                            <MaterialCommunityIcons name="refresh" size={18} color="#2A4DD0" />
                            <Text style={s.regenBtnText}>Regenerate Recommendations</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={s.emptyContainer}>
                        <Text style={s.emptyText}>Failed to load recommendations.</Text>
                        <TouchableOpacity style={s.retryBtn} onPress={fetchRecommendations}>
                            <Text style={s.retryText}>Retry</Text>
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
        overflow: 'hidden'
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
        paddingTop: 40,
        paddingHorizontal: 22,
        paddingBottom: 100, // bottom padding for floating tab bar
    },

    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    bellBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E7ECFF',
    },
    pageEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2A4DD0',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    pageTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        lineHeight: 34,
        marginBottom: 6,
    },
    pageSub: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 19,
        marginBottom: 20,
    },
    loadingContainer: {
        marginTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    insightBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#EEF1FF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    insightIconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    insightEyebrow: {
        fontSize: 10,
        fontWeight: '800',
        color: '#2A4DD0',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    insightText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0F172A',
        lineHeight: 18,
    },
    sectionHeader: {
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2,
    },
    doctorCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E7ECFF',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    doctorHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    doctorAvatarBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#EEF1FF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
    },
    doctorInfo: {
        flex: 1,
        gap: 2,
    },
    doctorName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    doctorSpecialty: {
        fontSize: 12,
        color: '#2A4DD0',
        fontWeight: '700',
    },
    matchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    matchText: {
        fontSize: 11,
        color: '#2A4DD0',
        fontWeight: '700',
    },
    urgencyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
    },
    urgencyText: {
        fontSize: 10,
        fontWeight: '800',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
    },
    doctorRecBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EEF1FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    doctorRecBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#2A4DD0',
    },
    reasonRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    doctorReason: {
        flex: 1,
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
    },
    doctorActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    availContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    availDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    availText: {
        fontSize: 12,
        fontWeight: '700',
    },
    bookBtn: {
        backgroundColor: '#EEF1FF',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },
    bookBtnDisabled: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    bookBtnText: {
        color: '#2A4DD0',
        fontWeight: '700',
        fontSize: 13,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
    },
    emptyText: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 12,
        backgroundColor: '#2A4DD0',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: '700',
    },
    regenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: '#C7D2FE',
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: '#fff',
        marginTop: 10,
    },
    regenBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2A4DD0',
    },
    // ── Premium cards wrapper ──────────────────────────────────────────
    cardsWrapper: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
    },
    cardsOverlay: {
        // Sits at the bottom — covers all but first card
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
});
