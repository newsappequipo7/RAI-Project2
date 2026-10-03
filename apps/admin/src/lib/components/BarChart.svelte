<script lang="ts">
	export interface Bar {
		label: string;
		value: number;
		detail?: string;
	}

	let {
		bars,
		format,
		label,
		empty = 'Sin datos todavía.'
	}: { bars: Bar[]; format: (value: number) => string; label: string; empty?: string } = $props();

	const max = $derived(Math.max(...bars.map((bar) => bar.value), 0));
</script>

{#if bars.length === 0}
	<p class="empty">{empty}</p>
{:else}
	<ul class="chart" aria-label={label}>
		{#each bars as bar (bar.label)}
			<li>
				<span class="name">{bar.label}</span>
				<span class="track" aria-hidden="true">
					<span class="fill" style:width="{max > 0 ? (bar.value / max) * 100 : 0}%"></span>
				</span>
				<span class="value">{format(bar.value)}{bar.detail ? ` · ${bar.detail}` : ''}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.chart {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	li {
		display: grid;
		grid-template-columns: minmax(8rem, 14rem) 1fr minmax(6rem, auto);
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.track {
		display: block;
		height: 0.7rem;
		background: #eee;
		border-radius: 3px;
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		background: #0b57d0;
	}

	.value {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		color: #666;
	}
</style>
