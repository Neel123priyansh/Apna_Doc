// app/(assessment)/ai-sound-analysis.tsx
//
// Flow:
//   1. User reads the sentence aloud (words highlight as they are recognised).
//   2. When the sentence is complete, the AI speaks 5 mood questions (TTS).
//      The circles PULSATE while the AI is speaking.
//   3. After each question the mic opens automatically and the user answers
//      by voice. A pause (silence) ends the answer and the next question starts.
//   4. After question 5 the answers are scored and a mood result is shown.
//
// Extra dependency:  npx expo install expo-speech

import React, { useEffect, useRef, useState } from 'react';

import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Animated,
    Easing,
    Alert,
    Platform,
    PermissionsAndroid,
} from 'react-native';

import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

import VoiceToText, {
    VoiceToTextEvents,
} from '@appcitor/react-native-voice-to-text';


// ─────────────────────────────────────────────────────────────────────────────
// Brand
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#F5F0E8';
const DARK_TEXT = '#121212';
const MUTED = '#9A9184';
const ORANGE = '#E8944A';
const TEXT_DARK = '#121212';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';
const SAID_TINT = '#C7CFC0';

const RING_OUTER = '#DCE4CB';
const RING_MID = '#B7CB98';
const RING_INNER = '#8FA876';
const RING_CORE = '#3F4A2E';

const TOTAL_STEPS = 6;
const CURRENT_STEP = 6;
const CIRCLE_SIZE = 280;

// How long (ms) of silence ends an answer / how long we wait for the user to start
const SILENCE_MS = 2200;
const NO_SPEECH_MS = 9000;


// ─────────────────────────────────────────────────────────────────────────────
// Target sentence
// ─────────────────────────────────────────────────────────────────────────────

const RAW_SENTENCE = 'I believe in Apna Doctoro, with all my heart.';
const WORDS = RAW_SENTENCE.split(' ');

const normalise = (word: string) => word.toLowerCase().replace(/[^a-z]/g, '');
const NORMALISED_WORDS = WORDS.map(normalise);


// ─────────────────────────────────────────────────────────────────────────────
// Mood questions (spoken by the AI, never shown as text)
// ─────────────────────────────────────────────────────────────────────────────

type Question = {
    text: string;
    // true when "yes" means something negative (e.g. "Have you felt stressed?")
    yesIsNegative?: boolean;
};

const QUESTIONS: Question[] = [
    { text: 'How are you feeling right now?' },
    { text: 'How would you describe your energy level today?' },
    { text: 'Have you felt stressed or anxious over the past few days?', yesIsNegative: true },
    { text: 'How well did you sleep last night?' },
    { text: 'What is one thing that made you smile or feel good recently?' },
];

const INTRO =
    'Thank you. Now I will ask you five short questions. Please answer each one out loud after I finish. ';


// ─────────────────────────────────────────────────────────────────────────────
// Simple on-device mood scoring
// (swap scoreAnswer / getMood for a call to your backend or an LLM if you want
//  deeper analysis)
// ─────────────────────────────────────────────────────────────────────────────

const POSITIVE: Record<string, number> = {
    good: 1, great: 1.5, happy: 1.5, well: 1, amazing: 1.5, awesome: 1.5,
    excellent: 1.5, calm: 1, relaxed: 1, peaceful: 1, energetic: 1.5,
    energized: 1.5, fantastic: 1.5, wonderful: 1.5, positive: 1, better: 1,
    cheerful: 1.5, joyful: 1.5, excited: 1.5, rested: 1, refreshed: 1,
    content: 1, grateful: 1, blessed: 1, nice: 1, love: 1, fun: 1, proud: 1,
    hopeful: 1, motivated: 1, strong: 1, healthy: 1, comfortable: 1,
    smile: 1, smiled: 1, fine: 0.5, okay: 0.5, ok: 0.5, alright: 0.5,
};

