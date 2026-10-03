import { PHOTO_MAX_BYTES } from '@repo/shared';

/**
 * Unsigned Cloudinary upload (ADR-010). The cloud name and the preset name are public by design;
 * there is no API secret in the client. Without both variables the portal only accepts URLs.
 */
export interface CloudinaryConfig {
	cloudName: string;
	uploadPreset: string;
}

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function readCloudinaryConfig(
	env: Record<string, string | undefined> = import.meta.env
): CloudinaryConfig | null {
	const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
	const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
	return cloudName && uploadPreset ? { cloudName, uploadPreset } : null;
}

/** Message to show when a file must not be uploaded, or null when it is fine. */
export function validatePhotoFile(file: Pick<File, 'type' | 'size'>): string | null {
	if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
		return 'Solo se aceptan imágenes JPG, PNG o WebP.';
	}
	if (file.size > PHOTO_MAX_BYTES) {
		return `La imagen pesa más de ${PHOTO_MAX_BYTES / (1024 * 1024)} MB.`;
	}
	return null;
}

export async function uploadPhoto(
	file: File,
	config: CloudinaryConfig,
	fetchFn: typeof fetch = fetch
): Promise<string> {
	const problem = validatePhotoFile(file);
	if (problem) throw new Error(problem);

	const form = new FormData();
	form.append('file', file);
	form.append('upload_preset', config.uploadPreset);

	const response = await fetchFn(
		`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
		{ method: 'POST', body: form }
	);
	const body = (await response.json().catch(() => null)) as {
		secure_url?: string;
		error?: { message?: string };
	} | null;

	if (!response.ok || !body?.secure_url) {
		throw new Error(body?.error?.message ?? `Cloudinary respondió ${response.status}`);
	}
	return body.secure_url;
}
