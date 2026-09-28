import { describe, expect, it } from 'vitest';
import { extractIdTokenFromHash } from './googleOAuth';

describe('extractIdTokenFromHash', () => {
	it('extracts the id_token from a URL fragment', () => {
		expect(extractIdTokenFromHash('#id_token=abc.def.ghi&scope=openid')).toBe('abc.def.ghi');
	});

	it('returns null when there is no id_token', () => {
		expect(extractIdTokenFromHash('#error=access_denied')).toBeNull();
	});

	it('returns null for an empty fragment', () => {
		expect(extractIdTokenFromHash('')).toBeNull();
	});
});
