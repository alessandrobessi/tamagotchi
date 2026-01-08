import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { feed } from '$lib/pet';
import { broadcast } from '$lib/broadcast';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const pet = await feed(body.currentState);
	broadcast(pet);
	return json(pet);
};
