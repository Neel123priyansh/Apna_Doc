import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    Platform,
    StatusBar,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ---------- THEME ----------
const BG = '#F6F2E7';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type HistoryItem = {
    id: string;
    title: string;
    subtitle: string;
    icon: IconName;
    color: string;
    // Set this to the route of the page you build for the section,
    // e.g. '/history/health_scores'. While it is undefined, tapping
    // the row shows a "coming soon" message.
    route?: string;
};

function BackgroundBlobs() {
    return (
        <View style={styles.blobLayer} pointerEvents="none">
            <View style={[styles.blob, { width: 260, height: 260, top: -50, right: -80 }]} />
            <View style={[styles.blob, { width: 320, height: 320, bottom: 60, left: -110, opacity: 0.55 }]} />
            <View style={[styles.blob, { width: 200, height: 200, bottom: -60, right: -60, opacity: 0.4 }]} />
        </View>
    );
}

const HISTORY_ITEMS: HistoryItem[] = [
    {
        id: 'scores',
        title: 'Previous Health Scores',
        subtitle: 'Track how your score has changed',
        icon: 'heart-pulse',
        color: '#10b981',
        route: undefined,
    },
    {
        id: 'vitals',
        title: 'Previous Vitals',
        subtitle: 'Height, weight, BMI and more',
        icon: 'chart-line',
        color: '#3b82f6',
        route: undefined,
    },
    {
        id: 'assessments',
        title: 'Assessments By Doctor',
        subtitle: 'Reviews and notes from your doctors',
        icon: 'stethoscope',
        color: '#6048E6',
        route: undefined,
    },
    {
        id: 'reports',
        title: 'Report Records',
        subtitle: 'Uploaded and verified medical reports',
        icon: 'file-document-outline',
        color: '#f59e0b',
        route: undefined,
    },
    {
        id: 'treatments',
        title: 'Treatment Records',
        subtitle: 'Medications and ongoing treatments',
        icon: 'pill',
        color: '#ef4444',
        route: undefined,
    },
    {
        id: 'visits',
        title: 'Total Visits to Doctors',
        subtitle: 'Appointments and consultations so far',
        icon: 'calendar-check-outline',
        color: '#14b8a6',
        route: undefined,
    },
];

export default function HealthHistory() {
    const router = useRouter();

    const openItem = (item: HistoryItem) => {
        if (item.route) {
            router.push(item.route as any);
        } else {
            Alert.alert(item.title, 'This section is coming soon.');
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <BackgroundBlobs />
            {/* ---------- HEADER ---------- */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.push('/user_profile')}
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={8}
                >
                    <Ionicons name="chevron-back" size={18} color="#121212" />
                </Pressable>

                <Text style={styles.headerTitle}>My Health History</Text>

                {/* Spacer keeps the title centered */}
                <View style={styles.backButtonSpacer} />
            </View>

            {/* ---------- OPTIONS ---------- */}
            <ScrollView
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            >
                {HISTORY_ITEMS.map((item) => (
                    <Pressable
                        key={item.id}
                        onPress={() => openItem(item)}
                        style={({ pressed }) => [
                            styles.card,
                            pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={item.title}
                    >
                        <View
                            style={[
                                styles.iconTile,
                                { backgroundColor: item.color + '1F' },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={item.icon}
                                size={26}
                                color={item.color}
                            />
                        </View>

                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={styles.cardSubtitle} numberOfLines={2}>
                                {item.subtitle}
                            </Text>
                        </View>

                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={26}
                            color="#9aa4b5"
                        />
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop:
            Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 6,
        paddingBottom: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
        color: '#1E1B16',
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    backButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.2,
        borderColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButtonSpacer: {
        width: 40,
        height: 40,
    },

    // List
    list: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 30,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 14,
        marginBottom: 12,
        elevation: 2,
    },
    blobLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    blob: {
        position: 'absolute',
        borderRadius: 999,
        backgroundColor: '#ECE2CB',
        opacity: 0.7,
    },
    iconTile: {
        width: 50,
        height: 50,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
        marginLeft: 14,
        marginRight: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182230',
    },
    cardSubtitle: {
        fontSize: 12,
        lineHeight: 17,
        color: '#657185',
        marginTop: 3,
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.99 }],
    },
});