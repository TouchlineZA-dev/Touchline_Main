import { ImageSourcePropType } from 'react-native';

// Bundled PSL club logos, used when the API has no crest URL for a club.
const LOCAL_CRESTS: [string[], ImageSourcePropType][] = [
  [['amazulu'], require('@/assets/logos/AmaZulu FC logo.png')],
  [['chippa'], require('@/assets/logos/Chippa United logo.png')],
  [['durban city'], require('@/assets/logos/Durban City FC logo.png')],
  [['golden arrows', 'lamontville'], require('@/assets/logos/Golden Arrows logo.png')],
  [['kaizer chiefs', 'chiefs'], require('@/assets/logos/Kaizer Chiefs logo.png')],
  [['magesi'], require('@/assets/logos/Magesi FC logo.png')],
  [['sundowns'], require('@/assets/logos/Mamelodi Sundowns logo.png')],
  [['marumo'], require('@/assets/logos/Marumo Gallants logo.png')],
  [['orbit'], require('@/assets/logos/Orbit College logo.png')],
  [['orlando pirates', 'pirates'], require('@/assets/logos/Orland Pirates logo.png')],
  [['polokwane'], require('@/assets/logos/Polokwane City logo.png')],
  [['richards bay'], require('@/assets/logos/Richards Bay logo.png')],
  [['sekhukhune'], require('@/assets/logos/Sekhukhune United FC logo.png')],
  [['siwelele'], require('@/assets/logos/Siwelele FC logo.png')],
  [['stellenbosch'], require('@/assets/logos/Stellenbosch FC logo.png')],
  [['ts galaxy', 'galaxy'], require('@/assets/logos/TS galaxy logo.png')],
];

/** Crest for a club: the API's URL if present, otherwise a bundled logo matched by name. */
export function crestSource(name: string | null | undefined, url?: string | null): ImageSourcePropType | null {
  if (url) return { uri: url };
  if (!name) return null;
  const n = name.toLowerCase();
  const match = LOCAL_CRESTS.find(([keys]) => keys.some((k) => n.includes(k)));
  return match ? match[1] : null;
}
