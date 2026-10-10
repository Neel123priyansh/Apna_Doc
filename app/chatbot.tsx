// App/app/(health)/ai-insights.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    FlatList, Platform, StatusBar,
    ActivityIndicator, KeyboardAvoidingView, Alert, Image, Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system'; // add this import at the top
import { authFetch } from '../src/services/authServices';
import Markdown from 'react-native-markdown-display';
import PremiumOverlay from '../components/PremiumOverlay';
import { useAuth } from '../context/AuthContext';

// ─────────────────────── Types ────────────────────────────────────────────────
type Role = 'ai' | 'user';
type MessageStatus = 'done' | 'thinking' | 'streaming';

type Message = {
    id: string;
    role: Role;
    text: string;
    time: string;
    status: MessageStatus;
    // ── Attachment preview shown on the sent bubble ─────────────────────────
    attachmentThumb?: string;   // data URI for an attached image
    attachmentLabel?: string;   // filename for an attached document
};

// What the user currently has staged to send with their next message.
type PendingAttachment =
    | { type: 'image'; uri: string; base64: string }
    | { type: 'document'; uri: string; name: string; extractedText: string };

// ─────────────────────── Constants ───────────────────────────────────────────
const QUICK_PROMPTS = [
    "What's my health score?",
    '✦ Analyze my report',
    'Show wellness tips',
    'Check my vitals',
];

// Vision-capable model, used only when an image is attached.
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = 'openai/gpt-oss-20b';

// ── System prompt — scoped strictly to medical/health topics ─────────────────
const SYSTEM_PROMPT = `
You are Apna Doctoro AI, a health assistant.

Only answer health, medicine, nutrition, fitness, mental wellbeing,
symptoms, medications, vitals, and medical-document questions.

Explain medical information clearly in simple language.
Do not diagnose. For medical decisions, recommend consultation
with an appropriate healthcare professional.

When analyzing uploaded medical documents, base your answer only
on information present in the document and clearly identify
uncertainty or missing information.

Keep responses concise and practical.
`;

const INITIAL_MESSAGE: Message = {
    id: 'init',
    role: 'ai',
    text: "Hello! I'm Apna Doctoro AI, your AI health assistant. I can help analyze your records, check your health score, or provide wellness tips. You can also attach a photo or PDF of a medical report and ask me about it. How can I assist you today?",
    time: '',
    status: 'done',
};

const fmtTime = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const uid = () => Math.random().toString(36).slice(2);

// ─────────────────────── Typing Indicator ───────────────────────────────────
const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true, delay }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true })
                ])
            ).start();
        };

        animateDot(dot1, 0);
        animateDot(dot2, 150);
        animateDot(dot3, 300);
    }, [dot1, dot2, dot3]);

    return (
        <View style={ms.thinkingRow}>
            <Animated.View style={[ms.dot, { opacity: 0.7, transform: [{ translateY: dot1 }] }]} />
            <Animated.View style={[ms.dot, { opacity: 0.7, transform: [{ translateY: dot2 }] }]} />
            <Animated.View style={[ms.dot, { opacity: 0.7, transform: [{ translateY: dot3 }] }]} />
        </View>
    );
};

