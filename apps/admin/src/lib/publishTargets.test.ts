import type { PublishField } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { hasJumpTarget, PUBLISH_FIELD_TARGETS } from './publishTargets';

describe('PUBLISH_FIELD_TARGETS', () => {
	it('covers every field a publish error can point to', () => {
		const fields: PublishField[] = [
			'title',
			'lead',
			'body',
			'topics',
			'geo',
			'importance',
			'sources',
			'claims',
			'image',
			'certainty',
			'certaintyNote',
			'checklist'
		];
		expect(Object.keys(PUBLISH_FIELD_TARGETS).sort()).toEqual([...fields].sort());
	});

	it('points every field, image included, to a section of the editor', () => {
		for (const field of Object.keys(PUBLISH_FIELD_TARGETS) as PublishField[]) {
			expect(hasJumpTarget(field), field).toBe(true);
		}
	});
});
