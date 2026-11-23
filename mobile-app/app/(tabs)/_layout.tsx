import React from 'react';
import { Tabs } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Brand, Fonts } from '@/src/theme/design';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Brand.green,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#FFFFFF',
        tabBarLabelStyle: {
          fontFamily: Fonts.display,
          fontSize: 11,
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'NEWS',
          tabBarIcon: ({ color }) => (
            <Ionicons name="newspaper-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: 'MY SQUAD',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'LEAGUES',
          tabBarIcon: ({ color }) => (
            <Ionicons name="trophy-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'PSL TABLE',
          tabBarIcon: ({ color }) => (
            <Feather name="layout" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'LIVE GAMES',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="soccer" size={26} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
