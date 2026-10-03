<script lang="ts">
	import { compareSuggestions, type News } from '@repo/shared';

	let { news }: { news: News } = $props();

	const rows = $derived(compareSuggestions(news));
</script>

{#if rows.length > 0}
	<section id="section-audit">
		<h2>La IA sugirió, se publicó</h2>
		<p class="hint">
			Qué propuso el modelo y qué decidió quedarse la persona editora: es el registro de las
			decisiones que requieren criterio humano.
		</p>
		<table>
			<thead>
				<tr><th>Campo</th><th>IA sugirió</th><th>Se publicó</th><th></th></tr>
			</thead>
			<tbody>
				{#each rows as row (row.field)}
					<tr>
						<td>{row.label}</td>
						<td>{row.suggested}</td>
						<td>{row.published}</td>
						<td class:same={row.matches} class:changed={!row.matches}>
							{row.matches ? 'Igual' : 'Distinto'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<style>
	section {
		margin-bottom: 2rem;
	}

	.hint {
		color: #666;
		font-size: 0.85rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid #ddd;
		text-align: left;
		vertical-align: top;
	}

	.same {
		color: #1b5e20;
	}

	.changed {
		color: #8a5a00;
		font-weight: 600;
	}
</style>
