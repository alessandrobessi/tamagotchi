import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { play } from '$lib/pet';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const pet = await play(body.currentState);
	return json(pet);
};
