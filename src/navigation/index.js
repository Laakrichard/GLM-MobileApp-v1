import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, ADMIN_ROLES } from '../constants';

// Screens
import SplashScreen      from '../screens/SplashScreen';
import OnboardingScreen  from '../screens/OnboardingScreen';
import LoginScreen       from '../screens/LoginScreen';
import RegisterScreen    from '../screens/RegisterScreen';
import HomeScreen        from '../screens/HomeScreen';
import MarkersScreen     from '../screens/MarkersScreen';
import DesignerScreen    from '../screens/DesignerScreen';
import OrdersScreen      from '../screens/OrdersScreen';
import VideosScreen      from '../screens/VideosScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import AdminScreen       from '../screens/AdminScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const map = {
    Home:    { on: '⌂',  off: '⌂'  },
    Markers: { on: '◉',  off: '◎'  },
    Design:  { on: '✦',  off: '✧'  },
    Orders:  { on: '📋', off: '📋' },
    Profile: { on: '◉',  off: '○'  },
    Admin:   { on: '⚙️', off: '⚙️' },
  };
  const icon = map[label] || { on: '●', off: '○' };
  return (
    <Text style={{ fontSize: 17, color: focused ? COLORS.copper : COLORS.textFaint }}>
      {focused ? icon.on : icon.off}
    </Text>
  );
}

function MainTabs({ isAdmin }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.tabBg,
          borderTopColor: COLORS.tabBorder,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 68,
        },
        tabBarActiveTintColor: COLORS.copper,
        tabBarInactiveTintColor: COLORS.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="Markers" component={MarkersScreen} />
      <Tab.Screen name="Design"  component={DesignerScreen} />
      <Tab.Screen name="Orders"  component={OrdersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminScreen}
          options={{
            tabBarLabel: 'Admin',
            tabBarActiveTintColor: COLORS.copper,
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const [appState, setAppState] = useState('loading');
  const [isAdmin,  setIsAdmin]  = useState(false);

  useEffect(() => {
    (async () => {
      const role = await AsyncStorage.getItem('glm_role');
      setIsAdmin(ADMIN_ROLES.includes(role));
      setAppState('splash');
    })();
  }, []);

  if (appState === 'loading') return null;

  if (appState === 'splash') {
    return <SplashScreen onDone={() => setAppState('onboarding')} />;
  }

  if (appState === 'onboarding') {
    return <OnboardingScreen onDone={() => setAppState('auth')} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login"       component={LoginScreen} />
        <Stack.Screen name="Register"    component={RegisterScreen} />
        <Stack.Screen name="Main"        children={() => <MainTabs isAdmin={isAdmin} />} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
