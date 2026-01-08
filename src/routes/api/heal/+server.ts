import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { heal } from '$lib/pet';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const pet = await heal(body.currentState);
	return json(pet);
};
