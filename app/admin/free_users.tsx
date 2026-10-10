import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authFetch } from '../../src/services/authServices';

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

export default function FreeUsersScreen() {
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/admin/users');
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            // Filter to keep only Free Users (isPremium is false or undefined)
            const freeUsers = data.filter((u: UserProfile) => !u.userId?.isPremium);
            setUsers(freeUsers);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const filteredUsers = users.filter((u) => {
        const name = (u.name || u.userId?.name || '').toLowerCase();
        const email = (u.userId?.email || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F4F7FF" />

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} activeOpacity={0.7} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={s.headerTitleContainer}>
                    <Text style={s.headerTitle}>Free Users</Text>
                    <Text style={s.headerSub}>{users.length} registered</Text>
                </View>
                <TouchableOpacity style={s.refreshBtn} activeOpacity={0.7} onPress={loadUsers}>
                    <Ionicons name="refresh" size={20} color="#2A4DD0" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={s.searchContainer}>
                <Ionicons name="search" size={18} color="#64748b" style={s.searchIcon} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search by name or email..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Users List */}
            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {loading ? (
                    <View style={s.centerBox}>
                        <ActivityIndicator size="large" color="#2A4DD0" />
                        <Text style={s.loadingText}>Fetching users...</Text>
                    </View>
                ) : filteredUsers.length === 0 ? (
                    <View style={s.emptyBox}>
                        <MaterialCommunityIcons name="account-search-outline" size={48} color="#cbd5e1" />
                        <Text style={s.emptyText}>
                            {searchQuery ? 'No matching users found.' : 'No free users registered.'}
                        </Text>
                    </View>
                ) : (
                    filteredUsers.map((user) => (
                        <View key={user._id} style={s.userCard}>
                            {/* Avatar */}
                            <View style={s.avatarContainer}>
                                <View style={s.userAvatar}>
                                    <MaterialCommunityIcons name="account" size={26} color="#475569" />
                                </View>
                                <View style={s.badgeFree}>
                                    <Text style={s.badgeFreeText}>FREE</Text>
                                </View>
                            </View>

                            {/* Info */}
                            <View style={s.userInfo}>
                                <Text style={s.userName}>{user.name || user.userId?.name || 'Unknown User'}</Text>
                                {user.userId?.email ? (
                                    <Text style={s.userEmail}>{user.userId.email}</Text>
                                ) : null}
                                <Text style={s.userVitals}>
                                    {[
                                        user.age ? `${user.age} yrs` : null,
                                        user.sex,
                                        user.weight ? `${user.weight}${user.weightUnit || 'kg'}` : null,
                                        user.height ? `${user.height}cm` : null
                                    ].filter(Boolean).join(' · ')}
                                </Text>

                                {user.conditions && user.conditions.length > 0 && (
                                    <View style={s.conditionRow}>
                                        {user.conditions.map((c, i) => (
                                            <View key={i} style={s.conditionTag}>
                                                <Text style={s.conditionTagText}>{c}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {user.medications ? (
                                    <View style={s.medsRow}>
                                        <MaterialCommunityIcons name="pill" size={12} color="#64748b" />
                                        <Text style={s.medsText} numberOfLines={1}>{user.medications}</Text>
                                    </View>
                                ) : null}

                                <Text style={s.listDate}>Registered {formatDate(user.createdAt)}</Text>
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F4F7FF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 44,
        paddingHorizontal: 18,
        paddingBottom: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E7ECFF',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0F172A',
    },
    headerSub: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 1,
    },
    refreshBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#EEF1FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 18,
        marginTop: 14,
        marginBottom: 8,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
    },
    scroll: {
        paddingHorizontal: 18,
        paddingTop: 10,
    },
    centerBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyBox: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#E7ECFF',
        marginTop: 20,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '600',
        textAlign: 'center',
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
        borderWidth: 1,
        borderColor: '#E7ECFF',
        shadowColor: '#2A4DD0',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    avatarContainer: {
        alignItems: 'center',
        gap: 6,
    },
    userAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    badgeFree: {
        backgroundColor: '#64748b',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeFreeText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '800',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    userEmail: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 1,
    },
    userVitals: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
        marginTop: 4,
    },
    conditionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 8,
    },
    conditionTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    conditionTagText: {
        fontSize: 10,
        color: '#475569',
        fontWeight: '700',
    },
    medsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        backgroundColor: '#F8FAFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    medsText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
        flex: 1,
    },
    listDate: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 10,
    },
});
