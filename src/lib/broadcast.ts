import type { Pet } from './pet';

type Controller = ReadableStreamDefaultController<Uint8Array>;

const clients = new Set<Controller>();
const encoder = new TextEncoder();

export function addClient(controller: Controller): void {
	clients.add(controller);
}

export function removeClient(controller: Controller): void {
	clients.delete(controller);
}

export function broadcast(pet: Pet): void {
	const data = `data: ${JSON.stringify(pet)}\n\n`;
	const encoded = encoder.encode(data);

	for (const controller of clients) {
		try {
			controller.enqueue(encoded);
		} catch {
			clients.delete(controller);
		}
	}
}

export function getClientCount(): number {
	return clients.size;
}
