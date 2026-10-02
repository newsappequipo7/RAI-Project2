<script lang="ts">
	import type { FieldIssue, NewsFieldName } from '@repo/shared';

	let { issues, field, show }: { issues: FieldIssue[]; field: NewsFieldName; show: boolean } =
		$props();

	const own = $derived(show ? issues.filter((issue) => issue.field === field) : []);
</script>

{#each own as issue (issue.code)}
	<p class={issue.severity} role={issue.severity === 'error' ? 'alert' : 'status'}>
		{issue.message}
	</p>
{/each}

<style>
	p {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
	}

	.error {
		color: #b00020;
	}

	.warning {
		color: #8a5a00;
	}
</style>
