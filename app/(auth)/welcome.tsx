// app/(auth)/welcome.tsx
import React, { useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Dimensions, StatusBar, Image, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const BRAND_GREEN = '#2E7D32';
const BRAND_TEAL = '#26A69A';
const BRAND_LIGHT = '#F5F0E8';
const BRAND_YELLOW = '#F5C518';

export default function WelcomeScreen() {
    const router = useRouter();

    // ── Entrance animations ─────────────────────────────────────────────────
    const fadeTitle = useRef(new Animated.Value(0)).current;
    const slideImg = useRef(new Animated.Value(30)).current;
    const fadeImg = useRef(new Animated.Value(0)).current;
    const fadeBtn = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.timing(fadeTitle, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.parallel([
                Animated.timing(fadeImg, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(slideImg, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
            Animated.timing(fadeBtn, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <SafeAreaView style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={BRAND_LIGHT} />

            {/* ── Decorative blobs ─────────────────────────────────────────── */}
            <View style={s.blobTopRight} />
            <View style={s.blobBottomLeft} />

            {/* ── Title ────────────────────────────────────────────────────── */}
            <Animated.View style={[s.titleSection, { opacity: fadeTitle }]}>
                <Text style={s.title}>
                    Welcome To Ultimate{'\n'}
                    <Text style={s.titleAccent}>Apna Doctoro</Text>
                </Text>
                <Text style={s.subtitle}>
                    Your mindful mental health AI companion{'\n'}
                    for everyone, anywhere 🌿
                </Text>
            </Animated.View>

            {/* ── Illustration ─────────────────────────────────────────────── */}
            <Animated.View style={[
                s.imageWrap,
                { opacity: fadeImg, transform: [{ translateY: slideImg }] }
            ]}>
                {/* Soft glow circle behind image */}
                <View style={s.glowCircle} />

                {/* Floating feature chips */}
                <View style={[s.chip, s.chipTopLeft]}>
                    <MaterialCommunityIcons name="brain" size={14} color={BRAND_GREEN} />
                    <Text style={s.chipText}>Mental clarity</Text>
                </View>
                <View style={[s.chip, s.chipTopRight]}>
                    <MaterialCommunityIcons name="heart-pulse" size={14} color="#E53E3E" />
                    <Text style={s.chipText}>Heart health</Text>
                </View>
                <View style={[s.chip, s.chipBottom]}>
                    <MaterialCommunityIcons name="leaf" size={14} color={BRAND_TEAL} />
                    <Text style={s.chipText}>Mindful living</Text>
                </View>

                <Image
                    source={require('../../assets/images/Frame.png')}
                    style={s.image}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* ── Stats row ──────────────────────────────────────────────────
                    <Animated.View style={[s.statsRow, { opacity: fadeBtn }]}>
                        <View style={s.statItem}>
                            <Text style={s.statNum}>50K+</Text>
                            <Text style={s.statLabel}>Users</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}>
                            <Text style={s.statNum}>4.9★</Text>
                            <Text style={s.statLabel}>Rating</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}>
                            <Text style={s.statNum}>100%</Text>
                            <Text style={s.statLabel}>AI-powered</Text>
                        </View>
                    </Animated.View> */}

            {/* ── Bottom CTA ───────────────────────────────────────────────── */}
            <Animated.View style={[s.bottomSection, { opacity: fadeBtn }]}>
                <TouchableOpacity
                    style={s.getStartedBtn}
                    onPress={() => router.push('/(auth)/signup' as any)}
                    activeOpacity={0.85}
                >
                    <Text style={s.getStartedText}>Get Started</Text>
                    <View style={s.btnArrow}>
                        <MaterialCommunityIcons name="arrow-right" size={18} color={BRAND_TEAL} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.loginLink}
                    onPress={() => router.push('/(auth)/login' as any)}
                    activeOpacity={0.7}
                >
                    {/* <Text style={s.loginLinkText}>
                        Already have an account?{' '}
                        <Text style={s.loginLinkBold}>Sign in</Text>
                    </Text> */}
                </TouchableOpacity>
            </Animated.View>
        </SafeAreaView>
    );
}

// ─────────────────────────── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: BRAND_LIGHT,
    },

    // ── Decorative blobs ─────────────────────────────────────────────────────
    blobTopRight: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#C8E6C9',
        opacity: 0.35,
    },
    blobBottomLeft: {
        position: 'absolute',
        bottom: -80,
        left: -80,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: '#B2DFDB',
        opacity: 0.3,
    },

    // ── Pill ─────────────────────────────────────────────────────────────────
    pillWrap: {
        alignItems: 'center',
        marginTop: height * 0.03,
        marginBottom: 4,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    pillDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: BRAND_TEAL,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#555',
    },

    // ── Title ─────────────────────────────────────────────────────────────────
    titleSection: {
        alignItems: 'center',
        paddingHorizontal: width * 0.02,
        marginTop: height * 0.120,
        marginBottom: height * -0.024,
    },
    title: {
        fontSize: width * 0.082,
        fontWeight: '800',
        color: BRAND_GREEN,
        textAlign: 'center',
        lineHeight: width * 0.096,
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    titleAccent: {
        color: BRAND_TEAL,
    },
    subtitle: {
        fontSize: 14,
        marginTop: 30,
        color: '#777',
        textAlign: 'center',
        lineHeight: 21,
        fontWeight: '400',
    },

    // ── Image ─────────────────────────────────────────────────────────────────
    imageWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    glowCircle: {
        position: 'absolute',
        width: width * 0.72,
        height: width * 0.72,
        borderRadius: width * 0.36,
        backgroundColor: '#E8F5E9',
    },
    image: {
        width: width * 0.68,
        height: width * 0.68,
        zIndex: 1,
    },

    // Floating chips
    chip: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        zIndex: 2,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#444',
    },
    chipTopLeft: {
        left: width * 0.02,
        top: '15%',
    },
    chipTopRight: {
        right: width * 0.02,
        top: '15%',
    },
    chipBottom: {
        bottom: '10%',
        alignSelf: 'center',
    },

    // ── Stats row ─────────────────────────────────────────────────────────────
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: width * 0.08,
        borderRadius: 16,
        paddingVertical: 12,
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 16,
        fontWeight: '800',
        color: BRAND_GREEN,
    },
    statLabel: {
        fontSize: 11,
        color: '#999',
        marginTop: 2,
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#F0F0F0',
    },

    // ── Bottom CTA ────────────────────────────────────────────────────────────
    bottomSection: {
        paddingHorizontal: width * 0.08,
        paddingBottom: height * 0.04,
        gap: 14,
    },
    getStartedBtn: {
        backgroundColor: BRAND_TEAL,
        borderRadius: 16,
        paddingVertical: 17,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        elevation: 6,
        shadowColor: BRAND_TEAL,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
    },
    getStartedText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.3,
    },
    btnArrow: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginLink: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    loginLinkText: {
        fontSize: 13,
        color: '#888',
        fontWeight: '400',
    },
    loginLinkBold: {
        color: BRAND_GREEN,
        fontWeight: '700',
    },
});