const NEGATIVE: Record<string, number> = {
    bad: 1, sad: 1.5, tired: 1, exhausted: 1.5, stressed: 1.5, anxious: 1.5,
    worried: 1, angry: 1.5, upset: 1, depressed: 2, low: 1, terrible: 1.5,
    awful: 1.5, horrible: 1.5, lonely: 1.5, overwhelmed: 1.5, nervous: 1,
    sleepy: 1, drained: 1.5, hopeless: 2, down: 1, irritated: 1,
    frustrated: 1, worse: 1, sick: 1, pain: 1, tense: 1, restless: 1,
    insomnia: 1.5, scared: 1, afraid: 1, miserable: 2, unhappy: 1.5,
    fatigued: 1, lazy: 0.5, burnout: 1.5, crying: 1, cried: 1,
    nightmare: 1, nightmares: 1, awake: 0.5,
};

const NEGATORS = [
    'not', 'no', 'never', 'dont', 'isnt', 'wasnt', 'cant',
    'couldnt', 'didnt', 'hardly', 'barely', 'neither',
];
const YES_WORDS = ['yes', 'yeah', 'yep', 'yup', 'definitely', 'often', 'always', 'constantly', 'lot'];
const NO_WORDS = ['no', 'nope', 'nah', 'never'];

const scoreAnswer = (text: string, yesIsNegative?: boolean): number => {
    if (!text.trim()) return 0;

    const tokens = text.toLowerCase().split(/\s+/).map(normalise).filter(Boolean);
    let score = 0;

    tokens.forEach((token, i) => {
        const value = POSITIVE[token] ?? (NEGATIVE[token] ? -NEGATIVE[token] : 0);
        if (!value) return;

        const prev = tokens.slice(Math.max(0, i - 2), i);
        const negated = prev.some(p => NEGATORS.includes(p));
        score += negated ? -value : value;
    });

    if (yesIsNegative) {
        const hasYes = tokens.some(t => YES_WORDS.includes(t));
        const hasNo = tokens.some(t => NO_WORDS.includes(t));
        if (hasYes && !hasNo) score -= 1.5;
        if (hasNo && !hasYes) score += 1.5;
    }

    return Math.max(-2, Math.min(2, score));
};

type MoodResult = {
    label: string;
    emoji: string;
    description: string;
    score: number; // -10 … +10
};

const getMood = (answers: string[]): MoodResult => {
    const total = answers.reduce(
        (sum, answer, i) => sum + scoreAnswer(answer, QUESTIONS[i]?.yesIsNegative),
        0
    );
    const score = Math.round(total * 10) / 10;

    if (score >= 5)
        return { label: 'Happy', emoji: '😄', description: 'You sound positive and full of energy.', score };
    if (score >= 2)
        return { label: 'Calm & Content', emoji: '🙂', description: 'You seem relaxed and in a good place.', score };
    if (score > -2)
        return { label: 'Neutral', emoji: '😐', description: 'Your mood seems balanced, with no strong signals.', score };
    if (score > -5)
        return { label: 'Stressed', emoji: '😟', description: 'You sound a little tense or worn out lately.', score };
    return { label: 'Low', emoji: '😔', description: 'You sound low. Consider talking to someone you trust.', score };
};


// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Phase =
    | 'idle'        // waiting to start
    | 'sentence'    // user is reading the sentence
    | 'asking'      // AI is speaking a question  (circles pulsate)
    | 'listening'   // user is answering
    | 'processing'  // between answer and next question
    | 'done';       // finished, mood result shown

