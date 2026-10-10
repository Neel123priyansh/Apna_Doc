//app/index.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Alert, Image, ActivityIndicator,
    Modal, Pressable, Animated, Dimensions, Easing,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { authFetch } from '../src/services/authServices';
import { useAuth } from '../context/AuthContext';
import PremiumOverlay from '../components/PremiumOverlay';
import { connectWithSocket } from '@/app/socket/socket';
import { File, Directory, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';


type ProfileData = {
    name?: string;
    age?: number;
    sex?: string;
    bloodType?: string;
    weight?: number;
    weightUnit?: string;
    height?: number;
    conditions?: string[];
    medications?: string;
};

type UserBooking = {
    _id: string;
    doctorName: string;
    specialty: string;
    doctorDegrees?: string[];
    date: string;
    slot: string;
    status: 'confirmed' | 'cancelled' | 'completed';
};

type DailyChallenges = {
    diet: {
        proteinGrams: number;
        carbsGrams: number;
        fiberGrams: number;
        fatGrams: number;
    };
    calories: {
        intakeKcal: number;
        burnKcal: number;
    };
    innerHealth: Array<{ id: string; label: string }>;
};

const DIET_CHALLENGES = [
    { id: 'protein', label: 'Protein', key: 'proteinGrams' },
    { id: 'carbs', label: 'Carbs', key: 'carbsGrams' },
    { id: 'fiber', label: 'Fiber', key: 'fiberGrams' },
    { id: 'fat', label: 'Fat', key: 'fatGrams' },
] as const;

// ─────────────────────── Mock data (replace with API) ────────────────────────
const DEFAULT_USER = {
    name: 'NULL',
    age: 'NULL',
    weight: 'NULL',
    height: 'NULL',
    avatar: null as string | null,
    conditions: 'NULL',
    medications: 'NULL',
};

const COLORS = {
  background: '#FFFFFF',
  lightGreen: '#C8F4C3',
  primary: '#1FA97F',
  text: '#17284D',
};


const CHALLENGE_THEMES = {
    diet:     { text: '#6048E6', box: '#6048E6', checkedBg: '#6048E6', checkMark: '#fff' },
    calories: { text: '#fff',    box: '#fff',    checkedBg: '#fff',    checkMark: '#1FA97F' },
    mind:     { text: '#F59E0B', box: '#F59E0B', checkedBg: '#F59E0B', checkMark: '#fff' },
} as const;

type ChallengeTheme = (typeof CHALLENGE_THEMES)[keyof typeof CHALLENGE_THEMES];

// ── Teal brand tokens for the Health Profile card + drawer ────────────────────
const TEAL_DARK   = '#0E6B57';   // card background (replaces the old brown #3E2A20)
const TEAL_DARKER = '#0A5647';   // drawer background, slightly deeper
const TEAL_MINT   = '#CFF3E4';   // light accent chip background
const TEAL_MINT_TEXT = '#0E6B4F';

// ── OpenWeatherMap Air Pollution API ───────────────────────────────────────────
// Get a free key at https://openweathermap.org/api/air-pollution — replace below.
const OPENWEATHER_API_KEY = '6803c31e9dd15c5bee33800ce26dd683';

// OpenWeatherMap's Air Pollution API returns an index from 1 (Good) to 5 (Very Poor)
const AQI_INFO: Record<number, { label: string; color: string }> = {
    1: { label: 'Good', color: '#4ADE80' },
    2: { label: 'Fair', color: '#A3E635' },
    3: { label: 'Moderate', color: '#FACC15' },
    4: { label: 'Poor', color: '#FB923C' },
    5: { label: 'Very Poor', color: '#F87171' },
};


const services = [
  {
    icon: 'molecule',
    bg: '#B9DDF6',
    color: '#15569A',
    title: 'Doctors',
  },
  {
    icon: 'pill',
    bg: '#E7EABF',
    color: '#C6B74B',
    title: 'Doctoro AI',
  },
  {
    icon: 'clipboard-text-outline',
    bg: '#C6E3E7',
    color: '#42BFC2',
    title: 'Reports',
  },
  {
    icon: 'virus-outline',
    bg: '#E2CCCD',
    color: '#EE555B',
    title: 'Appoinments',
  },
];

const serviceRoutes = {
    Doctors: '/specialist_doc/specialist',
    'Doctoro AI': '/chatbot',
    Reports: '/user_profile?tab=Reports',
    Appoinments: '/user_profile?tab=Doctor%20Bookings',
} as const;

const AVATAR_STORAGE_KEY = 'user_avatar_path';
const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 340);
const DAILY_CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000;

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function Index() {
    const router = useRouter();
    const { user: authUser, setUser, logout, loading: authLoading } = useAuth();
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);
    const [stagedImages, setStagedImages] = useState<Array<{ id: string; uri: string; name: string; mimeType?: string }>>([]);
    const [uploadHistory, setUploadHistory] = useState<string[]>([]);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [analyzingFile, setAnalyzingFile] = useState(false);
    const [reportStatus, setReportStatus] = useState<'none' | 'pending_review' | 'verified' | 'rejected'>('none');
    const [verifiedSummary, setVerifiedSummary] = useState<string | null>(null);
    const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
    const [verifiedByName, setVerifiedByName] = useState<string | null>(null);
    // ── Avatar state ────────────────────────────────────────────────────────
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [latestBooking, setLatestBooking] = useState<UserBooking | null>(null);
    const [healthScore, setHealthScore] = useState<number | null>(null);
    const [healthScoreLoading, setHealthScoreLoading] = useState(false);
    const healthScoreUserRef = useRef<string | null>(null);

    // ── Location + AQI state ───────────────────────────────────────────────
    const [locationName, setLocationName] = useState<string | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [aqi, setAqi] = useState<number | null>(null);
    const [dailyChallenges, setDailyChallenges] = useState<DailyChallenges | null>(null);
    const [dailyChallengesGeneratedAt, setDailyChallengesGeneratedAt] = useState<string | null>(null);
    const [challengeChecks, setChallengeChecks] = useState<Record<string, boolean>>({});
    const [dailyChallengesLoading, setDailyChallengesLoading] = useState(false);
    const [dailyChallengesError, setDailyChallengesError] = useState<string | null>(null);
    const challengeChecksRef = useRef<Record<string, boolean>>({});
    const challengeUserRef = useRef<string | null>(null);

    // ── Profile drawer state ───────────────────────────────────────────────
    const [drawerVisible, setDrawerVisible] = useState(false);
    const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const openDrawer = () => {
        setDrawerVisible(true);
        Animated.parallel([
            Animated.timing(drawerAnim, {
                toValue: 0,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(backdropAnim, {
                toValue: 1,
                duration: 280,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeDrawer = () => {
        Animated.parallel([
            Animated.timing(drawerAnim, {
                toValue: -DRAWER_WIDTH,
                duration: 220,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(backdropAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => setDrawerVisible(false));
    };

    useEffect(() => {
        loadSavedAvatar();
        loadUploadHistory();
    }, []);

    // Fetch location+AQI only after auth is ready (so the JWT token exists)
    useEffect(() => {
        if (!authLoading && authUser?._id) {
            fetchLocationAndAQI();
        }
    }, [authLoading, authUser?._id]);


    const loadUploadHistory = async () => {
        try {
            const stored = await AsyncStorage.getItem('upload_history');
            if (stored) setUploadHistory(JSON.parse(stored));
        } catch { /* silent */ }
    };

    const saveUploadHistory = async (history: string[]) => {
        try {
            await AsyncStorage.setItem('upload_history', JSON.stringify(history));
        } catch { /* silent */ }
    };

    // ── Fetch saved location from DB, then AQI for that location ──────────
    const fetchLocationAndAQI = async () => {
        setLocationLoading(true);
        try {
            // Try fetching the user's saved location from the database first
            const locRes = await authFetch('/api/auth/location');
            if (!locRes.ok) {
                // User hasn't saved a location yet — show a neutral label
                setLocationName('Set your location');
                setAqi(null);
                setLocationLoading(false);
                return;
            }

            const locData = await locRes.json();
            const saved = locData.location;
            const { latitude, longitude } = saved;

            // Use stored city/district/state fields from DB
            const cityLabel =
                saved.city ||
                saved.district ||
                saved.state ||
                'Your area';
            setLocationName(cityLabel);

            // Fetch AQI from OpenWeatherMap's Air Pollution API
            try {
                const res = await fetch(
                    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}`
                );
                const data = await res.json();
                const aqiIndex = data?.list?.[0]?.main?.aqi;
                setAqi(typeof aqiIndex === 'number' ? aqiIndex : null);
            } catch (err) {
                console.warn('[dashboard] Failed to fetch AQI:', err);
                setAqi(null);
            }
        } catch (err) {
            console.warn('[dashboard] Failed to fetch saved location:', err);
            setLocationName('Location unavailable');
            setAqi(null);
        } finally {
            setLocationLoading(false);
        }
    };

    const loadSavedAvatar = async () => {
        try {
            const savedPath = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
            if (savedPath) {
                const file = new File(savedPath);
                if (file.exists) {
                    setAvatarUri(savedPath);
                } else {
                    await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
                }
            }
        } catch (err) {
            console.warn('Failed to load avatar:', err);
        }
    };

    const saveImageLocally = async (tempUri: string) => {
        const filename = tempUri.split('/').pop() as string;
        const avatarsDir = new Directory(Paths.document, 'avatars');

        if (!avatarsDir.exists) {
            avatarsDir.create({ intermediates: true });
        }

        const sourceFile = new File(tempUri);
        const destFile = new File(avatarsDir, filename);

        // if a file already exists at destination, delete it first (copy will throw otherwise)
        if (destFile.exists) {
            destFile.delete();
        }

        sourceFile.copy(destFile);
        return destFile.uri;
    };

    const deleteOldAvatar = async (path: string | null) => {
        if (!path) return;
        try {
            const file = new File(path);
            if (file.exists) {
                file.delete();
            }
        } catch (err) {
            console.warn('Failed to delete old avatar:', err);
        }
    };

    // ── Health Review Modal ─────────────────────────────────────────────────
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [reviewText, setReviewText] = useState<string | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const pickAvatarImage = async () => {
        if (Platform.OS !== 'web') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission required',
                    'We need access to your photos to update your profile picture.'
                );
                return;
            }
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            try {
                await deleteOldAvatar(avatarUri);
                const savedUri = await saveImageLocally(uri);
                setAvatarUri(savedUri);
                await AsyncStorage.setItem(AVATAR_STORAGE_KEY, savedUri);
            } catch (err) {
                console.warn('Failed to save avatar:', err);
                // Fallback: just display without persisting
                setAvatarUri(uri);
            }
        }
    };
    const loadProfile = useCallback(async () => {
        if (authLoading) return;

        if (!authUser?._id) {
            setProfile(null);
            setLoadingProfile(false);
            return;
        }

        setLoadingProfile(true);
        try {
            const hasCompletedOnboarding = await SecureStore.getItemAsync('hasCompletedOnboarding');
            if (!hasCompletedOnboarding) {
                setLoadingProfile(false);
                router.replace('/(auth)/welcome' as any);
                return;
            }

            const res = await authFetch('/api/auth/profile');
            if (!res.ok) throw new Error('Unable to load profile');

            const data = await res.json();
            setProfile(data.profile || data);
            setLoadingProfile(false);
        } catch (error) {
            console.log('[dashboard] Profile load failed:', error);
            setProfile(null);
            setLoadingProfile(false);
        }
    }, [authLoading, authUser?._id, router]);

    useEffect(() => {
        let active = true;
        loadProfile();

        // Refresh once after login so the drawer reflects the newly restored account.
        const refreshTimer = setTimeout(() => {
            if (active) loadProfile();
        }, 2000);

        return () => {
            active = false;
            clearTimeout(refreshTimer);
        };
    }, [loadProfile]);

    // ── Fetch report status ────────────────────────────────────────────────
    const fetchReportStatus = async () => {
        try {
            const res = await authFetch('/api/auth/report-status');
            if (!res.ok) return;
            const data = await res.json();
            setReportStatus(data.reportStatus || 'none');
            setVerifiedSummary(data.verifiedSummary || null);
            setVerifiedAt(data.verifiedAt || null);
            setVerifiedByName(data.verifiedByName || null);
        } catch (e) {
            // Silently fail
        }
    };

    // Fetch status and refresh avatar whenever screen becomes focused
    useFocusEffect(
        useCallback(() => {
            fetchReportStatus();
            loadSavedAvatar();
            fetchLatestBooking();
        }, [])
    );

    const fetchLatestBooking = async () => {
        try {
            const res = await authFetch('/api/bookings/me');
            if (!res.ok) return;
            const bookings: UserBooking[] = await res.json();
            setLatestBooking(bookings.find(booking => booking.status !== 'cancelled') || null);
        } catch (error) {
            console.warn('[dashboard] Failed to fetch upcoming appointment:', error);
        }
    };

    const fetchHealthScore = useCallback(async () => {
        if (authLoading || !authUser?._id) {
            setHealthScore(null);
            return;
        }

        const requestedUserId = String(authUser._id);
        healthScoreUserRef.current = requestedUserId;
        setHealthScoreLoading(true);
        try {
            const res = await authFetch('/api/ai/health-score', {
                method: 'POST',
                body: JSON.stringify({ aqi }),
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                let message = `Health score request failed (${res.status})`;
                try {
                    const errorData = await res.json();
                    message = errorData.message || message;
                } catch {
                    // Keep the HTTP status when the server does not return JSON.
                }
                throw new Error(message);
            }
            const data = await res.json();
            if (healthScoreUserRef.current !== requestedUserId) return;
            if (typeof data.score === 'number') {
                setHealthScore(data.score);
                await AsyncStorage.setItem(
                    `user_health_score_${authUser._id}`,
                    String(data.score),
                );
            } else {
                setHealthScore(null);
            }
        } catch (error) {
            console.warn('[dashboard] Failed to fetch health score:', error);
            setHealthScore(null);
        } finally {
            setHealthScoreLoading(false);
        }
    }, [aqi, authLoading, authUser]);

    useEffect(() => {
        healthScoreUserRef.current = authUser?._id ? String(authUser._id) : null;
        setHealthScore(null);
        if (!authLoading && authUser?._id && !loadingProfile) {
            fetchHealthScore();
        }
    }, [authLoading, authUser?._id, fetchHealthScore, loadingProfile]);

    const requestDailyChallenges = useCallback(async () => {
        if (authLoading || !authUser?._id) return;

        const requestedUserId = String(authUser._id);
        challengeUserRef.current = requestedUserId;
        setDailyChallengesLoading(true);
        setDailyChallengesError(null);
        try {
            const res = await authFetch('/api/ai/daily-challenges', {
                method: 'POST',
                body: JSON.stringify({ aqi }),
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                let message = `Daily challenges request failed (${res.status})`;
                try {
                    const errorData = await res.json();
                    message = errorData.message || message;
                } catch {
                    // Keep the HTTP status when the server does not return JSON.
                }
                throw new Error(message);
            }

            const responseData = await res.json();
            const plan: DailyChallenges = responseData;
            const generatedAt = typeof responseData.generatedAt === 'string'
                && Number.isFinite(Date.parse(responseData.generatedAt))
                ? responseData.generatedAt
                : new Date().toISOString();
            if (challengeUserRef.current !== requestedUserId) return;
            const emptyChecks: Record<string, boolean> = {};
            setDailyChallenges(plan);
            setDailyChallengesGeneratedAt(generatedAt);
            challengeChecksRef.current = emptyChecks;
            setChallengeChecks(emptyChecks);
            await AsyncStorage.setItem(
                `daily_challenges_${requestedUserId}`,
                JSON.stringify({ plan, completed: emptyChecks, generatedAt }),
            );
        } catch (error) {
            if (challengeUserRef.current !== requestedUserId) return;
            console.warn('[dashboard] Failed to fetch daily challenges:', error);
            setDailyChallengesError(error instanceof Error ? error.message : 'Could not load today’s challenges.');
        } finally {
            if (challengeUserRef.current === requestedUserId) {
                setDailyChallengesLoading(false);
            }
        }
    }, [aqi, authLoading, authUser?._id]);

    useEffect(() => {
        if (authLoading || loadingProfile || locationLoading) return;
        if (!authUser?._id) {
            challengeUserRef.current = null;
            return;
        }

        let active = true;
        const userId = String(authUser._id);
        const storageKey = `daily_challenges_${userId}`;
        challengeUserRef.current = userId;

        const loadToday = async () => {
            try {
                const stored = await AsyncStorage.getItem(storageKey);
                if (!active) return;
                setDailyChallenges(null);
                setDailyChallengesGeneratedAt(null);
                setChallengeChecks({});
                challengeChecksRef.current = {};
                setDailyChallengesLoading(true);
                if (stored) {
                    const cached = JSON.parse(stored);
                    const generatedAtMs = Date.parse(cached?.generatedAt || '');
                    const cacheAgeMs = Date.now() - generatedAtMs;
                    if (
                        cached?.plan?.diet
                        && cached?.plan?.calories
                        && Array.isArray(cached?.plan?.innerHealth)
                        && Number.isFinite(generatedAtMs)
                        && cacheAgeMs >= 0
                        && cacheAgeMs < DAILY_CHALLENGE_TTL_MS
                    ) {
                        const completed = cached.completed && typeof cached.completed === 'object' ? cached.completed : {};
                        setDailyChallenges(cached.plan);
                        setDailyChallengesGeneratedAt(cached.generatedAt);
                        challengeChecksRef.current = completed;
                        setChallengeChecks(completed);
                        setDailyChallengesLoading(false);
                        return;
                    }
                    await AsyncStorage.removeItem(storageKey);
                }
                if (active) await requestDailyChallenges();
            } catch (error) {
                if (active) {
                    console.warn('[dashboard] Failed to load daily challenges:', error);
                    await requestDailyChallenges();
                }
            }
        };

        loadToday();
        return () => {
            active = false;
        };
    }, [authLoading, authUser?._id, loadingProfile, locationLoading, requestDailyChallenges]);

    const toggleChallenge = (challengeId: string) => {
        if (!authUser?._id || !dailyChallenges) return;
        const completed = {
            ...challengeChecksRef.current,
            [challengeId]: !challengeChecksRef.current[challengeId],
        };
        challengeChecksRef.current = completed;
        setChallengeChecks(completed);
        AsyncStorage.setItem(
            `daily_challenges_${authUser._id}`,
            JSON.stringify({ plan: dailyChallenges, completed, generatedAt: dailyChallengesGeneratedAt }),
        ).catch(error => console.warn('[dashboard] Failed to save challenge progress:', error));
    };

const renderChallengeToggle = (
    id: string,
    label: string,
    theme: ChallengeTheme,
    amount?: string,
) => {
    const checked = Boolean(challengeChecks[id]);
    return (
        <Pressable
            key={id}
            style={s.challengeItem}
            onPress={() => toggleChallenge(id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={amount ? `${label}, ${amount}` : label}
        >
            <View
                style={[
                    s.challengeCheckbox,
                    { borderColor: theme.box },
                    checked && { backgroundColor: theme.checkedBg },
                ]}
            >
                {checked && <Ionicons name="checkmark" size={11} color={theme.checkMark} />}
            </View>
            <View style={s.challengeItemCopy}>
                <Text style={[s.challengeItemLabel, { color: theme.text }]} numberOfLines={3}>
                    {label}
                </Text>
                {amount ? (
                    <Text style={[s.challengeAmount, { color: theme.text }]}>{amount}</Text>
                ) : null}
            </View>
        </Pressable>
    );
};

    // Listen to real-time status updates via Socket.IO
    useEffect(() => {
        let active = true;
        let localSocket: any = null;

        const setupSocket = async () => {
            try {
                const socket = await connectWithSocket();
                if (!active) return;
                localSocket = socket;

                socket.on('reportStatusUpdate', (data: {
                    reportStatus: 'none' | 'pending_review' | 'verified' | 'rejected';
                    verifiedSummary: string | null;
                    verifiedAt: string | null;
                    verifiedByName: string | null;
                }) => {
                    console.log('[dashboard] socket reportStatusUpdate received:', data);
                    setReportStatus(data.reportStatus);
                    setVerifiedSummary(data.verifiedSummary);
                    setVerifiedAt(data.verifiedAt);
                    setVerifiedByName(data.verifiedByName);

                    if (data.reportStatus === 'verified') {
                        Alert.alert('✅ Report Verified', `Your medical report has been verified by Dr. ${data.verifiedByName || 'in-house doctor'}.`);
                    } else if (data.reportStatus === 'rejected') {
                        Alert.alert('❌ Report Rejected', 'Your medical report requires re-submission.');
                    }
                });
            } catch (err) {
                console.warn('[dashboard] Socket connection failed:', err);
            }
        };

        if (authUser) {
            setupSocket();
        }

        return () => {
            active = false;
            if (localSocket) {
                localSocket.off('reportStatusUpdate');
            }
        };
    }, [authUser]);
    const isPremium = authUser?.isPremium;

    const user = {
        name: profile?.name || authUser?.name || 'NULL',
        age: profile?.age || 'NULL',
        weight: profile?.weight ? `${profile.weight} ${profile.weightUnit || 'kg'}` : 'NULL',
        height: profile?.height ? `${profile.height} cm` : 'NULL',
        conditions: profile?.conditions?.length ? profile.conditions.join(', ') : 'None reported',
        medications: profile?.medications || 'None reported',
        avatar: avatarUri,
    };

    // ── Derived display values for the Health Profile Card ────────────────
    const firstName = user.name.split(' ')[0];
    const aqiInfo = aqi ? AQI_INFO[aqi] : null;
    // Real signal instead of a placeholder number — badges up when there's
    // something the user actually needs to look at.
    const notificationCount =
        reportStatus === 'pending_review' ? 1 : reportStatus === 'rejected' ? 1 : 0;

    // ── File upload & Image document capture ────────────────────────────────
    // Option 1: Document Picker (PDF / Text file)
    const handleSelectFile = async () => {
        if (analyzingFile) return;

        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'text/plain'],
            copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setSelectedFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType });
            setStagedImages([]); // Clear images if switching to single document
        }
    };

    // Option 2: Camera Capture (scan document pages one by one)
    const handleCaptureCamera = async () => {
        if (analyzingFile) return;
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Camera Permission', 'Camera permission is required to capture document pages.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                quality: 0.85,
                allowsEditing: false,
            });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                const pageNum = stagedImages.length + 1;
                const newPage = {
                    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    uri: asset.uri,
                    name: asset.fileName || `doc_page_${pageNum}.jpg`,
                    mimeType: asset.mimeType || 'image/jpeg',
                };
                setSelectedFile(null); // Clear single file
                setStagedImages(prev => [...prev, newPage]);
            }
        } catch (err: any) {
            console.error('Camera capture error:', err);
            Alert.alert('Camera Error', 'Could not open camera: ' + (err.message || 'Unknown error'));
        }
    };

    // Option 3: Gallery Picker (select multiple document pages)
    const handlePickGallery = async () => {
        if (analyzingFile) return;
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Gallery Permission', 'Photo library access is required to select document images.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.85,
                selectionLimit: 10,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newPages = result.assets.map((asset, idx) => ({
                    id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 9)}`,
                    uri: asset.uri,
                    name: asset.fileName || `doc_page_${stagedImages.length + idx + 1}.jpg`,
                    mimeType: asset.mimeType || 'image/jpeg',
                }));
                setSelectedFile(null); // Clear single file
                setStagedImages(prev => [...prev, ...newPages]);
            }
        } catch (err: any) {
            console.error('Gallery pick error:', err);
            Alert.alert('Gallery Error', 'Could not pick images: ' + (err.message || 'Unknown error'));
        }
    };

    const handleRemoveStagedPage = (id: string) => {
        if (analyzingFile) return;
        setStagedImages(prev => prev.filter(img => img.id !== id));
    };

    const handleClearAllStaged = () => {
        if (analyzingFile) return;
        setSelectedFile(null);
        setStagedImages([]);
    };

    // Upload & Bundle handler
    const handleUploadFile = async () => {
        const hasSingleFile = !!selectedFile;
        const hasImages = stagedImages.length > 0;
        if ((!hasSingleFile && !hasImages) || analyzingFile) return;

        setAnalyzingFile(true);

        try {
            const formData = new FormData();
            let historyLabel = '';

            if (hasSingleFile && selectedFile) {
                setUploadedFile(selectedFile.name);
                historyLabel = selectedFile.name;
                const localUri = Platform.OS === 'ios' ? selectedFile.uri.replace('file://', '') : selectedFile.uri;
                const blobResponse = await fetch(localUri);
                const blob = await blobResponse.blob();
                formData.append('files', blob, selectedFile.name || 'report.pdf');
            } else if (hasImages) {
                const bundleName = `Document_${stagedImages.length}_Pages.pdf`;
                setUploadedFile(bundleName);
                historyLabel = bundleName;

                for (let i = 0; i < stagedImages.length; i++) {
                    const item = stagedImages[i];
                    const localUri = Platform.OS === 'ios' ? item.uri.replace('file://', '') : item.uri;
                    const blobResponse = await fetch(localUri);
                    const blob = await blobResponse.blob();
                    formData.append('files', blob, item.name || `page_${i + 1}.jpg`);
                }
            }

            const res = await authFetch('/api/auth/upload-report', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Analysis failed');

            const savedName = data.fileName || historyLabel;
            const newHistory = [savedName, ...uploadHistory.filter(f => f !== savedName)].slice(0, 10);
            setUploadHistory(newHistory);
            saveUploadHistory(newHistory);

            setSelectedFile(null);
            setStagedImages([]);

            Alert.alert(
                '📤 Report Sent for Review',
                'Your medical report was bundled and analyzed by our AI and has been sent to the In-House Doctor for verification. You will see the results once approved.',
            );
            fetchReportStatus();
        } catch (error: any) {
            console.error('Report analysis error:', error);
            Alert.alert('❌ Analysis Failed', error.message || 'Unable to parse and analyze report.');
        } finally {
            setAnalyzingFile(false);
        }
    };

    // ── Health Review ──────────────────────────────────────────────────────
    const handleCheckReview = async () => {
        setReviewText(null);
        setReviewLoading(true);
        setReviewModalVisible(true);
        try {
            const res = await authFetch('/api/ai/health-review', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Could not generate review');
            setReviewText(data.review);
        } catch (err: any) {
            setReviewModalVisible(false);
            Alert.alert('❌ Error', err.message || 'Failed to generate health review.');
        } finally {
            setReviewLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive',
                onPress: async () => {
                    try {
                        closeDrawer();
                        await logout();
                        router.replace('/(auth)/login');
                    } catch {
                        Alert.alert('Error', 'Failed to logout');
                    }
                },
            },
        ]);
    };

    const handleUpgrade = async () => {
        try {
            const res = await authFetch('/api/user/upgrade', { method: 'POST' });
            if (!res.ok) throw new Error('Upgrade failed');
            const data = await res.json();
            Alert.alert('Success', data.message);
            const profileRes = await authFetch('/api/auth/profile');
            const profileData = await profileRes.json();
            if (authUser) {
                setUser({ ...authUser, isPremium: profileData.userId?.isPremium || data.isPremium });
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    if (loadingProfile) {
        return (
            <View style={s.loadingScreen}>
                <ActivityIndicator size="large" color="#2A4DD0" />
                <Text style={s.loadingText}>Preparing your health dashboard...</Text>
            </View>
        );
    }

    // ─────────────────────── Render ──────────────────────────────────────────
    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F0F4FF" />

            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
            >

                {/* ══════════════ HEALTH PROFILE CARD — minimal, teal ═══════════════ */}
                <View style={s.healthCard}>
                    <View style={s.greetingRow}>
                                                <TouchableOpacity
                            style={s.hamburgerBtn}
                            activeOpacity={0.7}
                            onPress={openDrawer}
                            accessibilityRole="button"
                            accessibilityLabel="Open profile"
                        >
                            <Ionicons name="menu" size={22} color="#fff" />
                        </TouchableOpacity>
                        {/* <TouchableOpacity
                            style={s.healthAvatarWrap}
                            activeOpacity={0.85}
                            onPress={openDrawer}
                        >
                            {user.avatar ? (
                                <Image source={{ uri: user.avatar }} style={s.healthAvatar} />
                            ) : (
                                <View style={s.healthAvatarPlaceholder}>
                                    <MaterialCommunityIcons name="account" size={30} color="#0E6B57" />
                                </View>
                            )}
                        </TouchableOpacity> */}

                        <Text style={s.greetingText} numberOfLines={1}>👋Hi, {firstName}</Text>
                    </View>

                    <View style={s.locationRow}>
                        <Ionicons name="location-sharp" size={14} color="#BFE8DB" />
                        {locationLoading ? (
                            <ActivityIndicator size="small" color="#BFE8DB" style={{ marginLeft: 6 }} />
                        ) : (
                            <Text style={s.locationText} numberOfLines={1}>
                                Location: <Text style={s.locationValue}>{locationName || 'Unavailable'}</Text>
                                {aqiInfo && (
                                    <Text style={s.locationAqi}>
                                        {'  '}(AQI: <Text style={{ color: aqiInfo.color, fontWeight: '800' }}>{aqiInfo.label}</Text>)
                                    </Text>
                                )}
                            </Text>
                        )}
                    </View>
                </View>

                {/* ══════════════ Doctor SECTION ═══════════════════ */}
                {/* <View style={s.container_doc}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.scrollContent_doc}
                    >
                        {specialties.map((item) => (
                            <Pressable
                                key={item.name}
                                style={({ pressed }) => [
                                    s.specialtyButton,
                                    pressed && s.pressed,
                                ]}
                                onPress={() => {
                                    console.log('Selected:', item.name);
                                }}
                            >
                                <Image source={{ uri: item.image }} style={s.doctorImage} />
                                <Text style={s.specialtyText}>{item.name}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View> */}

                {latestBooking && (
                    <View style={s.container_app}>
                        <Text style={s.heading}>Upcoming Appointment</Text>

                        <View style={s.appointmentCard}>
                            <View style={s.doctorRow}>
                                <View style={s.appointmentAvatar}>
                                    <MaterialCommunityIcons name="doctor" size={24} color="#fff" />
                                </View>

                                <View style={s.doctorInfo}>
                                    <Text style={s.doctorName}>{latestBooking.doctorName}</Text>
                                    <Text style={s.specialization}>
                                        {latestBooking.specialty || 'Doctor consultation'}
                                        {latestBooking.doctorDegrees?.length
                                            ? ` • ${latestBooking.doctorDegrees.join(', ')}`
                                            : ''}
                                    </Text>
                                </View>
                            </View>

                            <View style={s.detailsContainer}>
                                <View style={s.detailItem}>
                                    <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#fff" />
                                    <Text style={s.detailText}>{latestBooking.date}</Text>
                                </View>

                                <View style={s.divider} />

                                <View style={s.detailItem}>
                                    <MaterialCommunityIcons name="clock-outline" size={20} color="#fff" />
                                    <Text style={s.detailText}>{latestBooking.slot}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* ══════════════ SERVICES SECTION ═══════════════════ */}
                {/* <View style={s.container}>
                    <Text style={s.title}>Services</Text>

                    <View style={s.servicesRow}>
                        {services.map((service, index) => (
                            <Pressable
                                key={index}
                                style={(s as any).serviceItem || { alignItems: 'center' }}
                                onPress={() => router.push((serviceRoutes as any)[service.title])}
                                accessibilityRole="button"
                                accessibilityLabel={service.title}
                            >
                                <View style={[s.serviceCard, { backgroundColor: service.bg }]}>
                                    <MaterialCommunityIcons
                                        name={service.icon as any}
                                        size={40}
                                        color={service.color}
                                    />
                                    {index === 2 && (
                                        <View style={s.check}>
                                            <MaterialCommunityIcons name="check" size={14} color="#42BFC2" />
                                        </View>
                                    )}
                                </View>
                                <Text style={s.serviceText}>{service.title}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View> */}

                {/* ══════════════ TODAY'S CHALLENGES ════════════════════════ */}
                <View style={s.dailyChallengesSection}>
                    <View style={s.dailyChallengesHeader}>
                        <Text style={s.dailyChallengesTitle}>Today&apos;s Challenges</Text>
                        {dailyChallengesLoading && <ActivityIndicator size="small" color="#1FA97F" />}
                    </View>
                    <Text style={s.dailyChallengesNote}>AI-personalized daily estimates, not medical advice.</Text>

                    {dailyChallengesError && !dailyChallenges && (
                        <TouchableOpacity
                            style={s.challengeRetry}
                            onPress={() => requestDailyChallenges()}
                            disabled={dailyChallengesLoading}
                            activeOpacity={0.8}
                        >
                            <Text style={s.challengeRetryText}>Couldn&apos;t load challenges. Tap to retry</Text>
                            <Text style={s.challengeRetryDetail} numberOfLines={3}>
                                {dailyChallengesError}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {dailyChallenges && (
                        <View style={s.challengeColumns}>
                            <View style={[s.challengeColumn, s.challengeDietColumn]}>
                                <Text style={s.challengeColumnTitle}>Diet</Text>
{DIET_CHALLENGES.map(item => (
    renderChallengeToggle(
        `diet-${item.id}`,
        item.label,
        CHALLENGE_THEMES.diet,
        `${dailyChallenges.diet[item.key]} g`,
    )
))}
                            </View>

                            <View style={[s.challengeColumn, s.challengeCaloriesColumn]}>
                                <Text style={s.challengeColumnTitle_green}>Calories</Text>
{renderChallengeToggle(
    'calories-intake',
    'Daily intake',
    CHALLENGE_THEMES.calories,
    `${dailyChallenges.calories.intakeKcal} kcal`,
)}
{renderChallengeToggle(
    'calories-burn',
    'Activity burn',
    CHALLENGE_THEMES.calories,
    `${dailyChallenges.calories.burnKcal} kcal`,
)}
                            </View>

                            <View style={[s.challengeColumn, s.challengeMindColumn]}>
                                <Text style={s.challengeColumnTitle_orange}>Inner Health (Mental)</Text>
                                {dailyChallenges.innerHealth.map(item =>
    renderChallengeToggle(item.id, item.label, CHALLENGE_THEMES.mind)
)}
                            </View>
                        </View>
                    )}
                </View>

                {/* ══════════════ LLM PROFILE CARD REVIEW ═══════════════════ */}
                <View style={s.healthCardreview}>
                    <Text style={s.healthCardLLMTitle}>Looking For Health Review?</Text>
                    <Text style={s.healthCardLLMSubTitle}>
                        Get your health review in just one click using the vitals given by you.
                    </Text>
                    <TouchableOpacity
                        style={s.buyLLMButton}
                        activeOpacity={0.85}
                        onPress={handleCheckReview}
                    >
                        <Text style={s.buyLLMButtonText}>CHECK REVIEW</Text>
                    </TouchableOpacity>
                </View>

                {/* ══════════════ UPLOAD CARD ════════════════════════════ */}
                <View style={s.uploadCard}>
                    <View style={s.uploadIconCircle}>
                        {analyzingFile ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="cloud-upload" size={28} color="#fff" />
                        )}
                    </View>
                    <Text style={s.uploadTitle}>
                        {analyzingFile ? 'AI Analyzing & Bundling Document...' : 'Upload Medical Report'}
                    </Text>
                    <Text style={s.uploadSub}>
                        {analyzingFile
                            ? 'Our medical AI is bundling pages into a unified document and extracting clinical findings.'
                            : stagedImages.length > 0
                                ? `${stagedImages.length} page${stagedImages.length > 1 ? 's' : ''} staged. These will be bundled into one document and analyzed by AI.`
                                : selectedFile
                                    ? 'PDF file staged. Tap upload to send for AI analysis.'
                                    : 'Upload a PDF, or scan/pick multiple document pages using Camera or Gallery.'}
                    </Text>

                    {/* Staged Single PDF file preview */}
                    {selectedFile && !analyzingFile && (
                        <View style={s.uploadedBadge}>
                            <Ionicons name="document-text" size={14} color="#1FA97F" />
                            <Text style={s.uploadedText} numberOfLines={1}>{selectedFile.name}</Text>
                        </View>
                    )}

                    {/* Staged Camera/Gallery Multi-Image preview */}
                    {stagedImages.length > 0 && !analyzingFile && (
                        <View style={{ width: '100%', alignItems: 'center' }}>
                            <View style={s.uploadedBadge}>
                                <Ionicons name="documents-outline" size={14} color="#1FA97F" />
                                <Text style={s.uploadedText}>
                                    {stagedImages.length} Page{stagedImages.length > 1 ? 's' : ''} Staged (Bundles into 1 PDF)
                                </Text>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={s.stagedPagesScroll}
                                contentContainerStyle={s.stagedPagesContainer}
                            >
                                {stagedImages.map((page, idx) => (
                                    <View key={page.id} style={s.pageThumbCard}>
                                        <Image source={{ uri: page.uri }} style={s.pageThumbImg} />
                                        <View style={s.pageThumbBadge}>
                                            <Text style={s.pageThumbBadgeText}>Page {idx + 1}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={s.pageRemoveBtn}
                                            onPress={() => handleRemoveStagedPage(page.id)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close-circle" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={s.addMoreCard}
                                    onPress={handleCaptureCamera}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="camera-outline" size={20} color="#1FA97F" />
                                    <Text style={s.addMoreCardText}>+ Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.addMoreCard}
                                    onPress={handlePickGallery}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="images-outline" size={20} color="#1FA97F" />
                                    <Text style={s.addMoreCardText}>+ Gallery</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            <View style={s.imageActionsRow}>
                                <TouchableOpacity
                                    style={s.secondaryActionBtn}
                                    onPress={handleCaptureCamera}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="camera" size={14} color="#1FA97F" />
                                    <Text style={s.secondaryActionText}>+ Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.secondaryActionBtn}
                                    onPress={handlePickGallery}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="images" size={14} color="#1FA97F" />
                                    <Text style={s.secondaryActionText}>+ Gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.clearActionBtn}
                                    onPress={handleClearAllStaged}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                    <Text style={s.clearActionText}>Clear</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={s.bundleUploadBtn}
                                onPress={handleUploadFile}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="cloud-upload" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={s.selectFileText}>
                                    Bundle & Upload ({stagedImages.length} Page{stagedImages.length > 1 ? 's' : ''})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Single PDF action buttons */}
                    {selectedFile && !analyzingFile && (
                        <View style={s.uploadTwoActions}>
                            <TouchableOpacity
                                style={s.changFileBtn}
                                onPress={handleSelectFile}
                                activeOpacity={0.8}
                            >
                                <Text style={s.changeFileText}>Change</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.uploadThisFileBtn}
                                onPress={handleUploadFile}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={s.selectFileText}>Upload This File</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Initial 3 options when nothing is selected */}
                    {!selectedFile && stagedImages.length === 0 && !analyzingFile && (
                        <View style={s.uploadOptionsRow}>
                            <TouchableOpacity
                                style={s.uploadChoiceBtn}
                                onPress={handleCaptureCamera}
                                activeOpacity={0.85}
                            >
                                <View style={s.uploadChoiceIconBox}>
                                    <Ionicons name="camera" size={20} color="#1FA97F" />
                                </View>
                                <Text style={s.uploadChoiceLabel}>Camera</Text>
                                <Text style={s.uploadChoiceSub}>Scan Pages</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.uploadChoiceBtn}
                                onPress={handlePickGallery}
                                activeOpacity={0.85}
                            >
                                <View style={s.uploadChoiceIconBox}>
                                    <Ionicons name="images" size={20} color="#1FA97F" />
                                </View>
                                <Text style={s.uploadChoiceLabel}>Gallery</Text>
                                <Text style={s.uploadChoiceSub}>Multi-Select</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.uploadChoiceBtn}
                                onPress={handleSelectFile}
                                activeOpacity={0.85}
                            >
                                <View style={s.uploadChoiceIconBox}>
                                    <Ionicons name="document-text" size={20} color="#1FA97F" />
                                </View>
                                <Text style={s.uploadChoiceLabel}>PDF File</Text>
                                <Text style={s.uploadChoiceSub}>Choose File</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Analyzing progress indicator */}
                    {analyzingFile && (
                        <View style={s.analyzingProgressBox}>
                            <ActivityIndicator size="small" color="#1FA97F" style={{ marginRight: 10 }} />
                            <Text style={s.analyzingProgressText}>Bundling pages & analyzing report with AI...</Text>
                        </View>
                    )}
                </View>

                {/* ══════════════ UPLOAD HISTORY ═══════════════════════════ */}
                {uploadHistory.length > 0 && (
                    <View style={s.historyCard}>
                        <View style={s.historyHeader}>
                            <Ionicons name="time-outline" size={16} color="#1FA97F" />
                            <Text style={s.historyTitle}>Previous Uploads</Text>
                        </View>
                        {uploadHistory.map((filename, idx) => (
                            <View key={idx} style={s.historyItem}>
                                <Ionicons name="checkmark-circle" size={15} color="#22c55e" />
                                <Text style={s.historyItemText} numberOfLines={1}>{filename}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ══════════════ REPORT STATUS CARD ════════════════════ */}
                {reportStatus === 'pending_review' && (
                    <View style={s.pendingCard}>
                        <View style={s.pendingCardLeft} />
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <ActivityIndicator size="small" color="#F59E0B" />
                                <Text style={s.pendingCardTitle}>Awaiting Doctor Verification</Text>
                            </View>
                            <Text style={s.pendingCardSub}>
                                Your AI-analyzed report has been sent to the In-House Doctor for review. Results will appear here once verified.
                            </Text>
                        </View>
                    </View>
                )}

                {reportStatus === 'verified' && verifiedSummary && (
                    <View style={s.verifiedCardWrapper}>
                        <View style={s.verifiedCard}>
                            <View style={s.verifiedBadge}>
                                <Ionicons name="shield-checkmark" size={14} color="#fff" />
                                <Text style={s.verifiedBadgeText}>Verified by Doctor</Text>
                            </View>
                            {verifiedByName && (
                                <Text style={s.verifiedByText}>Reviewed by Dr. {verifiedByName}</Text>
                            )}
                            {verifiedAt && (
                                <Text style={s.verifiedDateText}>
                                    {new Date(verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </Text>
                            )}
                            <View style={s.verifiedDivider} />
                            <Text style={s.verifiedSummaryTitle}>📋 Health Report Summary</Text>
                            <Text style={s.verifiedSummaryText}>{verifiedSummary}</Text>
                        </View>
                        {!isPremium && (
                            <PremiumOverlay
                                title={'Unlock Your Full\nHealth Report'}
                                bullets={[
                                    '✦  Complete AI-analyzed report details',
                                    '✦  Doctor verified findings & warnings',
                                    '✦  Personalized specialist referrals',
                                    '✦  Download & share your health summary',
                                ]}
                                height={290}
                                style={s.verifiedOverlay}
                            />
                        )}
                    </View>
                )}

                {reportStatus === 'rejected' && (
                    <View style={[s.pendingCard, { borderLeftColor: '#ef4444' }]}>
                        <View style={[s.pendingCardLeft, { backgroundColor: '#ef4444' }]} />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.pendingCardTitle, { color: '#ef4444' }]}>Report Not Approved</Text>
                            <Text style={s.pendingCardSub}>
                                The doctor reviewed your report and it requires re-submission. Please upload a clearer document.
                            </Text>
                        </View>
                    </View>
                )}

                {/* ══════════════ IN-HOUSE DOCTOR CARD (Premium Only) ════════ */}
                {isPremium && (
                    <View style={s.assignedDoctorCard}>
                        <View style={s.assignedDoctorHeader}>
                            <View style={s.assignedDoctorIconBox}>
                                <MaterialCommunityIcons name="stethoscope" size={26} color="#6048E6" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={s.assignedDoctorBadge}>
                                    <MaterialCommunityIcons name="crown" size={10} color="#F59E0B" />
                                    <Text style={s.assignedDoctorBadgeText}>PREMIUM BENEFIT</Text>
                                </View>
                                <Text style={s.assignedDoctorTitle}>In-House Doctor Assigned</Text>
                                <Text style={s.assignedDoctorSub}>
                                    You have been assigned a dedicated in-house doctor who will review and verify your medical reports.
                                </Text>
                            </View>
                        </View>

                        <View style={s.assignedDoctorDivider} />

                        <View style={s.assignedDoctorActions}>
                            <TouchableOpacity
                                style={[s.docActionBtn, { backgroundColor: '#D8D0FF' }]}
                                onPress={() => router.push('/chat')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="chat-processing-outline" size={22} color="#6048E6" />
                                <Text style={[s.docActionBtnText, { color: '#6048E6' }]}>Chat</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[s.docActionBtn, { backgroundColor: '#1FA97F' }]}
                                onPress={() => Alert.alert('Video Call', 'Connecting to your In-House Doctor...\n\nThis feature will be available soon.')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="video-outline" size={22} color="#fff" />
                                <Text style={[s.docActionBtnText, { color: '#fff' }]}>Video Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[s.docActionBtn, { backgroundColor: '#FFFBEB' }]}
                                onPress={() => Alert.alert('Prescription', 'Your doctor will send prescriptions here after reviewing your report.')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="prescription" size={22} color="#F59E0B" />
                                <Text style={[s.docActionBtnText, { color: '#F59E0B' }]}>Prescription</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ height: 24 }} />
            </ScrollView>

            {/* ═══════════════ PROFILE DRAWER — hamburger opens this ═══════════════ */}
            <Modal
                visible={drawerVisible}
                transparent
                animationType="none"
                onRequestClose={closeDrawer}
            >
                <View style={{ flex: 1, flexDirection: 'row' }}>
                    <Animated.View
                        style={[s.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: drawerAnim }] }]}
                    >
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.drawerContent}>
                            <TouchableOpacity style={s.drawerCloseBtn} onPress={closeDrawer} activeOpacity={0.7}>
                                <Ionicons name="close" size={20} color="#fff" />
                            </TouchableOpacity>

                            {/* Profile photo on top */}
                            <TouchableOpacity
                                style={s.drawerAvatarWrap}
                                activeOpacity={0.85}
                                onPress={pickAvatarImage}
                            >
                                {user.avatar ? (
                                    <Image source={{ uri: user.avatar }} style={s.drawerAvatar} />
                                ) : (
                                    <View style={s.drawerAvatarPlaceholder}>
                                        <MaterialCommunityIcons name="account" size={44} color="#0E6B57" />
                                    </View>
                                )}
                                <View style={s.drawerAvatarEditDot}>
                                    <Ionicons name="camera" size={12} color="#0E6B57" />
                                </View>
                            </TouchableOpacity>

                            <Text style={s.drawerName}>{user.name}</Text>
                            <Text style={s.drawerMemberLabel}>MEMBER · ACTIVE PROFILE</Text>

                            {/* Health score */}
                            <View style={s.drawerScoreBox}>
                                <View style={s.drawerScoreHeader}>
                                    <Text style={s.drawerScoreLabel}>HEALTH SCORE</Text>
                                    <TouchableOpacity
                                        style={s.drawerScoreRefresh}
                                        onPress={() => fetchHealthScore()}
                                        disabled={healthScoreLoading}
                                        accessibilityRole="button"
                                        accessibilityLabel="Refresh health score"
                                    >
                                        <Ionicons
                                            name="refresh"
                                            size={16}
                                            color={healthScoreLoading ? '#75B6A4' : '#fff'}
                                        />
                                    </TouchableOpacity>
                                </View>
                                {healthScoreLoading ? (
                                    <ActivityIndicator size="small" color="#fff" style={s.drawerScoreLoading} />
                                ) : (
                                    <Text style={s.drawerScoreValue}>
                                        {healthScore ?? '--'}<Text style={s.drawerScoreOutOf}> / 100</Text>
                                    </Text>
                                )}
                            </View>

                            {/* Vitals */}
                            <View style={s.drawerVitalsCard}>
                                {loadingProfile ? (
                                    <ActivityIndicator size="small" color="#0E6B57" style={s.drawerVitalsLoading} />
                                ) : (
                                    <>
                                        <DrawerVitalRow icon="calendar-blank-outline" label="Age" value={String(user.age)} />
                                        <DrawerVitalRow icon="water" label="Blood group" value={profile?.bloodType || 'Not recorded'} />
                                        <DrawerVitalRow icon="scale-bathroom" label="Weight" value={user.weight} />
                                        <DrawerVitalRow icon="human-male-height" label="Height" value={user.height} />
                                        <DrawerVitalRow icon="alert-circle-outline" label="Conditions" value={user.conditions} />
                                        <DrawerVitalRow icon="pill" label="Medications" value={user.medications} last />
                                    </>
                                )}
                            </View>

                            <TouchableOpacity style={s.drawerLogoutBtn} activeOpacity={0.85} onPress={handleLogout}>
                                <Ionicons name="log-out-outline" size={16} color="#fff" />
                                <Text style={s.drawerLogoutText}>Logout</Text>
                            </TouchableOpacity>

                            {isPremium ? (
                                <View style={s.drawerAfterPremium}>
                                    <MaterialCommunityIcons name="check-decagram" size={18} color="#0E6B57" />
                                    <Text style={s.afterPremiumText}>
                                        Dr. Apna Doctoro has been assigned to you as in-house doctor.
                                    </Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={s.drawerPremiumButton}
                                    activeOpacity={0.85}
                                    onPress={handleUpgrade}
                                >
                                    <Text style={s.buyLLMButtonText}>Mock Buy Premium</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </Animated.View>

                    <Animated.View style={[s.drawerBackdrop, { opacity: backdropAnim }]}>
                        <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
                    </Animated.View>
                </View>
            </Modal>

            {/* ═══════════════ HEALTH REVIEW MODAL ═══════════════════════ */}
            <Modal
                visible={reviewModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setReviewModalVisible(false)}
            >
                <Pressable style={s.modalBackdrop} onPress={() => setReviewModalVisible(false)}>
                    <Pressable style={s.modalCard} onPress={() => { }}>
                        <View style={s.modalHeader}>
                            <View style={s.modalIconWrap}>
                                <MaterialCommunityIcons name="heart-pulse" size={22} color="#6048E6" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.modalTitle}>Your Health Review</Text>
                                <Text style={s.modalSubTitle}>Powered by Apna Doctoro AI</Text>
                            </View>
                            <TouchableOpacity
                                style={s.modalCloseBtn}
                                onPress={() => setReviewModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close" size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={s.modalDivider} />

                        <ScrollView
                            style={s.modalBody}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 8 }}
                        >
                            {reviewLoading ? (
                                <View style={s.modalLoadingWrap}>
                                    <ActivityIndicator size="large" color="#6048E6" />
                                    <Text style={s.modalLoadingText}>Analysing your vitals...</Text>
                                </View>
                            ) : (
                                <Text style={s.modalReviewText}>{reviewText}</Text>
                            )}
                        </ScrollView>

                        {!isPremium && (
                            <View style={s.modalPremiumBanner}>
                                <MaterialCommunityIcons name="crown" size={16} color="#F59E0B" />
                                <Text style={s.modalPremiumText}>Buy Premium to Unlock Advanced AI</Text>
                                <TouchableOpacity
                                    style={s.modalPremiumBtn}
                                    activeOpacity={0.85}
                                    onPress={() => { setReviewModalVisible(false); handleUpgrade(); }}
                                >
                                    <Text style={s.modalPremiumBtnText}>Upgrade</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

        </View>
    );
}

// ─────────────────────── Drawer vital row sub-component ──────────────────────
function DrawerVitalRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
    return (
        <View style={[s.drawerVitalRow, !last && s.drawerVitalRowBorder]}>
            <View style={s.drawerVitalIconBox}>
                <MaterialCommunityIcons name={icon as any} size={16} color="#0E6B57" />
            </View>
            <Text style={s.drawerVitalLabel}>{label}</Text>
            <Text style={s.drawerVitalValue} numberOfLines={2}>{value}</Text>
        </View>
    );
}

// ─────────────────────────── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F6F2E7' },
    loadingScreen: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#F4F7FF', padding: 24,
    },
    loadingText: { marginTop: 12, fontSize: 15, color: '#475569', fontWeight: '600' },
    scroll: { paddingHorizontal: 0, paddingBottom: 100 },

    // ── Quick Actions Row (unchanged, unused elsewhere but left intact) ─────
    quickActionsRow: { flexDirection: 'row', gap: 12, marginHorizontal: '3.5%', marginBottom: 18 },
    quickActionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 12,
    },
    quickActionLabel: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },

    container: { paddingHorizontal: 14, paddingTop: 25, paddingBottom: 40 },
    title: { fontSize: 23, lineHeight: 42, color: '#000', marginBottom: 10 },
    servicesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    serviceCard: { width: 64, height: 64, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    serviceText: { marginTop: 9, fontSize: 13, fontWeight: '600', color: '#17284D', textAlign: 'center' },
    check: { position: 'absolute', right: 25, bottom: 25 },
    dailyChallengesSection: { width: '94%', alignSelf: 'center', marginTop: 20, marginBottom: 7 },
    dailyChallengesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dailyChallengesTitle: {fontSize: 23, fontWeight: '600', color: '#17284D' },
    dailyChallengesNote: { fontSize: 11, lineHeight: 16, color: '#64748B', marginTop: 3, marginBottom: 10 },
    challengeColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
    challengeColumn: {
        width: '32%', minHeight: 180, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 10,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5ECE8',
    },
    challengeDietColumn: { backgroundColor: '#D8D0FF', color: '#6048E6' },
    challengeCaloriesColumn: { backgroundColor: '#1FA97F'},
    challengeMindColumn: { backgroundColor: '#FFFBEB' },

    challengeColumnTitle: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: '#6048E6', minHeight: 28, marginBottom: 6 },
    challengeColumnTitle_green: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: '#fff', minHeight: 28, marginBottom: 6 },
    challengeColumnTitle_orange: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: '#F59E0B', minHeight: 28, marginBottom: 6 },
    
    challengeItem: { minHeight: 36, flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingVertical: 4 },
    challengeCheckbox: {
        width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#6048E6',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
    },
    challengeCheckboxChecked: { backgroundColor: '#1FA97F', borderColor: '#1FA97F' },
    challengeItemCopy: { flex: 1, minWidth: 0 },
    challengeItemLabel: { fontSize: 10, lineHeight: 13, color: '#334155', fontWeight: '600' },
    challengeAmount: { fontSize: 10, lineHeight: 13, color: '#0E6B57', fontWeight: '800', marginTop: 1 },
    challengeRetry: { alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#EAF5EF', borderRadius: 8 },
    challengeRetryText: { fontSize: 12, color: '#0E6B57', fontWeight: '700' },
    challengeRetryDetail: { fontSize: 11, lineHeight: 15, color: '#475569', marginTop: 4 },

    container_doc: { width: '100%', paddingVertical: 5, marginTop: 20 },
    scrollContent_doc: { paddingHorizontal: 15, gap: 10 },
    specialtyButton: {
        height: 55, minWidth: 150, paddingLeft: 7, paddingRight: 18,
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F2E7',
        borderWidth: 1, borderColor: '#9BB167', borderRadius: 35,
    },
    doctorImage: { width: 35, height: 35, borderRadius: 27, backgroundColor: '#E9EEF0' },
    specialtyText: { marginLeft: 10, fontSize: 16, fontWeight: '500', color: '#171717' },
    pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },

    // ── LLM review card (unchanged) ─────────────────────────────────────────
    healthCardreview: {
        backgroundColor: '#D8D0FF', borderRadius: 24, width: '93%', padding: 20,
        marginTop: 10, marginBottom: 20, position: 'relative', alignSelf: 'center',
    },
    healthCardLLMTitle: { fontSize: 18, fontWeight: '600', color: '#2B2B2B' },
    healthCardLLMSubTitle: { fontSize: 14, marginTop: 6, marginBottom: 30, fontWeight: '400', color: '#74727F' },
    buyLLMButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    buyLLMButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#6048E6', borderRadius: 15, paddingVertical: 14, marginTop: 4,
    },

    // ── Appointment card (unchanged) ────────────────────────────────────────
    container_app: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 20 },
    heading: { fontSize: 23, color: '#111111', marginBottom: 15 },
    appointmentCard: { backgroundColor: COLORS.lightGreen, borderRadius: 22, padding: 18 },
    doctorRow: { flexDirection: 'row', alignItems: 'center' },
    appointmentAvatar: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: '#1FA97F',
        alignItems: 'center', justifyContent: 'center',
    },
    doctorInfo: { flex: 1, marginLeft: 12 },
    doctorName: { fontSize: 21, fontWeight: '600', color: '#000' },
    specialization: { fontSize: 14, color: '#24745E', marginTop: 3 },
    detailsContainer: {
        marginTop: 20, backgroundColor: '#1FA97F', borderRadius: 30, minHeight: 58,
        paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    detailItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    detailText: { marginLeft: 20, fontSize: 14, fontWeight: '500', color: '#fff' },
    divider: { width: 1, height: 25, backgroundColor: '#fff', marginHorizontal: 20 },

    // ── Health Profile Card — minimal, teal ─────────────────────────────────
    healthCard: {
        backgroundColor: '#1FA97F',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 22,
        marginBottom: 0,
    },
    healthCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    hamburgerBtn: {
        width: 46, height: 46, borderRadius: 12,
        // backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    greetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    healthAvatarWrap: { position: 'relative' },
    healthAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff' },
    healthAvatarPlaceholder: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
    },
    greetingText: { color: '#fff', fontSize: 22, fontWeight: '800', flexShrink: 1 },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.09)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    locationText: { color: '#D9EFE6', fontSize: 12, fontWeight: '600', marginLeft: 6, flexShrink: 1 },
    locationValue: { color: '#fff', fontWeight: '800' },
    locationAqi: { color: '#D9EFE6', fontWeight: '600' },

    // Membership row — moved out of the health card
    membershipRow: { paddingHorizontal: 20, marginTop: 14, marginBottom: 4 },
    afterPremium: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: TEAL_MINT, borderRadius: 15, paddingVertical: 14, paddingHorizontal: 14,
    },
    afterPremiumText: {
        color: TEAL_MINT_TEXT, fontSize: 13, fontWeight: '700', lineHeight: 18,
        flexShrink: 1, textAlign: 'center',
    },
    premiumButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#6048E6', borderRadius: 15, paddingVertical: 14,
    },

    // ── Profile drawer ───────────────────────────────────────────────────────
    drawer: {
        backgroundColor: '#1FA97F',
        height: '100%',
        paddingTop: Platform.OS === 'ios' ? 56 : 36,
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20,
        shadowOffset: { width: 4, height: 0 }, elevation: 16,
    },
    drawerContent: { width: '100%', paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
    drawerCloseBtn: {
        alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
    },
    drawerAvatarWrap: { position: 'relative', marginBottom: 14 },
    drawerAvatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: '#fff' },
    drawerAvatarPlaceholder: {
        width: 92, height: 92, borderRadius: 46, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
    },
    drawerAvatarEditDot: {
        position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#F2D06B', alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: TEAL_DARKER,
    },
    drawerName: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
    drawerMemberLabel: {
        color: '#9FD6C4', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 4, marginBottom: 18,
    },
    drawerScoreBox: {
        width: '100%', backgroundColor: '#0E6B57', borderRadius: 18,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center', paddingVertical: 16, marginBottom: 18, position: 'relative',
    },
    drawerScoreHeader: {
        width: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    drawerScoreLabel: { color: '#9FD6C4', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
    drawerScoreRefresh: {
        position: 'absolute', right: 12, top: -4, width: 28, height: 28,
        alignItems: 'center', justifyContent: 'center',
    },
    drawerScoreValue: { color: '#fff', fontSize: 34, fontWeight: '900' },
    drawerScoreLoading: { marginVertical: 10 },
    drawerScoreOutOf: { color: '#9FD6C4', fontSize: 14, fontWeight: '700' },
    drawerVitalsCard: {
        width: '100%', alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14,
        marginBottom: 22,
    },
    drawerVitalsLoading: { marginVertical: 24 },
    drawerVitalRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 10 },
    drawerVitalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF3F1' },
    drawerVitalIconBox: {
        width: 30, height: 30, borderRadius: 10, backgroundColor: TEAL_MINT,
        alignItems: 'center', justifyContent: 'center',
    },
    drawerVitalLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', width: 84, paddingTop: 6 },
    drawerVitalValue: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'right', lineHeight: 18 },
    drawerLogoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#AF2B2D', borderRadius: 14, paddingVertical: 13, width: '100%',
    },
    drawerLogoutText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    drawerPremiumButton: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#6048E6', borderRadius: 14, paddingVertical: 13,
        width: '100%', marginTop: 12,
    },
    drawerAfterPremium: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: TEAL_MINT, borderRadius: 14, paddingVertical: 13,
        paddingHorizontal: 12, width: '100%', marginTop: 12,
    },
    drawerBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.55)' },

    // ── In-House Doctor Card ───────────────────────────────────────────────
    assignedDoctorCard: {
        backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16,
        alignSelf: 'center', width: '93%', borderWidth: 3, borderColor: '#F7F4F2',
    },
    assignedDoctorHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    assignedDoctorIconBox: {
        width: 52, height: 52, borderRadius: 16, backgroundColor: '#D8D0FF',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    assignedDoctorBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
        borderWidth: 1, borderColor: '#FDE68A', alignSelf: 'flex-start', marginBottom: 6,
    },
    assignedDoctorBadgeText: { fontSize: 10, fontWeight: '800', color: '#F59E0B', letterSpacing: 0.5 },
    assignedDoctorTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    assignedDoctorSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },
    assignedDoctorDivider: { height: 1, backgroundColor: '#EEF1FF', marginVertical: 16 },
    assignedDoctorActions: { flexDirection: 'row', gap: 10 },
    docActionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 6 },
    docActionBtnText: { fontSize: 12, fontWeight: '800' },

    // ── Upload card ─────────────────────────────────────────────────────────
    uploadCard: {
        backgroundColor: '#F7F4F2', borderRadius: 24, padding: 24, alignItems: 'center',
        width: '92%', alignSelf: 'center', marginBottom: 24,
        borderWidth: 3, borderColor: '#9BB167', borderStyle: 'dashed',
    },
    uploadIconCircle: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#1FA97F',
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        shadowColor: '#2A4DD0', shadowOpacity: 0.35, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    uploadTitle: { fontSize: 18, fontWeight: '800', color: '#2B2B2B', marginBottom: 8, letterSpacing: -0.2 },
    uploadSub: { fontSize: 13, color: '#2B2B2B', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
    uploadedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, maxWidth: '90%',
    },
    uploadedText: { fontSize: 12, color: '#22c55e', fontWeight: '600', flex: 1 },
    selectFileBtn: { backgroundColor: '#1FA97F', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' },
    selectFileText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
    uploadTwoActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    changFileBtn: {
        borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13,
        borderWidth: 1.5, borderColor: '#1FA97F',
    },
    changeFileText: { color: '#1FA97F', fontSize: 14, fontWeight: '700' },
    uploadThisFileBtn: {
        backgroundColor: '#1FA97F', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13,
        flexDirection: 'row', alignItems: 'center',
    },
    uploadOptionsRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        justifyContent: 'center',
        marginTop: 6,
    },
    uploadChoiceBtn: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#9BB167',
        shadowColor: '#1FA97F',
        shadowOpacity: 0.08,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    uploadChoiceIconBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#EBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    uploadChoiceLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1B6A50',
        marginBottom: 2,
    },
    uploadChoiceSub: {
        fontSize: 10,
        color: '#6B7280',
        fontWeight: '500',
    },
    stagedPagesScroll: {
        maxHeight: 120,
        marginVertical: 10,
        width: '100%',
    },
    stagedPagesContainer: {
        paddingHorizontal: 4,
        gap: 10,
        alignItems: 'center',
    },
    pageThumbCard: {
        width: 76,
        height: 100,
        borderRadius: 10,
        backgroundColor: '#fff',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#1FA97F',
        position: 'relative',
    },
    pageThumbImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    pageThumbBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingVertical: 2,
        alignItems: 'center',
    },
    pageThumbBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
    },
    pageRemoveBtn: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#fff',
        borderRadius: 10,
    },
    addMoreCard: {
        width: 76,
        height: 100,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#9BB167',
        borderStyle: 'dashed',
        backgroundColor: '#F9FAF7',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    addMoreCardText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1FA97F',
    },
    imageActionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#E8F5EE',
        borderWidth: 1,
        borderColor: '#C2E5D4',
    },
    secondaryActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1FA97F',
    },
    clearActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#FEE2E2',
    },
    clearActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#EF4444',
    },
    bundleUploadBtn: {
        backgroundColor: '#1FA97F',
        borderRadius: 14,
        paddingHorizontal: 20,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginTop: 2,
    },
    analyzingProgressBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#E8F5EE',
        borderRadius: 12,
        width: '100%',
        marginTop: 4,
    },
    analyzingProgressText: {
        fontSize: 13,
        color: '#1FA97F',
        fontWeight: '600',
    },

    // ── Upload History card ─────────────────────────────────────────────────
    historyCard: {
        backgroundColor: '#F0FDF7', borderRadius: 18, padding: 16,
        width: '92%', alignSelf: 'center', marginBottom: 16,
        borderWidth: 1, borderColor: '#BBF7D0',
    },
    historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    historyTitle: { fontSize: 14, fontWeight: '800', color: '#065F46' },
    historyItem: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#D1FAE5',
    },
    historyItemText: { fontSize: 13, color: '#047857', fontWeight: '500', flex: 1 },

    // ── Verified card wrapper ───────────────────────────────────────────────
    verifiedCardWrapper: {
        position: 'relative', overflow: 'hidden', borderRadius: 20,
        width: '92%', alignSelf: 'center', marginTop: 16, marginBottom: 24,
    },
    verifiedOverlay: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },

    // ── Pending review card ─────────────────────────────────────────────────
    pendingCard: {
        flexDirection: 'row', backgroundColor: '#FFFBEB', borderRadius: 16,
        marginTop: 16, marginBottom: 16, alignItems: 'center', width: '92%', alignSelf: 'center',
        padding: 16, borderWidth: 1, borderColor: '#FDE68A', gap: 12,
    },
    pendingCardLeft: { width: 4, borderRadius: 2, backgroundColor: '#F59E0B', alignSelf: 'stretch' },
    pendingCardTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
    pendingCardSub: { fontSize: 12, color: '#B45309', marginTop: 4, lineHeight: 18 },

    // ── Verified report card ────────────────────────────────────────────────
    verifiedCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20, marginTop: 16, padding: 18,
        borderWidth: 1.5, borderColor: '#1A9E8F', shadowColor: '#1A9E8F',
        shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    verifiedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A9E8F',
        alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10,
    },
    verifiedBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
    verifiedByText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    verifiedDateText: { fontSize: 11, color: '#94a3b8', marginTop: 2, marginBottom: 2 },
    verifiedDivider: { height: 1, backgroundColor: '#E8F7F5', marginVertical: 12 },
    verifiedSummaryTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    verifiedSummaryText: { fontSize: 13, color: '#334155', lineHeight: 20 },

    // ── Health Review Modal ──────────────────────────────────────────────────
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(10, 10, 20, 0.60)', justifyContent: 'flex-end', alignItems: 'center' },
    modalCard: {
        width: '100%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        paddingTop: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 }, elevation: 14, maxHeight: '82%',
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center' },
    modalIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9FF', alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#1F2937' },
    modalSubTitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
    modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    modalDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
    modalBody: { maxHeight: 280, marginBottom: 16 },
    modalLoadingWrap: { alignItems: 'center', paddingVertical: 36, gap: 14 },
    modalLoadingText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
    modalReviewText: { fontSize: 14, color: '#374151', lineHeight: 22, fontWeight: '400' },
    modalPremiumBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB',
        borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 4,
    },
    modalPremiumText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },
    modalPremiumBtn: { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
    modalPremiumBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
});
