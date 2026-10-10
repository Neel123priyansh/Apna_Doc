import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    SafeAreaView, StatusBar, Platform, Alert, ActivityIndicator,
    TextInput, Modal, RefreshControl, KeyboardAvoidingView, Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authFetch } from '../../src/services/authServices';
import { useAuth } from '../../context/AuthContext';

type PatientReview = {
    _id: string;
    name?: string;
    age?: number;
    sex?: string;
    weight?: number;
    weightUnit?: string;
    height?: number;
    conditions?: string[];
    medications?: string;
    aiReportSummary?: string;
    medicalReportSummary?: string;
    medicalReportUrl?: string;
    verifiedSummary?: string;
    reportStatus: string;
    verifiedAt?: string;
    verifiedBy?: { name: string };
    userId?: { name?: string; email?: string };
    createdAt: string;
};

const C = {
    bg: '#F4F7FF', surface: '#FFFFFF', primary: '#2A4DD0', primaryLight: '#EEF1FF',
    teal: '#1A9E8F', tealLight: '#E8F7F5', warning: '#F59E0B', warningLight: '#FFFBEB',
    danger: '#EF4444', dangerLight: '#FEE2E2', green: '#22C55E', greenLight: '#DCFCE7',
    text: '#0F172A', sub: '#64748B', border: '#E7ECFF',
};

const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const getInitials = (name?: string) =>
    (name || 'P').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

