// app/add-address.tsx

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';

import {
  Map,
  Camera,
  type MapRef,
  type CameraRef,
} from '@maplibre/maplibre-react-native';

import * as Location from 'expo-location';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authFetch } from '../src/services/authServices';

// ─────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────

const BG = '#F5F0E8';
const TEXT_DARK = '#121212';
const TEXT_MID = '#C8B4A0';
const TEAL = '#1FA97F';
const PILL_BG = '#EDE6D8';
const BORDER = '#EFEFEF';

// ─────────────────────────────────────────────────────────────
// MapLibre + OpenStreetMap style
//
// No Google Maps API key required.
//
// NOTE:
// OpenStreetMap's public tile server has usage policies.
// This is suitable for development/testing and low-volume use.
// For production at scale, use a proper OSM tile provider.
// ─────────────────────────────────────────────────────────────

const OSM_STYLE = {
  version: 8,

  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },

  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Onboarding step
// ─────────────────────────────────────────────────────────────

const CURRENT_STEP = 5;
const TOTAL_STEPS = 6;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type LocationInfo = {
  district: string;
  city: string;
  state: string;
  country: string;
  full: string;
};

type Coords = {
  latitude: number;
  longitude: number;
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function AddNewAddressScreen() {
  const router = useRouter();

  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  const params = useLocalSearchParams<{
    gender?: string;
    age?: string;
    weight?: string;
    unit?: string;
    height?: string;
  }>();

  const [locLoading, setLocLoading] = useState(false);

  const [locationInfo, setLocationInfo] =
    useState<LocationInfo | null>(null);

  // Default center — India
  // This will be replaced by the user's actual location
  // when they press "Use my current location".
  const [pinCoords, setPinCoords] = useState<Coords>({
    latitude: 20.5937,
    longitude: 78.9629,
  });

  const [region, setRegion] = useState<Coords>({
    latitude: 20.5937,
    longitude: 78.9629,
  });

  const [saving, setSaving] = useState(false);

  // ───────────────────────────────────────────────────────────
  // Reverse geocoding
  // ───────────────────────────────────────────────────────────

  const reverseGeocode = async (
    lat: number,
    lng: number
  ) => {
    try {
      const results =
        await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

      if (results && results.length > 0) {
        const r = results[0];

        const district =
          r.district ??
          r.subregion ??
          r.name ??
          '';

        const city =
          r.city ??
          r.region ??
          '';

        const state =
          r.region ??
          '';

        const country =
          r.country ??
          '';

        const full = [
          r.streetNumber,
          r.street,
          district,
          city,
          state,
          country,
        ]
          .filter(Boolean)
          .join(', ');

        setLocationInfo({
          district,
          city,
          state,
          country,
          full,
        });
      }
    } catch (err) {
      console.error(
        'Reverse geocode error:',
        err
      );
    }
  };

  // ───────────────────────────────────────────────────────────
  // Use current GPS location
  // ───────────────────────────────────────────────────────────

  const handleCurrentLocation = async () => {
    setLocLoading(true);
    setLocationInfo(null);

    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to use this feature.',
          [{ text: 'OK' }]
        );

        setLocLoading(false);
        return;
      }

      const loc =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const {
        latitude,
        longitude,
      } = loc.coords;

      // Update pin coordinates
      setPinCoords({
        latitude,
        longitude,
      });

      // Update region state
      setRegion({
        latitude,
        longitude,
      });

      // Move MapLibre camera
      cameraRef.current?.easeTo({
        center: [longitude, latitude],
        duration: 800,
      });

      // Reverse geocode
      await reverseGeocode(
        latitude,
        longitude
      );
    } catch (error) {
      console.error(
        'Current location error:',
        error
      );

      Alert.alert(
        'Error',
        'Could not get your location. Please try again.'
      );
    } finally {
      setLocLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────
  // User moves the map
  //
  // The center pin stays fixed.
  // We update the selected location to the map center.
  // ───────────────────────────────────────────────────────────

  const handleRegionChangeComplete = async (
    event: any
  ) => {
    try {
      const center =
        event?.nativeEvent?.center;

      if (
        !center ||
        !Array.isArray(center) ||
        center.length < 2
      ) {
        return;
      }

      // MapLibre coordinates are:
      // [longitude, latitude]

      const longitude = Number(center[0]);
      const latitude = Number(center[1]);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return;
      }

      setPinCoords({
        latitude,
        longitude,
      });

      setRegion({
        latitude,
        longitude,
      });

      await reverseGeocode(
        latitude,
        longitude
      );
    } catch (error) {
      console.error(
        'Map region change error:',
        error
      );
    }
  };

  // ───────────────────────────────────────────────────────────
  // Confirm selected location
  // ───────────────────────────────────────────────────────────

  const handleConfirmLocation = async () => {
    if (!locationInfo) {
      return;
    }

    setSaving(true);

    try {
      const locationResponse =
        await authFetch(
          '/api/auth/location',
          {
            method: 'PUT',

            body: JSON.stringify({
              latitude:
                pinCoords.latitude,

              longitude:
                pinCoords.longitude,

              ...locationInfo,
            }),
          }
        );

      const locationData =
        await locationResponse.json();

      if (!locationResponse.ok) {
        throw new Error(
          locationData.message ||
            'Failed to save location'
        );
      }

      router.replace({
        pathname: '/user_current_medication',

        params: {
          gender:
            params.gender ?? '',

          age:
            params.age ?? '',

          weight:
            params.weight ?? '',

          unit:
            params.unit ?? '',

          height:
            params.height ?? '',
        },
      } as any);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message ||
          'Failed to save your location.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      <StatusBar hidden 
        barStyle="dark-content"
        backgroundColor={BG}
      />

      {/* ───────────────── Header ───────────────── */}

      <View style={s.progressRow}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() =>
            router.push('/user_height')
          }
          activeOpacity={0.7}
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={TEXT_DARK}
          />
        </TouchableOpacity>

        <Text style={s.topTitle}>
          Your Location
        </Text>

        <View style={s.stepBadge}>
          <Text style={s.stepText}>
            {CURRENT_STEP} of {TOTAL_STEPS}
          </Text>
        </View>
      </View>

      {/* ───────────────── Map ───────────────── */}

      <View style={s.mapWrap}>
        <Map
          ref={mapRef}
          style={s.map}
          mapStyle={OSM_STYLE}

          // Keep map clean
          attribution={true}
          logo={false}
          compass={false}
          scaleBar={false}

          // User should be able to drag map
          dragPan={true}
          touchZoom={true}
          doubleTapZoom={true}
          touchRotate={false}
          touchPitch={false}

          // Detect map movement
          onRegionDidChange={
            handleRegionChangeComplete
          }
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: [
                region.longitude,
                region.latitude,
              ],
              zoom: 14,
            }}
          />
        </Map>

        {/* ─────────────────────────────────────
            Fixed center pin

            The map moves underneath this pin.
            ───────────────────────────────────── */}

        <View
          style={s.centerPin}
          pointerEvents="none"
        >
          {/* Teal circle glow */}
          <View style={s.pinGlow}>
            <View style={s.pinGlowInner} />
          </View>

          {/* Pin */}
          <View style={s.markerOuter}>
            <View style={s.markerInner} />
          </View>
        </View>

        {/* Drag hint */}

        <View
          style={s.dragHint}
          pointerEvents="none"
        >
          <Text style={s.dragHintText}>
            Drag map to adjust pin
          </Text>
        </View>
      </View>

      {/* ───────────────── Bottom sheet ───────────────── */}

      <View style={s.sheet}>
        {/* Drag handle */}

        <View style={s.handle} />

        {/* ───────────────── Current location ───────────────── */}

        <TouchableOpacity
          style={s.currentLocRow}
          onPress={handleCurrentLocation}
          activeOpacity={0.8}
          disabled={locLoading}
        >
          <View style={s.currentLocIcon}>
            {locLoading ? (
              <ActivityIndicator
                size="small"
                color="#fff"
              />
            ) : (
              <MaterialIcons
                name="navigation"
                size={18}
                color="#fff"
              />
            )}
          </View>

          <Text style={s.currentLocText}>
            Use my current location
          </Text>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#ccc"
          />
        </TouchableOpacity>

        {/* ───────────────── Location card ───────────────── */}

        {(locationInfo || locLoading) && (
          <View style={s.locationCard}>
            {locLoading &&
            !locationInfo ? (
              <View
                style={s.locationLoading}
              >
                <ActivityIndicator
                  size="small"
                  color={TEAL}
                />

                <Text
                  style={
                    s.locationLoadingText
                  }
                >
                  Getting your location...
                </Text>
              </View>
            ) : locationInfo ? (
              <>
                {/* Pin icon row */}

                <View
                  style={
                    s.locationCardTop
                  }
                >
                  <View
                    style={
                      s.locationPinIcon
                    }
                  >
                    <Ionicons
                      name="location"
                      size={18}
                      color={TEAL}
                    />
                  </View>

                  <View
                    style={{
                      flex: 1,
                      marginLeft: 12,
                    }}
                  >
                    <Text
                      style={
                        s.locationDistrict
                      }
                      numberOfLines={1}
                    >
                      {locationInfo.district ||
                        locationInfo.city ||
                        'Unknown Area'}
                    </Text>

                    <Text
                      style={
                        s.locationCityState
                      }
                      numberOfLines={1}
                    >
                      {[
                        locationInfo.city,
                        locationInfo.state,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>

                  {/* Confirm tick */}

                  <View
                    style={s.confirmDot}
                  >
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color="#fff"
                    />
                  </View>
                </View>

                {/* Full address */}

                {locationInfo.full ? (
                  <Text
                    style={s.locationFull}
                    numberOfLines={2}
                  >
                    {locationInfo.full}
                  </Text>
                ) : null}

                {/* District / City / State */}

                <View
                  style={s.chipsRow}
                >
                  {[
                    {
                      label: 'District',
                      value:
                        locationInfo.district,
                    },
                    {
                      label: 'City',
                      value:
                        locationInfo.city,
                    },
                    {
                      label: 'State',
                      value:
                        locationInfo.state,
                    },
                  ]
                    .filter(
                      (c) => c.value
                    )
                    .map((chip) => (
                      <View
                        key={chip.label}
                        style={s.chip}
                      >
                        <Text
                          style={
                            s.chipLabel
                          }
                        >
                          {chip.label}
                        </Text>

                        <Text
                          style={
                            s.chipValue
                          }
                          numberOfLines={1}
                        >
                          {chip.value}
                        </Text>
                      </View>
                    ))}
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ───────────────── Confirm button ───────────────── */}

        <TouchableOpacity
          style={[
            s.confirmBtn,
            {
              backgroundColor:
                locationInfo
                  ? TEAL
                  : '#ccc',
            },
          ]}
          activeOpacity={0.85}
          disabled={
            !locationInfo || saving
          }
          onPress={
            handleConfirmLocation
          }
        >
          <Text
            style={s.confirmBtnText}
          >
            {saving
              ? 'Saving Location...'
              : locationInfo
              ? 'Confirm Location'
              : 'Select a Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // ───────────────── Header ─────────────────

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: 16,

    marginBottom: 18,
    marginTop: 35,

    paddingTop:
      Platform.OS === 'android'
        ? 36
        : 12,

    paddingBottom: 14,

    backgroundColor: BG,
  },

  backBtn: {
    width: 30,
    height: 30,

    borderRadius: 15,

    borderWidth: 1.2,
    borderColor: TEXT_DARK,

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

  // ───────────────── Map ─────────────────

  mapWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Fixed center pin

  centerPin: {
    position: 'absolute',

    left: '50%',
    top: '50%',

    width: 28,
    height: 28,

    marginLeft: -14,
    marginTop: -14,

    alignItems: 'center',
    justifyContent: 'center',
  },

  // Circle glow around pin

  pinGlow: {
    position: 'absolute',

    width: 70,
    height: 70,

    borderRadius: 35,

    backgroundColor:
      'rgba(31,169,127,0.12)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  pinGlowInner: {
    width: 42,
    height: 42,

    borderRadius: 21,

    backgroundColor:
      'rgba(31,169,127,0.12)',
  },

  markerOuter: {
    width: 28,
    height: 28,

    borderRadius: 14,

    backgroundColor:
      'rgba(31,169,127,0.28)',

    borderWidth: 2.5,
    borderColor: TEAL,

    alignItems: 'center',
    justifyContent: 'center',
  },

  markerInner: {
    width: 10,
    height: 10,

    borderRadius: 5,

    backgroundColor: TEAL,
  },

  dragHint: {
    position: 'absolute',

    bottom: 14,

    alignSelf: 'center',

    backgroundColor:
      'rgba(0,0,0,0.4)',

    borderRadius: 20,

    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  dragHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },

  // ───────────────── Bottom sheet ─────────────────

  sheet: {
    backgroundColor: BG,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,

    shadowOffset: {
      width: 0,
      height: -4,
    },

    elevation: 8,
  },

  handle: {
    width: 40,
    height: 4,

    borderRadius: 2,

    backgroundColor: '#E0E0E0',

    alignSelf: 'center',

    marginBottom: 14,
  },

  // ───────────────── Current location ─────────────────

  currentLocRow: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 12,

    borderTopWidth: 1,
    borderTopColor: BORDER,

    marginBottom: 4,
  },

  currentLocIcon: {
    width: 38,
    height: 38,

    borderRadius: 10,

    backgroundColor: TEAL,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,
  },

  currentLocText: {
    flex: 1,

    fontSize: 15,
    fontWeight: '600',

    color: '#1a1a1a',
  },

  // ───────────────── Location card ─────────────────

  locationCard: {
    backgroundColor: '#EAF8F3',

    borderRadius: 16,

    padding: 14,

    marginTop: 8,

    borderWidth: 1.5,
    borderColor: '#B9E8DA',

    marginBottom: 12,
  },

  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 10,

    paddingVertical: 6,
  },

  locationLoadingText: {
    color: '#888',
    fontSize: 13,
  },

  locationCardTop: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 8,
  },

  locationPinIcon: {
    width: 36,
    height: 36,

    borderRadius: 10,

    backgroundColor: '#DDF3EA',

    alignItems: 'center',
    justifyContent: 'center',
  },

  locationDistrict: {
    fontSize: 15,
    fontWeight: '700',

    color: '#1a1a1a',
  },

  locationCityState: {
    fontSize: 12,

    color: '#888',

    marginTop: 2,
  },

  confirmDot: {
    width: 24,
    height: 24,

    borderRadius: 12,

    backgroundColor: TEAL,

    alignItems: 'center',
    justifyContent: 'center',
  },

  locationFull: {
    fontSize: 12,

    color: '#999',

    lineHeight: 18,

    marginBottom: 12,

    paddingLeft: 48,
  },

  // ───────────────── Chips ─────────────────

  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  chip: {
    flex: 1,

    backgroundColor: '#E4F6EF',

    borderRadius: 10,

    paddingHorizontal: 10,
    paddingVertical: 8,

    alignItems: 'center',
  },

  chipLabel: {
    fontSize: 10,

    color: '#888',

    fontWeight: '600',

    textTransform: 'uppercase',

    marginBottom: 3,
  },

  chipValue: {
    fontSize: 12,

    color: '#1a1a1a',

    fontWeight: '700',

    textAlign: 'center',
  },

  // ───────────────── Confirm ─────────────────

  confirmBtn: {
    borderRadius: 30,

    paddingVertical: 17,

    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 10,
    marginBottom: 24,

    width: '100%',

    gap: 8,

    shadowColor: TEAL,

    shadowOpacity: 0.3,

    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
  },

  confirmBtnText: {
    color: '#fff',

    fontSize: 16,

    fontWeight: '700',
  },
});