// ─────────────────────── Screen ───────────────────────────────────────────────
export default function AIInsightsScreen() {
    const listRef = useRef<FlatList>(null);
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // ── Attachment state ─────────────────────────────────────────────────────
    const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
    const [attachmentParsing, setAttachmentParsing] = useState(false);

    const { user } = useAuth();
    const isPremium = user?.isPremium;

    // Count how many messages the user has sent (role === 'user')
    const userMessageCount = messages.filter(m => m.role === 'user' && m.status === 'done').length;
    const isPremiumLocked = !isPremium && userMessageCount >= 2;

    // ── Scroll to bottom ────────────────────────────────────────────────────
    const scrollToEnd = () => {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    };

    // ── Attachment: menu ─────────────────────────────────────────────────────
    const openAttachMenu = () => {
        if (loading || isPremiumLocked || attachmentParsing) return;
        Alert.alert(
            'Add to your message',
            'Attach a photo or document of a medical report, prescription, or lab result.',
            [
                { text: 'Take Photo', onPress: handleTakePhoto },
                { text: 'Choose Photo', onPress: handlePickImage },
                { text: 'Choose Document (PDF)', onPress: handlePickDocument },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    // ── Attachment: camera ───────────────────────────────────────────────────
    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required to take a photo of your document.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            base64: true,
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
            setAttachment({
                type: 'image',
                uri: result.assets[0].uri,
                base64: result.assets[0].base64,
            });
        }
    };

    // ── Attachment: gallery ──────────────────────────────────────────────────
    const handlePickImage = async () => {
        if (Platform.OS !== 'web') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please allow photo library access to attach an image.');
                return;
            }
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            base64: true,
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
            setAttachment({
                type: 'image',
                uri: result.assets[0].uri,
                base64: result.assets[0].base64,
            });
        }
    };

    // ── Attachment: PDF document ──────────────────────────────────────────────
    // Uploads to the backend to extract text, so the AI has real content to
    // reason about instead of just a filename.
    // ── Attachment: PDF document ──────────────────────────────────────────────
    // Uploads to the backend to extract text, so the AI has real content to
    // reason about instead of just a filename.
    //
    // IMPORTANT: must use the { uri, name, type } object shape for the
    // FormData part on React Native — NOT fetch(uri).blob(). RN's fetch
    // polyfill has a special case for that object shape that performs a
    // real native file upload; a plain Blob from fetch().blob() does not
    // reliably serialize through the RN bridge and can silently corrupt
    // the upload (this was producing garbled/binary "text" being sent to
    // the AI instead of the actual extracted PDF content).
    const handlePickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'text/plain'],
            copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;

        const asset = result.assets[0];
        setAttachmentParsing(true);
        try {
            // expo-file-system's File implements the Blob/bytes() shape that
            // Expo's global fetch (winter runtime, SDK 54+) requires for
            // FormData parts. The old RN-style { uri, name, type } object
            // throws "Unsupported FormDataPart implementation" under this
            // runtime — it's only understood by RN's own fetch, which Expo
            // no longer uses by default.
            const file = new File(asset.uri);

            const formData = new FormData();
            formData.append('file', file, asset.name || 'document.pdf');

            const res = await authFetch('/api/ai/parse-document', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Could not read that document.');

            const extracted = (data.text || '').trim();
            const printableRatio = extracted.length
                ? extracted.replace(/[^\x20-\x7E\n]/g, '').length / extracted.length
                : 0;

            if (!extracted || printableRatio < 0.85) {
                throw new Error('That document could not be read clearly. Please try a different file or copy the text in manually.');
            }

            setAttachment({
                type: 'document',
                uri: asset.uri,
                name: asset.name,
                extractedText: extracted,
            });
        } catch (err: any) {
            Alert.alert('Could not attach document', err.message || 'Please try a different file.');
        } finally {
            setAttachmentParsing(false);
        }
    };
    const removeAttachment = () => setAttachment(null);

    // ── Send message ────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if ((!trimmed && !attachment) || loading || attachmentParsing) return;

        const currentAttachment = attachment;
        setInput('');
        setAttachment(null);
        setLoading(true);

        // Add user message (with attachment preview if present)
        const userMsg: Message = {
            id: uid(),
            role: 'user',
            text: trimmed || (currentAttachment?.type === 'image' ? 'Sent a photo' : 'Sent a document'),
            time: fmtTime(),
            status: 'done',
            attachmentThumb: currentAttachment?.type === 'image'
                ? `data:image/jpeg;base64,${currentAttachment.base64}`
                : undefined,
            attachmentLabel: currentAttachment?.type === 'document'
                ? currentAttachment.name
                : undefined,
        };

        // Add AI thinking placeholder
        const thinkId = uid();
        const thinkMsg: Message = {
            id: thinkId, role: 'ai',
            text: currentAttachment ? 'Reviewing what you shared...' : 'Analyzing recent health records...',
            time: '', status: 'thinking',
        };

        setMessages(prev => [...prev, userMsg, thinkMsg]);
        scrollToEnd();


        const MAX_HISTORY_MESSAGES = 3;
        const history = messages
            .filter(m => m.status === 'done')
            .slice(-MAX_HISTORY_MESSAGES)
            .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

        // ── Build the new user turn's content ────────────────────────────────
        // Image attachments use a multimodal content array (text + image_url)
        // so the vision model can actually see the document. Document
        // attachments are just extracted text folded into the message.
        let newContent: string | Array<Record<string, any>>;
        let model = TEXT_MODEL;

        if (currentAttachment?.type === 'image') {
            newContent = [
                { type: 'text', text: trimmed || 'Please review this photo of my medical document.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${currentAttachment.base64}` } },
            ];
            model = VISION_MODEL;
        } else if (currentAttachment?.type === 'document') {
            const docBlock = `\n\n[Attached document: ${currentAttachment.name}]\n${currentAttachment.extractedText}`;
            newContent = `${trimmed || 'Please review this document.'}${docBlock}`;
        } else {
            newContent = trimmed;
        }

        history.push({ role: 'user', content: newContent as any });

        try {
            // Give the request a hard ceiling — OCR on a photo can be slow, but it
            // should never hang the UI indefinitely. If it takes longer than this,
            // surface a clear error instead of leaving the thinking dots stuck.
            const controller = new AbortController();
            const timeoutMs = currentAttachment ? 60000 : 30000; // images get more time (OCR)
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await authFetch('/api/ai/chat', {
                method: 'POST',
                body: JSON.stringify({
                    systemPrompt: SYSTEM_PROMPT,
                    messages: history,
                    model,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'AI service is unavailable.');
            }
            const aiText = data?.reply || "I'm sorry, I couldn't process that. Please try again.";

            const aiMsg: Message = {
                id: uid(), role: 'ai', text: aiText, time: fmtTime(), status: 'done',
            };

            setMessages(prev => [
                ...prev.filter(m => m.id !== thinkId),
                aiMsg,
            ]);
        } catch (err: any) {
            const isTimeout = err?.name === 'AbortError';
            setMessages(prev => [
                ...prev.filter(m => m.id !== thinkId),
                {
                    id: uid(), role: 'ai',
                    text: isTimeout
                        ? "That's taking longer than expected to analyze — this can happen with photos. Please try again, or try a clearer/smaller image."
                        : 'Sorry, I ran into an issue. Please check your connection and try again.',
                    time: fmtTime(), status: 'done',
                },
            ]);
        } finally {
            setLoading(false);
            scrollToEnd();
        }
    }, [messages, loading, attachment, attachmentParsing]);

    // ── Message row renderer ─────────────────────────────────────────────────
    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isUser = item.role === 'user';
        const isThinking = item.status === 'thinking';
        const isFirst = index === 0;

        return (
            <>
                {isFirst && (
                    <View style={ms.dividerRow}>
                        <Text style={ms.dividerText}>TODAY</Text>
                    </View>
                )}

                <View style={[ms.row, isUser ? ms.rowUser : ms.rowAI]}>
                    <View style={[ms.bubble, isUser ? ms.bubbleUser : ms.bubbleAI]}>
                        {/* Attachment preview inside the sent bubble */}
                        {item.attachmentThumb && (
                            <Image source={{ uri: item.attachmentThumb }} style={ms.bubbleImage} />
                        )}
                        {item.attachmentLabel && (
                            <View style={ms.bubbleDocChip}>
                                <MaterialCommunityIcons name="file-pdf-box" size={16} color="#0B3B2E" />
                                <Text style={ms.bubbleDocText} numberOfLines={1}>{item.attachmentLabel}</Text>
                            </View>
                        )}

                        {isThinking ? (
                            <TypingIndicator />
                        ) : (
                            <Markdown
                                style={{
                                    body: {
                                        fontSize: 15,
                                        color: isUser ? '#0B3B2E' : '#1F2937',
                                        lineHeight: 21,
                                    },
                                    strong: { fontWeight: '700' },
                                    paragraph: { marginTop: 0, marginBottom: 8 },
                                    bullet_list: { marginBottom: 6 },
                                    ordered_list: { marginBottom: 6 },
                                    list_item: { marginBottom: 3 },
                                }}
                            >
                                {item.text}
                            </Markdown>
                        )}
                    </View>

                    {!isThinking && item.time ? (
                        <Text style={[ms.timestamp, isUser ? ms.timestampUser : ms.timestampAI]}>
                            {item.time}
                        </Text>
                    ) : null}
                </View>
            </>
        );
    };

    const canSend = (input.trim().length > 0 || !!attachment) && !loading && !isPremiumLocked && !attachmentParsing;

    // ─────────────────────── Render ──────────────────────────────────────────
    return (
        <View style={s.root}>
            <StatusBar hidden  barStyle="dark-content" backgroundColor="#F7F5EF" />

            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={s.header}>
                <TouchableOpacity
                    style={s.backBtn}
                    activeOpacity={0.7}
                    onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                >
                    <Ionicons name="arrow-back" size={22} color="#1F2937" />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <View style={s.headerAvatarWrap}>
                        <View style={s.headerAvatar}>
                            <MaterialCommunityIcons name="head-cog-outline" size={20} color="#1A9E8F" />
                        </View>
                        <View style={s.onlineDot} />
                    </View>
                    <View>
                        <Text style={s.headerName}>Apna Doctoro AI</Text>
                        <Text style={s.headerSub}>AI Health Assistant</Text>
                    </View>
                </View>

                <TouchableOpacity style={s.bellBtn} activeOpacity={0.7}>
                    <Ionicons name="notifications-outline" size={20} color="#1F2937" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: '#F6F2E7' }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
            >
                {/* ── Chat list ──────────────────────────────────────────── */}
                <View style={{ flex: 1, position: 'relative' }}>
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={s.chatContent}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={scrollToEnd}
                        scrollEnabled={!isPremiumLocked}
                        keyboardShouldPersistTaps="handled"
                    />

                    {isPremiumLocked && (
                        <PremiumOverlay
                            title={'Unlock Unlimited\nAI Health Chat'}
                            bullets={[
                                '✦  Unlimited conversations with Apna Doctoro AI',
                                '✦  Personalized health insights & advice',
                                '✦  Deep analysis of your medical reports',
                                '✦  24/7 AI-powered wellness guidance',
                            ]}
                            height={310}
                        />
                    )}
                </View>

                <View style={s.quickRow}>
                    {QUICK_PROMPTS.map(q => (
                        <TouchableOpacity
                            key={q}
                            style={s.quickChip}
                            onPress={() => sendMessage(q.replace('✦ ', ''))}
                            activeOpacity={0.75}
                            disabled={loading || isPremiumLocked}
                        >
                            <Text style={s.quickChipText} numberOfLines={1}>{q}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Pending attachment preview ───────────────────────────── */}
                {(attachment || attachmentParsing) && (
                    <View style={s.attachPreviewRow}>
                        {attachmentParsing ? (
                            <View style={s.attachChip}>
                                <ActivityIndicator size="small" color="#1A9E8F" />
                                <Text style={s.attachChipText}>Reading document...</Text>
                            </View>
                        ) : attachment?.type === 'image' ? (
                            <View style={s.attachChip}>
                                <Image source={{ uri: attachment.uri }} style={s.attachThumb} />
                                <Text style={s.attachChipText}>Photo ready to send</Text>
                                <TouchableOpacity onPress={removeAttachment} hitSlop={8}>
                                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                        ) : attachment?.type === 'document' ? (
                            <View style={s.attachChip}>
                                <MaterialCommunityIcons name="file-pdf-box" size={20} color="#1A9E8F" />
                                <Text style={s.attachChipText} numberOfLines={1}>{attachment.name}</Text>
                                <TouchableOpacity onPress={removeAttachment} hitSlop={8}>
                                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                )}

                <View style={[s.inputBar, isPremiumLocked && s.inputBarLocked]}>
                    {/* ── Attach button ──────────────────────────────────── */}
                    <TouchableOpacity
                        style={[s.attachBtn, (loading || isPremiumLocked || attachmentParsing) && s.attachBtnDisabled]}
                        onPress={openAttachMenu}
                        disabled={loading || isPremiumLocked || attachmentParsing}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="add-circle" size={26} color={isPremiumLocked ? '#C9C4B6' : '#1A9E8F'} />
                    </TouchableOpacity>

                    <TextInput
                        style={s.textInput}
                        placeholder={isPremiumLocked ? 'Upgrade to continue chatting...' : 'Ask about your health or attach a report...'}
                        placeholderTextColor="#9CA3AF"
                        value={input}
                        onChangeText={setInput}
                        multiline
                        maxLength={500}
                        editable={!loading && !isPremiumLocked}
                        onSubmitEditing={() => sendMessage(input)}
                        returnKeyType="send"
                    />

                    <TouchableOpacity
                        style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
                        onPress={() => sendMessage(input)}
                        disabled={!canSend}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Ionicons name={isPremiumLocked ? 'lock-closed' : 'send'} size={17} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

// ─────────────────────── Message styles ──────────────────────────────────────
const ms = StyleSheet.create({
    dividerRow: {
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 18,
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        letterSpacing: 0.6,
    },

    row: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    rowAI: {
        alignItems: 'flex-start',
    },
    rowUser: {
        alignItems: 'flex-end',
    },

    bubble: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '80%',
    },
    bubbleAI: {
        backgroundColor: '#EDEBE3',
        borderTopLeftRadius: 6,
    },
    bubbleUser: {
        backgroundColor: '#7FD6B4',
        borderTopRightRadius: 6,
    },

    // Attachment inside a sent bubble
    bubbleImage: {
        width: 180,
        height: 180,
        borderRadius: 14,
        marginBottom: 8,
        backgroundColor: '#DDEDE6',
    },
    bubbleDocChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginBottom: 8,
    },
    bubbleDocText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0B3B2E',
        maxWidth: 160,
    },

    msgText: {
        fontSize: 15,
        color: '#1F2937',
        lineHeight: 21,
    },
    msgTextUser: {
        color: '#0B3B2E',
    },

    timestamp: {
        fontSize: 11,
        color: '#ADB3BE',
        marginTop: 5,
        fontWeight: '500',
    },
    timestampAI: {
        marginLeft: 4,
    },
    timestampUser: {
        marginRight: 4,
    },

    thinkingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 2,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#9CA3AF',
        opacity: 0.5,
    },
});

