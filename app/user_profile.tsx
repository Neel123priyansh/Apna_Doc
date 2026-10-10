import React, { useEffect, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  PanResponder,
  Animated,
  Easing,
  Platform,
  StatusBar,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';
import { GLTFLoader } from
  'three/examples/jsm/loaders/GLTFLoader.js';
import { authFetch } from '../src/services/authServices';

(globalThis as any).THREE =
  (globalThis as any).THREE || THREE;

// Polyfill: GLTFLoader reads navigator.userAgent, which is undefined in React Native.
const nav: any =
  (globalThis as any).navigator ??
  ((globalThis as any).navigator = {});

if (typeof nav.userAgent !== 'string') {
  try {
    Object.defineProperty(nav, 'userAgent', {
      value: 'ReactNative',
      configurable: true,
    });
  } catch {
    nav.userAgent = 'ReactNative';
  }
}

// Cache keys and in-memory GLB buffer for instant screen loads
const USER_PROFILE_CACHE_KEY = '@ezzmed_user_profile_cache_v1';
let cachedGlbArrayBuffer: ArrayBuffer | null = null;

// @refresh reset

// ---------- THEME ----------
const BG = '#F6F2E7';

// Moves the 3D model up (+) or down (-) inside its view.
const MODEL_Y_OFFSET = 0.25;

// Route of your existing "My Health History" page.
const HISTORY_ROUTE = '/health_history';

// Route to the Sleep Quality screen
const SLEEP_ROUTE = '/user_sleep';

// OpenWeatherMap API key (same key used in index.tsx)
const OPENWEATHER_API_KEY = '6803c31e9dd15c5bee33800ce26dd683';

// ---------- AQI helpers ----------
// OpenWeatherMap Air Pollution API returns index 1-5
const OWM_AQI_MAP: Record<number, { label: string; color: string; displayValue: number }> = {
  1: { label: 'Good', color: '#10b981', displayValue: 25 },
  2: { label: 'Fair', color: '#a3e635', displayValue: 75 },
  3: { label: 'Moderate', color: '#f59e0b', displayValue: 125 },
  4: { label: 'Poor', color: '#f97316', displayValue: 175 },
  5: { label: 'Very Poor', color: '#ef4444', displayValue: 250 },
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

// ---------- TYPES ----------
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type VitalItem = {
  label: string;
  value: string;
  unit: string;
  color: string;
  icon: IconName;
};

// Placeholder vitals shown while loading
const LOADING_VITALS: VitalItem[] = [
  { label: 'Height', value: '—', unit: '', color: '#3b82f6', icon: 'human-male-height' },
  { label: 'Weight', value: '—', unit: '', color: '#10b981', icon: 'weight-kilogram' },
  { label: 'Age', value: '—', unit: '', color: '#f59e0b', icon: 'cake-variant-outline' },
  { label: 'BMI', value: '—', unit: '', color: '#8b5cf6', icon: 'speedometer' },
  { label: 'Blood group', value: '—', unit: '', color: '#ef4444', icon: 'water' },
];

export default function App() {
  const router = useRouter();

  // ---------- STATE ----------
  const [vitals, setVitals] = React.useState<VitalItem[]>(LOADING_VITALS);
  const [healthScore, setHealthScore] = React.useState<number | null>(null);
  const [profileName, setProfileName] = React.useState<string>('—');
  const [locationName, setLocationName] = React.useState<string>('—');
  const [aqiIndex, setAqiIndex] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [sleepQuality, setSleepQuality] = React.useState<string | null>(null);
  const [sleepLocked, setSleepLocked] = React.useState<boolean>(false);
  const [sleepLockHours, setSleepLockHours] = React.useState<number>(0);

  // Derived AQI display info
  const aqiDisplay = aqiIndex !== null ? OWM_AQI_MAP[aqiIndex] : null;
  const aqiDisplayValue = aqiDisplay?.displayValue ?? 0;
  const aqiInfo = aqiDisplay
    ? { label: aqiDisplay.label, color: aqiDisplay.color }
    : { label: 'N/A', color: '#9ca3af' };

  // ---------- PULSE GLOW ANIMATION ----------
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const textScale = pulse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.07, 1] });

  // ---------- FETCH & CACHE REAL DATA ----------
  useEffect(() => {
    let isMounted = true;

    // 1. Load cached vitals and profile data instantly from local device storage (0ms delay)
    const loadCachedData = async () => {
      try {
        const cachedJson = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
        if (cachedJson && isMounted) {
          const cached = JSON.parse(cachedJson);
          if (cached.profileName) setProfileName(cached.profileName);
          if (cached.vitals && Array.isArray(cached.vitals)) setVitals(cached.vitals);
          if (cached.locationName) setLocationName(cached.locationName);
          if (cached.aqiIndex !== undefined && cached.aqiIndex !== null) setAqiIndex(cached.aqiIndex);
          if (cached.healthScore !== undefined && cached.healthScore !== null) setHealthScore(cached.healthScore);
          if (cached.sleepQuality !== undefined) setSleepQuality(cached.sleepQuality);
          if (cached.sleepQualityUpdatedAt) {
            const now = Date.now();
            const lastUpdated = new Date(cached.sleepQualityUpdatedAt).getTime();
            const diffHours = (now - lastUpdated) / (1000 * 60 * 60);
            if (diffHours < 24) {
              setSleepLocked(true);
              setSleepLockHours(Math.ceil(24 - diffHours));
            } else {
              setSleepLocked(false);
              setSleepLockHours(0);
            }
          }
          setLoading(false);
        }
      } catch (cacheErr) {
        console.warn('[user_profile] Read cache error:', cacheErr);
      }
    };

    loadCachedData();

    // 2. Fetch fresh data from backend in background and update local storage
    const fetchAllData = async () => {
      let fetchedAqiIndex: number | null = null;
      let fetchedScore: number | null = null;
      let fetchedLocName: string = 'Your area';
      let freshVitals: VitalItem[] = [];
      let freshProfileName: string = '—';
      let freshSleepQuality: string | null = null;
      let freshSleepQualityUpdatedAt: string | null = null;

      try {
        // 1. Profile
        const profileRes = await authFetch('/api/auth/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (!isMounted) return;

          const name = profileData?.userId?.name ?? profileData?.name ?? '—';
          freshProfileName = name;
          const height = profileData?.height;
          const weight = profileData?.weight;
          const weightUnit = profileData?.weightUnit || 'kg';
          const age = profileData?.age;
          const bloodType = profileData?.bloodType || '—';

          if (profileData?.sleepQuality) {
            freshSleepQuality = profileData.sleepQuality;
            setSleepQuality(profileData.sleepQuality);
          }
          if (profileData?.sleepQualityUpdatedAt) {
            freshSleepQualityUpdatedAt = profileData.sleepQualityUpdatedAt;
            const now = Date.now();
            const lastUpdated = new Date(profileData.sleepQualityUpdatedAt).getTime();
            const diffHours = (now - lastUpdated) / (1000 * 60 * 60);
            if (diffHours < 24) {
              setSleepLocked(true);
              setSleepLockHours(Math.ceil(24 - diffHours));
            } else {
              setSleepLocked(false);
              setSleepLockHours(0);
            }
          }

          let bmiValue = '—';
          let bmiLabel = '';
          if (height && weight) {
            const weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;
            const heightM = height / 100;
            const bmi = weightKg / (heightM * heightM);
            bmiValue = bmi.toFixed(1);
            if (bmi < 18.5) bmiLabel = 'Underweight';
            else if (bmi < 25) bmiLabel = 'Normal';
            else if (bmi < 30) bmiLabel = 'Overweight';
            else bmiLabel = 'Obese';
          }

          freshVitals = [
            { label: 'Height', value: height ? String(height) : '—', unit: height ? 'cm' : '', color: '#3b82f6', icon: 'human-male-height' },
            { label: 'Weight', value: weight ? String(weight) : '—', unit: weight ? weightUnit : '', color: '#10b981', icon: 'weight-kilogram' },
            { label: 'Age', value: age ? String(age) : '—', unit: age ? 'yrs' : '', color: '#f59e0b', icon: 'cake-variant-outline' },
            { label: 'BMI', value: bmiValue, unit: bmiLabel, color: '#8b5cf6', icon: 'speedometer' },
            { label: 'Blood group', value: bloodType !== '—' ? bloodType : '—', unit: '', color: '#ef4444', icon: 'water' },
          ];

          setProfileName(name);
          setVitals(freshVitals);
        }

        // 2. Location -> AQI
        try {
          const locRes = await authFetch('/api/auth/location');
          if (locRes.ok) {
            const locData = await locRes.json();
            const saved = locData.location;
            const { latitude, longitude } = saved;
            if (!isMounted) return;

            fetchedLocName = saved.city || saved.district || saved.state || 'Your area';
            setLocationName(fetchedLocName);

            try {
              const aqiRes = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}`
              );
              const aqiData = await aqiRes.json();
              const index = aqiData?.list?.[0]?.main?.aqi;
              if (!isMounted) return;
              if (typeof index === 'number' && index >= 1 && index <= 5) {
                setAqiIndex(index);
                fetchedAqiIndex = index;
              }
            } catch (aqiErr) {
              console.warn('[user_profile] AQI fetch error:', aqiErr);
            }
          }
        } catch (locErr) {
          console.warn('[user_profile] Location fetch error:', locErr);
        }

        // 3. AI Health Score
        try {
          const scoreRes = await authFetch('/api/ai/health-score', {
            method: 'POST',
            body: JSON.stringify({ aqi: fetchedAqiIndex }),
          });
          if (scoreRes.ok) {
            const scoreData = await scoreRes.json();
            if (!isMounted) return;
            if (typeof scoreData?.score === 'number') {
              fetchedScore = scoreData.score;
              setHealthScore(fetchedScore);
            }
          }
        } catch (scoreErr) {
          console.warn('[user_profile] Health score fetch error:', scoreErr);
        }

        // Save fresh values to local device storage
        const cachePayload = {
          profileName: freshProfileName,
          vitals: freshVitals,
          locationName: fetchedLocName,
          aqiIndex: fetchedAqiIndex,
          healthScore: fetchedScore,
          sleepQuality: freshSleepQuality,
          sleepQualityUpdatedAt: freshSleepQualityUpdatedAt,
        };
        await AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(cachePayload));
      } catch (err) {
        console.error('[user_profile] Fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllData();
    return () => { isMounted = false; };
  }, []);

  // ---------- 3D MODEL refs ----------
  const modelRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);

  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastPinch = useRef(0);

  const initialCameraZ = useRef(4.5);
  const initialRotation = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,

      onPanResponderGrant: (event, gesture) => {
        lastX.current = gesture.dx;
        lastY.current = gesture.dy;
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          lastPinch.current = Math.sqrt(dx * dx + dy * dy);
        }
      },

      onPanResponderMove: (event, gesture) => {
        const model = modelRef.current;
        const camera = cameraRef.current;
        const touches = event.nativeEvent.touches;

        if (touches.length >= 2 && camera) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (lastPinch.current > 0 && distance > 0) {
            camera.position.z *= lastPinch.current / distance;
            camera.position.z = Math.max(2.5, Math.min(8, camera.position.z));
          }
          lastPinch.current = distance;
          lastX.current = gesture.dx;
          lastY.current = gesture.dy;
          return;
        }

        lastPinch.current = 0;

        if (model) {
          const deltaX = gesture.dx - lastX.current;
          const deltaY = gesture.dy - lastY.current;
          model.rotation.y += deltaX * 0.01;
          model.rotation.x += deltaY * 0.01;
          model.rotation.x = Math.max(-1.2, Math.min(1.2, model.rotation.x));
        }

        lastX.current = gesture.dx;
        lastY.current = gesture.dy;
      },

      onPanResponderRelease: () => { lastPinch.current = 0; },
    })
  ).current;

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
      modelRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, initialCameraZ.current);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const fakeCanvas = {
      width, height, clientWidth: width, clientHeight: height,
      style: {}, addEventListener: () => { }, removeEventListener: () => { },
    };

    const renderer = new THREE.WebGLRenderer({
      canvas: { ...fakeCanvas, getContext: () => gl } as unknown as HTMLCanvasElement,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setClearColor(BG);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xd5e4ff, 0.8);
    fillLight.position.set(-4, 1, -3);
    scene.add(fillLight);

    try {
      let arrayBuffer = cachedGlbArrayBuffer;
      if (!arrayBuffer) {
        const asset = Asset.fromModule(require('../assets/ecorche_-_anatomy_study.glb'));
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error('GLB asset has no local file URI');

        const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = toByteArray(base64);
        arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        cachedGlbArrayBuffer = arrayBuffer;
      }

      const loader = new GLTFLoader();
      await new Promise<void>((resolve, reject) => {
        loader.parse(
          arrayBuffer!,
          '',
          (gltf) => {
            const human = gltf.scene;
            const bounds = new THREE.Box3().setFromObject(human);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());

            if (size.length() === 0) { reject(new Error('GLB contains no visible geometry')); return; }

            const scale = 2.7 / size.y;
            human.scale.multiplyScalar(scale);
            human.position.set(-center.x * scale, -center.y * scale + MODEL_Y_OFFSET, -center.z * scale);

            scene.add(human);
            modelRef.current = human;
            initialRotation.current = { x: human.rotation.x, y: human.rotation.y };
            resolve();
          },
          (error) => reject(error)
        );
      });
    } catch (error) {
      console.error('HUMAN MODEL ERROR:', error);
    }

    const render = () => {
      frameRef.current = requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  const displayScore = healthScore ?? 0;

  return (
    <View style={styles.container}>
      <BackgroundBlobs />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Profile</Text>
        </View>

        <View style={styles.topSection}>
          <View style={styles.viewer}>
            <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
            <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
          </View>

          <View style={styles.vitalsPanel}>
            {/* Render the first 3 vitals (Height, Weight, Age) */}
            {vitals.slice(0, 3).map((item) => (
              <View key={item.label} style={styles.vitalCard}>
                <View style={[styles.vitalIconTile, { backgroundColor: item.color + '1F' }]}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.vitalText}>
                  <Text style={styles.vitalValue} numberOfLines={1}>
                    {item.value}
                    {item.unit ? <Text style={styles.vitalUnit}> {item.unit}</Text> : null}
                  </Text>
                  <Text style={styles.vitalLabel} numberOfLines={1}>{item.label}</Text>
                </View>
              </View>
            ))}

            {/* Sleep Quality button card — inserted after Age */}
            <Pressable
              onPress={() => {
                if (sleepLocked) {
                  Alert.alert(
                    'Sleep Quality Locked',
                    `Your sleep quality is recorded for today. You can set it again in ${sleepLockHours} hour(s).`
                  );
                  return;
                }
                router.push(SLEEP_ROUTE as any);
              }}
              style={({ pressed }) => [
                styles.vitalCard,
                styles.sleepCard,
                sleepLocked && styles.sleepCardLocked,
                pressed && !sleepLocked && { opacity: 0.78 },
              ]}
            >
              <View style={[styles.vitalIconTile, { backgroundColor: sleepLocked ? '#9ca3af1F' : '#6366f11F' }]}>
                <MaterialCommunityIcons
                  name={sleepLocked ? 'lock-clock' : 'moon-waning-crescent'}
                  size={20}
                  color={sleepLocked ? '#6b7280' : '#6366f1'}
                />
              </View>
              <View style={styles.vitalText}>
                <Text style={[styles.vitalValue, { color: sleepLocked ? '#374151' : '#6366f1', fontSize: 13 }]} numberOfLines={1}>
                  {sleepQuality ? sleepQuality : 'Sleep Quality'}
                </Text>
                <Text style={[styles.vitalLabel, { color: sleepLocked ? '#9ca3af' : '#6366f1' }]} numberOfLines={1}>
                  {sleepQuality
                    ? (sleepLocked ? `Locked (${sleepLockHours}h)` : 'Tap to Update →')
                    : 'Set now →'}
                </Text>
              </View>
            </Pressable>

            {/* Render remaining vitals (BMI, Blood group) */}
            {vitals.slice(3).map((item) => (
              <View key={item.label} style={styles.vitalCard}>
                <View style={[styles.vitalIconTile, { backgroundColor: item.color + '1F' }]}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.vitalText}>
                  <Text style={styles.vitalValue} numberOfLines={1}>
                    {item.value}
                    {item.unit ? <Text style={styles.vitalUnit}> {item.unit}</Text> : null}
                  </Text>
                  <Text style={styles.vitalLabel} numberOfLines={1}>{item.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={28} color="#657185" />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.name} numberOfLines={1}>{profileName}</Text>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={15} color="#657185" />
              <Text style={styles.location} numberOfLines={1}>{locationName}</Text>
            </View>
          </View>
          <View style={[styles.aqiBadge, { backgroundColor: aqiInfo.color + '1F' }]}>
            <Text style={[styles.aqiCaption, { color: aqiInfo.color }]}>AQI</Text>
            <Text style={[styles.aqiValue, { color: aqiInfo.color }]}>
              {aqiIndex !== null ? aqiDisplayValue : '—'}
            </Text>
            <Text style={[styles.aqiLabel, { color: aqiInfo.color }]}>
              {aqiIndex !== null ? aqiInfo.label : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreTitle}>Total Health Score</Text>
              <View style={styles.scorePill}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.scoreGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
                />
                <Animated.Text style={[styles.scoreValue, { transform: [{ scale: textScale }] }]}>
                  {loading ? '…' : `${displayScore}%`}
                </Animated.Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: loading ? '0%' : `${displayScore}%` }]} />
            </View>
            <Text style={styles.scoreNote}>
              The overall health score is calculated according to your overall vitals, medical
              conditions and uploaded medical records. These vitals can be improved when you
              follow all the daily challenges.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(HISTORY_ROUTE as any)}
            style={({ pressed }) => [styles.historyButton, pressed && styles.historyButtonPressed]}
          >
            <Text style={styles.historyButtonText}>My Health History</Text>
            <MaterialCommunityIcons name="chevron-right" size={28} color="#ffffff" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 150 },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24),
    marginBottom: 6,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E1B16', letterSpacing: -0.2, textAlign: 'center' },
  blobLayer: { ...StyleSheet.absoluteFillObject },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: '#ECE2CB', opacity: 0.7 },
  topSection: { height: 410, flexDirection: 'row', marginHorizontal: 12, marginTop: 5 },
  viewer: { flex: 0.52, overflow: 'hidden', borderRadius: 22, backgroundColor: BG },
  vitalsPanel: { flex: 0.48, justifyContent: 'space-between', paddingLeft: 10 },
  vitalCard: {
    height: 62, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 10, marginVertical: 3, elevation: 2,
  },
  sleepCard: {
    borderWidth: 1,
    borderColor: '#6366f133',
    backgroundColor: '#F5F3FF',
  },
  sleepCardLocked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  vitalIconTile: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vitalText: { flex: 1, marginLeft: 10 },
  vitalValue: { fontSize: 16, fontWeight: '700', color: '#182230' },
  vitalUnit: { fontSize: 11, fontWeight: '500', color: '#657185' },
  vitalLabel: { fontSize: 11, color: '#657185', marginTop: 1 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderRadius: 22, marginHorizontal: 12, marginTop: 14, marginBottom: 14, padding: 12, elevation: 3,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, marginLeft: 12, marginRight: 8 },
  name: { fontSize: 17, fontWeight: '700', color: '#182230' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  location: { fontSize: 13, color: '#657185', marginLeft: 3, flexShrink: 1 },
  aqiBadge: { alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, minWidth: 78 },
  aqiCaption: { fontSize: 11, fontWeight: '600' },
  aqiValue: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  aqiLabel: { fontSize: 11, fontWeight: '600' },
  bottomSection: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: 12, paddingBottom: 12 },
  scoreCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, elevation: 3 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreTitle: { fontSize: 18, fontWeight: '700', color: '#182230' },
  scorePill: { paddingHorizontal: 16, paddingVertical: 2, borderRadius: 20, backgroundColor: '#10b9811A', alignItems: 'center', justifyContent: 'center' },
  scoreGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 20, backgroundColor: '#10b981' },
  scoreValue: { fontSize: 30, fontWeight: '800', color: '#10b981' },
  progressTrack: { height: 12, borderRadius: 6, backgroundColor: '#e5e9f0', marginTop: 14, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#10b981' },
  scoreNote: { marginTop: 12, fontSize: 13, lineHeight: 19, color: '#657185' },
  historyButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#182230', borderRadius: 22, paddingVertical: 18, paddingLeft: 22, paddingRight: 14, marginTop: 14, elevation: 3,
  },
  historyButtonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  historyButtonText: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
});
