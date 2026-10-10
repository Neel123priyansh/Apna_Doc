import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Alert, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { authFetch } from '../../src/services/authServices';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────── Types ────────────────────────────────────────────────
type Doctor = {
    _id: string;
    name: string;
    specialty: string;
    degrees?: string[];
    degree?: string;
    yearsExperience: number;
    description: string;
    available: boolean;
    location?: {
        latitude: number;
        longitude: number;
        district?: string;
        city?: string;
        state?: string;
    };
    createdAt: string;
};

type UserProfile = {
    _id: string;
    name?: string;
    age?: number;
    sex?: string;
    weight?: number;
    weightUnit?: string;
    height?: number;
    conditions?: string[];
    medications?: string;
    createdAt: string;
    userId?: {
        name?: string;
        email?: string;
        isPremium?: boolean;
    };
};

type DoctorPlace = {
    district: string;
    city: string;
    state: string;
};

const DOCTOR_DEGREES = ['MBBS', 'MD', 'MS', 'DO', 'DM', 'MCh', 'BDS', 'MDS', 'PhD'];

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function AdminDashboard() {
    const { logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'doctors' | 'users' | 'in-house'>('doctors');

    // ── Doctors state ──────────────────────────────────────────────────────
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [newDoctorName, setNewDoctorName] = useState('');
    const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('');
    const [newDoctorDegrees, setNewDoctorDegrees] = useState<string[]>([]);
    const [customDegree, setCustomDegree] = useState('');
    const [newDoctorExperience, setNewDoctorExperience] = useState('');
    const [newDoctorDescription, setNewDoctorDescription] = useState('');
    const [degreeModalVisible, setDegreeModalVisible] = useState(false);
    const [newDoctorAvailable, setNewDoctorAvailable] = useState(true);
    const [doctorLocation, setDoctorLocation] = useState<Location.LocationObject | null>(null);
    const [doctorPlace, setDoctorPlace] = useState<DoctorPlace | null>(null);
    const [loadingDoctorLocation, setLoadingDoctorLocation] = useState(false);
    const [savingDoctor, setSavingDoctor] = useState(false);

    // ── Users state ─────────────────────────────────────────────────────────
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    // ── In-House Doctor Account state ─────────────────────────────────────────
    const [inHouseDoctor, setInHouseDoctor] = useState<any>(null);
    const [loadingInHouse, setLoadingInHouse] = useState(true);
    const [inHouseName, setInHouseName] = useState('');
    const [inHouseEmail, setInHouseEmail] = useState('');
    const [inHousePassword, setInHousePassword] = useState('');
    const [inHouseSpecialty, setInHouseSpecialty] = useState('');
    const [registeringInHouse, setRegisteringInHouse] = useState(false);
 
    // ── Bookings and selection state ──────────────────────────────────────────
    const [totalBookingsCount, setTotalBookingsCount] = useState<number | null>(null);
    const [selectedDoctorName, setSelectedDoctorName] = useState<string | null>(null);
    const [doctorBookings, setDoctorBookings] = useState<any[]>([]);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [bookingsModalVisible, setBookingsModalVisible] = useState(false);

    // ── Load doctors ────────────────────────────────────────────────────────
    const loadDoctors = async () => {
        setLoadingDoctors(true);
        try {
            const res = await authFetch('/api/admin/doctors');
            if (!res.ok) throw new Error('Failed to fetch doctors');
            const data = await res.json();
            setDoctors(data);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoadingDoctors(false);
        }
    };

    // ── Load users ─────────────────────────────────────────────────────────
    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await authFetch('/api/admin/users');
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            setUsers(data);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoadingUsers(false);
        }
    };

    // ── Load in-house doctor ────────────────────────────────────────────────
    const loadInHouseDoctor = async () => {
        setLoadingInHouse(true);
        try {
            const res = await authFetch('/api/admin/in-house-doctor');
            if (!res.ok) throw new Error('Failed to fetch in-house doctor');
            const data = await res.json();
            setInHouseDoctor(data.doctor || null);
        } catch (error: any) {
            console.log('Error fetching in-house doctor:', error.message);
        } finally {
            setLoadingInHouse(false);
        }
    };

    // ── Load booking stats ──────────────────────────────────────────────────
    const loadBookingStats = async () => {
        try {
            const res = await authFetch('/api/bookings/count');
            if (res.ok) {
                const data = await res.json();
                setTotalBookingsCount(data.count);
            }
        } catch (error) {
            console.log('Error fetching booking stats:', error);
        }
    };

    useEffect(() => {
        loadDoctors();
        loadUsers();
        loadInHouseDoctor();
        loadBookingStats();
    }, []);

    // ── Add doctor ─────────────────────────────────────────────────────────
    const handleAddDoctor = async () => {
        const degrees = [...newDoctorDegrees, ...(customDegree.trim() ? [customDegree.trim()] : [])];
        if (!newDoctorName.trim() || !newDoctorSpecialty.trim() || degrees.length === 0
            || !newDoctorExperience.trim() || !newDoctorDescription.trim()) {
            return Alert.alert('Incomplete', 'Please complete the doctor details before saving.');
        }
        const experience = Number(newDoctorExperience);
        if (!Number.isInteger(experience) || experience < 0 || experience > 80) {
            return Alert.alert('Invalid Experience', 'Years of experience must be a whole number from 0 to 80.');
        }
        if (!doctorLocation) {
            return Alert.alert('Location Required', 'Capture the doctor location before adding the doctor.');
        }
        setSavingDoctor(true);
        try {
            const res = await authFetch('/api/admin/doctors', {
                method: 'POST',
                body: JSON.stringify({
                    name: newDoctorName.trim(),
                    specialty: newDoctorSpecialty.trim(),
                    degrees,
                    yearsExperience: experience,
                    description: newDoctorDescription.trim(),
                    available: newDoctorAvailable,
                    location: {
                        latitude: doctorLocation.coords.latitude,
                        longitude: doctorLocation.coords.longitude,
                        ...doctorPlace,
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setNewDoctorName('');
            setNewDoctorSpecialty('');
            setNewDoctorDegrees([]);
            setCustomDegree('');
            setNewDoctorExperience('');
            setNewDoctorDescription('');
            setNewDoctorAvailable(true);
            setDoctorLocation(null);
            setDoctorPlace(null);
            Alert.alert('✅ Success', `Dr. ${data.doctor.name} has been added to the system.`);
            loadDoctors();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSavingDoctor(false);
        }
    };

    const captureDoctorLocation = async () => {
        setLoadingDoctorLocation(true);
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Location Permission', 'Location access is required to register this doctor.');
                return;
            }
            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            const addresses = await Location.reverseGeocodeAsync({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            });
            const address = addresses[0];
            if (!address) {
                throw new Error('Could not determine the location name. Please try again.');
            }
            setDoctorLocation(currentLocation);
            setDoctorPlace({
                district: address.district || address.subregion || '',
                city: address.city || address.subregion || '',
                state: address.region || '',
            });
        } catch (error: any) {
            Alert.alert('Location Error', error.message || 'Unable to capture the current location.');
        } finally {
            setLoadingDoctorLocation(false);
        }
    };

    // ── Register In-House Doctor ───────────────────────────────────────────
    const handleRegisterInHouse = async () => {
        if (!inHouseName.trim() || !inHouseEmail.trim() || !inHousePassword.trim() || !inHouseSpecialty.trim()) {
            return Alert.alert('Incomplete Fields', 'Please fill in all details for the in-house doctor account.');
        }
        if (inHousePassword.length < 6) {
            return Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
        }
        setRegisteringInHouse(true);
        try {
            const res = await authFetch('/api/admin/in-house-doctor', {
                method: 'POST',
                body: JSON.stringify({
                    name: inHouseName.trim(),
                    email: inHouseEmail.trim().toLowerCase(),
                    password: inHousePassword,
                    specialty: inHouseSpecialty.trim()
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to register account');
            
            Alert.alert('✅ Registered', 'In-House Doctor account created successfully!');
            setInHouseName('');
            setInHouseEmail('');
            setInHousePassword('');
            setInHouseSpecialty('');
            loadInHouseDoctor();
        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
        } finally {
            setRegisteringInHouse(false);
        }
    };

    // ── Load doctor bookings ───────────────────────────────────────────────
    const handleDoctorPress = async (docName: string) => {
        setSelectedDoctorName(docName);
        setBookingsModalVisible(true);
        setLoadingBookings(true);
        try {
            const res = await authFetch(`/api/bookings/doctor/${encodeURIComponent(docName)}`);
            if (!res.ok) throw new Error('Failed to fetch doctor bookings');
            const data = await res.json();
            setDoctorBookings(data);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Unable to load bookings.');
            setBookingsModalVisible(false);
        } finally {
            setLoadingBookings(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F4F7FF" />

            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <View style={s.header}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerEyebrow}>Ezzmed Control Center</Text>
                        <Text style={s.headerTitle}>Admin Dashboard</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={s.adminBadge}>
                            <MaterialCommunityIcons name="shield-crown" size={16} color="#fff" />
                            <Text style={s.adminBadgeText}>Admin</Text>
                        </View>
                        <TouchableOpacity style={s.logoutBtn} activeOpacity={0.7} onPress={logout}>
                            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Stats row ───────────────────────────────────────────── */}
                <View style={s.statsRow}>
                    <View style={[s.statCard, { backgroundColor: '#EEF1FF' }]}>
                        <MaterialCommunityIcons name="doctor" size={22} color="#2A4DD0" />
                        <Text style={s.statValue}>{loadingDoctors ? '...' : doctors.length}</Text>
                        <Text style={s.statLabel}>Doctors</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#F0FDF4' }]}>
                        <MaterialCommunityIcons name="calendar-check" size={22} color="#22C55E" />
                        <Text style={[s.statValue, { color: '#22C55E' }]}>{totalBookingsCount !== null ? totalBookingsCount : '...'}</Text>
                        <Text style={s.statLabel}>Bookings</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#FFF4E8' }]}>
                        <MaterialCommunityIcons name="account-group" size={22} color="#F97316" />
                        <Text style={[s.statValue, { color: '#F97316' }]}>{loadingUsers ? '...' : users.length}</Text>
                        <Text style={s.statLabel}>Users</Text>
                    </View>
                </View>

                {/* ── Tab pills ───────────────────────────────────────────── */}
                <View style={s.tabPills}>
                    <TouchableOpacity
                        style={[s.tabPill, activeTab === 'doctors' && s.tabPillActive]}
                        onPress={() => setActiveTab('doctors')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="doctor" size={16} color={activeTab === 'doctors' ? '#fff' : '#2A4DD0'} />
                        <Text style={[s.tabPillText, activeTab === 'doctors' && s.tabPillTextActive]}>Doctors</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.tabPill, activeTab === 'users' && s.tabPillActive]}
                        onPress={() => setActiveTab('users')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="account-group" size={16} color={activeTab === 'users' ? '#fff' : '#2A4DD0'} />
                        <Text style={[s.tabPillText, activeTab === 'users' && s.tabPillTextActive]}>Users</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.tabPill, activeTab === 'in-house' && s.tabPillActiveInHouse]}
                        onPress={() => setActiveTab('in-house')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="stethoscope" size={16} color={activeTab === 'in-house' ? '#fff' : '#1A9E8F'} />
                        <Text style={[s.tabPillText, activeTab === 'in-house' && s.tabPillTextActive]}>In-House Dr</Text>
                    </TouchableOpacity>
                </View>

                {/* ══════════════ DOCTORS TAB ════════════════════════════════ */}
                {activeTab === 'doctors' && (
                    <>
                        {/* ── Add Doctor form ─────────────────────────────── */}
                        <View style={s.formCard}>
                            <View style={s.formCardHeader}>
                                <MaterialCommunityIcons name="account-plus" size={20} color="#2A4DD0" />
                                <Text style={s.formCardTitle}>Register New Doctor</Text>
                            </View>

                            <View style={s.divider} />

                            <Text style={s.inputLabel}>Doctor&apos;s Full Name</Text>
                            <TextInput
                                style={s.input}
                                placeholder="e.g. Dr. Sarah Chen"
                                placeholderTextColor="#94a3b8"
                                value={newDoctorName}
                                onChangeText={setNewDoctorName}
                            />

                            <Text style={s.inputLabel}>Specialty</Text>
                            <TextInput
                                style={s.input}
                                placeholder="e.g. Cardiologist, Dermatologist"
                                placeholderTextColor="#94a3b8"
                                value={newDoctorSpecialty}
                                onChangeText={setNewDoctorSpecialty}
                            />

                            <Text style={s.inputLabel}>Highest Medical Degree</Text>
                            <TouchableOpacity
                                style={s.selectInput}
                                onPress={() => setDegreeModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={[s.selectText, newDoctorDegrees.length === 0 && !customDegree && s.placeholderText]}>
                                    {newDoctorDegrees.length > 0 || customDegree
                                        ? [...newDoctorDegrees, ...(customDegree ? [customDegree] : [])].join(', ')
                                        : 'Select degrees'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color="#64748b" />
                            </TouchableOpacity>

                            <Text style={s.inputLabel}>Years of Experience</Text>
                            <TextInput
                                style={s.input}
                                placeholder="e.g. 8"
                                placeholderTextColor="#94a3b8"
                                value={newDoctorExperience}
                                onChangeText={setNewDoctorExperience}
                                keyboardType="number-pad"
                                maxLength={2}
                            />

                            <Text style={s.inputLabel}>Short Description</Text>
                            <TextInput
                                style={[s.input, s.multilineInput]}
                                placeholder="Briefly describe the doctor's experience and expertise"
                                placeholderTextColor="#94a3b8"
                                value={newDoctorDescription}
                                onChangeText={setNewDoctorDescription}
                                multiline
                                maxLength={500}
                                textAlignVertical="top"
                            />

                            <Text style={s.inputLabel}>Doctor Location</Text>
                            <TouchableOpacity
                                style={[s.locationBtn, doctorLocation && s.locationBtnCaptured]}
                                onPress={captureDoctorLocation}
                                disabled={loadingDoctorLocation}
                                activeOpacity={0.8}
                            >
                                {loadingDoctorLocation ? (
                                    <ActivityIndicator size="small" color="#2A4DD0" />
                                ) : (
                                    <MaterialCommunityIcons
                                        name={doctorLocation ? 'map-marker-check' : 'map-marker-radius'}
                                        size={20}
                                        color={doctorLocation ? '#16a34a' : '#2A4DD0'}
                                    />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={s.locationBtnTitle}>
                                        {doctorLocation ? 'Location captured' : 'Use current location'}
                                    </Text>
                                    <Text style={s.locationBtnSub}>
                                        {doctorLocation && doctorPlace
                                            ? [doctorPlace.district, doctorPlace.city, doctorPlace.state].filter(Boolean).join(', ')
                                            : 'Required to save the doctor location'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#64748b" />
                            </TouchableOpacity>

                            <View style={s.availRow}>
                                <Text style={s.inputLabel}>Available for consultations</Text>
                                <Switch
                                    value={newDoctorAvailable}
                                    onValueChange={setNewDoctorAvailable}
                                    trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
                                    thumbColor={newDoctorAvailable ? '#2A4DD0' : '#94a3b8'}
                                />
                            </View>

                            <TouchableOpacity
                                style={[s.addBtn, savingDoctor && { opacity: 0.6 }]}
                                onPress={handleAddDoctor}
                                disabled={savingDoctor}
                                activeOpacity={0.85}
                            >
                                {savingDoctor ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="add-circle" size={18} color="#fff" />
                                        <Text style={s.addBtnText}>Add Doctor</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* ── Doctors list ────────────────────────────────── */}
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionTitle}>Registered Doctors ({doctors.length})</Text>
                            <TouchableOpacity onPress={loadDoctors} activeOpacity={0.7}>
                                <Ionicons name="refresh" size={18} color="#2A4DD0" />
                            </TouchableOpacity>
                        </View>

                        {loadingDoctors ? (
                            <View style={s.loadingBox}>
                                <ActivityIndicator size="small" color="#2A4DD0" />
                            </View>
                        ) : doctors.length === 0 ? (
                            <View style={s.emptyBox}>
                                <MaterialCommunityIcons name="doctor" size={36} color="#cbd5e1" />
                                <Text style={s.emptyText}>No doctors registered yet.</Text>
                            </View>
                        ) : (
                            doctors.map((doc) => (
                                <TouchableOpacity
                                    key={doc._id}
                                    style={s.listCard}
                                    onPress={() => handleDoctorPress(doc.name)}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.doctorAvatarBox}>
                                        <MaterialCommunityIcons name="doctor" size={26} color="#2A4DD0" />
                                    </View>
                                    <View style={s.listInfo}>
                                        <Text style={s.listName}>{doc.name}</Text>
                                        <Text style={s.listSub}>{doc.specialty}</Text>
                                        <Text style={s.doctorCredentials}>{(doc.degrees || (doc.degree ? [doc.degree] : [])).join(', ')} · {doc.yearsExperience ?? 0} yrs experience</Text>
                                        <View style={s.doctorLocationRow}>
                                            <Ionicons name="location-outline" size={12} color="#64748B" />
                                            <Text style={s.doctorLocationText} numberOfLines={1}>
                                                {doc.location
                                                    ? [doc.location.district, doc.location.city, doc.location.state].filter(Boolean).join(', ') || 'Location unavailable'
                                                    : 'Location unavailable'}
                                            </Text>
                                        </View>
                                        <Text style={s.listDate}>Added {formatDate(doc.createdAt)}</Text>
                                    </View>
                                    <View style={[s.availBadge, { backgroundColor: doc.available ? '#f0fdf4' : '#fef2f2' }]}>
                                        <View style={[s.availDot, { backgroundColor: doc.available ? '#22c55e' : '#ef4444' }]} />
                                        <Text style={[s.availText, { color: doc.available ? '#16a34a' : '#dc2626' }]}>
                                            {doc.available ? 'Active' : 'Busy'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </>
                )}

                {/* ══════════════ USERS TAB ══════════════════════════════════ */}
                {activeTab === 'users' && (
                    <>
                        {/* Separate Users Navigation Cards */}
                        <View style={s.userTypeCardsRow}>
                            <TouchableOpacity
                                style={[s.userTypeCard, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                                activeOpacity={0.8}
                                onPress={() => router.push('/admin/free_users' as any)}
                            >
                                <View style={s.userTypeCardHeader}>
                                    <MaterialCommunityIcons name="account" size={24} color="#475569" />
                                    <Ionicons name="chevron-forward" size={16} color="#64748b" />
                                </View>
                                <Text style={s.userTypeCardCount}>{loadingUsers ? '...' : users.filter(u => !u.userId?.isPremium).length}</Text>
                                <Text style={s.userTypeCardLabel}>Free Users</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[s.userTypeCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}
                                activeOpacity={0.8}
                                onPress={() => router.push('/admin/premium_user' as any)}
                            >
                                <View style={s.userTypeCardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <MaterialCommunityIcons name="crown" size={22} color="#F59E0B" />
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
                                </View>
                                <Text style={[s.userTypeCardCount, { color: '#F59E0B' }]}>{loadingUsers ? '...' : users.filter(u => u.userId?.isPremium).length}</Text>
                                <Text style={[s.userTypeCardLabel, { color: '#b45309' }]}>Premium Users</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.sectionHeader}>
                            <Text style={s.sectionTitle}>All Registered Users ({users.length})</Text>
                            <TouchableOpacity onPress={loadUsers} activeOpacity={0.7}>
                                <Ionicons name="refresh" size={18} color="#2A4DD0" />
                            </TouchableOpacity>
                        </View>

                        {loadingUsers ? (
                            <View style={s.loadingBox}>
                                <ActivityIndicator size="small" color="#2A4DD0" />
                            </View>
                        ) : users.length === 0 ? (
                            <View style={s.emptyBox}>
                                <MaterialCommunityIcons name="account-group" size={36} color="#cbd5e1" />
                                <Text style={s.emptyText}>No users registered yet.</Text>
                            </View>
                        ) : (
                            users.map((user) => (
                                <View key={user._id} style={s.userCard}>
                                    {/* Avatar */}
                                    <View style={s.userAvatar}>
                                        <MaterialCommunityIcons name="account-circle" size={32} color="#2A4DD0" />
                                    </View>

                                    {/* Info */}
                                    <View style={s.userInfo}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.listName}>{user.name || user.userId?.name || 'Unknown User'}</Text>
                                            {user.userId?.isPremium && (
                                                <MaterialCommunityIcons name="crown" size={14} color="#F59E0B" />
                                            )}
                                        </View>
                                        <Text style={s.listSub}>
                                            {[user.age ? `${user.age} yrs` : null, user.sex, user.weight ? `${user.weight}${user.weightUnit || 'kg'}` : null, user.height ? `${user.height}cm` : null].filter(Boolean).join(' · ')}
                                        </Text>
                                        {user.conditions && user.conditions.length > 0 && (
                                            <View style={s.conditionRow}>
                                                {user.conditions.slice(0, 3).map((c, i) => (
                                                    <View key={i} style={s.conditionTag}>
                                                        <Text style={s.conditionTagText}>{c}</Text>
                                                    </View>
                                                ))}
                                                {user.conditions.length > 3 && (
                                                    <View style={s.conditionTag}>
                                                        <Text style={s.conditionTagText}>+{user.conditions.length - 3}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                        <Text style={s.listDate}>Registered {formatDate(user.createdAt)}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                )}

                {/* ══════════════ IN-HOUSE DOCTOR TAB ═══════════════════════ */}
                {activeTab === 'in-house' && (
                    <>
                        {loadingInHouse ? (
                            <View style={s.loadingBox}>
                                <ActivityIndicator size="small" color="#1A9E8F" />
                            </View>
                        ) : inHouseDoctor ? (
                            /* ── Existing account card ── */
                            <>
                                {/* Status banner */}
                                <View style={s.inHouseActiveBanner}>
                                    <View style={s.inHouseActiveDot} />
                                    <Text style={s.inHouseActiveBannerText}>In-House Doctor Account Active</Text>
                                </View>

                                {/* Profile card */}
                                <View style={s.inHouseProfileCard}>
                                    {/* Gradient-like header strip */}
                                    <View style={s.inHouseCardTop}>
                                        <View style={s.inHouseAvatarRing}>
                                            <MaterialCommunityIcons name="stethoscope" size={36} color="#1A9E8F" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 14 }}>
                                            <Text style={s.inHouseDocName}>{inHouseDoctor.name}</Text>
                                            <View style={s.inHouseSpecialtyPill}>
                                                <MaterialCommunityIcons name="hospital-box" size={12} color="#1A9E8F" />
                                                <Text style={s.inHouseSpecialtyText}>{inHouseDoctor.specialty || 'General'}</Text>
                                            </View>
                                        </View>
                                        <View style={s.inHouseLiveBadge}>
                                            <View style={s.inHouseLiveDot} />
                                            <Text style={s.inHouseLiveText}>LIVE</Text>
                                        </View>
                                    </View>

                                    <View style={s.inHouseCardDivider} />

                                    {/* Details grid */}
                                    <View style={s.inHouseDetailsGrid}>
                                        <View style={s.inHouseDetailItem}>
                                            <Ionicons name="mail-outline" size={14} color="#64748B" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inHouseDetailLabel}>EMAIL</Text>
                                                <Text style={s.inHouseDetailValue} numberOfLines={1}>{inHouseDoctor.email}</Text>
                                            </View>
                                        </View>
                                        <View style={s.inHouseDetailItem}>
                                            <MaterialCommunityIcons name="medical-bag" size={14} color="#64748B" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inHouseDetailLabel}>SPECIALTY</Text>
                                                <Text style={s.inHouseDetailValue}>{inHouseDoctor.specialty || 'General'}</Text>
                                            </View>
                                        </View>
                                        <View style={s.inHouseDetailItem}>
                                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inHouseDetailLabel}>REGISTERED ON</Text>
                                                <Text style={s.inHouseDetailValue}>{formatDate(inHouseDoctor.createdAt)}</Text>
                                            </View>
                                        </View>
                                        <View style={s.inHouseDetailItem}>
                                            <MaterialCommunityIcons name="shield-account" size={14} color="#64748B" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inHouseDetailLabel}>ROLE</Text>
                                                <Text style={[s.inHouseDetailValue, { color: '#1A9E8F', fontWeight: '800' }]}>In-House Doctor</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Info notice */}
                                <View style={s.inHouseNotice}>
                                    <MaterialCommunityIcons name="information-outline" size={16} color="#2A4DD0" />
                                    <Text style={s.inHouseNoticeText}>
                                        Only one In-House Doctor account is allowed. To change the doctor, please contact your database administrator.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            /* ── Registration form ── */
                            <View style={s.inHouseFormCard}>
                                {/* Card header */}
                                <View style={s.inHouseFormHeader}>
                                    <View style={s.inHouseFormIconBg}>
                                        <MaterialCommunityIcons name="stethoscope" size={26} color="#1A9E8F" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                        <Text style={s.inHouseFormTitle}>Register In-House Doctor</Text>
                                        <Text style={s.inHouseFormSubtitle}>Create the single dedicated doctor account</Text>
                                    </View>
                                </View>

                                <View style={s.inHouseFormDivider} />

                                {/* Warning badge */}
                                <View style={s.inHouseSingleWarn}>
                                    <MaterialCommunityIcons name="alert-circle" size={14} color="#F59E0B" />
                                    <Text style={s.inHouseSingleWarnText}>Only one account can be created. Choose carefully.</Text>
                                </View>

                                {/* Form fields */}
                                <Text style={s.inputLabel}>Full Name</Text>
                                <TextInput
                                    style={s.inHouseInput}
                                    placeholder="e.g. Dr. Priya Sharma"
                                    placeholderTextColor="#94a3b8"
                                    value={inHouseName}
                                    onChangeText={setInHouseName}
                                    autoCapitalize="words"
                                />

                                <Text style={s.inputLabel}>Email Address</Text>
                                <TextInput
                                    style={s.inHouseInput}
                                    placeholder="e.g. doctor@ezzmed.com"
                                    placeholderTextColor="#94a3b8"
                                    value={inHouseEmail}
                                    onChangeText={setInHouseEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />

                                <Text style={s.inputLabel}>Password</Text>
                                <TextInput
                                    style={s.inHouseInput}
                                    placeholder="Min. 6 characters"
                                    placeholderTextColor="#94a3b8"
                                    value={inHousePassword}
                                    onChangeText={setInHousePassword}
                                    secureTextEntry
                                />

                                <Text style={s.inputLabel}>Specialty / Department</Text>
                                <TextInput
                                    style={s.inHouseInput}
                                    placeholder="e.g. General Physician"
                                    placeholderTextColor="#94a3b8"
                                    value={inHouseSpecialty}
                                    onChangeText={setInHouseSpecialty}
                                />

                                <TouchableOpacity
                                    style={[s.inHouseRegisterBtn, registeringInHouse && { opacity: 0.6 }]}
                                    onPress={handleRegisterInHouse}
                                    disabled={registeringInHouse}
                                    activeOpacity={0.85}
                                >
                                    {registeringInHouse ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="account-plus" size={18} color="#fff" />
                                            <Text style={s.inHouseRegisterBtnText}>Create Doctor Account</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal
                visible={degreeModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDegreeModalVisible(false)}
            >
                <TouchableOpacity
                    style={s.degreeModalOverlay}
                    activeOpacity={1}
                    onPress={() => setDegreeModalVisible(false)}
                >
                    <View style={s.degreeModalCard}>
                        <Text style={s.degreeModalTitle}>Select Doctor Degree</Text>
                        {DOCTOR_DEGREES.map((degree) => (
                            <TouchableOpacity
                                key={degree}
                                style={[s.degreeOption, newDoctorDegrees.includes(degree) && s.degreeOptionActive]}
                                onPress={() => {
                                    setNewDoctorDegrees(current => current.includes(degree)
                                        ? current.filter(item => item !== degree)
                                        : [...current, degree]);
                                }}
                                activeOpacity={0.75}
                            >
                                <Text style={[s.degreeOptionText, newDoctorDegrees.includes(degree) && s.degreeOptionTextActive]}>
                                    {degree}
                                </Text>
                                {newDoctorDegrees.includes(degree) && (
                                    <Ionicons name="checkmark" size={18} color="#2A4DD0" />
                                )}
                            </TouchableOpacity>
                        ))}
                        <TextInput
                            style={s.customDegreeInput}
                            placeholder="Custom degree (optional)"
                            placeholderTextColor="#94a3b8"
                            value={customDegree}
                            onChangeText={setCustomDegree}
                        />
                        <TouchableOpacity
                            style={s.degreeDoneButton}
                            onPress={() => setDegreeModalVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={s.degreeDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Doctor Bookings Modal ───────────────────────────── */}
            <Modal
                visible={bookingsModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setBookingsModalVisible(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        {/* Modal Header */}
                        <View style={s.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.modalLabel}>DOCTOR APPOINTMENTS</Text>
                                <Text style={s.modalTitle} numberOfLines={1}>{selectedDoctorName}</Text>
                            </View>
                            <TouchableOpacity
                                style={s.closeButton}
                                onPress={() => setBookingsModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <View style={s.modalDivider} />

                        {loadingBookings ? (
                            <View style={s.modalLoading}>
                                <ActivityIndicator size="large" color="#2A4DD0" />
                                <Text style={s.modalLoadingText}>Loading appointments...</Text>
                            </View>
                        ) : doctorBookings.length === 0 ? (
                            <View style={s.modalEmpty}>
                                <MaterialCommunityIcons name="calendar-blank" size={48} color="#cbd5e1" />
                                <Text style={s.modalEmptyText}>No appointments booked for this doctor.</Text>
                            </View>
                        ) : (
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 24 }}
                            >
                                {doctorBookings.map((booking: any) => (
                                    <View key={booking._id} style={s.bookingCard}>
                                        <View style={s.bookingHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.bookingUser}>{booking.userName || 'Anonymous User'}</Text>
                                                <Text style={s.bookingEmail}>{booking.userEmail}</Text>
                                            </View>
                                            <View style={[s.bookingTypeBadge, { backgroundColor: booking.consultType === 'Online' ? '#EEF1FF' : '#F1F5F9' }]}>
                                                <Text style={[s.bookingTypeText, { color: booking.consultType === 'Online' ? '#2A4DD0' : '#475569' }]}>
                                                    {booking.consultType}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={s.bookingCardDivider} />

                                        <View style={s.bookingDetailsGrid}>
                                            <View style={s.bookingDetailItem}>
                                                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                                <Text style={s.bookingDetailText}>{booking.date}</Text>
                                            </View>
                                            <View style={s.bookingDetailItem}>
                                                <Ionicons name="time-outline" size={14} color="#64748B" />
                                                <Text style={s.bookingDetailText}>{booking.slot}</Text>
                                            </View>
                                            <View style={s.bookingDetailItem}>
                                                <Ionicons name="cash-outline" size={14} color="#64748B" />
                                                <Text style={s.bookingDetailText}>{booking.price || 'Clinic Fee'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F4F7FF',
    },
    scroll: {
        paddingTop: Platform.OS === 'ios' ? 60 : 44,
        paddingHorizontal: 18,
        paddingBottom: 40,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerLeft: {},
    headerEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2A4DD0',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2A4DD0',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    adminBadgeText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 12,
    },
    logoutBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Stats row
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#2A4DD0',
    },
    statLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },

    // Tab pills
    tabPills: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
        backgroundColor: '#EEF1FF',
        borderRadius: 14,
        padding: 4,
    },
    tabPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 10,
        paddingVertical: 10,
    },
    tabPillActive: {
        backgroundColor: '#2A4DD0',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    tabPillText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2A4DD0',
    },
    tabPillTextActive: {
        color: '#fff',
    },

    // Form card
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E7ECFF',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    formCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    formCardTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    input: {
        backgroundColor: '#F8FAFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
        marginBottom: 14,
    },
    selectInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 14,
    },
    selectText: {
        fontSize: 15,
        color: '#0F172A',
    },
    placeholderText: {
        color: '#94a3b8',
    },
    multilineInput: {
        minHeight: 88,
        paddingTop: 12,
    },
    doctorCredentials: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8FAFF',
        borderWidth: 1.5,
        borderColor: '#C7D2FE',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        marginBottom: 16,
    },
    locationBtnCaptured: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    locationBtnTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    locationBtnSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    availRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#2A4DD0',
        borderRadius: 14,
        paddingVertical: 14,
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    addBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },

    // List card (doctors)
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E7ECFF',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    doctorAvatarBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#EEF1FF',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    listInfo: {
        flex: 1,
    },
    listName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    listSub: {
        fontSize: 12,
        color: '#2A4DD0',
        fontWeight: '600',
        marginTop: 1,
    },
    doctorLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    doctorLocationText: {
        flex: 1,
        fontSize: 11,
        color: '#64748B',
    },
    listDate: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 3,
    },
    availBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    availDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    availText: {
        fontSize: 11,
        fontWeight: '700',
    },
    degreeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    degreeModalCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 18,
        shadowColor: '#0F172A',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    degreeModalTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
    },
    degreeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    degreeOptionActive: {
        backgroundColor: '#EEF1FF',
    },
    degreeOptionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
    },
    degreeOptionTextActive: {
        color: '#2A4DD0',
        fontWeight: '800',
    },
    customDegreeInput: {
        backgroundColor: '#F8FAFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginTop: 8,
        fontSize: 14,
        color: '#0F172A',
    },
    degreeDoneButton: {
        alignItems: 'center',
        backgroundColor: '#2A4DD0',
        borderRadius: 10,
        paddingVertical: 11,
        marginTop: 10,
    },
    degreeDoneText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    // User Category Cards
    userTypeCardsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    userTypeCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    userTypeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    userTypeCardCount: {
        fontSize: 24,
        fontWeight: '800',
        color: '#334155',
    },
    userTypeCardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 2,
    },

    // User card
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E7ECFF',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EEF1FF',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    userInfo: {
        flex: 1,
    },
    conditionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 5,
        marginBottom: 2,
    },
    conditionTag: {
        backgroundColor: '#EEF1FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    conditionTagText: {
        fontSize: 10,
        color: '#2A4DD0',
        fontWeight: '700',
    },
    loadingBox: {
        padding: 24,
        alignItems: 'center',
    },
    emptyBox: {
        padding: 32,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#E7ECFF',
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '600',
    },

    // ── In-House Doctor tab ───────────────────────────────────────────────────
    tabPillActiveInHouse: {
        backgroundColor: '#1A9E8F',
        shadowColor: '#1A9E8F',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    inHouseActiveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#E8F7F5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#99E6DE',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    inHouseActiveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#1A9E8F',
    },
    inHouseActiveBannerText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1A9E8F',
    },
    inHouseProfileCard: {
        backgroundColor: '#fff',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#D1F0EC',
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: '#1A9E8F',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    inHouseCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F7F5',
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    inHouseAvatarRing: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#99E6DE',
        flexShrink: 0,
    },
    inHouseDocName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6,
    },
    inHouseSpecialtyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    inHouseSpecialtyText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1A9E8F',
    },
    inHouseLiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#22C55E',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    inHouseLiveDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    inHouseLiveText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    inHouseCardDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
    },
    inHouseDetailsGrid: {
        paddingHorizontal: 18,
        paddingVertical: 16,
        gap: 14,
    },
    inHouseDetailItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    inHouseDetailLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    inHouseDetailValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    inHouseNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#EEF1FF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        marginBottom: 6,
    },
    inHouseNoticeText: {
        flex: 1,
        fontSize: 12,
        color: '#2A4DD0',
        fontWeight: '600',
        lineHeight: 18,
    },
    // Form card
    inHouseFormCard: {
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: '#D1F0EC',
        shadowColor: '#1A9E8F',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        marginBottom: 16,
    },
    inHouseFormHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    inHouseFormIconBg: {
        width: 54,
        height: 54,
        borderRadius: 16,
        backgroundColor: '#E8F7F5',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    inHouseFormTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
    },
    inHouseFormSubtitle: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 2,
    },
    inHouseFormDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 16,
    },
    inHouseSingleWarn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FDE68A',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 18,
    },
    inHouseSingleWarnText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: '#B45309',
        lineHeight: 17,
    },
    inHouseInput: {
        backgroundColor: '#F8FAFF',
        borderWidth: 1.5,
        borderColor: '#D1F0EC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
        marginBottom: 14,
    },
    inHouseRegisterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1A9E8F',
        borderRadius: 14,
        paddingVertical: 15,
        marginTop: 4,
        shadowColor: '#1A9E8F',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    inHouseRegisterBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
        letterSpacing: 0.2,
    },

    // ── Bookings Modal Styles ───────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '75%',
        paddingHorizontal: 20,
        paddingTop: 20,
        shadowColor: '#0F172A',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 4,
    },
    modalLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#2A4DD0',
        letterSpacing: 1.2,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 14,
    },
    modalLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    modalLoadingText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    modalEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingBottom: 40,
    },
    modalEmptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '600',
        textAlign: 'center',
    },
    bookingCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 14,
        marginBottom: 12,
    },
    bookingHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    bookingUser: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    bookingEmail: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 1,
    },
    bookingTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    bookingTypeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    bookingCardDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 10,
    },
    bookingDetailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    bookingDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bookingDetailText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
});
