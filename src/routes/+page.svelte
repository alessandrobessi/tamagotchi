<script lang="ts">
	import { onMount } from 'svelte';
	import type { Pet, Stage } from '$lib/pet';

	// Raw pet data from server
	let rawPet: Pet | null = $state(null);
	let newName = $state('');
	let showRebirthForm = $state(false);
	let now = $state(Date.now());
	let lastKnownUpdate = $state(0); // Track latest lastUpdate we've seen
	let hasActed = $state(false); // Track if user has acted this session

	// Decay rates (per hour)
	const DECAY_RATES = { hunger: 5, happiness: 3, health: 2 };

	// Stage thresholds (in hours)
	const STAGE_THRESHOLDS: { stage: Stage; minHours: number }[] = [
		{ stage: 'senior', minHours: 168 },
		{ stage: 'adult', minHours: 72 },
		{ stage: 'teen', minHours: 24 },
		{ stage: 'child', minHours: 6 },
		{ stage: 'baby', minHours: 1 },
		{ stage: 'egg', minHours: 0 }
	];

	// Calculate display pet with decay applied client-side
	let pet = $derived.by(() => {
		if (!rawPet) return null;

		const hoursPassed = (now - rawPet.lastUpdate) / (1000 * 60 * 60);
		const age = (now - rawPet.birthTime) / (1000 * 60 * 60);

		let hunger = rawPet.hunger;
		let happiness = rawPet.happiness;
		let health = rawPet.health;
		let isAlive = rawPet.isAlive;

		if (isAlive && hoursPassed > 0) {
			hunger = Math.max(0, rawPet.hunger - DECAY_RATES.hunger * hoursPassed);
			happiness = Math.max(0, rawPet.happiness - DECAY_RATES.happiness * hoursPassed);

			let healthDecay = DECAY_RATES.health * hoursPassed;
			if (hunger < 20) healthDecay *= 2;
			if (happiness < 20) healthDecay *= 1.5;
			health = Math.max(0, rawPet.health - healthDecay);

			if (health <= 0) {
				isAlive = false;
				health = 0;
			}
		}

		let stage: Stage = 'egg';
		for (const { stage: s, minHours } of STAGE_THRESHOLDS) {
			if (age >= minHours) {
				stage = s;
				break;
			}
		}

		return { ...rawPet, hunger, happiness, health, isAlive, age, stage };
	});

	// 8-bit pixel art sprites (CSS class names)
	const stageSprites: Record<Stage, string> = {
		egg: 'sprite-egg',
		baby: 'sprite-baby',
		child: 'sprite-child',
		teen: 'sprite-teen',
		adult: 'sprite-adult',
		senior: 'sprite-senior'
	};

	const stageNames: Record<Stage, string> = {
		egg: 'Egg',
		baby: 'Baby',
		child: 'Child',
		teen: 'Teen',
		adult: 'Adult',
		senior: 'Senior'
	};

	function formatAge(hours: number): string {
		if (hours < 1) {
			return `${Math.floor(hours * 60)} minutes`;
		} else if (hours < 24) {
			return `${hours.toFixed(1)} hours`;
		} else {
			return `${(hours / 24).toFixed(1)} days`;
		}
	}

	function getStatClass(value: number): string {
		if (value <= 20) return 'critical';
		if (value <= 50) return 'warning';
		return 'good';
	}

	function updatePet(newPet: Pet) {
		// Only update if this data is newer than what we have
		if (newPet.lastUpdate >= lastKnownUpdate) {
			rawPet = newPet;
			lastKnownUpdate = newPet.lastUpdate;
		}
	}

	async function feed() {
		if (hasActed) return;
		const res = await fetch('/api/feed', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentState: rawPet })
		});
		const pet = await res.json();
		updatePet(pet);
		broadcastUpdate(pet);
		hasActed = true;
	}

	async function play() {
		if (hasActed) return;
		const res = await fetch('/api/play', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentState: rawPet })
		});
		const pet = await res.json();
		updatePet(pet);
		broadcastUpdate(pet);
		hasActed = true;
	}

	async function heal() {
		if (hasActed) return;
		const res = await fetch('/api/heal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentState: rawPet })
		});
		const pet = await res.json();
		updatePet(pet);
		broadcastUpdate(pet);
		hasActed = true;
	}

	async function rebirth() {
		if (hasActed) return;
		const res = await fetch('/api/rebirth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newName || 'Tama' })
		});
		const pet = await res.json();
		updatePet(pet);
		broadcastUpdate(pet);
		hasActed = true;
		newName = '';
		showRebirthForm = false;
	}

	async function refreshState() {
		const res = await fetch('/api/state');
		updatePet(await res.json());
	}

	function refreshAndReset() {
		hasActed = false;
		refreshState();
	}

	// BroadcastChannel for same-browser tab sync
	let channel: BroadcastChannel | null = null;

	onMount(() => {
		refreshState();

		// Update time every 100ms for smooth decay display
		const timeInterval = setInterval(() => {
			now = Date.now();
		}, 100);

		// Set up BroadcastChannel for instant same-browser tab sync
		channel = new BroadcastChannel('tamagotchi-sync');
		channel.onmessage = (event) => {
			if (event.data?.type === 'pet-update' && event.data.pet) {
				updatePet(event.data.pet);
			}
		};

		return () => {
			clearInterval(timeInterval);
			channel?.close();
		};
	});

	function broadcastUpdate(pet: Pet) {
		channel?.postMessage({ type: 'pet-update', pet });
	}
