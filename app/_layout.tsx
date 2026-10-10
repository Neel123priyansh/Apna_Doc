import { useEffect } from "react";
import { Platform, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Tabs, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Keep splash screen visible while resolving auth state
SplashScreen.preventAutoHideAsync().catch(() => { });

if (Platform.OS === 'android') {
  NavigationBar.setVisibilityAsync("hidden").catch(() => {});
}

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const currentRouteName = state.routes[state.index]?.name;

  // Determine if we should hide the tab bar (e.g. for auth & onboarding screens)
  const hideTabBar =
    currentRouteName === '(auth)' ||
    currentRouteName === 'admin' ||
    currentRouteName === 'in-house_doctor' ||
    currentRouteName === 'welcome_user' ||
    currentRouteName === 'user_gender' ||
    currentRouteName === 'user_age' ||
    currentRouteName === 'user_weight' ||
    currentRouteName === 'user_height' ||
    currentRouteName === 'user_location' ||
    currentRouteName === 'user_current_medication' ||
    currentRouteName === 'user_allergies_familyhistory' ||
    currentRouteName === 'user_bloodType' ||
    currentRouteName === 'user_voice_analysis' ||
    currentRouteName === 'medical_sym' ||
    currentRouteName === 'chat' ||
    currentRouteName === 'chatbot' ||
    currentRouteName === 'mood' ||
    currentRouteName === 'specialist_doc/booking_doc';

  if (hideTabBar) return null;

  // Exactly 5 tabs requested: Home, AI-Chat, AI-Insights, Doctors
  const tabs = [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'chatbot', label: 'AI-Chat', icon: 'chatbubble-ellipses' },
    { name: 'insights', label: 'AI-Insights', icon: 'document-text' },
    { name: 'specialist_doc/specialist', label: 'Doctors', icon: 'medkit' },
    { name: 'user_profile', label: 'Profile', icon: 'person-circle' },
  ];

  return (
    <View style={tabStyles.floatingContainer} pointerEvents="box-none">
      <View style={tabStyles.barContent}>
        {tabs.map((tab) => {
          const isFocused = currentRouteName === tab.name;

          const onPress = () => {
            if (isFocused) return;

            const route = state.routes.find((r: any) => r.name === tab.name);

            if (route) {
              // Route already exists in the navigator state — use standard tab navigation
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            } else {
              // Route not yet initialised — navigate by name directly
              navigation.navigate(tab.name);
            }
          };

          return (
            <TouchableOpacity
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.8}
              style={tabStyles.tabItem}
            >
              <View style={[tabStyles.iconWrap, isFocused && tabStyles.activePill]}>
                <Ionicons
                  name={tab.icon as any}
                  size={isFocused ? 20 : 22}
                  color={isFocused ? '#FFFFFF' : '#526055'}
                />
                {isFocused && <View style={tabStyles.activeIndicatorDot} />}
              </View>
              <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>
                {tab.label === 'AI-Chat' ? 'Doctoro AI' : tab.label === 'AI-Insights' ? 'Insights' : tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const { user, loading, hasRegistered } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();


  // Hide splash screen when auth loading is finished
  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [loading]);

  // Authentication Guard
  useEffect(() => {
    if (loading || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      if (!hasRegistered) {
        router.replace('/(auth)/welcome' as any);
      } else {
        router.replace('/(auth)/login' as any);
      }
    } else if (user && inAuthGroup) {
      if (user.role === 'admin') {
        router.replace('/admin' as any);
      } else if (user.role === 'doctor') {
        router.replace('/in-house_doctor' as any);
      } else {
        if (user.hasProfile) {
          router.replace('/user_profile' as any);
        } else {
          router.replace('/welcome_user' as any);
        }
      }
    }
  }, [user, loading, hasRegistered, segments, navigationState]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: "AI-Chat",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "AI-Insights",
        }}
      />
      <Tabs.Screen
        name="specialist_doc/specialist"
        options={{
          title: "Doctors",
        }}
      />
      <Tabs.Screen
        name="user_profile"
        options={{
          title: "Profile",
        }}
      />
      <Tabs.Screen
        name="mood"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="docRecom"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="in-house_doctor"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(auth)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="welcome_user"
        options={{
          href: null,
        }}
      />
        <Tabs.Screen
          name="user_location"
          options={{
            href: null,
          }}
        />
      <Tabs.Screen
        name="user_gender"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const tabStyles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 26,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  barContent: {
    width: '100%',
    height: 88,
    backgroundColor: '#ffffffff',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 76,
    gap: 3,
  },
  activePill: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#0EA877',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  activeIndicatorDot: {
    position: 'absolute',
    bottom: 0,
    width: 16,
    height: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: '#FAF9F6',
  },
  inactiveIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#526055',
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabLabelActive: {
    color: '#0E8F6D',
  },
});

