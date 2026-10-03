<script lang="ts">
	import { buildCoverSpec, wrapCoverTitle, type News } from '@repo/shared';

	let { title, topics, geo }: Pick<News, 'title' | 'topics' | 'geo'> = $props();

	const HEIGHT = 900;
	const WIDTH = 1600;
	const MAX_CHARS_PER_LINE = 22;

	const spec = $derived(buildCoverSpec({ title: title || 'Título de la noticia', topics, geo }));
	const lines = $derived(wrapCoverTitle(spec.title, MAX_CHARS_PER_LINE));
	const pad = $derived(spec.layout.padding * HEIGHT);
	const kickerSize = $derived(spec.layout.kickerSize * HEIGHT);
	const titleSize = $derived(spec.layout.titleSize * HEIGHT);
	const titleStart = $derived(pad + kickerSize + 0.9 * titleSize);
</script>

<svg
	viewBox="0 0 {WIDTH} {HEIGHT}"
	role="img"
	aria-label="Vista previa de la portada generada"
	xmlns="http://www.w3.org/2000/svg"
>
	<rect width={WIDTH} height={HEIGHT} fill={spec.background} />
	{#if spec.kicker}
		<text
			x={pad}
			y={pad + kickerSize}
			fill={spec.foreground}
			font-size={kickerSize}
			font-weight="700"
			letter-spacing="4"
			opacity="0.85">{spec.kicker}</text
		>
	{/if}
	{#each lines as line, index (index)}
		<text
			x={pad}
			y={titleStart + index * titleSize * spec.layout.titleLineHeight}
			fill={spec.foreground}
			font-size={titleSize}
			font-weight="800">{line}</text
		>
	{/each}
	{#if spec.place}
		<text
			x={pad}
			y={HEIGHT - pad}
			fill={spec.foreground}
			font-size={spec.layout.placeSize * HEIGHT}
			opacity="0.9">{spec.place}</text
		>
	{/if}
	<text
		x={WIDTH - pad}
		y={HEIGHT - pad}
		text-anchor="end"
		fill={spec.foreground}
		font-size={spec.layout.captionSize * HEIGHT}
		opacity="0.8">{spec.caption}</text
	>
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		max-width: 480px;
		height: auto;
		border-radius: 4px;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
</style>
