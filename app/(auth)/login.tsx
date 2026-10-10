// app/(auth)/login.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator, Animated,
    KeyboardAvoidingView, Platform, ScrollView,
    Dimensions, Easing, useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, FontAwesome, AntDesign } from '@expo/vector-icons';
import { login } from '../../src/services/authServices';
import { useAuth } from '../../context/AuthContext';
import { CurvedHeader } from '@/components/half_circle_part';
import { useGoogleAuth } from '@/context/googleOauth';
import { StatusBar } from 'react-native';
const { width } = Dimensions.get('window');

const TEAL = '#2DBD96';
const DARK_BG = '#1A1F2E';
const BG = '#FBFAF3';


export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const role = 'user'; // default role — no selection needed
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const { setUser, markRegistered } = useAuth();
    const router = useRouter();
    const headerAnim = useRef(new Animated.Value(0)).current;
    const cardAnim = useRef(new Animated.Value(0)).current;
    const { width } = useWindowDimensions();
    const hPad = width < 360 ? 18 : width >= 500 ? width * 0.1 : 24;
    useEffect(() => {
        Animated.sequence([
            Animated.timing(headerAnim, {
                toValue: 1, duration: 420,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(cardAnim, {
                toValue: 1, duration: 360,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const btnScale = useRef(new Animated.Value(1)).current;
    const pressIn = () => Animated.timing(btnScale, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
    const pressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();


    const handleLogin = async () => {
        if (!email) return Alert.alert('Missing Field', 'Please enter your email address.');
        if (!password) return Alert.alert('Missing Field', 'Please enter your password.');
        try {
            setLoading(true);
            const data = await login(email.trim(), password);
            await markRegistered();
            setUser(data.user);
        } catch (err: any) {
            Alert.alert('Login Failed', err.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const { signInWithGoogle } = useGoogleAuth({
        onSuccess: async (data) => {
            try {
                setLoading(true);
                await markRegistered();
                setUser(data.user);
            } catch (err: any) {
                Alert.alert('Google Sign-In Failed', err.message || 'Something went wrong.');
            } finally {
                setLoading(false);
            }
        },
        onError: (msg) => Alert.alert('Google Sign-In Error', msg),
    });

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, backgroundColor: BG }}
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <StatusBar hidden  hidden={true} />
                {/* ── Dark curved header ─────────────────────────── */}
                <Animated.View style={{
                    opacity: headerAnim,
                    transform: [{
                        translateY: headerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-20, 0],
                        }),
                    }],
                }}>
                    <CurvedHeader />
                </Animated.View>

                {/* ── Body ──────────────────────────────────────────── */}
                <Animated.View style={[
                    s.body,
                    { paddingHorizontal: hPad },
                    {
                        opacity: cardAnim,
                        transform: [{
                            translateY: cardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [24, 0],
                            }),
                        }],
                    },
                ]}>

                    {/* Email */}
                    <Text style={s.label}>Email Address</Text>
                    <View style={s.inputRow}>
                        <MaterialCommunityIcons
                            name="email-outline" size={22}
                            color="#888" style={s.inputIcon}
                        />
                        <TextInput
                            style={s.input}
                            placeholder="Enter your email address..."
                            placeholderTextColor="#bbb"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password */}
                    <Text style={s.label}>Password</Text>
                    <View style={s.inputRow}>
                        <MaterialCommunityIcons
                            name="lock-outline" size={22}
                            color="#888" style={s.inputIcon}
                        />
                        <TextInput
                            style={[s.input, { flex: 1 }]}
                            placeholder="Enter your password..."
                            placeholderTextColor="#bbb"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPass}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPass(p => !p)}
                            style={{ padding: 4 }}
                        >
                            <Ionicons
                                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                                size={20} color="#bbb"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Sign In button */}
                    <TouchableOpacity
                        style={[s.btn, loading && { opacity: 0.6 }]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={s.btnText}>Sign In</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={s.dividerRow}>
                        <View style={s.dividerLine} />
                        <Text style={s.dividerText}>or</Text>
                        <View style={s.dividerLine} />
                    </View>

                    {/* Social buttons */}
                    <View style={s.socialRow}>
                        <TouchableOpacity
                            style={s.socialBtn}
                            activeOpacity={0.75}
                            onPress={signInWithGoogle}
                            disabled={loading}
                        >
                            <AntDesign name="google" size={27} color={TEAL} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.socialBtn} activeOpacity={0.75}>
                            <FontAwesome name="facebook" size={27} color={TEAL} />
                        </TouchableOpacity>
                    </View>

                    {/* Sign Up */}
                    <TouchableOpacity
                        onPress={() => router.push('/(auth)/signup')}
                        style={{ alignItems: 'center', marginTop: 20 }}
                    >
                        <Text style={s.signupText}>
                            Don't have an account?{' '}
                            <Text style={s.signupLink}>Sign Up.</Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Forgot */}
                    <TouchableOpacity style={{ alignItems: 'center', marginTop: 10 }}>
                        <Text style={s.forgotText}>Forgot your password?</Text>
                    </TouchableOpacity>

                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    // ── Dark header ─────────────────────────────────────
    header: {
        backgroundColor: DARK_BG,
        paddingTop: Platform.OS === 'ios' ? 70 : 52,
        paddingBottom: 48,
        paddingHorizontal: 24,
        alignItems: 'center',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: TEAL,
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    headerSub: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
        lineHeight: 22,
    },

    // ── Body ─────────────────────────────────────────────
    body: {
        backgroundColor: "#F7F4EC",
        paddingHorizontal: 22,
        paddingTop: 32,
        paddingBottom: 40,
        flex: 1,
    },

    // ── Fields ───────────────────────────────────────────
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1F2E',
        marginBottom: 8,
        marginTop: 23,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EDEAE0',
        borderRadius: 14,
        minHeight: 54,
        paddingHorizontal: 16,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: '#131A2E',
    },

    // ── Role cards ───────────────────────────────────────
    rolesRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 44,
        marginTop: 4,
    },
    roleCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1.5,
        borderColor: '#D5D2CB',
        borderRadius: 16,
        paddingVertical: 13,
        paddingHorizontal: 6,
        backgroundColor: '#ECEAE5',
    },
    roleCardActive: {
        borderColor: TEAL,
        backgroundColor: '#E8FBF5',
    },
    roleLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        textAlign: 'center',
        lineHeight: 16,
    },
    roleLabelActive: {
        color: TEAL,
        fontWeight: '700',
    },

    // ── Sign In button ────────────────────────────────────
    btn: {
        backgroundColor: TEAL,
        borderRadius: 16,
        paddingVertical: 17,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 50,
        shadowColor: TEAL,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    btnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 18,
        letterSpacing: 0.3,
    },

    // ── Divider ───────────────────────────────────────────
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 22,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#D5D2CB',
    },
    dividerText: {
        fontSize: 14,
        color: '#999',
    },

    // ── Social ────────────────────────────────────────────
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 18,
    },
    socialBtn: {
        width: 64,
        height: 64,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: TEAL,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Footer links ──────────────────────────────────────
    signupText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        textAlign: 'center',
    },
    signupLink: {
        color: '#2DBD96',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    forgotText: {
        fontSize: 14,
        color: TEAL,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
