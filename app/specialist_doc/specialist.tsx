// app/specialist_doc/specialist.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Image, TextInput,
    LayoutAnimation, UIManager, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authFetch } from '../../src/services/authServices';
import { useAuth } from '../../context/AuthContext';
import PremiumOverlay from '../../components/PremiumOverlay';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────── Types ────────────────────────────────────────────────
type TabKey = 'specialist' | 'recommended';
type Filter = { key: string; label: string; emoji: string };
type DoctorLocation = {
    latitude: number;
    longitude: number;
    district?: string;
    city?: string;
    state?: string;
};
type Doctor = {
    id: string; name: string; specialty: string; credentials: string;
    rating: number; reviews: string; avatar: string | null; available?: boolean;
    yearsExperience?: number; location?: DoctorLocation;
};
type Recommendation = {
    name: string; specialty: string; reason: string; matchScore: number;
    urgency: 'Routine' | 'Soon' | 'Urgent'; available: boolean; isDoctorRecomm?: boolean;
};
type AIResult = { summary: string; recommendations: Recommendation[] };

// ─────────────────────── Specialty filter chips ───────────────────────────────
const FILTERS: Filter[] = [
    { key: 'dermatologist', label: 'Dermatologist', emoji: '🧴' },
    { key: 'heart', label: 'Cardiologist', emoji: '❤️' },
    { key: 'neurologist', label: 'Neurologist', emoji: '🧠' },
    { key: 'pediatrics', label: 'Pediatrics', emoji: '👶' },
    { key: 'oncology', label: 'Oncology', emoji: '🎗️' },
];

function getUrgencyStyles(urgency: string) {
    switch (urgency) {
        case 'Urgent': return { bg: '#FEF2F2', text: '#EF4444', border: '#FCA5A5' };
        case 'Soon': return { bg: '#FFF7ED', text: '#F97316', border: '#FED7AA' };
        default: return { bg: '#F0FDF4', text: '#22C55E', border: '#BBF7D0' };
    }
}

// ─────────────────────── Sub-components ──────────────────────────────────────
function BackgroundBlobs() {
    return (
        <View style={s.blobLayer} pointerEvents="none">
            <View style={[s.blob, { width: 260, height: 260, top: -50, right: -80 }]} />
            <View style={[s.blob, { width: 320, height: 320, bottom: 60, left: -110, opacity: 0.55 }]} />
            <View style={[s.blob, { width: 200, height: 200, bottom: -60, right: -60, opacity: 0.4 }]} />
        </View>
    );
}

function StarRow({ rating }: { rating: number }) {
    return (
        <View style={{ flexDirection: 'row', gap: 1 }}>
            {[0, 1, 2, 3, 4].map(i => (
                <Ionicons key={i} name={i < Math.round(rating) ? 'star' : 'star-outline'} size={13} color="#F5B400" />
            ))}
        </View>
    );
}