</script>

<main>
	{#if !pet}
		<div class="loading">
			<div class="spinner"></div>
			<p>Connecting to your pet...</p>
		</div>
	{:else if !pet.isAlive}
		<div class="death-screen">
			<div class="sprite-container">
				<div class="sprite sprite-tombstone"></div>
			</div>
			<h1>Rest in Peace</h1>
			<p class="pet-name">{pet.name}</p>
			<p class="age">Lived for {formatAge(pet.age)}</p>

			{#if showRebirthForm}
				<div class="rebirth-form">
					<input type="text" bind:value={newName} placeholder="New pet name" maxlength="20" />
					<button onclick={rebirth}>Hatch New Pet</button>
					<button class="secondary" onclick={() => (showRebirthForm = false)}>Cancel</button>
				</div>
			{:else}
				<button class="rebirth-btn" onclick={() => (showRebirthForm = true)}>New Beginning</button>
			{/if}
		</div>
	{:else}
		<div class="tamagotchi">
			<header>
				<h1>{pet.name}</h1>
				<span class="stage">{stageNames[pet.stage]}</span>
			</header>

			<div class="pet-display">
				<div class="sprite-container" class:bounce={pet.happiness > 70}>
					<div class="sprite {stageSprites[pet.stage]}"></div>
				</div>
				<p class="age">Age: {formatAge(pet.age)}</p>
			</div>

			<div class="stats">
				<div class="stat">
					<span class="stat-label">Hunger</span>
					<div class="stat-bar">
						<div
							class="stat-fill {getStatClass(pet.hunger)}"
							style="width: {pet.hunger}%"
						></div>
					</div>
					<span class="stat-value">{Math.round(pet.hunger)}%</span>
				</div>

				<div class="stat">
					<span class="stat-label">Happiness</span>
					<div class="stat-bar">
						<div
							class="stat-fill {getStatClass(pet.happiness)}"
							style="width: {pet.happiness}%"
						></div>
					</div>
					<span class="stat-value">{Math.round(pet.happiness)}%</span>
				</div>

				<div class="stat">
					<span class="stat-label">Health</span>
					<div class="stat-bar">
						<div
							class="stat-fill {getStatClass(pet.health)}"
							style="width: {pet.health}%"
						></div>
					</div>
					<span class="stat-value">{Math.round(pet.health)}%</span>
				</div>
			</div>

			{#if hasActed}
				<div class="action-done">
					<p>You've helped {pet.name} today!</p>
					<button onclick={refreshAndReset} class="refresh-btn">Check on {pet.name} again</button>
				</div>
			{:else}
				<div class="actions">
					<button onclick={feed} title="Feed your pet">🍔 Feed</button>
					<button onclick={play} title="Play with your pet">🎾 Play</button>
					<button onclick={heal} title="Give medicine">💊 Heal</button>
				</div>
			{/if}

			<footer>
				<div class="rules">
					<h3>How it works</h3>
					<ul>
						<li>This pet is shared by everyone who visits this page</li>
						<li>You can perform one action per visit</li>
						<li>Stats decay over time - check back often!</li>
						<li>If health reaches 0, the pet dies</li>
						<li>Work together to keep it alive!</li>
					</ul>
				</div>
			</footer>
		</div>
	{/if}
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

	:global(body) {
		margin: 0;
		font-family: 'Press Start 2P', monospace;
		background: #0a0a0a;
		background-image:
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 2px,
				rgba(0, 255, 255, 0.03) 2px,
				rgba(0, 255, 255, 0.03) 4px
			);
		min-height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	main {
		padding: 1rem;
		width: 100%;
		max-width: 420px;
	}

	.loading {
		text-align: center;
		color: #0ff;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid #333;
		border-top-color: #0ff;
		border-radius: 0;
		margin: 0 auto 1rem;
		animation: spin 1s steps(8) infinite;
		box-shadow: 0 0 10px #0ff;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.tamagotchi,
	.death-screen {
		background: #1a1a2e;
		border: 4px solid #0ff;
		box-shadow:
			0 0 20px rgba(0, 255, 255, 0.5),
			inset 0 0 60px rgba(0, 255, 255, 0.1);
		padding: 1.5rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #ff00ff;
		padding-bottom: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1rem;
		color: #ff00ff;
		text-transform: uppercase;
	}

	.stage {
		background: transparent;
		border: 2px solid #0ff;
		color: #0ff;
		padding: 0.25rem 0.5rem;
		font-size: 0.5rem;
		text-transform: uppercase;
	}

	.pet-display {
		text-align: center;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #0a0a1a;
		border: 2px solid #333;
	}

	.sprite-container {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100px;
		margin-bottom: 0.5rem;
	}

	.sprite-container.bounce {
		animation: bounce 0.3s steps(2) infinite;
	}

	.sprite {
		image-rendering: pixelated;
	}

	/* Pixel size for sprites */
	:root {
		--px: 6px;
	}

	/* EGG - simple white/cream oval */
	.sprite-egg {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Row 1 */
			calc(var(--px) * 3) 0 0 #f5f5dc,
			calc(var(--px) * 4) 0 0 #f5f5dc,
			calc(var(--px) * 5) 0 0 #f5f5dc,
			/* Row 2 */
			calc(var(--px) * 2) var(--px) 0 #f5f5dc,
			calc(var(--px) * 3) var(--px) 0 #fffef0,
			calc(var(--px) * 4) var(--px) 0 #fffef0,
			calc(var(--px) * 5) var(--px) 0 #f5f5dc,
			calc(var(--px) * 6) var(--px) 0 #f5f5dc,
			/* Row 3 */
			calc(var(--px) * 1) calc(var(--px) * 2) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 2) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 2) 0 #f5f5dc,
			calc(var(--px) * 7) calc(var(--px) * 2) 0 #f5f5dc,
			/* Row 4-7 - body */
			calc(var(--px) * 1) calc(var(--px) * 3) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 3) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 3) 0 #fffef0,
			calc(var(--px) * 7) calc(var(--px) * 3) 0 #f5f5dc,
			calc(var(--px) * 1) calc(var(--px) * 4) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 7) calc(var(--px) * 4) 0 #f5f5dc,
			calc(var(--px) * 1) calc(var(--px) * 5) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 7) calc(var(--px) * 5) 0 #f5f5dc,
			calc(var(--px) * 1) calc(var(--px) * 6) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 6) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 6) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 6) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #fffef0,
			calc(var(--px) * 7) calc(var(--px) * 6) 0 #f5f5dc,
			/* Row 8 */
			calc(var(--px) * 2) calc(var(--px) * 7) 0 #f5f5dc,
			calc(var(--px) * 3) calc(var(--px) * 7) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 7) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 7) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 7) 0 #f5f5dc,
			/* Row 9 */
			calc(var(--px) * 3) calc(var(--px) * 8) 0 #f5f5dc,
			calc(var(--px) * 4) calc(var(--px) * 8) 0 #f5f5dc,
			calc(var(--px) * 5) calc(var(--px) * 8) 0 #f5f5dc;
	}

	/* BABY - hatching chick */
	.sprite-baby {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Head */
			calc(var(--px) * 3) 0 0 #ffdd00,
			calc(var(--px) * 4) 0 0 #ffdd00,
			calc(var(--px) * 5) 0 0 #ffdd00,
			calc(var(--px) * 2) var(--px) 0 #ffdd00,
			calc(var(--px) * 3) var(--px) 0 #ffee44,
			calc(var(--px) * 4) var(--px) 0 #ffee44,
			calc(var(--px) * 5) var(--px) 0 #ffee44,
			calc(var(--px) * 6) var(--px) 0 #ffdd00,
			/* Eyes */
			calc(var(--px) * 2) calc(var(--px) * 2) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #000,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #000,
			calc(var(--px) * 6) calc(var(--px) * 2) 0 #ffdd00,
			/* Beak */
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #ffdd00,
			/* Egg shell bottom */
			calc(var(--px) * 1) calc(var(--px) * 4) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #fffef0,
			calc(var(--px) * 7) calc(var(--px) * 4) 0 #f5f5dc,
			calc(var(--px) * 0) calc(var(--px) * 5) 0 #f5f5dc,
			calc(var(--px) * 1) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 2) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 7) calc(var(--px) * 5) 0 #fffef0,
			calc(var(--px) * 8) calc(var(--px) * 5) 0 #f5f5dc,
			calc(var(--px) * 1) calc(var(--px) * 6) 0 #f5f5dc,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #f5f5dc,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #f5f5dc,
			calc(var(--px) * 7) calc(var(--px) * 6) 0 #f5f5dc;
	}

	/* CHILD - small yellow chick */
	.sprite-child {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Head */
			calc(var(--px) * 3) 0 0 #ffdd00,
			calc(var(--px) * 4) 0 0 #ffdd00,
			calc(var(--px) * 5) 0 0 #ffdd00,
			calc(var(--px) * 2) var(--px) 0 #ffdd00,
			calc(var(--px) * 3) var(--px) 0 #ffee44,
			calc(var(--px) * 4) var(--px) 0 #ffee44,
			calc(var(--px) * 5) var(--px) 0 #ffee44,
			calc(var(--px) * 6) var(--px) 0 #ffdd00,
			/* Eyes */
			calc(var(--px) * 2) calc(var(--px) * 2) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #000,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #000,
			calc(var(--px) * 6) calc(var(--px) * 2) 0 #ffdd00,
			/* Beak */
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #ffdd00,
			/* Body */
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 1) calc(var(--px) * 5) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 5) 0 #ffee44,
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #ffee44,
			calc(var(--px) * 7) calc(var(--px) * 5) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #ffdd00,
			/* Feet */
			calc(var(--px) * 2) calc(var(--px) * 7) 0 #ff6600,
			calc(var(--px) * 3) calc(var(--px) * 7) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 7) 0 #ff6600,
			calc(var(--px) * 6) calc(var(--px) * 7) 0 #ff6600;
	}

	/* TEEN - bigger chick with tuft */
	.sprite-teen {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Tuft */
			calc(var(--px) * 4) 0 0 #ffdd00,
			calc(var(--px) * 3) var(--px) 0 #ffdd00,
			calc(var(--px) * 5) var(--px) 0 #ffdd00,
			/* Head */
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 3) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 3) 0 #ffdd00,
			/* Eyes */
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #000,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #000,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #ffdd00,
			/* Beak */
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #ff6600,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #ffdd00,
			/* Body */
			calc(var(--px) * 1) calc(var(--px) * 6) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 3) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 7) calc(var(--px) * 6) 0 #ffdd00,
			calc(var(--px) * 1) calc(var(--px) * 7) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 3) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 7) calc(var(--px) * 7) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 8) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 8) 0 #ffdd00,
			/* Feet */
			calc(var(--px) * 2) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 3) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 6) calc(var(--px) * 9) 0 #ff6600;
	}

	/* ADULT - rooster with red comb */
	.sprite-adult {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Comb */
			calc(var(--px) * 3) 0 0 #ff0000,
			calc(var(--px) * 4) 0 0 #ff0000,
			calc(var(--px) * 5) 0 0 #ff0000,
			calc(var(--px) * 2) var(--px) 0 #ff0000,
			calc(var(--px) * 4) var(--px) 0 #ff0000,
			calc(var(--px) * 6) var(--px) 0 #ff0000,
			/* Head */
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 3) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 3) 0 #ffdd00,
			/* Eyes */
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #ffdd00,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #000,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #000,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #ffdd00,
			/* Beak */
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #ffdd00,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #ff6600,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #ff6600,
			calc(var(--px) * 7) calc(var(--px) * 5) 0 #ffdd00,
			/* Wattle */
			calc(var(--px) * 4) calc(var(--px) * 6) 0 #ff0000,
			calc(var(--px) * 5) calc(var(--px) * 6) 0 #ff0000,
			/* Body */
			calc(var(--px) * 1) calc(var(--px) * 6) 0 #ffdd00,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 3) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #ffee44,
			calc(var(--px) * 7) calc(var(--px) * 6) 0 #ffdd00,
			calc(var(--px) * 0) calc(var(--px) * 7) 0 #ffdd00,
			calc(var(--px) * 1) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 2) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 3) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 7) calc(var(--px) * 7) 0 #ffee44,
			calc(var(--px) * 8) calc(var(--px) * 7) 0 #ffdd00,
			calc(var(--px) * 0) calc(var(--px) * 8) 0 #ffdd00,
			calc(var(--px) * 1) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 2) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 3) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 4) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 5) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 6) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 7) calc(var(--px) * 8) 0 #ffee44,
			calc(var(--px) * 8) calc(var(--px) * 8) 0 #ffdd00,
			/* Tail */
			calc(var(--px) * -1) calc(var(--px) * 6) 0 #cc4400,
			calc(var(--px) * -2) calc(var(--px) * 5) 0 #cc4400,
			calc(var(--px) * -1) calc(var(--px) * 5) 0 #ff6600,
			calc(var(--px) * -2) calc(var(--px) * 4) 0 #00aa00,
			calc(var(--px) * -1) calc(var(--px) * 4) 0 #00cc00,
			calc(var(--px) * 0) calc(var(--px) * 5) 0 #00cc00,
			/* Feet */
			calc(var(--px) * 2) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 3) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 5) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 6) calc(var(--px) * 9) 0 #ff6600,
			calc(var(--px) * 1) calc(var(--px) * 10) 0 #ff6600,
			calc(var(--px) * 4) calc(var(--px) * 10) 0 #ff6600,
			calc(var(--px) * 7) calc(var(--px) * 10) 0 #ff6600;
	}

	/* SENIOR - wise golden bird */
	.sprite-senior {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Crown/Crest */
			calc(var(--px) * 4) 0 0 #ffd700,
			calc(var(--px) * 3) var(--px) 0 #ffd700,
			calc(var(--px) * 5) var(--px) 0 #ffd700,
			calc(var(--px) * 2) calc(var(--px) * 2) 0 #ffd700,
			calc(var(--px) * 6) calc(var(--px) * 2) 0 #ffd700,
			/* Head */
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #daa520,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #ffc125,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #daa520,
			calc(var(--px) * 2) calc(var(--px) * 3) 0 #daa520,
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #ffc125,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #ffc125,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #ffc125,
			calc(var(--px) * 6) calc(var(--px) * 3) 0 #daa520,
			/* Eyes with wisdom */
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #daa520,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #fff,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #ffc125,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #fff,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #daa520,
			/* Beak */
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #daa520,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #8b4513,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #8b4513,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #8b4513,
			calc(var(--px) * 7) calc(var(--px) * 5) 0 #daa520,
			/* Body */
			calc(var(--px) * 1) calc(var(--px) * 6) 0 #daa520,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #ffc125,
			calc(var(--px) * 3) calc(var(--px) * 6) 0 #ffc125,
			calc(var(--px) * 4) calc(var(--px) * 6) 0 #ffc125,
			calc(var(--px) * 5) calc(var(--px) * 6) 0 #ffc125,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #ffc125,
			calc(var(--px) * 7) calc(var(--px) * 6) 0 #daa520,
			calc(var(--px) * 0) calc(var(--px) * 7) 0 #daa520,
			calc(var(--px) * 1) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 2) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 3) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 4) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 5) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 6) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 7) calc(var(--px) * 7) 0 #ffc125,
			calc(var(--px) * 8) calc(var(--px) * 7) 0 #daa520,
			calc(var(--px) * 0) calc(var(--px) * 8) 0 #daa520,
			calc(var(--px) * 1) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 2) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 3) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 4) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 5) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 6) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 7) calc(var(--px) * 8) 0 #ffc125,
			calc(var(--px) * 8) calc(var(--px) * 8) 0 #daa520,
			/* Wing detail */
			calc(var(--px) * 1) calc(var(--px) * 9) 0 #b8860b,
			calc(var(--px) * 2) calc(var(--px) * 9) 0 #b8860b,
			calc(var(--px) * 6) calc(var(--px) * 9) 0 #b8860b,
			calc(var(--px) * 7) calc(var(--px) * 9) 0 #b8860b,
			/* Majestic tail */
			calc(var(--px) * -1) calc(var(--px) * 5) 0 #8b0000,
			calc(var(--px) * -2) calc(var(--px) * 4) 0 #8b0000,
			calc(var(--px) * -1) calc(var(--px) * 4) 0 #b22222,
			calc(var(--px) * -2) calc(var(--px) * 3) 0 #ffd700,
			calc(var(--px) * -1) calc(var(--px) * 3) 0 #ffd700,
			calc(var(--px) * 0) calc(var(--px) * 4) 0 #ffd700,
			calc(var(--px) * -3) calc(var(--px) * 3) 0 #006400,
			calc(var(--px) * -2) calc(var(--px) * 2) 0 #228b22,
			/* Feet */
			calc(var(--px) * 2) calc(var(--px) * 10) 0 #8b4513,
			calc(var(--px) * 3) calc(var(--px) * 10) 0 #8b4513,
			calc(var(--px) * 5) calc(var(--px) * 10) 0 #8b4513,
			calc(var(--px) * 6) calc(var(--px) * 10) 0 #8b4513,
			calc(var(--px) * 1) calc(var(--px) * 11) 0 #8b4513,
			calc(var(--px) * 4) calc(var(--px) * 11) 0 #8b4513,
			calc(var(--px) * 7) calc(var(--px) * 11) 0 #8b4513;
	}

	/* TOMBSTONE */
	.sprite-tombstone {
		width: var(--px);
		height: var(--px);
		background: transparent;
		box-shadow:
			/* Top arch */
			calc(var(--px) * 3) 0 0 #666,
			calc(var(--px) * 4) 0 0 #888,
			calc(var(--px) * 5) 0 0 #666,
			calc(var(--px) * 2) var(--px) 0 #666,
			calc(var(--px) * 3) var(--px) 0 #888,
			calc(var(--px) * 4) var(--px) 0 #aaa,
			calc(var(--px) * 5) var(--px) 0 #888,
			calc(var(--px) * 6) var(--px) 0 #666,
			/* Body */
			calc(var(--px) * 1) calc(var(--px) * 2) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 2) 0 #888,
			calc(var(--px) * 3) calc(var(--px) * 2) 0 #aaa,
			calc(var(--px) * 4) calc(var(--px) * 2) 0 #aaa,
			calc(var(--px) * 5) calc(var(--px) * 2) 0 #aaa,
			calc(var(--px) * 6) calc(var(--px) * 2) 0 #888,
			calc(var(--px) * 7) calc(var(--px) * 2) 0 #666,
			/* RIP text row */
			calc(var(--px) * 1) calc(var(--px) * 3) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 3) 0 #888,
			calc(var(--px) * 3) calc(var(--px) * 3) 0 #333,
			calc(var(--px) * 4) calc(var(--px) * 3) 0 #333,
			calc(var(--px) * 5) calc(var(--px) * 3) 0 #333,
			calc(var(--px) * 6) calc(var(--px) * 3) 0 #888,
			calc(var(--px) * 7) calc(var(--px) * 3) 0 #666,
			calc(var(--px) * 1) calc(var(--px) * 4) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 4) 0 #888,
			calc(var(--px) * 3) calc(var(--px) * 4) 0 #aaa,
			calc(var(--px) * 4) calc(var(--px) * 4) 0 #aaa,
			calc(var(--px) * 5) calc(var(--px) * 4) 0 #aaa,
			calc(var(--px) * 6) calc(var(--px) * 4) 0 #888,
			calc(var(--px) * 7) calc(var(--px) * 4) 0 #666,
			calc(var(--px) * 1) calc(var(--px) * 5) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 5) 0 #888,
			calc(var(--px) * 3) calc(var(--px) * 5) 0 #aaa,
			calc(var(--px) * 4) calc(var(--px) * 5) 0 #aaa,
			calc(var(--px) * 5) calc(var(--px) * 5) 0 #aaa,
			calc(var(--px) * 6) calc(var(--px) * 5) 0 #888,
			calc(var(--px) * 7) calc(var(--px) * 5) 0 #666,
			calc(var(--px) * 1) calc(var(--px) * 6) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 6) 0 #888,
			calc(var(--px) * 3) calc(var(--px) * 6) 0 #aaa,
			calc(var(--px) * 4) calc(var(--px) * 6) 0 #aaa,
			calc(var(--px) * 5) calc(var(--px) * 6) 0 #aaa,
			calc(var(--px) * 6) calc(var(--px) * 6) 0 #888,
			calc(var(--px) * 7) calc(var(--px) * 6) 0 #666,
			calc(var(--px) * 1) calc(var(--px) * 7) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 7) 0 #888,
			calc(var(--px) * 3) calc(var(--px) * 7) 0 #aaa,
			calc(var(--px) * 4) calc(var(--px) * 7) 0 #aaa,
			calc(var(--px) * 5) calc(var(--px) * 7) 0 #aaa,
			calc(var(--px) * 6) calc(var(--px) * 7) 0 #888,
			calc(var(--px) * 7) calc(var(--px) * 7) 0 #666,
			/* Base */
			calc(var(--px) * 0) calc(var(--px) * 8) 0 #555,
			calc(var(--px) * 1) calc(var(--px) * 8) 0 #666,
			calc(var(--px) * 2) calc(var(--px) * 8) 0 #777,
			calc(var(--px) * 3) calc(var(--px) * 8) 0 #777,
			calc(var(--px) * 4) calc(var(--px) * 8) 0 #777,
			calc(var(--px) * 5) calc(var(--px) * 8) 0 #777,
			calc(var(--px) * 6) calc(var(--px) * 8) 0 #777,
			calc(var(--px) * 7) calc(var(--px) * 8) 0 #666,
			calc(var(--px) * 8) calc(var(--px) * 8) 0 #555,
			/* Ground */
			calc(var(--px) * -1) calc(var(--px) * 9) 0 #2d5a27,
			calc(var(--px) * 0) calc(var(--px) * 9) 0 #3a7a33,
			calc(var(--px) * 1) calc(var(--px) * 9) 0 #2d5a27,
			calc(var(--px) * 2) calc(var(--px) * 9) 0 #3a7a33,
			calc(var(--px) * 3) calc(var(--px) * 9) 0 #2d5a27,
			calc(var(--px) * 4) calc(var(--px) * 9) 0 #3a7a33,
			calc(var(--px) * 5) calc(var(--px) * 9) 0 #2d5a27,
			calc(var(--px) * 6) calc(var(--px) * 9) 0 #3a7a33,
			calc(var(--px) * 7) calc(var(--px) * 9) 0 #2d5a27,
			calc(var(--px) * 8) calc(var(--px) * 9) 0 #3a7a33,
			calc(var(--px) * 9) calc(var(--px) * 9) 0 #2d5a27;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	.age {
		color: #0ff;
		font-size: 0.5rem;
		margin: 0;
	}

	.stats {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.stat {
		display: grid;
		grid-template-columns: 70px 1fr 45px;
		align-items: center;
		gap: 0.5rem;
	}

	.stat-label {
		font-size: 0.5rem;
		color: #ff0;
		text-transform: uppercase;
	}

	.stat-bar {
		height: 16px;
		background: #0a0a1a;
		border: 2px solid #333;
		overflow: hidden;
	}

	.stat-fill {
		height: 100%;
		transition: width 0.3s steps(10);
	}

	.stat-fill.good {
		background: repeating-linear-gradient(
			90deg,
			#0f0 0px,
			#0f0 8px,
			#0a0 8px,
			#0a0 16px
		);
		box-shadow: 0 0 10px #0f0;
	}
	.stat-fill.warning {
		background: repeating-linear-gradient(
			90deg,
			#ff0 0px,
			#ff0 8px,
			#aa0 8px,
			#aa0 16px
		);
		box-shadow: 0 0 10px #ff0;
	}
	.stat-fill.critical {
		background: repeating-linear-gradient(
			90deg,
			#f00 0px,
			#f00 8px,
			#a00 8px,
			#a00 16px
		);
		box-shadow: 0 0 10px #f00;
		animation: pulse 0.5s steps(2) infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.stat-value {
		text-align: right;
		font-size: 0.5rem;
		color: #fff;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	button {
		padding: 0.75rem 0.5rem;
		border: 3px solid #ff00ff;
		background: #1a1a2e;
		font-family: 'Press Start 2P', monospace;
		font-size: 0.5rem;
		cursor: pointer;
		transition: all 0.1s steps(2);
		color: #ff00ff;
		text-transform: uppercase;
	}

	button:hover {
		background: #ff00ff;
		color: #000;
		box-shadow: 0 0 20px #ff00ff;
		text-shadow: none;
	}

	button:active {
		transform: scale(0.95);
	}

	button.secondary {
		border-color: #666;
		color: #666;
		text-shadow: none;
	}

	button.secondary:hover {
		background: #666;
		color: #000;
		box-shadow: 0 0 20px #666;
	}

	footer {
		margin-top: 1.5rem;
	}

	.action-done {
		text-align: center;
		padding: 1rem;
		background: #0a0a1a;
		border: 2px solid #0f0;
		margin-bottom: 1rem;
	}

	.action-done p {
		margin: 0 0 1rem;
		color: #0f0;
		font-size: 0.5rem;
	}

	.refresh-btn {
		width: 100%;
		border-color: #0ff;
		color: #0ff;
	}

	.refresh-btn:hover {
		background: #0ff;
		color: #000;
		box-shadow: 0 0 20px #0ff;
	}

	.rules {
		text-align: left;
		background: #0a0a1a;
		border: 2px solid #333;
		padding: 1rem;
	}

	.rules h3 {
		margin: 0 0 0.75rem;
		font-size: 0.5rem;
		color: #0ff;
		text-transform: uppercase;
	}

	.rules ul {
		margin: 0;
		padding-left: 1rem;
		font-size: 0.4rem;
		color: #888;
		line-height: 1.8;
	}

	.rules li {
		margin-bottom: 0.25rem;
	}

	.rules li:last-child {
		margin-bottom: 0;
	}

	.death-screen {
		text-align: center;
		border-color: #f00;
		box-shadow:
			0 0 20px rgba(255, 0, 0, 0.5),
			inset 0 0 60px rgba(255, 0, 0, 0.1);
	}

	.tombstone {
		font-size: 4rem;
		margin-bottom: 1rem;
		filter: grayscale(100%) drop-shadow(0 0 10px #fff);
	}

	.death-screen h1 {
		color: #f00;
		margin-bottom: 0.5rem;
		font-size: 1rem;
	}

	.death-screen .pet-name {
		font-size: 0.75rem;
		color: #fff;
		margin: 0 0 0.5rem;
	}

	.death-screen .age {
		margin-bottom: 2rem;
		color: #888;
	}

	.rebirth-btn {
		width: 100%;
		border-color: #0f0;
		color: #0f0;
	}

	.rebirth-btn:hover {
		background: #0f0;
		color: #000;
		box-shadow: 0 0 20px #0f0;
	}

	.rebirth-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rebirth-form input {
		padding: 0.75rem;
		border: 3px solid #0ff;
		background: #0a0a1a;
		font-family: 'Press Start 2P', monospace;
		font-size: 0.6rem;
		text-align: center;
		color: #0ff;
	}

	.rebirth-form input::placeholder {
		color: #336;
	}

	.rebirth-form input:focus {
		outline: none;
		box-shadow: 0 0 20px #0ff;
	}
</style>
