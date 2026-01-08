import { json } from '@sveltejs/kit';
import { rebirth } from '$lib/pet';
import { broadcast } from '$lib/broadcast';

export async function POST({ request }) {
	const body = await request.json();
	const name = body.name || 'Tama';
	const pet = await rebirth(name);
	broadcast(pet);
	return json(pet);
}