function ReviewModal({ item, visible, onClose, onAction, submitting }: {
    item: PatientReview | null; visible: boolean; onClose: () => void;
    onAction: (id: string, action: 'approve' | 'reject', text: string) => void; submitting: boolean;
}) {
    const [editedSummary, setEditedSummary] = useState('');
    useEffect(() => { if (item) setEditedSummary(item.aiReportSummary || item.medicalReportSummary || ''); }, [item]);
    if (!item) return null;
    const patientName = item.userId?.name || item.name || 'Patient';
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={ms.overlay}>
                    <View style={ms.sheet}>
                        <View style={ms.modalHeader}>
                            <View>
                                <Text style={ms.modalTitle}>Review Report</Text>
                                <Text style={ms.modalSub}>{patientName}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={ms.closeBtn} activeOpacity={0.7}>
                                <Ionicons name="close" size={20} color={C.sub} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={ms.vitalsBox}>
                                <Text style={ms.sectionLabel}>PATIENT VITALS</Text>
                                <View style={ms.vitalsGrid}>
                                    {[
                                        { label: 'Age', value: item.age ? `${item.age} yrs` : '-' },
                                        { label: 'Sex', value: item.sex || '-' },
                                        { label: 'Weight', value: item.weight ? `${item.weight}${item.weightUnit || 'kg'}` : '-' },
                                        { label: 'Height', value: item.height ? `${item.height} cm` : '-' },
                                    ].map(v => (
                                        <View key={v.label} style={ms.vitalItem}>
                                            <Text style={ms.vitalLabel}>{v.label}</Text>
                                            <Text style={ms.vitalValue}>{v.value}</Text>
                                        </View>
                                    ))}
                                </View>
                                {item.conditions && item.conditions.length > 0 && (
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={ms.vitalLabel}>CONDITIONS</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                            {item.conditions.map((c: string, i: number) => (
                                                <View key={i} style={ms.condTag}><Text style={ms.condTagText}>{c}</Text></View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                                {item.medications && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={ms.vitalLabel}>MEDICATIONS</Text>
                                        <Text style={[ms.vitalValue, { marginTop: 4, fontWeight: '500', fontSize: 13 }]}>{item.medications}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={ms.summaryBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <MaterialCommunityIcons name="robot" size={18} color={C.primary} />
                                    <Text style={ms.sectionLabel}>AI-GENERATED SUMMARY (editable)</Text>
                                </View>
                                <TextInput
                                    style={ms.summaryInput}
                                    value={editedSummary}
                                    onChangeText={setEditedSummary}
                                    multiline
                                    numberOfLines={8}
                                    textAlignVertical="top"
                                    placeholder="AI summary will appear here..."
                                    placeholderTextColor={C.sub}
                                />
                            </View>
                            <Text style={ms.dateText}>Uploaded: {fmtDate(item.createdAt)}</Text>
                            <View style={ms.actionRow}>
                                <TouchableOpacity
                                    style={[ms.actionBtn, ms.rejectBtn, submitting && { opacity: 0.6 }]}
                                    onPress={() => onAction(item._id, 'reject', editedSummary)}
                                    disabled={submitting} activeOpacity={0.8}
                                >
                                    <Ionicons name="close-circle-outline" size={18} color={C.danger} />
                                    <Text style={[ms.actionBtnText, { color: C.danger }]}>Reject</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[ms.actionBtn, ms.approveBtn, submitting && { opacity: 0.6 }]}
                                    onPress={() => onAction(item._id, 'approve', editedSummary)}
                                    disabled={submitting} activeOpacity={0.8}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark" size={18} color="#fff" />
                                            <Text style={[ms.actionBtnText, { color: '#fff' }]}>Approve and Verify</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default function InHouseDoctorDashboard() {
    const router = useRouter();
    const { user: authUser, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'pdfs'>('pending');
    const [pending, setPending] = useState<PatientReview[]>([]);
    const [verified, setVerified] = useState<PatientReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PatientReview | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [pendingRes, verifiedRes] = await Promise.all([
                authFetch('/api/doctor/pending-reviews'),
                authFetch('/api/doctor/verified-reports'),
            ]);
            if (pendingRes.ok) {
                const data = await pendingRes.json();
                console.log('Pending data:', data);
                // Alert.alert('Debug', 'Pending reviews fetched: ' + JSON.stringify(data).substring(0, 100));
                setPending(data);
            } else {
                const text = await pendingRes.text();
                console.error('Pending failed:', pendingRes.status, text);
                Alert.alert('Error', 'Failed to fetch pending reviews: ' + pendingRes.status);
            }
            if (verifiedRes.ok) setVerified(await verifiedRes.json());
        } catch (e: any) {
            console.error('Load error', e);
            Alert.alert('Load error', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAction = async (profileId: string, action: 'approve' | 'reject', verifiedSummary: string) => {
        if (action === 'approve' && !verifiedSummary.trim()) {
            Alert.alert('Empty Summary', 'Please keep or edit the AI summary before approving.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await authFetch(`/api/doctor/verify/${profileId}`, {
                method: 'POST',
                body: JSON.stringify({ action, verifiedSummary }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSelectedItem(null);
            await loadData();
            Alert.alert(
                action === 'approve' ? 'Report Verified' : 'Report Rejected',
                action === 'approve'
                    ? 'The verified summary has been sent to the patient.'
                    : 'The report has been rejected and the patient will be notified.',
            );
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const allReports = [...pending, ...verified];
    const pdfReports = allReports.filter(r => r.medicalReportUrl);
    const currentList = activeTab === 'pending' ? pending : activeTab === 'verified' ? verified : [];

    return (
        <SafeAreaView style={s.safe}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={C.bg} />
            <View style={s.header}>
                <View>
                    <Text style={s.headerEyebrow}>In-House Doctor</Text>
                    <Text style={s.headerTitle}>Review Dashboard</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={s.doctorBadge}>
                        <MaterialCommunityIcons name="stethoscope" size={14} color="#fff" />
                        <Text style={s.doctorBadgeText}>{authUser?.name?.split(' ')[0] || 'Doctor'}</Text>
                    </View>
                    <TouchableOpacity style={s.logoutBtn} activeOpacity={0.7} onPress={logout}>
                        <Ionicons name="log-out-outline" size={18} color={C.danger} />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={s.statsRow}>
                <View style={[s.statCard, { backgroundColor: C.warningLight, borderColor: '#FDE68A' }]}>
                    <Text style={[s.statValue, { color: C.warning }]}>{pending.length}</Text>
                    <Text style={s.statLabel}>Pending Review</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: C.tealLight, borderColor: '#99E6DE' }]}>
                    <Text style={[s.statValue, { color: C.teal }]}>{verified.length}</Text>
                    <Text style={s.statLabel}>Verified</Text>
                </View>
            </View>
            <View style={s.tabPills}>
                <TouchableOpacity style={[s.pill, activeTab === 'pending' && s.pillActivePending]} onPress={() => setActiveTab('pending')} activeOpacity={0.8}>
                    <Ionicons name="time-outline" size={15} color={activeTab === 'pending' ? '#fff' : C.warning} />
                    <Text style={[s.pillText, activeTab === 'pending' && s.pillTextActive]}>Pending ({pending.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.pill, activeTab === 'verified' && s.pillActiveVerified]} onPress={() => setActiveTab('verified')} activeOpacity={0.8}>
                    <Ionicons name="shield-checkmark-outline" size={15} color={activeTab === 'verified' ? '#fff' : C.teal} />
                    <Text style={[s.pillText, activeTab === 'verified' && s.pillTextActive]}>Verified ({verified.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.pillPremium} onPress={() => router.push('/in-house_doctor/assigned_users')} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="star-four-points-outline" size={15} color="#F59E0B" />
                    <Text style={[s.pillText, { color: '#F59E0B' }]}>Assigned Premium</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.pill, activeTab === 'pdfs' && s.pillActivePdfs]} onPress={() => setActiveTab('pdfs')} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="file-pdf-box" size={15} color={activeTab === 'pdfs' ? '#fff' : '#EF4444'} />
                    <Text style={[s.pillText, activeTab === 'pdfs' && s.pillTextActive]}>PDFs</Text>
                </TouchableOpacity>
            </View>
            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={s.centerText}>Loading reports...</Text>
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={s.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.primary} />}
                >
                    {activeTab === 'pdfs' ? (
                        pdfReports.length === 0 ? (
                            <View style={s.emptyBox}>
                                <MaterialCommunityIcons name="file-pdf-box" size={48} color="#CBD5E1" />
                                <Text style={s.emptyTitle}>No PDFs Uploaded</Text>
                                <Text style={s.emptyText}>Premium users who upload reports will appear here.</Text>
                            </View>
                        ) : pdfReports.map(item => {
                            const name = item.userId?.name || item.name || 'Unknown Patient';
                            return (
                                <View key={item._id + '_pdf'} style={s.pdfCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={s.pdfIconBox}>
                                            <MaterialCommunityIcons name="file-pdf-box" size={28} color="#EF4444" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.cardName}>{name}</Text>
                                            <Text style={s.cardSub}>{item.userId?.email || ''}</Text>
                                            <Text style={s.cardDate}>Uploaded {fmtDate(item.createdAt)}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={s.pdfOpenBtn}
                                            onPress={() => item.medicalReportUrl
                                                ? Linking.openURL(item.medicalReportUrl)
                                                : Alert.alert('No PDF', 'PDF link unavailable.')
                                            }
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="open-outline" size={14} color="#fff" />
                                            <Text style={s.pdfOpenBtnText}>Open</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    ) : currentList.length === 0 ? (
                        <View style={s.emptyBox}>
                            <MaterialCommunityIcons name={activeTab === 'pending' ? 'inbox-arrow-down' : 'check-circle'} size={48} color="#CBD5E1" />
                            <Text style={s.emptyTitle}>{activeTab === 'pending' ? 'No Pending Reviews' : 'No Verified Reports Yet'}</Text>
                            <Text style={s.emptyText}>{activeTab === 'pending' ? 'All patient reports are up to date.' : 'Verified reports will appear here.'}</Text>
                        </View>
                    ) : currentList.map(item => {
                        const name = item.userId?.name || item.name || 'Unknown Patient';
                        return (
                            <View key={item._id} style={s.card}>
                                <View style={s.cardTop}>
                                    <View style={s.avatar}><Text style={s.avatarText}>{getInitials(name)}</Text></View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.cardName}>{name}</Text>
                                        <Text style={s.cardSub}>
                                            {[item.age ? `${item.age} yrs` : null, item.sex, item.conditions?.slice(0, 2).join(', ')].filter(Boolean).join(' / ')}
                                        </Text>
                                        <Text style={s.cardDate}>Uploaded {fmtDate(item.createdAt)}</Text>
                                    </View>
                                    {activeTab === 'verified' && (
                                        <View style={s.verifiedBadge}>
                                            <Ionicons name="shield-checkmark" size={12} color="#fff" />
                                            <Text style={s.verifiedBadgeText}>Verified</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={[s.summaryPreview, activeTab === 'verified' && { backgroundColor: C.tealLight }]}>
                                    <Text style={s.summaryPreviewLabel}>{activeTab === 'verified' ? 'VERIFIED SUMMARY' : 'AI SUMMARY (PENDING REVIEW)'}</Text>
                                    <Text style={s.summaryPreviewText} numberOfLines={3}>
                                        {activeTab === 'verified' ? (item.verifiedSummary || 'No summary.') : (item.aiReportSummary || item.medicalReportSummary || 'No AI summary available.')}
                                    </Text>
                                </View>
                                {activeTab === 'pending' && (
                                    <TouchableOpacity style={s.reviewBtn} activeOpacity={0.85} onPress={() => setSelectedItem(item)}>
                                        <Ionicons name="eye-outline" size={16} color="#fff" />
                                        <Text style={s.reviewBtnText}>Review and Verify</Text>
                                    </TouchableOpacity>
                                )}
                                {activeTab === 'verified' && item.verifiedAt && (
                                    <Text style={s.verifiedDate}>Verified on {fmtDate(item.verifiedAt)}{item.verifiedBy?.name ? ` by ${item.verifiedBy.name}` : ''}</Text>
                                )}
                            </View>
                        );
                    })}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
            <ReviewModal item={selectedItem} visible={!!selectedItem} onClose={() => setSelectedItem(null)} onAction={handleAction} submitting={submitting} />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 4 : 16, paddingBottom: 12 },
    headerEyebrow: { fontSize: 11, fontWeight: '800', color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
    doctorBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.teal, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    doctorBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    logoutBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.dangerLight, alignItems: 'center', justifyContent: 'center' },
    statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginBottom: 14 },
    statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
    statValue: { fontSize: 28, fontWeight: '800' },
    statLabel: { fontSize: 11, color: C.sub, fontWeight: '600' },
    tabPills: { flexDirection: 'row', gap: 10, marginHorizontal: 18, marginBottom: 16, backgroundColor: C.primaryLight, borderRadius: 14, padding: 4 },
    pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
    pillActivePending: { backgroundColor: C.warning, shadowColor: C.warning, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    pillActiveVerified: { backgroundColor: C.teal, shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    pillText: { fontSize: 13, fontWeight: '700', color: C.sub },
    pillTextActive: {
        color: '#fff',
    },
    pillPremium: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        gap: 6,
    },
    pillActivePdfs: { backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    pdfCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
        borderWidth: 1, borderColor: '#FEE2E2',
        shadowColor: '#EF4444', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    pdfIconBox: {
        width: 50, height: 50, borderRadius: 14,
        backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    },
    pdfOpenBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    },
    pdfOpenBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    list: {
        paddingHorizontal: 20, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    centerText: { fontSize: 14, color: C.sub },
    emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    emptyText: { fontSize: 13, color: C.sub, textAlign: 'center', paddingHorizontal: 20 },
    card: { backgroundColor: C.surface, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border, shadowColor: '#2A4DD0', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    avatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText: { fontSize: 16, fontWeight: '800', color: C.primary },
    cardName: { fontSize: 15, fontWeight: '800', color: C.text },
    cardSub: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 2 },
    cardDate: { fontSize: 11, color: C.sub, marginTop: 3 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    verifiedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    summaryPreview: { backgroundColor: C.primaryLight, borderRadius: 12, padding: 12, marginBottom: 12 },
    summaryPreviewLabel: { fontSize: 10, fontWeight: '800', color: C.sub, letterSpacing: 0.6, marginBottom: 6 },
    summaryPreviewText: { fontSize: 13, color: C.text, lineHeight: 19 },
    reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    reviewBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    verifiedDate: { fontSize: 11, color: C.sub, textAlign: 'center', marginTop: 2 },
});

const ms = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: C.text },
    modalSub: { fontSize: 13, color: C.sub, marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: C.sub, letterSpacing: 0.8 },
    vitalsBox: { backgroundColor: C.primaryLight, borderRadius: 16, padding: 14, marginBottom: 16 },
    vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    vitalItem: { backgroundColor: C.surface, borderRadius: 10, padding: 10, minWidth: '22%' },
    vitalLabel: { fontSize: 10, fontWeight: '700', color: C.sub, letterSpacing: 0.5 },
    vitalValue: { fontSize: 15, fontWeight: '800', color: C.text, marginTop: 4 },
    condTag: { backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.border },
    condTagText: { fontSize: 12, color: C.primary, fontWeight: '700' },
    summaryBox: { backgroundColor: '#F8FAFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
    summaryInput: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: C.text, lineHeight: 20, minHeight: 140 },
    dateText: { fontSize: 12, color: C.sub, textAlign: 'center', marginBottom: 16 },
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
    rejectBtn: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
    approveBtn: { backgroundColor: C.teal, shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    actionBtnText: { fontSize: 14, fontWeight: '800' },
});
