import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authFetch } from '../src/services/authServices';

type Doctor = {
    _id: string;
    name: string;
    specialty: string;
    degrees?: string[];
    degree?: string;
    yearsExperience?: number;
    description?: string;
    available: boolean;
    avatar?: string | null;
    location?: {
        latitude: number;
        longitude: number;
        district?: string;
        city?: string;
        state?: string;
    };
};

export default function DoctorProfileScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [doctor, setDoctor] = useState<Doctor | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDoctor = async () => {
            if (!id) return;
            try {
                const response = await authFetch(`/api/doctors/${encodeURIComponent(id)}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to load doctor details');
                setDoctor(data);
            } catch (error: any) {
                Alert.alert('Unable to load doctor', error.message || 'Please try again.', [
                    { text: 'Go back', onPress: () => router.back() },
                ]);
            } finally {
                setLoading(false);
            }
        };
        loadDoctor();
    }, [id]);

    const openDirections = () => {
        if (!doctor?.location) return;
        const { latitude, longitude } = doctor.location;
        Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
        ).catch(() => Alert.alert('Maps unavailable', 'Unable to open directions.'));
    };

    if (loading) {
        return <View style={s.center}><ActivityIndicator size="large" color="#1FA97F" /></View>;
    }

    if (!doctor) return null;

    const location = doctor.location
        ? [doctor.location.district, doctor.location.city, doctor.location.state].filter(Boolean).join(', ')
        : 'Location unavailable';

    return (
        <View style={s.root}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={s.topBar}>
                    <TouchableOpacity style={s.backButton} onPress={() => router.push('/docRecom')}>
                        <Ionicons name="arrow-back" size={22} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={s.topTitle}>Doctor Details</Text>
                    <View style={s.backButton} />
                </View>

                <View style={s.profileHeader}>
                    {doctor.avatar ? (
                        <Image source={{ uri: doctor.avatar }} style={s.avatar} />
                    ) : (
                        <View style={s.avatarPlaceholder}>
                            <MaterialCommunityIcons name="doctor" size={42} color="#2A4DD0" />
                        </View>
                    )}
                    <Text style={s.name}>{doctor.name}</Text>
                    <Text style={s.specialty}>{doctor.specialty}</Text>
                    <View style={[s.status, { backgroundColor: doctor.available ? '#DCFCE7' : '#FEE2E2' }]}>
                        <View style={[s.statusDot, { backgroundColor: doctor.available ? '#22C55E' : '#EF4444' }]} />
                        <Text style={[s.statusText, { color: doctor.available ? '#16A34A' : '#DC2626' }]}>
                            {doctor.available ? 'Available' : 'Busy'}
                        </Text>
                    </View>
                </View>

                <View style={s.statsRow}>
                    <View style={s.stat}><Text style={s.statValue}>{doctor.degrees?.join(', ') || doctor.degree || 'Medical degree'}</Text><Text style={s.statLabel}>Degrees</Text></View>
                    <View style={s.stat}><Text style={s.statValue}>{doctor.yearsExperience ?? 'N/A'}+</Text><Text style={s.statLabel}>Years experience</Text></View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>About</Text>
                    <Text style={s.description}>{doctor.description || 'No description available.'}</Text>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>Location</Text>
                    <View style={s.locationRow}>
                        <Ionicons name="location-outline" size={20} color="#1FA97F" />
                        <Text style={s.locationText}>{location}</Text>
                    </View>
                    {doctor.location && (
                        <TouchableOpacity style={s.directionsButton} onPress={openDirections} activeOpacity={0.8}>
                            <Ionicons name="navigate-outline" size={18} color="#fff" />
                            <Text style={s.directionsText}>Get directions</Text>
                        </TouchableOpacity>
                    )}
                    {/* <TouchableOpacity
                        style={[s.bookButton, !doctor.available && s.bookButtonDisabled]}
                        disabled={!doctor.available}
                        onPress={() => router.push({
                            pathname: '/specialist_doc/booking_doc',
                            params: { doctorName: doctor.name, specialty: doctor.specialty },
                        } as any)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="calendar-outline" size={18} color={doctor.available ? '#fff' : '#94A3B8'} />
                        <Text style={[s.bookButtonText, !doctor.available && s.bookButtonTextDisabled]}>Book an Appointment</Text>
                    </TouchableOpacity> */}
                </View>
                                    <TouchableOpacity
                        style={[s.bookButton, !doctor.available && s.bookButtonDisabled]}
                        disabled={!doctor.available}
                        onPress={() => router.push({
                            pathname: '/specialist_doc/booking_doc',
                            params: { doctorName: doctor.name, specialty: doctor.specialty },
                        } as any)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="calendar-outline" size={18} color={doctor.available ? '#fff' : '#94A3B8'} />
                        <Text style={[s.bookButtonText, !doctor.available && s.bookButtonTextDisabled]}>Book an Appointment</Text>
                    </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F6F2E7' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F2E7' },
    content: { padding: 18, paddingTop: 48, paddingBottom: 50 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    topTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    profileHeader: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#E7ECFF' },
    avatar: { width: 92, height: 92, borderRadius: 24, marginBottom: 12 },
    avatarPlaceholder: { width: 92, height: 92, borderRadius: 24, backgroundColor: '#EEF1FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    name: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
    specialty: { fontSize: 14, color: '#2A4DD0', fontWeight: '700', marginTop: 4 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '800' },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    stat: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E7ECFF' },
    statValue: { fontSize: 16, fontWeight: '800', color: '#2A4DD0', textAlign: 'center' },
    statLabel: { fontSize: 11, color: '#64748B', marginTop: 4, textAlign: 'center' },
    section: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#E7ECFF' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    description: { fontSize: 14, lineHeight: 21, color: '#475569' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    locationText: { flex: 1, fontSize: 14, color: '#475569' },
    directionsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1FA97F', borderRadius: 12, paddingVertical: 12, marginTop: 14 },
    directionsText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    bookButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2A4DD0', borderRadius: 12, paddingVertical: 12, marginTop: 40 },
    bookButtonDisabled: { backgroundColor: '#F1F5F9' },
    bookButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    bookButtonTextDisabled: { color: '#94A3B8' },
});
