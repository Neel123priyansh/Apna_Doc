// app/mood-selector.tsx
import React, { useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Dimensions, Animated, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const BG = '#F5F0E8';
const BROWN = '#3D2B1F';

const MOODS = [
    { key: 'awful', label: 'Awful', emoji: '😫', color: '#E05C5C', light: '#FDEAEA', desc: 'Having a really rough time' },
    { key: 'sad', label: 'Sad', emoji: '😔', color: '#5B8CFF', light: '#EAF0FF', desc: 'Feeling down or low' },
    { key: 'neutral', label: 'Neutral', emoji: '😐', color: '#FF9800', light: '#FFF4E5', desc: 'Just going through the day' },
    { key: 'good', label: 'Good', emoji: '🙂', color: '#3EC97A', light: '#EAFAF1', desc: 'Feeling pretty good!' },
    { key: 'happy', label: 'Happy', emoji: '😄', color: '#4CAF50', light: '#E8F5E9', desc: 'In a great mood!' },
];

export default function MoodSelectorScreen() {
    const router = useRouter();
    const [selected, setSelected] = useState('neutral');
    const scaleRef = useRef(new Animated.Value(1)).current;

    const mood = MOODS.find(m => m.key === selected)!;

    // Load initial mood index on mount
    React.useEffect(() => {
        const loadInitial = async () => {
            try {
                const storedIdx = await AsyncStorage.getItem('user_mood_idx');
                if (storedIdx !== null) {
                    const idx = parseInt(storedIdx, 10);
                    // Map index back to key: awfl(0) | sad/bad(1) | neutral(2) | good(3) | happy/great(4)
                    const keys = ['awful', 'sad', 'neutral', 'good', 'happy'];
                    if (keys[idx]) {
                        setSelected(keys[idx]);
                    }
                }
            } catch (e) { }
        };
        loadInitial();
    }, []);

    const handleSelect = (key: string) => {
        setSelected(key);
        // Pop animation on select
        Animated.sequence([
            Animated.timing(scaleRef, { toValue: 1.18, duration: 120, useNativeDriver: true }),
            Animated.timing(scaleRef, { toValue: 1.00, duration: 120, useNativeDriver: true }),
        ]).start();
    };

    const handleSave = async () => {
        try {
            const keys = ['awful', 'sad', 'neutral', 'good', 'happy'];
            const idx = keys.indexOf(selected);
            if (idx !== -1) {
                await AsyncStorage.setItem('user_mood_idx', String(idx));
            }
        } catch (e) { }
        router.push('/user_profile');
    };

    return (
        <SafeAreaView style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor={BG} />

            {/* ── Title ─────────────────────────────────────────── */}
            <Text style={s.question}>How would you{'\n'}describe your mood?</Text>

            {/* ── Big emoji ─────────────────────────────────────── */}
            <Animated.View style={[s.bigEmojiWrap, {
                backgroundColor: mood.light,
                transform: [{ scale: scaleRef }],
            }]}>
                <Text style={s.bigEmoji}>{mood.emoji}</Text>
            </Animated.View>

            {/* ── Mood label + desc ──────────────────────────────── */}
            <Text style={[s.moodLabel, { color: mood.color }]}>{mood.label}</Text>
            <Text style={s.moodDesc}>{mood.desc}</Text>

            {/* ── 5 mood buttons ────────────────────────────────── */}
            <View style={s.row}>
                {MOODS.map(m => {
                    const active = m.key === selected;
                    return (
                        <TouchableOpacity
                            key={m.key}
                            style={[
                                s.moodBtn,
                                {
                                    borderColor: active ? m.color : 'transparent',
                                    backgroundColor: active ? m.light : '#EDEBE6'
                                },
                            ]}
                            onPress={() => handleSelect(m.key)}
                            activeOpacity={0.75}
                        >
                            <Text style={s.btnEmoji}>{m.emoji}</Text>
                            <Text style={[s.btnLabel, { color: active ? m.color : '#999' }]}>
                                {m.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Save button ────────────────────────────────────── */}
            <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: mood.color }]}
                activeOpacity={0.85}
                onPress={handleSave}
            >
                <Text style={s.saveBtnText}>Save Mood →</Text>
            </TouchableOpacity>

        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: BG,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    question: {
        fontSize: 28,
        fontWeight: '800',
        color: BROWN,
        textAlign: 'center',
        lineHeight: 36,
        marginTop: 48,
        letterSpacing: -0.3,
    },
    bigEmojiWrap: {
        width: width * 0.42,
        height: width * 0.42,
        borderRadius: width * 0.21,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 36,
        marginBottom: 20,
    },
    bigEmoji: { fontSize: width * 0.2 },
    moodLabel: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
    moodDesc: { fontSize: 14, color: '#999', marginTop: 6, marginBottom: 36 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
        marginBottom: 32,
    },
    moodBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 18,
        borderWidth: 2,
        gap: 5,
    },
    btnEmoji: { fontSize: 26 },
    btnLabel: { fontSize: 11, fontWeight: '600' },
    saveBtn: {
        width: '100%',
        borderRadius: 50,
        paddingVertical: 17,
        alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
