import { get } from '@vercel/edge-config';

export type Stage = 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'senior';

export interface Pet {
	name: string;
	hunger: number;
	happiness: number;
	health: number;
	age: number;
	birthTime: number;
	stage: Stage;
	isAlive: boolean;
	lastUpdate: number;
}

const PET_KEY = 'pet';

const DECAY_RATES = {
	hunger: 5,
	happiness: 3,
	health: 2
} as const;

const STAGE_THRESHOLDS: { stage: Stage; minHours: number }[] = [
	{ stage: 'senior', minHours: 168 },
	{ stage: 'adult', minHours: 72 },
	{ stage: 'teen', minHours: 24 },
	{ stage: 'child', minHours: 6 },
	{ stage: 'baby', minHours: 1 },
	{ stage: 'egg', minHours: 0 }
];

function createNewPet(name: string): Pet {
	const now = Date.now();
	return {
		name,
		hunger: 100,
		happiness: 100,
		health: 100,
		age: 0,
		birthTime: now,
		stage: 'egg',
		isAlive: true,
		lastUpdate: now
	};
}

function applyDecay(pet: Pet): Pet {
	if (!pet.isAlive) return pet;

	const now = Date.now();
	const hoursPassed = (now - pet.lastUpdate) / (1000 * 60 * 60);

	if (hoursPassed < 0.001) return pet;

	pet.hunger = Math.max(0, pet.hunger - DECAY_RATES.hunger * hoursPassed);
	pet.happiness = Math.max(0, pet.happiness - DECAY_RATES.happiness * hoursPassed);

	let healthDecay = DECAY_RATES.health * hoursPassed;
	if (pet.hunger < 20) healthDecay *= 2;
	if (pet.happiness < 20) healthDecay *= 1.5;
	pet.health = Math.max(0, pet.health - healthDecay);

	pet.age = (now - pet.birthTime) / (1000 * 60 * 60);
	pet.lastUpdate = now;

	for (const { stage, minHours } of STAGE_THRESHOLDS) {
		if (pet.age >= minHours) {
			pet.stage = stage;
			break;
		}
	}

	if (pet.health <= 0) {
		pet.isAlive = false;
		pet.health = 0;
	}

	return pet;
}

async function loadPet(): Promise<Pet> {
	try {
		console.log('Loading pet from Edge Config...');
		const pet = await get<Pet>(PET_KEY);
		console.log('Loaded pet:', pet ? `birthTime=${pet.birthTime}` : 'null');
		if (pet) return pet;
	} catch (error) {
		console.error('Failed to load pet from Edge Config:', error);
	}
	console.log('Creating new pet (no existing pet found)');
	return createNewPet('Tama');
}

async function savePet(pet: Pet): Promise<void> {
	const edgeConfigId = process.env.EDGE_CONFIG_ID;
	const vercelApiToken = process.env.VERCEL_API_TOKEN;

	console.log('Saving pet to Edge Config...', `birthTime=${pet.birthTime}`);
	console.log('EDGE_CONFIG_ID:', edgeConfigId ? 'set' : 'NOT SET');
	console.log('VERCEL_API_TOKEN:', vercelApiToken ? 'set' : 'NOT SET');

	if (!edgeConfigId || !vercelApiToken) {
		console.error('Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN');
		return;
	}

	try {
		const response = await fetch(
			`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
			{
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${vercelApiToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					items: [{ operation: 'upsert', key: PET_KEY, value: pet }]
				})
			}
		);

		if (!response.ok) {
			const error = await response.text();
			console.error('Failed to save pet:', error);
		} else {
			console.log('Pet saved successfully to Edge Config');
		}
	} catch (error) {
		console.error('Failed to save pet to Edge Config:', error);
	}
}

export async function getState(): Promise<Pet> {
	const pet = await loadPet();
	return { ...pet };
}

export async function feed(clientState?: Pet): Promise<Pet> {
	let pet = clientState || (await loadPet());
	if (!pet.isAlive) return { ...pet };
	pet = applyDecay({ ...pet });
	pet.hunger = Math.min(100, pet.hunger + 20);
	pet.lastUpdate = Date.now();
	await savePet(pet);
	return { ...pet };
}

export async function play(clientState?: Pet): Promise<Pet> {
	let pet = clientState || (await loadPet());
	if (!pet.isAlive) return { ...pet };
	pet = applyDecay({ ...pet });
	pet.happiness = Math.min(100, pet.happiness + 15);
	pet.hunger = Math.max(0, pet.hunger - 5);
	pet.lastUpdate = Date.now();
	await savePet(pet);
	return { ...pet };
}

export async function heal(clientState?: Pet): Promise<Pet> {
	let pet = clientState || (await loadPet());
	if (!pet.isAlive) return { ...pet };
	pet = applyDecay({ ...pet });
	pet.health = Math.min(100, pet.health + 25);
	pet.lastUpdate = Date.now();
	await savePet(pet);
	return { ...pet };
}

export async function rebirth(name: string): Promise<Pet> {
	const pet = createNewPet(name || 'Tama');
	await savePet(pet);
	return { ...pet };
}
