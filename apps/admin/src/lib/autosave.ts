export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export const AUTOSAVE_DELAY_MS = 2000;

/**
 * Debounced autosave: `schedule()` marks the editor dirty and saves once edits pause for
 * `delayMs`. `flush()` saves right away (leaving the page). Saves never overlap; edits made
 * during a save trigger a new one when it ends.
 */
export class Autosaver {
	status: SaveStatus = 'idle';
	errorMessage = '';

	private timer: ReturnType<typeof setTimeout> | undefined;
	private running: Promise<void> | undefined;
	private pending = false;

	constructor(
		private readonly save: () => Promise<void>,
		private readonly onChange: () => void = () => {},
		private readonly delayMs = AUTOSAVE_DELAY_MS
	) {}

	schedule(): void {
		this.pending = true;
		this.set('dirty');
		clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.flush(), this.delayMs);
	}

	async flush(): Promise<void> {
		clearTimeout(this.timer);
		this.timer = undefined;

		if (this.running) {
			await this.running;
			return;
		}
		if (!this.pending) return;

		this.running = this.run().finally(() => {
			this.running = undefined;
		});
		await this.running;
	}

	dispose(): void {
		clearTimeout(this.timer);
		this.timer = undefined;
	}

	private async run(): Promise<void> {
		while (this.pending) {
			this.pending = false;
			this.set('saving');

			try {
				await this.save();
			} catch (error) {
				this.pending = true;
				this.errorMessage = error instanceof Error ? error.message : 'No se pudo guardar';
				this.set('error');
				return;
			}
		}
		this.set('saved');
	}

	private set(status: SaveStatus): void {
		this.status = status;
		this.onChange();
	}
}