// ─────────────────────────── Main styles ─────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F7F5EF',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingBottom: 14,
        backgroundColor: '#F7F5EF',
        borderBottomWidth: 1,
        borderBottomColor: '#EAE7DD',
        gap: 4,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerAvatarWrap: {
        position: 'relative',
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E3F5EF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: '#F7F5EF',
    },
    headerName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: -0.1,
    },
    headerSub: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
        marginTop: 1,
    },
    bellBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Chat
    chatContent: {
        paddingTop: 14,
        paddingBottom: 10,
    },

    // Quick prompts
    quickRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#F6F2E7',
    },
    quickChip: {
        borderWidth: 1,
        borderColor: '#E3E0D6',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
    },
    quickChipText: {
        fontSize: 13,
        color: '#1A9E8F',
        fontWeight: '600',
    },

    // ── Attachment preview row (above the input bar) ──────────────────────────
    attachPreviewRow: {
        paddingHorizontal: 20,
        paddingTop: 4,
        backgroundColor: '#F6F2E7',
    },
    attachChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#E3E0D6',
        alignSelf: 'flex-start',
        maxWidth: '90%',
    },
    attachThumb: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#EDEBE3',
    },
    attachChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        flexShrink: 1,
    },

    // Input
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 12,
        marginBottom: 40,
        backgroundColor: '#F6F2E7',
    },
    attachBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    attachBtnDisabled: {
        opacity: 0.5,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#EDEBE3',
        borderRadius: 15,
        paddingHorizontal: 16,
        paddingVertical: 18,
        fontSize: 14,
        color: '#1F2937',
        maxHeight: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    sendBtn: {
        width: 58,
        height: 58,
        borderRadius: 15,
        backgroundColor: '#1A9E8F',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1A9E8F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    sendBtnDisabled: {
        backgroundColor: '#C9E4DC',
        shadowOpacity: 0,
        elevation: 0,
    },
    inputBarLocked: {
        opacity: 0.5,
    },

});
