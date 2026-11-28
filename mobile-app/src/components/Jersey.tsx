import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { jerseySvgs } from '@/src/lib/jerseySvgs';

type KitKey = keyof typeof jerseySvgs;

const teamKits: Array<[string, KitKey]> = [
  ['amazulu', 'amazulu'],
  ['capetowncity', 'capetowncity'],
  ['kaizerchiefs', 'chiefs'],
  ['chiefs', 'chiefs'],
  ['chippa', 'chippa'],
  ['durbancity', 'durbancity'],
  ['goldenarrows', 'goldenarrows'],
  ['magesi', 'magesi'],
  ['marumogallants', 'marumo'],
  ['marumo', 'marumo'],
  ['orlandopirates', 'pirates'],
  ['pirates', 'pirates'],
  ['polokwane', 'polokwane'],
  ['richardsbay', 'richardsbay'],
  ['siwelele', 'siwelele'],
  ['sekhukhune', 'sekhukhune'],
  ['stellenbosch', 'stellenbosch'],
  ['mamelodisundowns', 'sundowns'],
  ['sundowns', 'sundowns'],
  ['supersportunited', 'supersport'],
  ['supersport', 'supersport'],
  ['tsgalaxy', 'tsgalaxy'],
];

export function getJerseyKey(club?: string | null): KitKey {
  const normalized = (club ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return teamKits.find(([alias]) => normalized.includes(alias))?.[1] ?? 'generic';
}

export function Jersey({ club, size = 42 }: { club?: string | null; size?: number }) {
  const key = getJerseyKey(club);
  return (
    <View accessible accessibilityLabel={`${club || 'Generic'} fantasy shirt`} style={{ width: size, height: size }}>
      <SvgXml xml={jerseySvgs[key]} width={size} height={size} />
    </View>
  );
}
