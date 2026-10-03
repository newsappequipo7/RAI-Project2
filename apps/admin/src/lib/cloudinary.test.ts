import { describe, expect, it, vi } from 'vitest';
import { readCloudinaryConfig, uploadPhoto, validatePhotoFile } from './cloudinary';

const config = { cloudName: 'demo cloud', uploadPreset: 'news_unsigned' };
const jpeg = () => new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

describe('readCloudinaryConfig', () => {
	it('needs both public variables', () => {
		expect(
			readCloudinaryConfig({
				VITE_CLOUDINARY_CLOUD_NAME: ' demo ',
				VITE_CLOUDINARY_UPLOAD_PRESET: 'p'
			})
		).toEqual({ cloudName: 'demo', uploadPreset: 'p' });
		expect(readCloudinaryConfig({ VITE_CLOUDINARY_CLOUD_NAME: 'demo' })).toBeNull();
		expect(readCloudinaryConfig({})).toBeNull();
	});
});

describe('validatePhotoFile', () => {
	it('accepts JPG, PNG and WebP up to 5 MB', () => {
		expect(validatePhotoFile({ type: 'image/png', size: 1024 })).toBeNull();
		expect(validatePhotoFile({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull();
	});

	it('rejects other types and oversize files', () => {
		expect(validatePhotoFile({ type: 'application/pdf', size: 10 })).toContain('JPG, PNG o WebP');
		expect(validatePhotoFile({ type: 'image/gif', size: 10 })).toContain('JPG, PNG o WebP');
		expect(validatePhotoFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })).toContain('5 MB');
	});
});

describe('uploadPhoto', () => {
	it('posts the file and the unsigned preset, and returns the secure URL', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/a.jpg' }), {
				status: 200
			})
		);

		const url = await uploadPhoto(jpeg(), config, fetchFn);

		expect(url).toBe('https://res.cloudinary.com/demo/a.jpg');
		const [endpoint, init] = fetchFn.mock.calls[0] as [string, RequestInit];
		expect(endpoint).toBe('https://api.cloudinary.com/v1_1/demo%20cloud/image/upload');
		expect(init.method).toBe('POST');
		const form = init.body as FormData;
		expect(form.get('upload_preset')).toBe('news_unsigned');
		expect(form.get('file')).toBeInstanceOf(File);
		expect([...form.keys()].sort()).toEqual(['file', 'upload_preset']); // no secret, no signature
	});

	it('surfaces Cloudinary errors', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'Upload preset not found' } }), {
				status: 400
			})
		);
		await expect(uploadPhoto(jpeg(), config, fetchFn)).rejects.toThrow('Upload preset not found');
	});

	it('does not even call Cloudinary for an invalid file', async () => {
		const fetchFn = vi.fn();
		const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

		await expect(uploadPhoto(pdf, config, fetchFn)).rejects.toThrow('JPG, PNG o WebP');
		expect(fetchFn).not.toHaveBeenCalled();
	});
});
