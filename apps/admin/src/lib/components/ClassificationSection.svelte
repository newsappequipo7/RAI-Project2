<script lang="ts">
	import {
		COUNTRIES_ES,
		IMPORTANCE_LEVELS,
		LOCATIONS,
		MAX_TOPICS,
		REGIONS,
		TOPICS,
		type FieldIssue,
		type GeoScope,
		type News,
		type NewsFieldName
	} from '@repo/shared';
	import { normalizeGeo, toggleValue } from '$lib/newsStore';
	import FieldIssues from './FieldIssues.svelte';

	let {
		news = $bindable(),
		issues,
		touched,
		readonly,
		onedit
	}: {
		news: News;
		issues: FieldIssue[];
		touched: Partial<Record<NewsFieldName, boolean>>;
		readonly: boolean;
		onedit: (field: NewsFieldName) => void;
	} = $props();

	const SCOPES: { value: GeoScope; label: string; hint: string }[] = [
		{ value: 'local', label: 'Local', hint: 'Afecta a una o más ciudades del catálogo.' },
		{ value: 'nacional', label: 'Nacional', hint: 'Afecta a todo un país.' },
		{ value: 'regional', label: 'Regional', hint: 'Afecta a varios países de una región.' },
		{ value: 'internacional', label: 'Internacional', hint: 'Ocurre en otro país o entre países.' },
		{ value: 'global', label: 'Global', hint: 'Afecta a todo el mundo; sin país ni región.' }
	];

	const topicLimitReached = $derived(news.topics.length >= MAX_TOPICS);
	const scopeHint = $derived(SCOPES.find((scope) => scope.value === news.geo.scope)?.hint);

	function toggleTopic(key: string) {
		news.topics = toggleValue(news.topics, key);
		onedit('topics');
	}

	function setScope(scope: GeoScope) {
		news.geo = normalizeGeo(news.geo, scope);
		onedit('geo');
	}

	function toggleGeo(list: 'countries' | 'cityIds' | 'regions', value: string) {
		news.geo = { ...news.geo, [list]: toggleValue(news.geo[list], value) };
		onedit('geo');
	}

	function setImportance(value: News['importance']) {
		news.importance = value;
		onedit('importance');
	}
</script>

<section id="section-classification">
	<h2>Clasificación</h2>

	<fieldset disabled={readonly}>
		<legend>Temas (1 a {MAX_TOPICS})</legend>
		<div class="options">
			{#each TOPICS as topic (topic.key)}
				<label class="option">
					<input
						type="checkbox"
						checked={news.topics.includes(topic.key)}
						disabled={topicLimitReached && !news.topics.includes(topic.key)}
						onchange={() => toggleTopic(topic.key)}
					/>
					{topic.label}
				</label>
			{/each}
		</div>
		<FieldIssues {issues} field="topics" show={touched.topics === true} />
	</fieldset>

	<fieldset disabled={readonly}>
		<legend>Alcance geográfico</legend>
		<label for="scope">Alcance</label>
		<select
			id="scope"
			value={news.geo.scope}
			onchange={(event) => setScope(event.currentTarget.value as GeoScope)}
		>
			{#each SCOPES as scope (scope.value)}
				<option value={scope.value}>{scope.label}</option>
			{/each}
		</select>
		<p class="hint">{scopeHint}</p>

		{#if news.geo.scope !== 'global'}
			<h3>Países afectados</h3>
			<div class="options scroll">
				{#each COUNTRIES_ES as country (country.iso)}
					<label class="option">
						<input
							type="checkbox"
							checked={news.geo.countries.includes(country.iso)}
							onchange={() => toggleGeo('countries', country.iso)}
						/>
						{country.name}
					</label>
				{/each}
			</div>

			<h3>Regiones</h3>
			<div class="options">
				{#each REGIONS as region (region)}
					<label class="option">
						<input
							type="checkbox"
							checked={news.geo.regions.includes(region)}
							onchange={() => toggleGeo('regions', region)}
						/>
						{region}
					</label>
				{/each}
			</div>
		{/if}

		{#if news.geo.scope === 'local'}
			<h3>Ciudades</h3>
			<div class="options">
				{#each LOCATIONS as location (location.id)}
					<label class="option">
						<input
							type="checkbox"
							checked={news.geo.cityIds.includes(location.id)}
							onchange={() => toggleGeo('cityIds', location.id)}
						/>
						{location.city}
					</label>
				{/each}
			</div>
		{/if}
		<FieldIssues {issues} field="geo" show={touched.geo === true} />
	</fieldset>

	<fieldset disabled={readonly}>
		<legend>Importancia editorial</legend>
		{#each IMPORTANCE_LEVELS as level (level.value)}
			<label class="importance">
				<input
					type="radio"
					name="importance"
					value={level.value}
					checked={news.importance === level.value}
					onchange={() => setImportance(level.value)}
				/>
				<span><strong>{level.value} · {level.label}</strong> — {level.description}</span>
			</label>
		{/each}
		<FieldIssues {issues} field="importance" show={touched.importance === true} />
	</fieldset>
</section>

<style>
	section {
		margin-bottom: 2rem;
	}

	fieldset {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	legend {
		font-weight: 600;
		padding: 0 0.5rem;
	}

	h3 {
		margin: 1rem 0 0.25rem;
		font-size: 0.95rem;
	}

	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
	}

	.options.scroll {
		max-height: 9rem;
		overflow-y: auto;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.hint {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: #666;
	}

	.importance {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		margin: 0.35rem 0;
	}
</style>
