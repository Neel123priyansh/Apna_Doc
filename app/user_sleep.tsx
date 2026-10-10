import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    LayoutChangeEvent,
    TouchableOpacity,
    PanResponder,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import { authFetch } from "../src/services/authServices";

// Install: npx expo install react-native-svg @expo/vector-icons

type Level = {
    key: string;
    label: string;
    hours: string;
    face: "excellent" | "good" | "fair" | "poor" | "worst";
    bg: string;
    fg: string;
};
const TEXT_DARK = '#121212';

const LEVELS: Level[] = [
    { key: "excellent", label: "Excellent", hours: "7-9 HOURS", face: "excellent", bg: "#9AAE63", fg: "#3C4A1C" },
    { key: "good", label: "Good", hours: "6-7 HOURS", face: "good", bg: "#FFCB52", fg: "#7A4A0C" },
    { key: "fair", label: "Fair", hours: "5 HOURS", face: "fair", bg: "#C6A394", fg: "#6B4A3A" },
    { key: "poor", label: "Poor", hours: "3-4 HOURS", face: "poor", bg: "#F07F1A", fg: "#7A2E08" },
    { key: "worst", label: "Worst", hours: "<3 HOURS", face: "worst", bg: "#A58CF2", fg: "#47308A" },
];

const COLORS = {
    background: "#FAF5F0",
    title: "#4A2C17",
    inactive: "#C9C0BB",
    track: "#EADFDA",
    fill: "#CC6410",
    thumb: "#F07F1A",
    thumbRing: "#FBD3BC",
};

const ROW_HEIGHT = 87;
const FIRST_CENTER = 32; // distance from track top to first row center
const TRACK_HEIGHT = 401;
const TRACK_WIDTH = 14;
const THUMB = 60;

const centerFor = (i: number) => FIRST_CENTER + i * ROW_HEIGHT;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function Face({ type, bg, fg }: { type: Level["face"]; bg: string; fg: string }) {
    const sw = 2.6;
    return (
        <Svg width={44} height={44} viewBox="0 0 44 44">
            <Circle cx={22} cy={22} r={22} fill={bg} />
            {type === "excellent" && (
                <>
                    <Path d="M10 18 Q14 13 18 18" stroke={fg} strokeWidth={sw} strokeLinecap="round" fill="none" />
                    <Path d="M26 18 Q30 13 34 18" stroke={fg} strokeWidth={sw} strokeLinecap="round" fill="none" />
                    <Path d="M11 25 Q22 38 33 25" stroke={fg} strokeWidth={sw} strokeLinecap="round" fill="none" />
                </>
            )}
            {type === "good" && (
                <>
                    <Line x1={14} y1={13} x2={14} y2={19} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Line x1={30} y1={13} x2={30} y2={19} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Path d="M11 25 Q22 38 33 25" stroke={fg} strokeWidth={sw} strokeLinecap="round" fill="none" />
                </>
            )}
            {type === "fair" && (
                <>
                    <Line x1={14} y1={15} x2={14} y2={20} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Line x1={30} y1={15} x2={30} y2={20} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Line x1={13} y1={30} x2={31} y2={30} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                </>
            )}
            {type === "poor" && (
                <>
                    <Line x1={14} y1={15} x2={14} y2={21} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Line x1={30} y1={15} x2={30} y2={21} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Path d="M12 33 Q22 22 32 33" stroke={fg} strokeWidth={sw} strokeLinecap="round" fill="none" />
                </>
            )}
            {type === "worst" && (
                <>
                    <Path d="M10 14 L17 21 M17 14 L10 21" stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Path d="M27 14 L34 21 M34 14 L27 21" stroke={fg} strokeWidth={sw} strokeLinecap="round" />
                    <Path d="M12 33 Q22 23 32 33" stroke={fg} strokeWidth={sw} strokeLinecap="round" fill="none" />
                </>
            )}
        </Svg>
    );
}

