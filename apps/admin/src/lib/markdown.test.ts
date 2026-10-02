import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('renders paragraphs separated by blank lines', () => {
		expect(renderMarkdown('Uno\ndos\n\nTres')).toBe('<p>Uno dos</p>\n<p>Tres</p>');
	});

	it('renders bold, italic and headings', () => {
		expect(renderMarkdown('Hola **mundo** y *tú*')).toBe(
			'<p>Hola <strong>mundo</strong> y <em>tú</em></p>'
		);
		expect(renderMarkdown('## Título')).toBe('<h3>Título</h3>');
	});

	it('renders quotes and lists', () => {
		expect(renderMarkdown('> Cita textual')).toBe('<blockquote>Cita textual</blockquote>');
		expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
	});

	it('renders http(s) links safely', () => {
		expect(renderMarkdown('[fuente](https://example.org/a_b*c)')).toBe(
			'<p><a href="https://example.org/a_b*c" target="_blank" rel="noopener noreferrer">fuente</a></p>'
		);
	});

	it('escapes raw HTML and refuses non-http links', () => {
		const html = renderMarkdown(
			'<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>'
		);
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('href="javascript');
		expect(html).toContain('&lt;script&gt;');
	});

	it('returns an empty string for blank input', () => {
		expect(renderMarkdown('  \n\n ')).toBe('');
	});
});
