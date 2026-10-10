// app/(auth)/welcome-interactive.tsx
import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, StatusBar, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const GREEN = '#8FA876';   // muted olive-green background
const GREEN_DARK = '#7C9865';   // darker circle shade
const GREEN_LIGHT = '#9BB388';   // lighter circle shade
const TEAL = '#12A784';   // button text / accent

export default function WelcomeInteractiveScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { width, height } = useWindowDimensions();

    // Replace with the actual logged-in user's name
    const userName = user?.name || 'Guest';

    return (
        <SafeAreaView style={s.root}>
            <StatusBar hidden  barStyle="light-content" backgroundColor={GREEN} />

            {/* ── Decorative background circles ────────────────────────── */}
            <View style={[s.circle, s.circleTopRight]} />
            <View style={[s.circle, s.circleMidLeft]} />
            <View style={[s.circle, s.circleMidRight]} />
            <View style={[s.circle, s.circleBottomLeft]} />

            {/* ── Center text block ────────────────────────────────────── */}
            <View style={s.centerBlock}>
                <Text style={s.welcomeText}>Welcome!</Text>
                <Text style={s.nameText}>{userName}</Text>
            </View>

            {/* ── Get Started button ───────────────────────────────────── */}
            <View style={s.bottomBlock}>
                <TouchableOpacity
                    style={s.getStartedBtn}
                    onPress={() => router.replace('/user_gender' as any)}
                    activeOpacity={0.85}
                >
                    <Text style={s.getStartedText}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={18} color={TEAL} />
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: GREEN,
        overflow: 'hidden',
    },

    // ── Decorative circles ────────────────────────────────────────────────────
    circle: {
        position: 'absolute',
        borderRadius: 999,
    },
    circleTopRight: {
        width: 140,
        height: 140,
        backgroundColor: GREEN_LIGHT,
        top: -30,
        right: -30,
        opacity: 0.6,
    },
    circleMidLeft: {
        width: 190,
        height: 190,
        backgroundColor: GREEN_DARK,
        top: '18%',
        left: -90,
        opacity: 0.55,
    },
    circleMidRight: {
        width: 160,
        height: 160,
        backgroundColor: GREEN_DARK,
        top: '38%',
        right: -60,
        opacity: 0.5,
    },
    circleBottomLeft: {
        width: 220,
        height: 220,
        backgroundColor: GREEN_LIGHT,
        bottom: '12%',
        left: -100,
        opacity: 0.45,
    },

    // ── Center text ───────────────────────────────────────────────────────────
    centerBlock: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    welcomeText: {
        fontSize: 62,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
        marginBottom: 50,
        textAlign: 'center',
    },
    nameText: {
        fontSize: 36,
        fontWeight: '400',
        color: '#fff',
        opacity: 0.95,
        textAlign: 'center',
    },

    // ── Bottom button ─────────────────────────────────────────────────────────
    bottomBlock: {
        paddingHorizontal: 28,
        paddingBottom: 48,
    },
    getStartedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        borderRadius: 30,
        paddingVertical: 17,

    },
    getStartedText: {
        fontSize: 16,
        fontWeight: '700',
        color: TEAL,
        letterSpacing: 0.2,
    },
});
