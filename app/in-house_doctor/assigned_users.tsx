import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator,
    TouchableOpacity, SafeAreaView, Alert, Modal, TextInput,
    KeyboardAvoidingView, Platform, ScrollView, Linking
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { authFetch } from '../../src/services/authServices';
import { useRouter } from 'expo-router';

type AssignedUser = {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
        isPremium: boolean;
    };
    reportStatus: string;
    medicalReportUrl?: string;
    aiReportSummary?: string;
    createdAt: string;
    age?: number;
    sex?: string;
    doctorRecommendations?: Array<{ name: string; specialty: string; reason: string }>;
};

export default function AssignedUsersScreen() {
    const router = useRouter();
    const [users, setUsers] = useState<AssignedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Recommendation modal state
    const [selectedUser, setSelectedUser] = useState<AssignedUser | null>(null);
    const [showRecommendModal, setShowRecommendModal] = useState(false);
    const [recName, setRecName] = useState('');
    const [recSpecialty, setRecSpecialty] = useState('');
    const [recReason, setRecReason] = useState('');

    const fetchAssignedUsers = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/doctor/assigned-users');
            if (!res.ok) throw new Error('Failed to fetch assigned users');
            const data = await res.json();
            setUsers(data);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Unable to fetch assigned users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAssignedUsers(); }, []);

    const openRecommendModal = (user: AssignedUser) => {
        setSelectedUser(user);
        setRecName('');
        setRecSpecialty('');
        setRecReason('');
        setShowRecommendModal(true);
    };

    const submitRecommendation = async () => {
        if (!recName.trim() || !recSpecialty.trim() || !recReason.trim()) {
            Alert.alert('Missing Fields', 'Please fill in all fields.');
            return;
        }
        if (!selectedUser) return;
        setSubmitting(true);
        try {
            const res = await authFetch(`/api/doctor/recommend/${selectedUser.userId._id}`, {
                method: 'POST',
                body: JSON.stringify({ name: recName.trim(), specialty: recSpecialty.trim(), reason: recReason.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to submit');
            Alert.alert('✅ Success', `Specialist recommended to ${selectedUser.userId.name}!`);
            setShowRecommendModal(false);
            fetchAssignedUsers();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const openPDF = (url?: string) => {
        if (!url) {
            Alert.alert('No PDF', 'This user has not uploaded a PDF report yet.');
            return;
        }
        Linking.openURL(url).catch(() =>
            Alert.alert('Error', 'Could not open PDF. Copy the link manually.')
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return '#10B981';
            case 'pending_review': return '#F59E0B';
            case 'rejected': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const renderUser = ({ item }: { item: AssignedUser }) => (
        <View style={s.userCard}>
            {/* Card Header */}
            <View style={s.cardHeader}>
                <View style={s.avatarBox}>
                    <MaterialCommunityIcons name="account-star" size={28} color="#F59E0B" />
                </View>
                <View style={s.userInfo}>
                    <Text style={s.userName}>{item.userId.name}</Text>
                    <Text style={s.userEmail}>{item.userId.email}</Text>
                </View>
                <View style={[s.premiumBadge]}>
                    <MaterialCommunityIcons name="crown" size={12} color="#F59E0B" />
                    <Text style={s.premiumText}>PREMIUM</Text>
                </View>
            </View>

            <View style={s.divider} />

            {/* Stats Row */}
            <View style={s.statsRow}>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Age</Text>
                    <Text style={s.statValue}>{item.age || '-'}</Text>
                </View>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Sex</Text>
                    <Text style={s.statValue}>{item.sex || '-'}</Text>
                </View>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Status</Text>
                    <View style={s.statusBadge}>
                        <View style={[s.statusDot, { backgroundColor: getStatusColor(item.reportStatus) }]} />
                        <Text style={[s.statusText, { color: getStatusColor(item.reportStatus) }]}>
                            {(item.reportStatus || 'none').replace('_', ' ').toUpperCase()}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Existing recommendations */}
            {item.doctorRecommendations && item.doctorRecommendations.length > 0 && (
                <View style={s.existingRecs}>
                    <Text style={s.existingRecsTitle}>
                        <MaterialCommunityIcons name="check-circle" size={12} color="#10B981" />
                        {` ${item.doctorRecommendations.length} recommendation(s) sent`}
                    </Text>
                </View>
            )}

            <View style={s.divider} />

            {/* Contact Action Buttons */}
            <View style={s.contactRow}>
                <TouchableOpacity
                    style={[s.contactBtn, { backgroundColor: '#E8F7F5' }]}
                    onPress={() => Alert.alert('Video Call', `Initiating video call with ${item.userId.name}...\n\nThis feature will be available soon.`)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="video-outline" size={20} color="#1A9E8F" />
                    <Text style={[s.contactBtnText, { color: '#1A9E8F' }]}>Video Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.contactBtn, { backgroundColor: '#EEF1FF' }]}
                    onPress={() => router.push({
                        pathname: '/in-house_doctor/chat',
                        params: {
                            userId: item.userId._id,
                            patientName: item.userId.name,
                        },
                    })}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="chat-processing-outline" size={20} color="#2A4DD0" />
                    <Text style={[s.contactBtnText, { color: '#2A4DD0' }]}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.contactBtn, { backgroundColor: '#FFFBEB' }]}
                    onPress={() => Alert.alert('Send Prescription', `Sending prescription to ${item.userId.name}...\n\nThis feature will be available soon.`)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="prescription" size={20} color="#F59E0B" />
                    <Text style={[s.contactBtnText, { color: '#F59E0B' }]}>Prescription</Text>
                </TouchableOpacity>
            </View>

            <View style={s.divider} />

            {/* Document Action Buttons */}
            <View style={s.actionRow}>
                <TouchableOpacity
                    style={[s.actionBtn, s.pdfBtn]}
                    onPress={() => openPDF(item.medicalReportUrl)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="file-pdf-box" size={16} color="#EF4444" />
                    <Text style={[s.actionBtnText, { color: '#EF4444' }]}>View PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.actionBtn, s.recBtn]}
                    onPress={() => openRecommendModal(item)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="doctor" size={16} color="#fff" />
                    <Text style={[s.actionBtnText, { color: '#fff' }]}>Recommend Specialist</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={s.root}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View>
                    <Text style={s.headerTitle}>Assigned Patients</Text>
                    <Text style={s.headerSub}>Premium Members</Text>
                </View>
                <TouchableOpacity onPress={fetchAssignedUsers} style={s.refreshBtn}>
                    <Ionicons name="refresh" size={20} color="#2A4DD0" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator size="large" color="#2A4DD0" />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={item => item._id}
                    renderItem={renderUser}
                    contentContainerStyle={s.list}
                    ListEmptyComponent={
                        <View style={s.emptyBox}>
                            <MaterialCommunityIcons name="account-group-outline" size={48} color="#94A3B8" />
                            <Text style={s.emptyText}>No premium users assigned yet.</Text>
                        </View>
                    }
                />
            )}

            {/* ── Recommend Modal ── */}
            <Modal visible={showRecommendModal} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalBg}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={s.modalTitle}>Recommend Specialist</Text>
                                <Text style={s.modalSub}>For {selectedUser?.userId.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowRecommendModal(false)}>
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={s.inputLabel}>Specialist Name</Text>
                            <TextInput
                                style={s.input}
                                placeholder="e.g. Dr. Sarah Khan"
                                placeholderTextColor="#94A3B8"
                                value={recName}
                                onChangeText={setRecName}
                            />

                            <Text style={s.inputLabel}>Specialty</Text>
                            <TextInput
                                style={s.input}
                                placeholder="e.g. Cardiologist, Endocrinologist"
                                placeholderTextColor="#94A3B8"
                                value={recSpecialty}
                                onChangeText={setRecSpecialty}
                            />

                            <Text style={s.inputLabel}>Reason for Referral</Text>
                            <TextInput
                                style={[s.input, s.textArea]}
                                placeholder="Explain why you are recommending this specialist..."
                                placeholderTextColor="#94A3B8"
                                value={recReason}
                                onChangeText={setRecReason}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />

                            <TouchableOpacity
                                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={submitRecommendation}
                                disabled={submitting}
                                activeOpacity={0.8}
                            >
                                {submitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <>
                                        <MaterialCommunityIcons name="send-check" size={18} color="#fff" />
                                        <Text style={s.submitBtnText}>Send Recommendation</Text>
                                    </>
                                }
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F7FF' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E7ECFF',
    },
    backBtn: { padding: 4 },
    refreshBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: '#EEF1FF', alignItems: 'center', justifyContent: 'center'
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
    headerSub: { fontSize: 12, color: '#F59E0B', fontWeight: '700', textAlign: 'center' },
    list: { padding: 20, gap: 16 },
    userCard: {
        backgroundColor: '#fff', borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: '#FDE68A',
        shadowColor: '#F59E0B', shadowOpacity: 0.1,
        shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarBox: {
        width: 50, height: 50, borderRadius: 14,
        backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center'
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    userEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
    premiumBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A',
    },
    premiumText: { fontSize: 9, fontWeight: '800', color: '#F59E0B' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stat: { flex: 1 },
    statLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
    statValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '700' },
    existingRecs: {
        backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: '#6EE7B7', marginBottom: 4,
    },
    existingRecsTitle: { fontSize: 12, color: '#065F46', fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10, borderRadius: 12,
    },
    pdfBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
    recBtn: { backgroundColor: '#2A4DD0' },
    actionBtnText: { fontSize: 13, fontWeight: '700' },
    contactRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    contactBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 14, gap: 5,
    },
    contactBtnText: { fontSize: 11, fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyBox: { alignItems: 'center', marginTop: 60, gap: 12 },
    emptyText: { fontSize: 15, color: '#64748B', fontWeight: '500' },
    // Modal
    modalBg: {
        flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 14 },
    input: {
        backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1,
        borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12,
        fontSize: 15, color: '#0F172A',
    },
    textArea: { height: 100 },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#2A4DD0', borderRadius: 16,
        paddingVertical: 16, marginTop: 24, marginBottom: 8,
    },
    submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
