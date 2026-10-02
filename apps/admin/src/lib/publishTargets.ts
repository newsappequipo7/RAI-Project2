import type { PublishField } from '@repo/shared';

/**
 * Element each publish error points to, so the editor can jump to it. `null` means that section
 * does not exist yet (the image picker arrives with F2-07).
 */
export const PUBLISH_FIELD_TARGETS: Record<PublishField, string | null> = {
	title: 'title',
	lead: 'lead',
	body: 'body',
	topics: 'section-classification',
	geo: 'scope',
	importance: 'section-classification',
	sources: 'section-sources',
	claims: 'section-claims',
	image: null,
	certainty: 'certainty-options',
	certaintyNote: 'certainty-note',
	checklist: 'section-checklist'
};

export function hasJumpTarget(field: PublishField): boolean {
	return PUBLISH_FIELD_TARGETS[field] !== null;
}

/** Scrolls to the element for a publish error and focuses it when it is a form control. */
export function jumpToField(field: PublishField): void {
	const id = PUBLISH_FIELD_TARGETS[field];
	const element = id ? document.getElementById(id) : null;
	if (!element) return;

	element.scrollIntoView({ behavior: 'smooth', block: 'center' });
	if (
		element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
	) {
		element.focus({ preventScroll: true });
	}
}