export default function AISoundAnalysisScreen() {

    const router = useRouter();
    const params = useLocalSearchParams();

    const [phase, setPhase] = useState<Phase>('idle');
    const [spokenIndex, setSpokenIndex] = useState(0);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [result, setResult] = useState<MoodResult | null>(null);
    const [answersState, setAnswersState] = useState<string[]>([]);

    // Refs (safe to read from native event callbacks / timers)
    const phaseRef = useRef<Phase>('idle');
    const listeningRef = useRef(false);
    const transcriptRef = useRef('');
    const qIndexRef = useRef(0);
    const answersRef = useRef<string[]>([]);
    const retryRef = useRef<number[]>([]);
    const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const noSpeechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Always-fresh handle to the latest functions for the event listeners
    const api = useRef<{
        handleSentenceResult: (t: string) => void;
        handleAnswerResult: (t: string) => void;
        handleEnd: () => void;
    }>({
        handleSentenceResult: () => { },
        handleAnswerResult: () => { },
        handleEnd: () => { },
    });

    const updatePhase = (next: Phase) => {
        phaseRef.current = next;
        setPhase(next);
    };

    const clearTimers = () => {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        if (noSpeechTimer.current) clearTimeout(noSpeechTimer.current);
        silenceTimer.current = null;
        noSpeechTimer.current = null;
    };


    // ───────────────────────────────────────────────────────────────────────
    // Pulse animation
    // Strong + fast while the AI speaks, gentle while the user speaks
    // ───────────────────────────────────────────────────────────────────────

    const pulse = useRef(new Animated.Value(0)).current;
    const aiSpeaking = phase === 'asking';
    const shouldPulse = phase === 'asking' || phase === 'listening' || phase === 'sentence';

    useEffect(() => {
        let loop: Animated.CompositeAnimation | null = null;

        if (shouldPulse) {
            const duration = aiSpeaking ? 650 : 900;

            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 0,
                        duration,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
        } else {
            pulse.setValue(0);
        }

        return () => {
            loop?.stop();
        };
    }, [shouldPulse, aiSpeaking, pulse]);

    const outerScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: aiSpeaking ? [1, 1.2] : [1, 1.12],
    });
    const midScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: aiSpeaking ? [1, 1.13] : [1, 1.07],
    });
    const innerScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: aiSpeaking ? [1, 1.09] : [1, 1],
    });
    const coreScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: aiSpeaking ? [1, 1.15] : [1, 1],
    });


    // ───────────────────────────────────────────────────────────────────────
    // Sentence matching (unchanged logic)
    // ───────────────────────────────────────────────────────────────────────

    const handleSentenceResult = (transcript: string) => {
        if (!transcript) return;

        const heard = transcript
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map(normalise)
            .filter(Boolean);

        if (!heard.length) return;

        console.log('[Speech] Heard:', heard);

        setSpokenIndex(previousIndex => {
            let index = previousIndex;

            while (index < NORMALISED_WORDS.length) {
                const expected = NORMALISED_WORDS[index];

                if (heard.indexOf(expected) !== -1) {
                    index++;
                    continue;
                }

                // Speech engines often drop the final vowel of "Doctoro"
                if (expected === 'doctoro' && heard.includes('doctor')) {
                    index++;
                    continue;
                }

                break;
            }

            return index;
        });
    };


    // ───────────────────────────────────────────────────────────────────────
    // Answer capture
    // ───────────────────────────────────────────────────────────────────────

    const handleAnswerResult = (transcript: string) => {
        if (!transcript) return;

        transcriptRef.current = transcript;

        // User started talking: cancel the "no speech" timer and
        // (re)start the silence timer. Silence = answer finished.
        if (noSpeechTimer.current) {
            clearTimeout(noSpeechTimer.current);
            noSpeechTimer.current = null;
        }
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(finishAnswer, SILENCE_MS);
    };

    const handleEnd = () => {
        console.log('[VoiceToText] END');

        // We stopped it ourselves – ignore
        if (!listeningRef.current) return;
        listeningRef.current = false;

        if (phaseRef.current === 'sentence') {
            // Android ends recognition after a pause: keep listening
            setTimeout(() => {
                if (phaseRef.current === 'sentence') startListeningSafe();
            }, 400);
        } else if (phaseRef.current === 'listening') {
            if (transcriptRef.current.trim()) {
                finishAnswer();
            } else {
                setTimeout(() => {
                    if (phaseRef.current === 'listening') startListeningSafe();
                }, 400);
            }
        }
    };

    // refresh the handle every render
    api.current = { handleSentenceResult, handleAnswerResult, handleEnd };


    // ───────────────────────────────────────────────────────────────────────
    // VoiceToText listeners (subscribed once)
    // ───────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const route = (value: string) => {
            if (phaseRef.current === 'sentence') {
                api.current.handleSentenceResult(value);
            } else if (phaseRef.current === 'listening') {
                api.current.handleAnswerResult(value);
            }
        };

        const subs = [
            VoiceToText.addEventListener(VoiceToTextEvents.START, () =>
                console.log('[VoiceToText] START')
            ),
            VoiceToText.addEventListener(VoiceToTextEvents.BEGIN, () =>
                console.log('[VoiceToText] USER STARTED SPEAKING')
            ),
            VoiceToText.addEventListener(VoiceToTextEvents.PARTIAL_RESULTS, event => {
                console.log('[VoiceToText] PARTIAL:', event.value);
                route(event.value);
            }),
            VoiceToText.addEventListener(VoiceToTextEvents.RESULTS, event => {
                console.log('[VoiceToText] FINAL:', event.value);
                route(event.value);
            }),
            VoiceToText.addEventListener(VoiceToTextEvents.ERROR, event => {
                console.warn('[VoiceToText] ERROR:', event);

                // Normal Android timeout / no-match errors: ignore
                if (event.code === 6 || event.code === 7) return;

                if (listeningRef.current && phaseRef.current === 'sentence') {
                    Alert.alert(
                        'Speech Recognition Error',
                        event.message || 'Unable to recognise your speech.'
                    );
                }
            }),
            VoiceToText.addEventListener(VoiceToTextEvents.END, () =>
                api.current.handleEnd()
            ),
        ];

        return () => {
            subs.forEach(sub => sub.remove());
            try {
                VoiceToText.destroy();
            } catch (error) {
                console.warn('VoiceToText cleanup error:', error);
            }
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            listeningRef.current = false;
            clearTimers();
            Speech.stop();
            try {
                VoiceToText.destroy();
            } catch { }
        };
    }, []);


    // ───────────────────────────────────────────────────────────────────────
    // Permissions + listening helpers
    // ───────────────────────────────────────────────────────────────────────

    const requestAndroidPermission = async () => {
        if (Platform.OS !== 'android') return true;

        try {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                    title: 'Microphone Permission',
                    message: 'Apna Doctor needs microphone access to analyse your speech.',
                    buttonPositive: 'Allow',
                    buttonNegative: 'Cancel',
                }
            );
            return result === PermissionsAndroid.RESULTS.GRANTED;
        } catch (error) {
            console.warn('Permission error:', error);
            return false;
        }
    };

    async function startListeningSafe() {
        if (listeningRef.current) return;
        listeningRef.current = true;

        try {
            await VoiceToText.startListening({ continuous: true });
            console.log('[VoiceToText] Listening started');
        } catch (error) {
            console.error('[VoiceToText] Start error:', error);
            listeningRef.current = false;
            updatePhase('idle');
            Alert.alert('Speech Recognition Error', 'Could not start speech recognition.');
        }
    }

    async function stopListeningSafe() {
        if (!listeningRef.current) return;
        listeningRef.current = false;

        try {
            await VoiceToText.stopListening();
        } catch (error) {
            console.warn('[VoiceToText] Stop error:', error);
        }
    }


    // ───────────────────────────────────────────────────────────────────────
    // Step 1 – sentence
    // ───────────────────────────────────────────────────────────────────────

    const startSentence = async () => {
        try {
            setSpokenIndex(0);
            setResult(null);

            if (!(await requestAndroidPermission())) {
                Alert.alert('Microphone Access Needed', 'Please allow microphone access.');
                return;
            }

            const available = await VoiceToText.isRecognitionAvailable();
            if (!available) {
                Alert.alert(
                    'Speech Recognition Unavailable',
                    'Speech recognition is not available on this device.'
                );
                return;
            }

            await VoiceToText.setRecognitionLanguage('en-US');

            updatePhase('sentence');
            await startListeningSafe();
        } catch (error) {
            console.error('[VoiceToText] Start error:', error);
            listeningRef.current = false;
            updatePhase('idle');
            Alert.alert('Speech Recognition Error', 'Could not start speech recognition.');
        }
    };

    // Sentence completed -> begin questions
    useEffect(() => {
        if (spokenIndex >= WORDS.length && phase === 'sentence') {
            console.log('[Speech] Sentence completed');
            beginQuestions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spokenIndex, phase]);

    async function beginQuestions() {
        // switch phase immediately so this can't fire twice
        updatePhase('processing');

        await stopListeningSafe();

        answersRef.current = [];
        retryRef.current = QUESTIONS.map(() => 0);
        setAnswersState([]);

        setTimeout(() => askQuestion(0, INTRO), 700);
    }


    // ───────────────────────────────────────────────────────────────────────
    // Step 2 – AI asks (TTS), then user answers (STT)
    // ───────────────────────────────────────────────────────────────────────

    function askQuestion(index: number, prefix = '') {
        clearTimers();

        qIndexRef.current = index;
        setQuestionIndex(index);
        updatePhase('asking');

        Speech.stop();
        Speech.speak(prefix + QUESTIONS[index].text, {
            language: 'en-US',
            pitch: 1.0,
            rate: 0.95,
            onDone: () => {
                // small gap so the mic doesn't pick up the end of the TTS
                setTimeout(() => {
                    if (phaseRef.current === 'asking') startAnswering();
                }, 350);
            },
            onError: () => {
                if (phaseRef.current === 'asking') startAnswering();
            },
        });
    }

    async function startAnswering() {
        transcriptRef.current = '';
        updatePhase('listening');

        await startListeningSafe();

        // If the user never speaks, give up after a while
        noSpeechTimer.current = setTimeout(finishAnswer, NO_SPEECH_MS);
    }

    async function finishAnswer() {
        if (phaseRef.current !== 'listening') return;

        updatePhase('processing');
        clearTimers();
        await stopListeningSafe();

        const index = qIndexRef.current;
        const text = transcriptRef.current.trim();

        // Nothing heard: re-ask once
        if (!text && retryRef.current[index] < 1) {
            retryRef.current[index] += 1;
            askQuestion(index, "Sorry, I didn't catch that. ");
            return;
        }

        answersRef.current[index] = text;
        console.log(`[Answer ${index + 1}]`, text || '(no answer)');

        if (index + 1 < QUESTIONS.length) {
            setTimeout(() => askQuestion(index + 1), 500);
        } else {
            finishAll();
        }
    }

    function finishAll() {
        const answers = QUESTIONS.map((_, i) => answersRef.current[i] ?? '');
        const mood = getMood(answers);

        setAnswersState(answers);
        setResult(mood);
        updatePhase('done');

        Speech.speak('Thank you. Your mood analysis is complete.', {
            language: 'en-US',
            rate: 0.95,
        });
    }


    // ───────────────────────────────────────────────────────────────────────
    // Circle button
    // ───────────────────────────────────────────────────────────────────────

    const handleCirclePress = async () => {
        switch (phase) {
            case 'idle':
                startSentence();
                break;

            case 'sentence':
                // cancel
                await stopListeningSafe();
                setSpokenIndex(0);
                updatePhase('idle');
                break;

            case 'listening':
                // "I'm done answering"
                finishAnswer();
                break;

            case 'done':
                Speech.stop();
                setSpokenIndex(0);
                setResult(null);
                updatePhase('idle');
                break;

            default:
                // asking / processing – ignore taps
                break;
        }
    };


    // ───────────────────────────────────────────────────────────────────────
    // Continue
    // ───────────────────────────────────────────────────────────────────────

    const handleContinue = () => {
        if (phase !== 'done' || !result) return;

        router.push({
            pathname: '/medical_sym',
            params: {
                ...params,
                voiceSampleCaptured: 'true',
                moodLabel: result.label,
                moodScore: String(result.score),
                moodAnswers: JSON.stringify(answersState),
            },
        } as any);
    };


    // ───────────────────────────────────────────────────────────────────────
    // UI text
    // ───────────────────────────────────────────────────────────────────────

    const inQuestions =
        phase === 'asking' || phase === 'listening' ||
        (phase === 'processing' && spokenIndex >= WORDS.length);

    const subtitle =
        phase === 'done'
            ? "Here's what we picked up from your voice."
            : inQuestions
                ? 'Listen to each question and answer out loud.\nWe move on when you pause.'
                : "Please say the following words below. Don't\nworry, we don't steal your voice data.";

    const caption =
        phase === 'idle' ? 'Tap to start recording'
            : phase === 'sentence' ? 'Listening… tap to stop'
                : phase === 'asking' ? 'Apna Doctor is asking…'
                    : phase === 'listening' ? 'Your turn — speak now (tap when done)'
                        : phase === 'processing' ? 'Analysing your answer…'
                            : 'Analysis complete. Tap to redo';

    const iconName =
        phase === 'asking' ? 'volume-high'
            : phase === 'sentence' ? 'stop'
                : 'microphone';


    // ───────────────────────────────────────────────────────────────────────
    // UI
    // ───────────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={s.root}>

            <StatusBar hidden barStyle="dark-content" backgroundColor={BG} />

            {/* Header */}
            <View style={s.progressRow}>
                <TouchableOpacity
                    style={s.backBtn}
                    onPress={() => {
                        Speech.stop();
                        router.push('/user_bloodType');
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-back" size={18} color={TEXT_DARK} />
                </TouchableOpacity>

                <Text style={s.topTitle}>User's Profile</Text>

                <View style={s.stepBadge}>
                    <Text style={s.stepText}>
                        {CURRENT_STEP} of {TOTAL_STEPS}
                    </Text>
                </View>
            </View>

            {/* Title */}
            <Text style={s.title}>AI Mood Analysis</Text>
            <Text style={s.subtitle}>{subtitle}</Text>

            {/* Recording / speaking circle */}
            <View style={s.circleArea}>
                <TouchableOpacity activeOpacity={0.85} onPress={handleCirclePress}>
                    <Animated.View style={[s.ringOuter, { transform: [{ scale: outerScale }] }]}>
                        <Animated.View style={[s.ringMid, { transform: [{ scale: midScale }] }]}>
                            <Animated.View style={[s.ringInner, { transform: [{ scale: innerScale }] }]}>
                                <Animated.View style={[s.ringCore, { transform: [{ scale: coreScale }] }]}>
                                    {phase === 'done' ? (
                                        <Ionicons name="checkmark" size={30} color="#fff" />
                                    ) : (
                                        <MaterialCommunityIcons
                                            name={iconName as any}
                                            size={28}
                                            color="#fff"
                                        />
                                    )}
                                </Animated.View>
                            </Animated.View>
                        </Animated.View>
                    </Animated.View>
                </TouchableOpacity>

                <Text style={s.circleCaption}>{caption}</Text>
            </View>

            {/* Sentence (before questions) */}
            {(phase === 'idle' || phase === 'sentence' ||
                (phase === 'processing' && !inQuestions)) && (
                    <View style={s.sentenceWrap}>
                        {WORDS.map((word, i) => {
                            const isCurrent = i === spokenIndex;
                            const isSpoken = i < spokenIndex;

                            return (
                                <View key={i} style={[s.wordChip, isCurrent && s.wordChipActive]}>
                                    <Text
                                        style={[
                                            s.wordText,
                                            isCurrent && s.wordTextActive,
                                            isSpoken && s.wordTextSpoken,
                                        ]}
                                    >
                                        {word}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

            {/* Question progress – the questions themselves are voice only */}
            {inQuestions && (
                <View style={s.progressWrap}>
                    <View style={s.dotsRow}>
                        {QUESTIONS.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    s.dot,
                                    i < questionIndex && s.dotDone,
                                    i === questionIndex && s.dotActive,
                                ]}
                            />
                        ))}
                    </View>
                    <Text style={s.questionCounter}>
                        Question {questionIndex + 1} of {QUESTIONS.length}
                    </Text>
                </View>
            )}

            {/* Result */}
            {phase === 'done' && result && (
                <View style={s.resultCard}>
                    <Text style={s.resultEmoji}>{result.emoji}</Text>
                    <Text style={s.resultLabel}>{result.label}</Text>
                    <Text style={s.resultDesc}>{result.description}</Text>
                </View>
            )}

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Continue */}
            <TouchableOpacity
                style={[s.continueBtn, phase !== 'done' && s.continueBtnDisabled]}
                onPress={handleContinue}
                disabled={phase !== 'done'}
                activeOpacity={0.85}
            >
                <Text style={s.continueText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

        </SafeAreaView>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

    root: {
        flex: 1,
        backgroundColor: BG,
        paddingHorizontal: 14,
        paddingVertical: 20,
    },

    title: {
        fontSize: 32,
        fontWeight: '800',
        color: TEXT_DARK,
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: 12,
        letterSpacing: -0.3,
        marginTop: 10,
    },

    subtitle: {
        fontSize: 13,
        color: MUTED,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 40,
    },

    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
        marginTop: 35,
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

    topTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: TEXT_DARK,
    },

    stepBadge: {
        backgroundColor: PILL_BG,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },

    stepText: {
        fontSize: 12,
        fontWeight: '600',
        color: TEXT_DARK,
    },

    circleArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 34,
    },

    ringOuter: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        backgroundColor: RING_OUTER,
        alignItems: 'center',
        justifyContent: 'center',
    },

    ringMid: {
        width: CIRCLE_SIZE * 0.74,
        height: CIRCLE_SIZE * 0.74,
        borderRadius: (CIRCLE_SIZE * 0.74) / 2,
        backgroundColor: RING_MID,
        alignItems: 'center',
        justifyContent: 'center',
    },

    ringInner: {
        width: CIRCLE_SIZE * 0.5,
        height: CIRCLE_SIZE * 0.5,
        borderRadius: (CIRCLE_SIZE * 0.5) / 2,
        backgroundColor: RING_INNER,
        alignItems: 'center',
        justifyContent: 'center',
    },

    ringCore: {
        width: CIRCLE_SIZE * 0.26,
        height: CIRCLE_SIZE * 0.26,
        borderRadius: (CIRCLE_SIZE * 0.26) / 2,
        backgroundColor: RING_CORE,
        alignItems: 'center',
        justifyContent: 'center',
    },

    circleCaption: {
        marginTop: 18,
        fontSize: 12,
        fontWeight: '600',
        color: MUTED,
    },

    sentenceWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        marginBottom: 8,
    },

    wordChip: {
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderRadius: 20,
    },

    wordChipActive: {
        backgroundColor: ORANGE,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },

    wordText: {
        fontSize: 22,
        fontWeight: '700',
        color: DARK_TEXT,
    },

    wordTextActive: {
        color: '#fff',
    },

    wordTextSpoken: {
        color: SAID_TINT,
    },

    // Question progress
    progressWrap: {
        alignItems: 'center',
        marginTop: 4,
    },

    dotsRow: {
        flexDirection: 'row',
        gap: 10,
    },

    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: PILL_BG,
    },

    dotDone: {
        backgroundColor: RING_INNER,
    },

    dotActive: {
        backgroundColor: ORANGE,
        width: 28,
    },

    questionCounter: {
        marginTop: 12,
        fontSize: 13,
        fontWeight: '600',
        color: MUTED,
    },

    // Result
    resultCard: {
        alignSelf: 'center',
        alignItems: 'center',
        backgroundColor: PILL_BG,
        borderRadius: 24,
        paddingVertical: 18,
        paddingHorizontal: 28,
        marginTop: 4,
        maxWidth: '92%',
    },

    resultEmoji: {
        fontSize: 40,
        marginBottom: 6,
    },

    resultLabel: {
        fontSize: 22,
        fontWeight: '800',
        color: TEXT_DARK,
    },

    resultDesc: {
        fontSize: 13,
        color: MUTED,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 19,
    },

    continueBtn: {
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 17,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: TEAL,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },

    continueBtnDisabled: {
        opacity: 0.45,
    },

    continueText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

});