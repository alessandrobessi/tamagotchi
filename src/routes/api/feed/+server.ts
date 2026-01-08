import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { feed } from '$lib/pet';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const pet = await feed(body.currentState);
	return json(pet);
};
