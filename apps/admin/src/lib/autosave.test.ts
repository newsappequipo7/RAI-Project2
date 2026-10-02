import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosaver } from './autosave';

describe('Autosaver', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('saves once, 2 seconds after the last edit', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const saver = new Autosaver(save);

		saver.schedule();
		await vi.advanceTimersByTimeAsync(1500);
		saver.schedule();
		await vi.advanceTimersByTimeAsync(1500);
		expect(save).not.toHaveBeenCalled();
		expect(saver.status).toBe('dirty');

		await vi.advanceTimersByTimeAsync(600);
		expect(save).toHaveBeenCalledTimes(1);
		expect(saver.status).toBe('saved');
	});

	it('flush saves immediately and skips when nothing is pending', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const saver = new Autosaver(save);

		await saver.flush();
		expect(save).not.toHaveBeenCalled();

		saver.schedule();
		await saver.flush();
		expect(save).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(5000);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('saves again when an edit arrives during a save', async () => {
		let release: () => void = () => {};
		const save = vi
			.fn()
			.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
			.mockResolvedValue(undefined);
		const saver = new Autosaver(save);

		saver.schedule();
		const flushing = saver.flush();
		saver.schedule();
		release();
		await flushing;

		expect(save).toHaveBeenCalledTimes(2);
		expect(saver.status).toBe('saved');
	});

	it('reports errors and retries on the next edit', async () => {
		const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
		const saver = new Autosaver(save);

		saver.schedule();
		await saver.flush();
		expect(saver.status).toBe('error');
		expect(saver.errorMessage).toBe('offline');

		saver.schedule();
		await saver.flush();
		expect(saver.status).toBe('saved');
		expect(save).toHaveBeenCalledTimes(2);
	});

	it('notifies on every status change and stops after dispose', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const onChange = vi.fn();
		const saver = new Autosaver(save, onChange);

		saver.schedule();
		saver.dispose();
		await vi.advanceTimersByTimeAsync(5000);
		expect(save).not.toHaveBeenCalled();
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});
