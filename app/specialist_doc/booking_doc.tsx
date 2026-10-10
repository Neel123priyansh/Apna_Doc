// app/get-schedule.tsx
import React, { useState, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, SafeAreaView, Platform, StatusBar,
    Dimensions, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authFetch } from '../../src/services/authServices';

const { width } = Dimensions.get('window');

const TEAL = '#1FA97F';
const TEAL_LIGHT = '#E8F7F2';
const BG = '#F6F2E7';
const CARD_BG = '#fff';
const TEXT_DARK = '#1A1A1A';
const TEXT_MID = '#888';
const BORDER = '#EFEFEF';
const DISABLED = '#F0F0F0';
const DISABLED_TEXT = '#C0C0C0';

// ── Helpers ───────────────────────────────────────────────────
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getWeekStrip(year: number, month: number, selectedDate: number) {
    // Return 7 days centred around selectedDate, clamped within the month
    const total = getDaysInMonth(year, month);
    let start = selectedDate - 3;
    let end = selectedDate + 3;
    if (start < 1) { end += (1 - start); start = 1; }
    if (end > total) { start -= (end - total); end = total; }
    start = Math.max(1, start);

    const days = [];
    for (let d = start; d <= end; d++) {
        const dow = new Date(year, month, d).getDay();
        days.push({ date: d, day: DAY_LABELS[dow] });
    }
    return days;
}

// ── Time slots ────────────────────────────────────────────────
const SLOTS: Record<string, string[]> = {
    Morning: ['06:00 am', '07:00 am', '08:00 am', '08:30 am'],
    Afternoon: ['10:00 am', '10:30 am', '11:00 am', '11:30 am'],
    Night: ['07:00 pm', '08:00 pm', '09:00 pm', '10:00 pm'],
};

const FEE_OPTIONS = [
    { key: 'voice', label: 'Voice Call', icon: 'call-outline', price: '₹1000' },
    { key: 'video', label: 'Video Call', icon: 'videocam-outline', price: '₹2000' },
];

// ── DetailRow helper ────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: TEAL_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon as any} size={16} color={TEAL} />
            </View>
            <Text style={{ fontSize: 12, color: TEXT_MID, flex: 1 }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_DARK }}>{value}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────