export default function SleepQualityScreen() {
    const router = useRouter();
    const [selected, setSelected] = useState(3);
    const [saving, setSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [lockMessage, setLockMessage] = useState<string | null>(null);

    const thumbY = useRef(new Animated.Value(centerFor(3))).current;
    const currentY = useRef(centerFor(3));
    const startY = useRef(centerFor(3));
    const selectedRef = useRef(3);

    useEffect(() => {
        const fetchInitialState = async () => {
            try {
                const res = await authFetch('/api/auth/profile');
                if (res.ok) {
                    const data = await res.json();
                    if (data?.sleepQuality) {
                        const idx = LEVELS.findIndex(l => l.label.toLowerCase() === data.sleepQuality.toLowerCase());
                        if (idx !== -1) {
                            setSelected(idx);
                            selectedRef.current = idx;
                            const targetY = centerFor(idx);
                            currentY.current = targetY;
                            thumbY.setValue(targetY);
                        }
                    }

                    if (data?.sleepQualityUpdatedAt) {
                        const now = Date.now();
                        const lastUpdated = new Date(data.sleepQualityUpdatedAt).getTime();
                        const diffHours = (now - lastUpdated) / (1000 * 60 * 60);

                        if (diffHours < 24) {
                            const remaining = Math.ceil(24 - diffHours);
                            setIsLocked(true);
                            setLockMessage(`Sleep quality was updated recently. You can update it again in ${remaining} hour(s).`);
                        }
                    }
                }
            } catch (err) {
                console.error('[user_sleep] Fetch profile error:', err);
            }
        };

        fetchInitialState();
    }, []);

    const nearestIndex = (y: number) =>
        clamp(Math.round((y - FIRST_CENTER) / ROW_HEIGHT), 0, LEVELS.length - 1);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => !isLocked,
                onMoveShouldSetPanResponder: () => !isLocked,
                onPanResponderGrant: () => {
                    if (isLocked) return;
                    thumbY.stopAnimation((v) => {
                        startY.current = v;
                        currentY.current = v;
                    });
                },
                onPanResponderMove: (_, g) => {
                    if (isLocked) return;
                    const y = clamp(startY.current + g.dy, FIRST_CENTER, centerFor(LEVELS.length - 1));
                    currentY.current = y;
                    thumbY.setValue(y);
                    const idx = nearestIndex(y);
                    if (idx !== selectedRef.current) {
                        selectedRef.current = idx;
                        setSelected(idx);
                    }
                },
                onPanResponderRelease: () => {
                    if (isLocked) return;
                    const idx = nearestIndex(currentY.current);
                    selectedRef.current = idx;
                    setSelected(idx);
                    Animated.spring(thumbY, {
                        toValue: centerFor(idx),
                        useNativeDriver: false,
                        friction: 8,
                        tension: 80,
                    }).start();
                },
            }),
        [thumbY, isLocked]
    );

    const onRowPress = (idx: number) => {
        if (isLocked) {
            Alert.alert("Locked", lockMessage || "Sleep quality can only be changed once every 24 hours.");
            return;
        }
        selectedRef.current = idx;
        setSelected(idx);
        Animated.spring(thumbY, { toValue: centerFor(idx), useNativeDriver: false, friction: 8 }).start();
    };

    const handleSave = async () => {
        if (isLocked) {
            Alert.alert("24-Hour Restriction", lockMessage || "Sleep quality can only be updated once every 24 hours.");
            return;
        }

        try {
            setSaving(true);
            const selectedLevel = LEVELS[selected];
            const res = await authFetch('/api/auth/sleep', {
                method: 'POST',
                body: JSON.stringify({ sleepQuality: selectedLevel.label }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data?.locked) {
                    setIsLocked(true);
                    setLockMessage(data.message);
                }
                Alert.alert("Unable to Update", data.message || "Failed to save sleep quality.");
                return;
            }

            try {
                const cachedJson = await AsyncStorage.getItem('@ezzmed_user_profile_cache_v1');
                if (cachedJson) {
                    const cached = JSON.parse(cachedJson);
                    cached.sleepQuality = selectedLevel.label;
                    cached.sleepQualityUpdatedAt = new Date().toISOString();
                    await AsyncStorage.setItem('@ezzmed_user_profile_cache_v1', JSON.stringify(cached));
                }
            } catch (err) {
                console.warn('[user_sleep] Cache update error:', err);
            }

            Alert.alert("Success", "Sleep quality recorded successfully!", [
                { text: "OK", onPress: () => router.push('/user_profile') }
            ]);
        } catch (err) {
            console.error('[user_sleep] Save error:', err);
            Alert.alert("Error", "An unexpected error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    const fillHeight = thumbY.interpolate({
        inputRange: [FIRST_CENTER, centerFor(LEVELS.length - 1)],
        outputRange: [TRACK_HEIGHT - FIRST_CENTER, TRACK_HEIGHT - centerFor(LEVELS.length - 1)],
    });

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.push('/user_profile')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="chevron-back" size={18} color={TEXT_DARK} />
            </TouchableOpacity>
            <Text style={styles.title}>How would you rate your{"\n"}sleep quality?</Text>

            <View style={styles.body}>
                {/* Track */}
                <View style={styles.track}>
                    <Animated.View style={[styles.fill, { height: fillHeight }]} />
                </View>

                {/* Rows */}
                {LEVELS.map((lvl, i) => {
                    const active = i === selected;
                    return (
                        <View key={lvl.key} style={[styles.row, { top: centerFor(i) - ROW_HEIGHT / 2 }]}>
                            <View style={styles.labelBlock} onTouchEnd={() => onRowPress(i)}>
                                <Text style={[styles.label, { color: active ? COLORS.title : COLORS.inactive }]}>
                                    {lvl.label}
                                </Text>
                                <View style={styles.hoursRow}>
                                    <Ionicons
                                        name="time"
                                        size={12}
                                        color={active ? COLORS.title : COLORS.inactive}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text style={[styles.hours, { color: active ? COLORS.title : COLORS.inactive }]}>
                                        {lvl.hours}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.faceWrap} onTouchEnd={() => onRowPress(i)}>
                                <Face type={lvl.face} bg={lvl.bg} fg={lvl.fg} />
                            </View>
                        </View>
                    );
                })}

                {/* Thumb */}
                <Animated.View
                    {...panResponder.panHandlers}
                    style={[
                        styles.thumbRing,
                        { transform: [{ translateY: Animated.subtract(thumbY, THUMB / 2 + 6) }] },
                    ]}
                >
                    <View style={styles.thumb}>
                        <Ionicons name="chevron-up" size={9} color="#fff" style={{ marginBottom: -3 }} />
                        <Ionicons name="chevron-down" size={9} color="#fff" style={{ marginTop: -3 }} />
                    </View>
                </Animated.View>
            </View>

            {isLocked && (
                <View style={styles.lockBanner}>
                    <Ionicons name="lock-closed" size={16} color="#B91C1C" style={{ marginRight: 6 }} />
                    <Text style={styles.lockText}>{lockMessage}</Text>
                </View>
            )}

            <TouchableOpacity
                style={[styles.saveBtn, (saving || isLocked) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
            >
                {saving ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                    <Text style={styles.saveBtnText}>{isLocked ? "Locked for 24 Hours" : "Save Sleep Quality"}</Text>
                )}
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: "center",
    },
    title: {
        marginTop: 72,
        fontSize: 25,
        lineHeight: 33,
        fontWeight: "800",
        color: COLORS.title,
        textAlign: "center",
    },
    body: {
        marginTop: 40,
        width: "100%",
        maxWidth: 360,
        height: TRACK_HEIGHT,
        paddingHorizontal: 14,
    },
    backBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.2,
        borderColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
    },
    track: {
        position: "absolute",
        left: "50%",
        marginLeft: -TRACK_WIDTH / 2,
        top: 0,
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        borderRadius: TRACK_WIDTH / 2,
        backgroundColor: COLORS.track,
        overflow: "hidden",
        justifyContent: "flex-end",
    },
    fill: {
        width: "100%",
        backgroundColor: COLORS.fill,
        borderRadius: TRACK_WIDTH / 2,
    },
    row: {
        position: "absolute",
        left: 14,
        right: 14,
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    labelBlock: { width: 120 },
    label: { fontSize: 16, fontWeight: "700", marginBottom: 5 },
    hoursRow: { flexDirection: "row", alignItems: "center" },
    hours: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
    faceWrap: { width: 44, height: 44 },
    thumbRing: {
        position: "absolute",
        left: "50%",
        marginLeft: -(THUMB + 12) / 2,
        top: 0,
        width: THUMB + 12,
        height: THUMB + 12,
        borderRadius: (THUMB + 12) / 2,
        backgroundColor: COLORS.thumbRing,
        alignItems: "center",
        justifyContent: "center",
    },
    thumb: {
        width: THUMB,
        height: THUMB,
        borderRadius: THUMB / 2,
        backgroundColor: COLORS.thumb,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#F07F1A",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    lockBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginHorizontal: 20,
        marginTop: 15,
    },
    lockText: {
        fontSize: 12,
        color: '#991B1B',
        fontWeight: '600',
        flex: 1,
    },
    saveBtn: {
        width: '85%',
        maxWidth: 320,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.title,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 24,
        elevation: 3,
    },
    saveBtnDisabled: {
        backgroundColor: '#8E7767',
        opacity: 0.8,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});