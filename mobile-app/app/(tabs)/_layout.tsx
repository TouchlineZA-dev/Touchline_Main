import React from 'react';
import { Tabs } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/src/theme/design';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          height: 76,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#D7E3DB',
        },
        tabBarActiveTintColor: '#087C3A',
        tabBarInactiveTintColor: '#202522',
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyMedium,
          fontSize: 10,
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="newspaper-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: 'Squad',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color }) => (
            <Ionicons name="trophy-outline" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => (
            <Feather name="bar-chart-2" size={24} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={24} color={String(color)} />
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
