import type { CityDefinition, CityId } from './types';
import { PARIS } from './paris';
import { NEW_YORK } from './newyork';
import { LONDON } from './london';
import { TOKYO } from './tokyo';
import { DUBLIN } from './dublin';

/**
 * Registry of playable cities. Adding a city means writing a CityDefinition (grid, areas, style,
 * palette and landmark builders) and listing it here; every system reads from this data.
 */
export const CITIES: CityDefinition[] = [PARIS, NEW_YORK, LONDON, TOKYO, DUBLIN];

export const cityById = (id: CityId | string): CityDefinition => CITIES.find((c) => c.id === id) ?? CITIES[0];
