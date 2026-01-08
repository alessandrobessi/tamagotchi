import { getState } from '$lib/pet';
import { addClient, removeClient } from '$lib/broadcast';

export async function GET() {
	const initialPet = await getState();

	const stream = new ReadableStream({
		start(controller) {
			addClient(controller);

			const data = `data: ${JSON.stringify(initialPet)}\n\n`;
			controller.enqueue(new TextEncoder().encode(data));
		},
		cancel(controller) {
			removeClient(controller);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
}
