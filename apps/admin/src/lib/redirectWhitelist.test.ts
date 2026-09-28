import { describe, expect, it } from 'vitest';
import { isAllowedRedirect } from './redirectWhitelist';

describe('isAllowedRedirect', () => {
	it('allows Expo Go deep links', () => {
		expect(isAllowedRedirect('exp://192.168.1.10:8081/--/auth')).toBe(true);
	});

	it('allows the native build scheme', () => {
		expect(isAllowedRedirect('newsapp://auth')).toBe(true);
	});

	it('rejects arbitrary external URLs', () => {
		expect(isAllowedRedirect('https://evil.example')).toBe(false);
	});

	it('rejects a scheme that merely contains an allowed prefix', () => {
		expect(isAllowedRedirect('https://evil.example/exp://fake')).toBe(false);
	});
});
