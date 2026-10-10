// app/(auth)/signup.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator,
    Platform, ScrollView, useWindowDimensions,
    Animated, Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, FontAwesome, AntDesign } from '@expo/vector-icons';
import { signup } from '../../src/services/authServices';
import { useAuth } from '../../context/AuthContext';
import { CurvedHeader } from '@/components/half_circle';
import { useGoogleAuth } from '@/context/googleOauth';
import { StatusBar } from 'react-native';


const TEAL = '#2DBD96';
const CREAM = '#F7F4EC';
const FIELD = '#EDEAE0';
const MUTED = '#8B93A7';
const TEXT = '#131A2E';

export default function SignupScreen() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const role = 'user'; // default role — no selection needed
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    const emailRef = useRef<TextInput>(null);
    const passRef = useRef<TextInput>(null);
    const specialRef = useRef<TextInput>(null);

    const { setUser, markRegistered } = useAuth();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const hPad = width < 360 ? 18 : width >= 500 ? width * 0.1 : 24;

    // ── Entrance animations ───────────────────────────────────────────────
    const headerAnim = useRef(new Animated.Value(0)).current;
    const cardAnim = useRef(new Animated.Value(0)).current;

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

    // ── Button press scale ──────────────────────────────────────────────────────
    const btnScale = useRef(new Animated.Value(1)).current;
    const pressIn = () => Animated.timing(btnScale, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
    const pressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

    // ── Submit ────────────────────────────────────────────────────
    const handleSignup = async () => {
        if (!name || !email || !password)
            return Alert.alert('Error', 'All fields are required');
        if (password.length < 6)
            return Alert.alert('Error', 'Password must be at least 6 characters');
        try {
            setLoading(true);
            const data = await signup(
                name.trim(), email.trim().toLowerCase(),
                password, role
            );
            await markRegistered();
            setUser(data.user);
        } catch (err: any) {
            Alert.alert('Signup Failed', err.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const { signInWithGoogle } = useGoogleAuth({
        intent: 'signup',
        onSuccess: async (data) => {
            try {
                setLoading(true);
                await markRegistered();
                setUser(data.user);
            } catch (err: any) {
                if (err.code === 'ACCOUNT_EXISTS') {
                    Alert.alert(
                        'Account already exists',
                        'An account already exists with this Google email. Please sign in instead.',
                        [{ text: 'Go to Sign In', onPress: () => router.replace('/(auth)/login') }, { text: 'Cancel', style: 'cancel' }]
                    );
                } else {
                    Alert.alert('Google Sign-Up Failed', err.message || 'Something went wrong.');
                }
            } finally {
                setLoading(false);
            }
        },
        onError: (msg) => Alert.alert('Google Sign-Up Error', msg),
    });

    return (
        <View style={{ flex: 1, backgroundColor: '#131A2E' }}>
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, backgroundColor: CREAM }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <StatusBar hidden  hidden={true} />
                {/* ── Curved header ──────────────────────────────────────── */}
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

                {/* ── Form body ──────────────────────────────────────────── */}
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

                    {/* Full Name */}
                    <Text style={s.label}>Full Name</Text>
                    <View style={s.inputRow}>
                        <MaterialCommunityIcons
                            name="card-account-details-outline"
                            size={22} color="#888" style={s.inputIcon}
                        />
                        <TextInput
                            style={s.input}
                            placeholder="Enter your full name..."
                            placeholderTextColor={MUTED}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                            returnKeyType="next"
                            onSubmitEditing={() => emailRef.current?.focus()}
                        />
                    </View>

                    {/* Email */}
                    <Text style={s.label}>Email Address</Text>
                    <View style={s.inputRow}>
                        <MaterialCommunityIcons
                            name="email-outline" size={22}
                            color="#888" style={s.inputIcon}
                        />
                        <TextInput
                            ref={emailRef}
                            style={s.input}
                            placeholder="Enter your email..."
                            placeholderTextColor={MUTED}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            returnKeyType="next"
                            onSubmitEditing={() => passRef.current?.focus()}
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
                            ref={passRef}
                            style={[s.input, { flex: 1 }]}
                            placeholder="Enter your password..."
                            placeholderTextColor={MUTED}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPass}
                            returnKeyType="done"
                            onSubmitEditing={handleSignup}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPass(p => !p)}
                            style={s.eyeBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons
                                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                                size={20} color={MUTED}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Submit button */}
                    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                        <TouchableOpacity
                            style={[s.button, loading && { opacity: 0.55 }]}
                            onPress={handleSignup}
                            onPressIn={pressIn}
                            onPressOut={pressOut}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={s.buttonText}>Create Account</Text>
                                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

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
                        <TouchableOpacity
                            style={s.socialBtn}
                            activeOpacity={0.75}
                            onPress={() => Alert.alert('Facebook', 'Coming soon')}
                        >
                            <FontAwesome name="facebook" size={27} color={TEAL} />
                        </TouchableOpacity>
                    </View>

                    {/* Sign in link */}
                    <TouchableOpacity
                        onPress={() => router.push('/(auth)/login')}
                        style={s.signinRow}
                        activeOpacity={0.7}
                    >
                        <Text style={s.signinText}>
                            Already have an account?{' '}
                            <Text style={s.signinLink}>Sign In</Text>
                            <Text style={{ color: '#555' }}>.</Text>
                        </Text>
                    </TouchableOpacity>

                </Animated.View>
            </ScrollView >
        </View >
    );
}

const s = StyleSheet.create({
    body: {
        backgroundColor: CREAM,
        paddingTop: 22,
        paddingBottom: 48,
    },

    label: {
        fontSize: 14,
        fontWeight: '700',
        color: TEXT,
        marginBottom: 8,
        marginTop: 18,
    },

    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: FIELD,
        borderRadius: 14,
        paddingHorizontal: 16,
        minHeight: 54,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: TEXT,
    },
    eyeBtn: { padding: 4 },

    rolesRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 44,
        marginTop: 4,
    },
    roleCard: {
        flex: 1,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 13,
        paddingHorizontal: 6,
        backgroundColor: '#ECEAE5',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#D5D2CB',
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

    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 50,
        backgroundColor: TEAL,
        borderRadius: 16,
        paddingVertical: 17,
        shadowColor: TEAL,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 18,
        letterSpacing: 0.3,
    },

    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 28,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#DDE0E8',
    },
    dividerText: {
        fontSize: 13,
        color: MUTED,
        fontWeight: '500',
    },

    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 18,
        marginTop: 14,
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

    signinRow: {
        alignItems: 'center',
        marginTop: 24,
        paddingBottom: 8,
    },
    signinText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    signinLink: {
        color: TEAL,
        fontWeight: '800',
        textDecorationLine: 'underline',
    },
});
