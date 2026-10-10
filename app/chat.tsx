// app/chat.tsx  ─  Premium User ↔ In-House Doctor  (User side)
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Platform, Alert, KeyboardAvoidingView,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/context/AuthContext';
import { connectWithSocket } from '@/app/socket/socket';
import { authFetch } from '@/src/services/authServices';
import type { Socket } from 'socket.io-client';

// ─────────────────────── Types ────────────────────────────────────────────────
type SenderRole = 'doctor' | 'user';
type MessageType = 'text' | 'file';

type ChatMessage = {
    _id: string;
    senderId: string;
    senderName: string;
    senderRole: SenderRole;
    text?: string | null;
    type: MessageType;
    fileName?: string | null;
    createdAt: string;
    readAt?: string | null;
};

// ─────────────────────── Helpers ─────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);
const fmtTime = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function UserChatScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const scrollRef = useRef<ScrollView>(null);
    const socketRef = useRef<Socket | null>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigation = useNavigation();

    useEffect(() => {
        // Hide the parent tab bar while this screen is active
        navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });

        return () => {
            // Restore it when leaving the chat screen
            navigation.getParent()?.setOptions({
                tabBarStyle: {
                    position: 'absolute',
                    // ...whatever your normal tab bar style is
                },
            });
        };
    }, [navigation]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [peerTyping, setPeerTyping] = useState(false);
    const [peerOnline, setPeerOnline] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scrollToEnd = useCallback(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }, []);

    // ── Setup socket & load history ──────────────────────────────────────────
    useEffect(() => {
        if (!user?._id) return;

        let active = true;

        const setup = async () => {
            try {
                // 1. Connect (idempotent — reuses existing socket if already connected)
                const socket = await connectWithSocket();
                if (!active) return;
                socketRef.current = socket;
                setConnected(true);

                // 2. Register listeners
                socket.on('chat-history', (history: ChatMessage[]) => {
                    if (!active) return;
                    setMessages(history);
                    setLoading(false);
                    scrollToEnd();
                });

                socket.on('receive-message', (msg: ChatMessage) => {
                    if (!active) return;
                    setMessages(prev => {
                        // Avoid duplicates (server echoes back to sender too)
                        if (prev.some(m => m._id === msg._id)) return prev;
                        return [...prev, msg];
                    });
                    scrollToEnd();
                    // Auto-mark incoming doctor messages as read
                    if (msg.senderRole === 'doctor') {
                        socket.emit('chat-read', { patientUserId: user._id });
                    }
                });

                socket.on('peer-typing', ({ isTyping }: { isTyping: boolean }) => {
                    if (!active) return;
                    setPeerTyping(isTyping);
                });

                socket.on('chat-peer-online', () => {
                    if (!active) return;
                    setPeerOnline(true);
                });

                socket.on('messages-read', () => {
                    if (!active) return;
                    // Mark all our messages as read
                    setMessages(prev =>
                        prev.map(m =>
                            m.senderRole === 'user' && !m.readAt
                                ? { ...m, readAt: new Date().toISOString() }
                                : m
                        )
                    );
                });

                socket.on('chat-error', ({ message }: { message: string }) => {
                    if (!active) return;
                    setError(message);
                    setLoading(false);
                    Alert.alert('Chat Error', message);
                });

                // 3. Join chat room — server validates access
                socket.emit('join-chat', { patientUserId: user._id });

            } catch (err: any) {
                if (!active) return;
                console.error('[UserChat] Setup error:', err);
                setError('Could not connect to chat. Please try again.');
                setLoading(false);
            }
        };

        setup();

        return () => {
            active = false;
            // Clean up listeners but don't disconnect (socket is shared)
            const socket = socketRef.current;
            if (socket) {
                socket.off('chat-history');
                socket.off('receive-message');
                socket.off('peer-typing');
                socket.off('chat-peer-online');
                socket.off('messages-read');
                socket.off('chat-error');
            }
        };
    }, [user?._id]);

    // ── Send message ─────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || sending || !socketRef.current || !user?._id) return;

        setInput('');
        setSending(true);

        // Stop typing indicator
        socketRef.current.emit('chat-typing', { patientUserId: user._id, isTyping: false });

        socketRef.current.emit('chat-message', {
            patientUserId: user._id,
            text: trimmed,
            type: 'text',
        });

        setSending(false);
    }, [sending, user?._id]);

    // ── Typing indicator ─────────────────────────────────────────────────────
    const handleInputChange = (text: string) => {
        setInput(text);
        if (!socketRef.current || !user?._id) return;

        socketRef.current.emit('chat-typing', { patientUserId: user._id, isTyping: true });

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            socketRef.current?.emit('chat-typing', { patientUserId: user._id, isTyping: false });
        }, 2000);
    };

    // ── Attach file ──────────────────────────────────────────────────────────
    const handleAttach = async () => {
        if (!socketRef.current || !user?._id) return;
        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*'],
            copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.[0]) {
            socketRef.current.emit('chat-message', {
                patientUserId: user._id,
                type: 'file',
                fileName: result.assets[0].name,
            });
        }
    };

    // ── Render bubble ────────────────────────────────────────────────────────
    const renderMessage = (msg: ChatMessage, idx: number) => {
        const isMe = msg.senderRole === 'user';
        const isFile = msg.type === 'file';
        const showDateLabel = idx === 0;

        return (
            <View key={msg._id}>
                {showDateLabel && (
                    <View style={s.dateLabelRow}>
                        <Text style={s.dateLabel}>
                            {new Date(msg.createdAt).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric'
                            }).toUpperCase()}
                        </Text>
                    </View>
                )}

                <View style={[s.msgRow, isMe && s.msgRowMe]}>
                    {!isMe && (
                        <View style={s.docAvatar}>
                            <MaterialCommunityIcons name="stethoscope" size={16} color="#5B4FE0" />
                        </View>
                    )}

                    <View style={{ maxWidth: '78%' }}>
                        {isFile ? (
                            <View style={[s.fileCard, isMe && s.fileCardMe]}>
                                <View style={s.fileCardTop}>
                                    <View style={s.fileIconBox}>
                                        <MaterialCommunityIcons name="file-pdf-box" size={22} color="#E0713E" />
                                    </View>
                                    <Text style={s.fileName} numberOfLines={1}>{msg.fileName}</Text>
                                    <TouchableOpacity style={s.downloadBtn}
                                        onPress={() => Alert.alert('Download', `Downloading ${msg.fileName}`)}>
                                        <Ionicons name="download-outline" size={20} color="#5B4FE0" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={s.fileSentBy}>{isMe ? 'SENT BY YOU' : `SENT BY ${msg.senderName.toUpperCase()}`}</Text>
                            </View>
                        ) : (
                            <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleDoctor]}>
                                <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>
                                    {msg.text}
                                </Text>
                            </View>
                        )}

                        <View style={[s.timeRow, isMe && s.timeRowMe]}>
                            <Text style={s.timeText}>{fmtTime(msg.createdAt)}</Text>
                            {isMe && msg.readAt && (
                                <Ionicons name="checkmark-done" size={14} color="#5B4FE0" style={{ marginLeft: 3 }} />
                            )}
                            {isMe && !msg.readAt && (
                                <Ionicons name="checkmark" size={14} color="#A6A08F" style={{ marginLeft: 3 }} />
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // ─────────────────────── Render ──────────────────────────────────────────
    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F6F2E7" />

            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color="#1E1B16" />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <View style={s.headerAvatar}>
                        <MaterialCommunityIcons name="doctor" size={24} color="#5B4FE0" />
                        {peerOnline && <View style={s.onlineDot} />}
                    </View>
                    <View>
                        <Text style={s.headerName}>In-House Doctor</Text>
                        <View style={s.headerSubRow}>
                            <Text style={s.headerSpecialty}>Your assigned physician</Text>
                            {peerOnline && <>
                                <Text style={s.headerDot}> • </Text>
                                <Text style={s.headerOnline}>Online</Text>
                            </>}
                        </View>
                    </View>
                </View>

                <View style={s.headerActions}>
                    <TouchableOpacity style={s.headerActionBtn}
                        onPress={() => Alert.alert('Voice Call', 'Coming soon')} activeOpacity={0.7}>
                        <Ionicons name="call-outline" size={19} color="#1E1B16" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.headerActionBtn}
                        onPress={() => Alert.alert('Video Call', 'Coming soon')} activeOpacity={0.7}>
                        <Ionicons name="videocam-outline" size={21} color="#1E1B16" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Connection status banner ────────────────────────────────── */}
            {!connected && !error && (
                <View style={s.connectingBanner}>
                    <ActivityIndicator size="small" color="#5B4FE0" style={{ marginRight: 8 }} />
                    <Text style={s.connectingText}>Connecting to secure channel…</Text>
                </View>
            )}
            {error && (
                <View style={[s.connectingBanner, { backgroundColor: '#FBEAE6' }]}>
                    <Ionicons name="warning-outline" size={16} color="#D14D3D" style={{ marginRight: 6 }} />
                    <Text style={[s.connectingText, { color: '#D14D3D' }]}>{error}</Text>
                </View>
            )}

            {/* ── Secure chat notice ──────────────────────────────────────── */}
            {connected && !error && (
                <View style={s.aiBanner}>
                    <View style={s.aiBannerLeft}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#5B4FE0" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.aiBannerLabel}>END-TO-END SECURED CHAT</Text>
                        <Text style={s.aiBannerText}>
                            Messages are encrypted and only visible to you and your assigned doctor.
                            {peerOnline && <Text style={s.aiBannerBold}> Your doctor is online.</Text>}
                        </Text>
                    </View>
                </View>
            )}

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* ── Messages ───────────────────────────────────────────── */}
                {loading ? (
                    <View style={s.loadingCenter}>
                        <ActivityIndicator size="large" color="#5B4FE0" />
                        <Text style={s.loadingText}>Loading conversation…</Text>
                    </View>
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        style={s.chatArea}
                        contentContainerStyle={[s.chatContent, messages.length === 0 && s.chatEmpty]}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={scrollToEnd}
                    >
                        {messages.length === 0 ? (
                            <View style={s.emptyState}>
                                <View style={s.emptyIconBox}>
                                    <MaterialCommunityIcons name="chat-outline" size={40} color="#A6A08F" />
                                </View>
                                <Text style={s.emptyTitle}>Start the conversation</Text>
                                <Text style={s.emptySubtitle}>Your in-house doctor will reply shortly.</Text>
                            </View>
                        ) : (
                            messages.map((msg, idx) => renderMessage(msg, idx))
                        )}
                        {peerTyping && (
                            <View style={[s.msgRow, { marginBottom: 8 }]}>
                                <View style={s.docAvatar}>
                                    <MaterialCommunityIcons name="stethoscope" size={16} color="#5B4FE0" />
                                </View>
                                <View style={[s.bubble, s.bubbleDoctor, { paddingVertical: 10 }]}>
                                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color="#5B4FE0" />
                                        <Text style={{ color: '#A6A08F', fontSize: 13, fontStyle: 'italic' }}>typing…</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                )}

                {/* ── Input bar ──────────────────────────────────────────── */}
                <View style={s.inputBar}>
                    <TouchableOpacity style={s.attachBtn} onPress={handleAttach} activeOpacity={0.7}>
                        <Ionicons name="add-circle-outline" size={25} color="#8A8578" />
                    </TouchableOpacity>

                    <TextInput
                        style={s.textInput}
                        placeholder="Type a message…"
                        placeholderTextColor="#A6A08F"
                        value={input}
                        onChangeText={handleInputChange}
                        multiline
                        maxLength={500}
                        editable={connected && !error}
                        returnKeyType="send"
                        onSubmitEditing={() => sendMessage(input)}
                    />

                    <TouchableOpacity
                        style={[s.sendBtn, (!input.trim() || sending || !connected) && s.sendBtnDisabled]}
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim() || sending || !connected}
                        activeOpacity={0.85}
                    >
                        {sending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Ionicons name="send" size={17} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

// ─────────────────────────── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F6F2E7' },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F2E7',
        paddingTop: Platform.OS === 'ios' ? 54 : 38, paddingBottom: 14,
        paddingHorizontal: 16, gap: 10,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 13, backgroundColor: '#EDE7D8',
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: {
        width: 44, height: 44, borderRadius: 15, backgroundColor: '#EDE9FB',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    onlineDot: {
        position: 'absolute', bottom: 1, right: 1, width: 10, height: 10,
        borderRadius: 5, backgroundColor: '#22c55e', borderWidth: 1.5, borderColor: '#F6F2E7',
    },
    headerName: { fontSize: 15, fontWeight: '800', color: '#1E1B16', letterSpacing: -0.2 },
    headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
    headerSpecialty: { fontSize: 12, color: '#8A8578', fontWeight: '500' },
    headerDot: { fontSize: 12, color: '#A6A08F' },
    headerOnline: { fontSize: 12, color: '#22c55e', fontWeight: '600' },
    headerActions: { flexDirection: 'row', gap: 6 },
    headerActionBtn: {
        width: 38, height: 38, borderRadius: 13, backgroundColor: '#EDE7D8',
        alignItems: 'center', justifyContent: 'center',
    },

    // Banners
    connectingBanner: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FB',
        paddingHorizontal: 16, paddingVertical: 10,
    },
    connectingText: { fontSize: 13, color: '#5B4FE0', fontWeight: '500' },
    aiBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        backgroundColor: '#EDE9FB',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    aiBannerLeft: {
        width: 30, height: 30, borderRadius: 10, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
        shadowColor: '#5B4FE0', shadowOpacity: 0.1, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    aiBannerLabel: { fontSize: 10, fontWeight: '800', color: '#5B4FE0', letterSpacing: 0.8, marginBottom: 4 },
    aiBannerText: { fontSize: 13, color: '#3A362C', lineHeight: 19 },
    aiBannerBold: { fontWeight: '700', color: '#1E1B16' },

    // Chat
    chatArea: { flex: 1, backgroundColor: '#FBF9F3' },
    chatContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 },
    chatEmpty: { flex: 1, justifyContent: 'center' },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#FBF9F3' },
    loadingText: { fontSize: 14, color: '#8A8578' },
    emptyState: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    emptyIconBox: {
        width: 84, height: 84, borderRadius: 42, backgroundColor: '#EDE7D8',
        alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E1B16' },
    emptySubtitle: { fontSize: 13, color: '#8A8578', textAlign: 'center' },

    // Date label
    dateLabelRow: { alignItems: 'center', marginBottom: 16 },
    dateLabel: {
        fontSize: 11, color: '#8A8578', fontWeight: '600', backgroundColor: '#EDE7D8',
        paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, letterSpacing: 0.3, overflow: 'hidden',
    },

    // Message rows
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 8 },
    msgRowMe: { justifyContent: 'flex-end' },
    docAvatar: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: '#EDE9FB',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 18,
    },

    // Bubbles
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 2 },
    bubbleDoctor: {
        backgroundColor: '#fff', borderTopLeftRadius: 4,
        shadowColor: '#3A362C', shadowOpacity: 0.05, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    bubbleMe: {
        backgroundColor: '#5B4FE0', borderTopRightRadius: 4,
        shadowColor: '#5B4FE0', shadowOpacity: 0.28, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    bubbleText: { fontSize: 15, color: '#1E1B16', lineHeight: 21 },
    bubbleTextMe: { color: '#fff' },

    // Time
    timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 2 },
    timeRowMe: { justifyContent: 'flex-end', paddingRight: 2, paddingLeft: 0 },
    timeText: { fontSize: 11, color: '#A6A08F' },

    // File card
    fileCard: {
        backgroundColor: '#fff', borderRadius: 16, borderTopLeftRadius: 4,
        overflow: 'hidden', marginBottom: 2,
        shadowColor: '#3A362C', shadowOpacity: 0.06, shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 }, elevation: 2, width: 260,
    },
    fileCardMe: { borderTopLeftRadius: 16, borderTopRightRadius: 4 },
    fileCardTop: {
        flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8,
        borderBottomWidth: 1, borderBottomColor: '#F5F1E6',
    },
    fileIconBox: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: '#FBEEDC',
        alignItems: 'center', justifyContent: 'center',
    },
    fileName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E1B16' },
    downloadBtn: {
        width: 32, height: 32, borderRadius: 10, backgroundColor: '#EDE9FB',
        alignItems: 'center', justifyContent: 'center',
    },
    fileSentBy: {
        fontSize: 10, color: '#A6A08F', fontWeight: '700', letterSpacing: 0.5,
        paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FBF9F3', textTransform: 'uppercase',
    },

    // Input bar
    inputBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F6F2E7',
        paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    },
    attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    textInput: {
        flex: 1, backgroundColor: '#fff', borderRadius: 22,
        paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        fontSize: 14, color: '#1E1B16', maxHeight: 90,
        shadowColor: '#3A362C', shadowOpacity: 0.04, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: '#5B4FE0',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#5B4FE0', shadowOpacity: 0.35, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 5,
    },
    sendBtnDisabled: { backgroundColor: '#CFC9F5', shadowOpacity: 0, elevation: 0 },
});
