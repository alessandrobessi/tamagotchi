import { json } from '@sveltejs/kit';
import { getState } from '$lib/pet';

export async function GET() {
	const pet = await getState();
	return json(pet);
}