function DoctorCard({ doctor, onPress, onDirections }: {
    doctor: Doctor;
    onPress: () => void;
    onDirections: () => void;
}) {
    return (
        <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={onPress}>
            {doctor.avatar
                ? <Image source={{ uri: doctor.avatar }} style={s.cardAvatar} />
                : <View style={s.cardAvatarPlaceholder}><MaterialCommunityIcons name="doctor" size={28} color="#5B4FE0" /></View>
            }
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.cardDoctorName} numberOfLines={1}>{doctor.name}</Text>
                <View style={s.specialtyRow}>
                    <MaterialCommunityIcons name="stethoscope" size={13} color="#8A8578" />
                    <Text style={s.specialtyText} numberOfLines={1}>
                        {doctor.specialty} • {doctor.credentials}
                        {doctor.yearsExperience !== undefined ? ` • ${doctor.yearsExperience} yrs` : ''}
                    </Text>
                </View>
                <View style={s.ratingRow}>
                    <StarRow rating={doctor.rating} />
                    <Text style={s.ratingValue}>{doctor.rating.toFixed(1)}</Text>
                    <Text style={s.ratingDot}>•</Text>
                    <Text style={s.ratingReviews}>{doctor.reviews}</Text>
                    {doctor.available !== undefined && (
                        <View style={[s.availPill, { backgroundColor: doctor.available ? '#DCFCE7' : '#FEE2E2' }]}>
                            <View style={[s.availDotSm, { backgroundColor: doctor.available ? '#22C55E' : '#EF4444' }]} />
                            <Text style={[s.availTextSm, { color: doctor.available ? '#16A34A' : '#DC2626' }]}>
                                {doctor.available ? 'Available' : 'Busy'}
                            </Text>
                        </View>
                    )}
                </View>
                {doctor.location && (
                    <TouchableOpacity
                        style={s.directionsBtn}
                        activeOpacity={0.7}
                        onPress={onDirections}
                        hitSlop={6}
                    >
                        <Ionicons name="navigate-outline" size={13} color="#1FA97F" />
                        <Text style={s.directionsText}>Get directions</Text>
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity style={s.menuBtn} activeOpacity={0.6} hitSlop={8}>
                <MaterialCommunityIcons name="dots-vertical" size={18} color="#A6A08F" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function SpecialistScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const isPremium = user?.isPremium;

    // ── Tab state ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<TabKey>('specialist');

    // ── Specialist tab state ───────────────────────────────────────────────────
    const [activeFilter, setActiveFilter] = useState('dermatologist');
    const [searchOpen, setSearchOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dbDoctors, setDbDoctors] = useState<Doctor[]>([]);
    const [loadingFilter, setLoadingFilter] = useState(false);
    const [locationRequired, setLocationRequired] = useState(false);

    // ── Recommended tab state ──────────────────────────────────────────────────
    const [aiData, setAiData] = useState<AIResult | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    const activeSpecialty = FILTERS.find(f => f.key === activeFilter)?.label ?? '';

    const openDirections = async (doctor: Doctor) => {
        if (!doctor.location) return;

        const { latitude, longitude } = doctor.location;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Maps unavailable', 'Unable to open directions for this doctor.');
        }
    };

    // ── Specialist fetch ───────────────────────────────────────────────────────
    const fetchDoctorsBySpecialty = useCallback(async (specialty: string) => {
        setLoadingFilter(true);
        setDbDoctors([]);
        setLocationRequired(false);
        try {
            const res = await authFetch(`/api/doctors/by-specialty?specialty=${encodeURIComponent(specialty)}`);
            if (res.status === 409) {
                const error = await res.json();
                setLocationRequired(error.code === 'LOCATION_REQUIRED');
                return;
            }
            if (!res.ok) throw new Error('fetch failed');
            const data: any[] = await res.json();
            setDbDoctors(data.map(d => ({
                id: String(d._id), name: d.name, specialty: d.specialty,
                credentials: (d.degrees || (d.degree ? [d.degree] : [])).join(', ') || 'Medical degree', rating: 4.8, reviews: 'Verified',
                avatar: d.avatar ?? null, available: d.available,
                yearsExperience: d.yearsExperience, location: d.location,
            })));
        } catch {
            setDbDoctors([]);
        } finally {
            setLoadingFilter(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'specialist') fetchDoctorsBySpecialty(activeSpecialty);
    }, [activeFilter, activeTab]);

    // ── Recommended fetch ──────────────────────────────────────────────────────
    const fetchRecommendations = useCallback(async () => {
        setAiLoading(true);
        try {
            const res = await authFetch('/api/ai/doctor-recommendations', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to load doctor recommendations');
            setAiData(await res.json());
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Unable to fetch recommendations.');
        } finally {
            setAiLoading(false);
        }
    }, []);

    // Load recommendations lazily when tab is first opened
    useEffect(() => {
        if (activeTab === 'recommended' && !aiData) fetchRecommendations();
    }, [activeTab]);

    // ── Search filter ──────────────────────────────────────────────────────────
    const filteredDoctors = dbDoctors.filter(d => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q);
    });

    const toggleSearch = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSearchOpen(prev => !prev);
        if (searchOpen) setSearch('');
    };

    const switchTab = (tab: TabKey) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveTab(tab);
    };

    // ─────────────────────── Render ───────────────────────────────────────────
    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F6F2E7" />
            <BackgroundBlobs />

            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={s.header}>
                <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color="#1E1B16" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>
                    {activeTab === 'specialist' ? 'Specialists' : 'Recommended'}
                </Text>
                {activeTab === 'specialist' ? (
                    <TouchableOpacity style={s.headerBtn} onPress={toggleSearch} activeOpacity={0.7}>
                        <Ionicons name={searchOpen ? 'close' : 'search'} size={21} color="#1E1B16" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={s.headerBtn} onPress={fetchRecommendations} activeOpacity={0.7}>
                        <Ionicons name="refresh" size={20} color="#2A4DD0" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Horizontal Capsule Tab Switcher ────────────────────────── */}
            <View style={s.capsuleWrap}>
                <View style={s.capsuleTrack}>
                    <TouchableOpacity
                        style={[s.capsuleTab, activeTab === 'specialist' && s.capsuleTabActiveGreen]}
                        activeOpacity={0.85}
                        onPress={() => switchTab('specialist')}
                    >
                        <MaterialCommunityIcons
                            name="stethoscope"
                            size={14}
                            color={activeTab === 'specialist' ? '#fff' : '#8A8578'}
                        />
                        <Text style={[s.capsuleTabText, activeTab === 'specialist' && s.capsuleTabTextActive]}>
                            Doctors Factory
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.capsuleTab, activeTab === 'recommended' && s.capsuleTabActiveBlue]}
                        activeOpacity={0.85}
                        onPress={() => switchTab('recommended')}
                    >
                        <MaterialCommunityIcons
                            name="shield-heart-outline"
                            size={14}
                            color={activeTab === 'recommended' ? '#fff' : '#8A8578'}
                        />
                        <Text style={[s.capsuleTabText, activeTab === 'recommended' && s.capsuleTabTextActive]}>
                            Recommended
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ══════════════ SPECIALIST TAB ══════════════════════════════ */}
            {activeTab === 'specialist' && (
                <>
                    {searchOpen && (
                        <View style={s.searchBar}>
                            <Ionicons name="search" size={16} color="#8A8578" />
                            <TextInput
                                style={s.searchInput}
                                placeholder={`Search ${activeSpecialty}...`}
                                placeholderTextColor="#A6A08F"
                                value={search}
                                onChangeText={setSearch}
                                autoFocus
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                                    <Ionicons name="close-circle" size={16} color="#A6A08F" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.filterRow}
                    >
                        {FILTERS.map(f => {
                            const isActive = f.key === activeFilter;
                            return (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[s.chip, isActive && s.chipActive]}
                                    activeOpacity={0.8}
                                    onPress={() => setActiveFilter(f.key)}
                                >
                                    <View style={[s.chipIcon, isActive && s.chipIconActive]}>
                                        <Text style={{ fontSize: 12 }}>{f.emoji}</Text>
                                    </View>
                                    <Text style={[s.chipText, isActive && s.chipTextActive]}>{f.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <ScrollView
                        contentContainerStyle={s.listContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {loadingFilter ? (
                            <View style={s.loadingBox}>
                                <ActivityIndicator size="large" color="#1FA97F" />
                                <Text style={s.loadingText}>Finding {activeSpecialty} specialists...</Text>
                            </View>
                        ) : filteredDoctors.length === 0 ? (
                            <View style={s.emptyState}>
                                <MaterialCommunityIcons
                                    name={locationRequired ? 'map-marker-radius-outline' : 'account-search-outline'}
                                    size={40}
                                    color="#A6A08F"
                                />
                                <Text style={s.emptyText}>
                                    {locationRequired
                                        ? 'Save your location to find specialists within 15 km.'
                                        : search.trim()
                                            ? 'No doctors match your search.'
                                            : `No ${activeSpecialty} doctors are available within 15 km.`}
                                </Text>
                                {locationRequired && (
                                    <TouchableOpacity
                                        style={s.locationBtn}
                                        activeOpacity={0.85}
                                        onPress={() => router.push('/user_location' as any)}
                                    >
                                        <Ionicons name="location-outline" size={16} color="#fff" />
                                        <Text style={s.locationBtnText}>Add location</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <>
                                <View style={s.dbHeader}>
                                    <MaterialCommunityIcons name="database-check" size={13} color="#1FA97F" />
                                    <Text style={s.dbHeaderText}>
                                        {filteredDoctors.length} {activeSpecialty}
                                        {filteredDoctors.length !== 1 ? ' specialists' : ' specialist'} found
                                    </Text>
                                </View>
                                {filteredDoctors.map(doc => (
                                    <DoctorCard
                                        key={doc.id}
                                        doctor={doc}
                                        onDirections={() => openDirections(doc)}
                                        onPress={() => router.push({
                                            pathname: '/doctor-profile',
                                            params: { id: doc.id },
                                        } as any)}
                                    />
                                ))}
                            </>
                        )}
                        <View style={{ height: 100 }} />
                    </ScrollView>
                </>
            )}

            {/* ══════════════ RECOMMENDED TAB ═════════════════════════════ */}
            {activeTab === 'recommended' && (
                <ScrollView
                    contentContainerStyle={s.recomScroll}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={s.recomSub}>
                        AI-driven recommendations matching your vitals, conditions, and uploaded records.
                    </Text>

                    {aiLoading ? (
                        <View style={s.loadingBox}>
                            <ActivityIndicator size="large" color="#2A4DD0" />
                            <Text style={s.loadingText}>Analyzing your health profile…</Text>
                        </View>
                    ) : aiData ? (
                        <>
                            {/* Insight banner */}
                            <View style={s.insightBanner}>
                                <View style={s.insightIconBox}>
                                    <MaterialCommunityIcons name="shield-heart-outline" size={24} color="#2A4DD0" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.insightEyebrow}>HEALTH FOCUS SUMMARY</Text>
                                    <Text style={s.insightText}>
                                        {aiData.summary || 'Consult specialists recommended below based on your medical status.'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={s.sectionTitle}>AI Matching Specialists</Text>

                            {aiData.recommendations && aiData.recommendations.length > 0 ? (
                                <View style={s.cardsWrapper}>
                                    {aiData.recommendations.map((doc, idx) => {
                                        const urg = getUrgencyStyles(doc.urgency);
                                        return (
                                            <View key={idx} style={s.recomCard}>
                                                <View style={s.recomCardHeader}>
                                                    <View style={s.recomAvatarBox}>
                                                        <MaterialCommunityIcons name="doctor" size={32} color="#2A4DD0" />
                                                    </View>
                                                    <View style={s.recomInfo}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <Text style={s.recomName}>{doc.name}</Text>
                                                            {doc.isDoctorRecomm && (
                                                                <View style={s.inHouseBadge}>
                                                                    <MaterialCommunityIcons name="stethoscope" size={10} color="#2A4DD0" />
                                                                    <Text style={s.inHouseBadgeText}>In-House Doc</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={s.recomSpecialty}>{doc.specialty}</Text>
                                                        <View style={s.matchRow}>
                                                            <MaterialCommunityIcons name="bullseye-arrow" size={14} color="#2A4DD0" />
                                                            <Text style={s.matchText}>
                                                                {doc.isDoctorRecomm ? 'Doctor Referred' : `${doc.matchScore}% AI Match`}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View style={[s.urgencyBadge, { backgroundColor: urg.bg, borderColor: urg.border }]}>
                                                        <Text style={[s.urgencyText, { color: urg.text }]}>{doc.urgency}</Text>
                                                    </View>
                                                </View>

                                                <View style={s.cardDivider} />

                                                <View style={s.reasonRow}>
                                                    <MaterialCommunityIcons name="information-outline" size={16} color="#64748b" style={{ marginTop: 2 }} />
                                                    <Text style={s.reasonText}>{doc.reason}</Text>
                                                </View>

                                                <View style={s.recomActions}>
                                                    <View style={s.availContainer}>
                                                        <View style={[s.availDotLg, { backgroundColor: doc.available ? '#22c55e' : '#ef4444' }]} />
                                                        <Text style={[s.availTextLg, { color: doc.available ? '#16a34a' : '#dc2626' }]}>
                                                            {doc.available ? 'Available' : 'Busy'}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[s.bookBtn, !doc.available && s.bookBtnDisabled]}
                                                        activeOpacity={0.8}
                                                        disabled={!doc.available}
                                                        onPress={() => router.push({
                                                            pathname: '/specialist_doc/booking_doc',
                                                            params: { doctorName: doc.name, specialty: doc.specialty },
                                                        } as any)}
                                                    >
                                                        <Text style={[s.bookBtnText, !doc.available && { color: '#94a3b8' }]}>
                                                            Book Consultation
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}

                                    {!isPremium && aiData.recommendations.length > 1 && (
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
                                <View style={s.emptyState}>
                                    <MaterialCommunityIcons name="account-search-outline" size={40} color="#A6A08F" />
                                    <Text style={s.emptyText}>No specialist recommendations generated.</Text>
                                </View>
                            )}

                            <TouchableOpacity style={s.regenBtn} activeOpacity={0.85} onPress={fetchRecommendations}>
                                <MaterialCommunityIcons name="refresh" size={18} color="#2A4DD0" />
                                <Text style={s.regenBtnText}>Regenerate Recommendations</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={s.emptyState}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#A6A08F" />
                            <Text style={s.emptyText}>Failed to load recommendations.</Text>
                            <TouchableOpacity style={s.retryBtn} onPress={fetchRecommendations}>
                                <Text style={s.retryText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </View>
    );
}

// ─────────────────────────── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F6F2E7', overflow: 'hidden' },
    blobLayer: { ...StyleSheet.absoluteFillObject },
    blob: { position: 'absolute', borderRadius: 999, backgroundColor: '#ECE2CB', opacity: 0.7 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 44,
        paddingBottom: 10,
    },
    headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E1B16', letterSpacing: -0.2 },

    // Capsule tab switcher
    capsuleWrap: { alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, marginTop: 2 },
    capsuleTrack: {
        flexDirection: 'row', backgroundColor: '#EDE8DC',
        borderRadius: 30, padding: 4, gap: 4, width: '100%',
    },
    capsuleTab: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 26,
    },
    capsuleTabActiveGreen: {
        backgroundColor: '#1FA97F',
        shadowColor: '#1FA97F', shadowOpacity: 0.25, shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 }, elevation: 4,
    },
    capsuleTabActiveBlue: {
        backgroundColor: '#2A4DD0',
        shadowColor: '#2A4DD0', shadowOpacity: 0.25, shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 }, elevation: 4,
    },
    capsuleTabText: { fontSize: 14, fontWeight: '700', color: '#8A8578' },
    capsuleTabTextActive: { color: '#fff' },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#fff', borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 10,
        marginHorizontal: 16, marginBottom: 8,
        shadowColor: '#3A362C', shadowOpacity: 0.05, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#1E1B16', fontWeight: '500' },

    // Filter chips
    filterRow: { paddingHorizontal: 16, gap: 8, marginTop: 4, marginBottom: 10 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
        backgroundColor: '#fff', borderRadius: 24,
        borderWidth: 2, borderColor: '#ECEBE6',
        paddingLeft: 6, paddingRight: 14, paddingVertical: 6,
    },
    chipActive: { backgroundColor: '#CFF3E4', borderColor: '#8DD5BB' },
    chipIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#F1EFE6', alignItems: 'center', justifyContent: 'center' },
    chipIconActive: { backgroundColor: '#1FA97F' },
    chipText: { fontSize: 13, fontWeight: '600', color: '#3A362C' },
    chipTextActive: { color: '#0E6B4F' },

    // Specialist list
    listContent: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
    dbHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 4 },
    dbHeaderText: { fontSize: 12, fontWeight: '700', color: '#1FA97F' },

    // Doctor card (Specialist tab)
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 4,
        shadowColor: '#3A362C', shadowOpacity: 0.05, shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 }, elevation: 2,
    },
    cardAvatar: { width: 56, height: 56, borderRadius: 16 },
    cardAvatarPlaceholder: {
        width: 56, height: 56, borderRadius: 16, backgroundColor: '#EDE9FB',
        alignItems: 'center', justifyContent: 'center',
    },
    cardDoctorName: { fontSize: 15, fontWeight: '800', color: '#1E1B16', letterSpacing: -0.1, marginBottom: 3 },
    specialtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
    specialtyText: { fontSize: 12, color: '#8A8578', fontWeight: '500', flexShrink: 1 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    ratingValue: { fontSize: 12, fontWeight: '700', color: '#1E1B16' },
    ratingDot: { fontSize: 12, color: '#C7C2B4' },
    ratingReviews: { fontSize: 12, color: '#8A8578', fontWeight: '500' },
    menuBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    availPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    availDotSm: { width: 5, height: 5, borderRadius: 3 },
    availTextSm: { fontSize: 10, fontWeight: '700' },
    directionsBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        alignSelf: 'flex-start', marginTop: 6,
    },
    directionsText: { fontSize: 11, color: '#1FA97F', fontWeight: '700' },

    // Recommended tab
    recomScroll: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 100 },
    recomSub: { fontSize: 13, color: '#64748b', lineHeight: 19, marginBottom: 18 },
    insightBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: '#EEF1FF', borderRadius: 16, padding: 16,
        marginBottom: 20, borderWidth: 1, borderColor: '#C7D2FE',
    },
    insightIconBox: {
        width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#2A4DD0', shadowOpacity: 0.1, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    insightEyebrow: { fontSize: 10, fontWeight: '800', color: '#2A4DD0', letterSpacing: 1.2, marginBottom: 4 },
    insightText: { fontSize: 13, fontWeight: '600', color: '#0F172A', lineHeight: 18 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2, marginBottom: 14 },
    cardsWrapper: { position: 'relative', overflow: 'hidden', borderRadius: 20 },
    cardsOverlay: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    recomCard: {
        backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14,
        borderWidth: 1, borderColor: '#E7ECFF',
        shadowColor: '#2A4DD0', shadowOpacity: 0.05, shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    recomCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    recomAvatarBox: {
        width: 56, height: 56, borderRadius: 16, backgroundColor: '#EEF1FF',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    recomInfo: { flex: 1, gap: 2 },
    recomName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    recomSpecialty: { fontSize: 12, color: '#2A4DD0', fontWeight: '700' },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    matchText: { fontSize: 11, color: '#2A4DD0', fontWeight: '700' },
    urgencyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
    urgencyText: { fontSize: 10, fontWeight: '800' },
    inHouseBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#EEF1FF', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE',
    },
    inHouseBadgeText: { fontSize: 10, fontWeight: '800', color: '#2A4DD0' },
    cardDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
    reasonRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 14 },
    reasonText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 18 },
    recomActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    availContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    availDotLg: { width: 8, height: 8, borderRadius: 4 },
    availTextLg: { fontSize: 12, fontWeight: '700' },
    bookBtn: { backgroundColor: '#EEF1FF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
    bookBtnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
    bookBtnText: { color: '#2A4DD0', fontWeight: '700', fontSize: 13 },
    regenBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1.5, borderColor: '#C7D2FE', borderRadius: 14,
        paddingVertical: 14, backgroundColor: '#fff', marginTop: 10,
    },
    regenBtnText: { fontSize: 14, fontWeight: '700', color: '#2A4DD0' },
    emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
    emptyText: { fontSize: 13, color: '#8A8578', textAlign: 'center', paddingHorizontal: 24 },
    retryBtn: { marginTop: 12, backgroundColor: '#2A4DD0', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    retryText: { color: '#fff', fontWeight: '700' },
    locationBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 6, backgroundColor: '#1FA97F', paddingHorizontal: 16,
        paddingVertical: 10, borderRadius: 10,
    },
    locationBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    loadingText: { fontSize: 13, color: '#8A8578', fontWeight: '500' },
});