export default function GetScheduleScreen() {
    const router = useRouter();
    const { doctorName, specialty } = useLocalSearchParams<{
        doctorName?: string; specialty?: string;
    }>();

    // ── Calendar state ────────────────────────────────────────
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selDate, setSelDate] = useState(today.getDate());

    // ── Appointment state ─────────────────────────────────────
    const [consultType, setConsultType] = useState<'Hospital' | 'Online'>('Online');
    const [timeOfDay, setTimeOfDay] = useState('Afternoon');
    const [selSlot, setSelSlot] = useState(SLOTS['Afternoon'][1]);
    const [feeType, setFeeType] = useState('video');

    const isOnline = consultType === 'Online';
    const weekDays = useMemo(() => getWeekStrip(year, month, selDate), [year, month, selDate]);
    const totalDays = getDaysInMonth(year, month);
    const currentSlots = SLOTS[timeOfDay] ?? [];

    // ── UI state ──────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

    // ── Month navigation ──────────────────────────────────────
    const prevMonth = () => {
        if (month === 0) { setMonth(11); setYear(y => y - 1); }
        else { setMonth(m => m - 1); }
        setSelDate(1);
    };
    const nextMonth = () => {
        if (month === 11) { setMonth(0); setYear(y => y + 1); }
        else { setMonth(m => m + 1); }
        setSelDate(1);
    };

    // ── Date selection ────────────────────────────────────────
    const handleDateSelect = (date: number) => {
        setSelDate(date);
        // Auto-pick first available slot when date changes
        setSelSlot(SLOTS[timeOfDay][0]);
    };

    // ── Time of day switch ────────────────────────────────────
    const handleTodSwitch = (tod: string) => {
        setTimeOfDay(tod);
        setSelSlot(SLOTS[tod][0]);
    };

    // ── Finish — POST to backend ──────────────────────────────
    const handleFinish = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await authFetch('/api/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    doctorName: doctorName ?? 'Specialist',
                    specialty: specialty ?? '',
                    consultType,
                    date: `${selDate} ${MONTH_NAMES[month]} ${year}`,
                    slot: selSlot,
                    feeType: isOnline ? feeType : 'hospital',
                    price: isOnline
                        ? (FEE_OPTIONS.find(f => f.key === feeType)?.price ?? '')
                        : 'Clinic Fee',
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Booking failed');
            setConfirmedBooking(json.booking);
            setModalVisible(true);
        } catch (err: any) {
            Alert.alert('Booking Error', err.message || 'Could not confirm booking. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <SafeAreaView style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={BG} />

            {/* ── Header ──────────────────────────────────────── */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.push({ pathname: '/docRecom' })} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
                </TouchableOpacity>
                <View style={s.headerCenter}>
                    <Text style={s.headerTitle} numberOfLines={1}>
                        {doctorName ?? 'Get Schedule'}
                    </Text>
                    {specialty ? (
                        <Text style={s.headerSub} numberOfLines={1}>{specialty}</Text>
                    ) : null}
                </View>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.scroll}
            >
                {/* ── Consult toggle ───────────────────────────── */}
                <View style={s.toggleRow}>
                    {(['Hospital', 'Online'] as const).map(type => {
                        const active = consultType === type;
                        return (
                            <TouchableOpacity
                                key={type}
                                style={[s.toggleBtn, active && s.toggleBtnActive]}
                                onPress={() => setConsultType(type)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons
                                    name={type === 'Hospital' ? 'hospital-building' : 'web'}
                                    size={18}
                                    color={active ? '#fff' : TEXT_MID}
                                />
                                <Text style={[s.toggleText, active && s.toggleTextActive]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── Calendar ──────────────────────────────────── */}
                <View style={s.section}>
                    <View style={s.monthRow}>
                        <Text style={s.monthText}>
                            {MONTH_NAMES[month]} {year}
                        </Text>
                        <View style={s.monthNavRow}>
                            <TouchableOpacity style={s.monthNav} onPress={prevMonth} activeOpacity={0.7}>
                                <Ionicons name="chevron-back" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                            <TouchableOpacity style={s.monthNav} onPress={nextMonth} activeOpacity={0.7}>
                                <Ionicons name="chevron-forward" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Week strip — 7 days around selected */}
                    <View style={s.weekRow}>
                        {weekDays.map(({ date, day }) => {
                            const isSelected = date === selDate;
                            // Mark today with dashed border
                            const isToday =
                                date === today.getDate() &&
                                month === today.getMonth() &&
                                year === today.getFullYear();

                            return (
                                <TouchableOpacity
                                    key={date}
                                    style={[
                                        s.dayCell,
                                        isSelected && s.dayCellSelected,
                                        isToday && !isSelected && s.dayCellToday,
                                    ]}
                                    onPress={() => handleDateSelect(date)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.dateNum, isSelected && s.dateNumSelected]}>
                                        {date}
                                    </Text>
                                    <Text style={[s.dayLabel, isSelected && s.dayLabelSelected]}>
                                        {day}
                                    </Text>
                                    {isToday && !isSelected && (
                                        <View style={s.todayDot} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Quick date jump — show first/prev/next page */}
                    <View style={s.dateJumpRow}>
                        <TouchableOpacity
                            style={s.jumpBtn}
                            onPress={() => handleDateSelect(Math.max(1, selDate - 7))}
                        >
                            <Text style={s.jumpText}>← Earlier</Text>
                        </TouchableOpacity>
                        <Text style={s.selectedDateLabel}>
                            {selDate} {MONTH_NAMES[month].slice(0, 3)} {year}
                        </Text>
                        <TouchableOpacity
                            style={s.jumpBtn}
                            onPress={() => handleDateSelect(Math.min(totalDays, selDate + 7))}
                        >
                            <Text style={s.jumpText}>Later →</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Available Slots ───────────────────────────── */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Available Slots</Text>

                    {/* Time of day tabs */}
                    <View style={s.timeTabRow}>
                        {Object.keys(SLOTS).map(tod => {
                            const active = tod === timeOfDay;
                            const icon = tod === 'Morning' ? '☀️'
                                : tod === 'Afternoon' ? '🌤️'
                                    : '🌙';
                            return (
                                <TouchableOpacity
                                    key={tod}
                                    style={[s.timeTab, active && s.timeTabActive]}
                                    onPress={() => handleTodSwitch(tod)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.timeTabIcon}>{icon}</Text>
                                    <Text style={[s.timeTabText, active && s.timeTabTextActive]}>
                                        {tod}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Slot grid */}
                    <View style={s.slotsGrid}>
                        {currentSlots.map(slot => {
                            const active = slot === selSlot;
                            return (
                                <TouchableOpacity
                                    key={slot}
                                    style={[s.slotBtn, active && s.slotBtnActive]}
                                    onPress={() => setSelSlot(slot)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[s.slotText, active && s.slotTextActive]}>
                                        {slot}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* ── Consultation Fees ─────────────────────────── */}
                <View style={s.section}>
                    <View style={s.feeTitleRow}>
                        <Text style={s.sectionTitle}>Consultation Fees</Text>
                        {/* ✅ Hospital badge shown when disabled */}
                        {!isOnline && (
                            <View style={s.hospitalBadge}>
                                <MaterialCommunityIcons name="hospital-building" size={13} color="#888" />
                                <Text style={s.hospitalBadgeText}>Visit in person</Text>
                            </View>
                        )}
                    </View>

                    {/* ✅ Disabled overlay message when Hospital selected */}
                    {!isOnline && (
                        <View style={s.disabledNotice}>
                            <Ionicons name="information-circle-outline" size={18} color="#888" />
                            <Text style={s.disabledNoticeText}>
                                Online consultation fees are not applicable for Hospital visits. Please pay at the clinic.
                            </Text>
                        </View>
                    )}

                    <View style={[s.feeRow, !isOnline && s.feeRowDisabled]}>
                        {FEE_OPTIONS.map(fee => {
                            const active = feeType === fee.key && isOnline;
                            const disabled = !isOnline;
                            return (
                                <TouchableOpacity
                                    key={fee.key}
                                    style={[
                                        s.feeCard,
                                        active && s.feeCardActive,
                                        disabled && s.feeCardDisabled,
                                    ]}
                                    onPress={() => isOnline && setFeeType(fee.key)}
                                    activeOpacity={isOnline ? 0.8 : 1}
                                    disabled={disabled}
                                >
                                    <View style={[
                                        s.feeIconWrap,
                                        active && s.feeIconWrapActive,
                                        disabled && s.feeIconWrapDisabled,
                                    ]}>
                                        <Ionicons
                                            name={fee.icon as any}
                                            size={20}
                                            color={
                                                disabled ? DISABLED_TEXT
                                                    : active ? '#fff'
                                                        : TEXT_MID
                                            }
                                        />
                                    </View>
                                    <Text style={[
                                        s.feeLabel,
                                        active && s.feeLabelActive,
                                        disabled && s.feeLabelDisabled,
                                    ]}>
                                        {fee.label}
                                    </Text>
                                    <Text style={[
                                        s.feePrice,
                                        active && s.feePriceActive,
                                        disabled && s.feePriceDisabled,
                                    ]}>
                                        {fee.price}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* ── Summary chip ─────────────────────────────────── */}
            <View style={s.summaryChip}>
                <Ionicons name="calendar-outline" size={14} color={TEAL} />
                <Text style={s.summaryText}>
                    {selDate} {MONTH_NAMES[month].slice(0, 3)} · {selSlot}
                    {isOnline ? ` · ${FEE_OPTIONS.find(f => f.key === feeType)?.price}` : ' · Clinic Fee'}
                </Text>
            </View>

            {/* ── Continue button ──────────────────────────────── */}
            <View style={s.bottomBar}>
                <TouchableOpacity
                    style={s.continueBtn}
                    activeOpacity={0.85}
                    onPress={handleFinish}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={s.continueBtnText}>Finish</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>

        {/* ── Booking Confirmed Modal ───────────────────────── */}
        <Modal
            visible={modalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => { setModalVisible(false); router.push({ pathname: '/docRecom' }); }}
        >
            <View style={s.modalOverlay}>
                <View style={s.modalCard}>
                    {/* Checkmark */}
                    <View style={s.modalIconWrap}>
                        <Ionicons name="checkmark-circle" size={60} color={TEAL} />
                    </View>

                    <Text style={s.modalTitle}>Booking Confirmed!</Text>
                    <Text style={s.modalSub}>Your appointment has been successfully booked.</Text>

                    {/* Details */}
                    <View style={s.modalDetails}>
                        <DetailRow icon="person-outline" label="Doctor" value={confirmedBooking?.doctorName ?? doctorName ?? ''} />
                        {(confirmedBooking?.specialty || specialty) ? (
                            <DetailRow icon="medical-outline" label="Specialty" value={confirmedBooking?.specialty || specialty!} />
                        ) : null}
                        <DetailRow icon="swap-horizontal-outline" label="Type" value={confirmedBooking?.consultType ?? consultType} />
                        <DetailRow icon="calendar-outline" label="Date" value={confirmedBooking?.date ?? ''} />
                        <DetailRow icon="time-outline" label="Time" value={confirmedBooking?.slot ?? ''} />
                        <DetailRow icon="cash-outline" label="Fee" value={confirmedBooking?.price ?? ''} />
                    </View>

                    <TouchableOpacity
                        style={s.modalBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                            setModalVisible(false);
                            router.push({ pathname: '/docRecom' });
                        }}
                    >
                        <Text style={s.modalBtnText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
        </>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 50 : 8, paddingBottom: 34 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, textAlign: 'center' },
    headerSub: { fontSize: 12, fontWeight: '500', color: TEAL, textAlign: 'center', marginTop: 2 },

    scroll: { paddingHorizontal: 18, paddingBottom: 24 },

    // Toggle
    toggleRow: { flexDirection: 'row', backgroundColor: CARD_BG, borderRadius: 16, padding: 4, marginBottom: 34 },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 13 },
    toggleBtnActive: { backgroundColor: TEAL, shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    toggleText: { fontSize: 14, fontWeight: '600', color: TEXT_MID },
    toggleTextActive: { color: '#fff' },

    // Section
    section: { marginBottom: 50 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 14 },

    // Calendar
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    monthText: { fontSize: 15, fontWeight: '700', color: TEXT_DARK },
    monthNavRow: { flexDirection: 'row', gap: 4 },
    monthNav: { width: 30, height: 30, borderRadius: 15, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCell: { width: (width - 36 - 48) / 7, minWidth: 38, height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: 'transparent' },
    dayCellSelected: { backgroundColor: TEAL, shadowColor: TEAL, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    dayCellToday: { borderWidth: 1.5, borderColor: TEAL, borderStyle: 'dashed', borderRadius: 14 },
    dateNum: { fontSize: 15, fontWeight: '700', color: TEXT_DARK },
    dateNumSelected: { color: '#fff' },
    dayLabel: { fontSize: 11, fontWeight: '500', color: TEXT_MID },
    dayLabelSelected: { color: 'rgba(255,255,255,0.85)' },
    todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: TEAL, position: 'absolute', bottom: 5 },

    // Date jump
    dateJumpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    jumpBtn: { paddingVertical: 4, paddingHorizontal: 8 },
    jumpText: { fontSize: 12, color: TEAL, fontWeight: '600' },
    selectedDateLabel: { fontSize: 12, fontWeight: '700', color: TEXT_DARK },

    // Time tabs
    timeTabRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    timeTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, backgroundColor: CARD_BG },
    timeTabActive: { backgroundColor: TEAL, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
    timeTabIcon: { fontSize: 14 },
    timeTabText: { fontSize: 13, fontWeight: '600', color: TEXT_MID },
    timeTabTextActive: { color: '#fff' },

    // Slots
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slotBtn: { width: (width - 36 - 30) / 4, paddingVertical: 11, borderRadius: 12, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER },
    slotBtnActive: { backgroundColor: TEAL, borderColor: TEAL, shadowColor: TEAL, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
    slotText: { fontSize: 12, fontWeight: '600', color: TEXT_MID },
    slotTextActive: { color: '#fff' },

    // Fees
    feeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    hospitalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F0F0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    hospitalBadgeText: { fontSize: 11, color: '#888', fontWeight: '600' },
    disabledNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E8E8E8' },
    disabledNoticeText: { fontSize: 12, color: '#888', flex: 1, lineHeight: 18 },
    feeRow: { flexDirection: 'row', gap: 10 },
    feeRowDisabled: { opacity: 0.45 },
    feeCard: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: 16, backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER },
    feeCardActive: { backgroundColor: TEAL_LIGHT, borderColor: TEAL },
    feeCardDisabled: { backgroundColor: DISABLED, borderColor: BORDER },
    feeIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
    feeIconWrapActive: { backgroundColor: TEAL },
    feeIconWrapDisabled: { backgroundColor: DISABLED },
    feeLabel: { fontSize: 11, fontWeight: '600', color: TEXT_MID, textAlign: 'center' },
    feeLabelActive: { color: TEAL },
    feeLabelDisabled: { color: DISABLED_TEXT },
    feePrice: { fontSize: 17, fontWeight: '800', color: TEXT_DARK },
    feePriceActive: { color: TEAL },
    feePriceDisabled: { color: DISABLED_TEXT },

    // Summary chip
    summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TEAL_LIGHT, marginHorizontal: 18, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 8, borderWidth: 1, borderColor: '#B8E8D8' },
    summaryText: { fontSize: 13, fontWeight: '600', color: TEAL },

    // Bottom
    bottomBar: { paddingHorizontal: 18, paddingBottom: Platform.OS === 'ios' ? 28 : 18, paddingTop: 4, backgroundColor: BG },
    continueBtn: { backgroundColor: TEAL, borderRadius: 50, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: TEAL, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
    continueBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

    // ── Confirmation Modal ──────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    modalIconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: TEAL_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: TEXT_DARK,
        marginBottom: 6,
        textAlign: 'center',
    },
    modalSub: {
        fontSize: 13,
        color: TEXT_MID,
        textAlign: 'center',
        marginBottom: 22,
        lineHeight: 20,
    },
    modalDetails: {
        width: '100%',
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: BORDER,
    },
    modalBtn: {
        width: '100%',
        backgroundColor: TEAL,
        borderRadius: 50,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: TEAL,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    modalBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
