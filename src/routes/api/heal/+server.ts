import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { heal } from '$lib/pet';
import { broadcast } from '$lib/broadcast';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const pet = await heal(body.currentState);
	broadcast(pet);
	return json(pet);
};
