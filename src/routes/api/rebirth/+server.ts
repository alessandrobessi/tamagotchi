import { json } from '@sveltejs/kit';
import { rebirth } from '$lib/pet';

export async function POST({ request }) {
	const body = await request.json();
	const name = body.name || 'Tama';
	const pet = await rebirth(name);
	return json(pet);
}
