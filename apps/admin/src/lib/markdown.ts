/**
 * Minimal, safe renderer for the "simple markdown" of a news body: paragraphs, headings, lists,
 * `>` quotes (cita_fuente), **bold**, *italic* and http(s) links. Every input character is escaped
 * before any tag is added, so the result is safe for `{@html}`.
 */

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function renderInline(escaped: string): string {
	const links: string[] = [];

	// Links first and out of the way, so `*` or `_` inside a URL are not read as emphasis.
	const withTokens = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
		links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
		return `\uE000${links.length - 1}\uE000`;
	});

	return withTokens
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/\uE000(\d+)\uE000/g, (_, index) => links[Number(index)] ?? '');
}

function renderBlock(block: string): string {
	const lines = block.split('\n');

	if (lines.every((line) => /^>\s?/.test(line))) {
		const text = lines.map((line) => line.replace(/^>\s?/, '')).join(' ');
		return `<blockquote>${renderInline(escapeHtml(text))}</blockquote>`;
	}

	if (lines.every((line) => /^[-*]\s+/.test(line))) {
		const items = lines.map(
			(line) => `<li>${renderInline(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`
		);
		return `<ul>${items.join('')}</ul>`;
	}

	const heading = /^(#{1,3})\s+(.+)$/.exec(block);
	const [, marks, headingText] = heading ?? [];
	if (marks && headingText && lines.length === 1) {
		const level = marks.length + 1;
		return `<h${level}>${renderInline(escapeHtml(headingText))}</h${level}>`;
	}

	return `<p>${renderInline(escapeHtml(lines.join(' ')))}</p>`;
}

export function renderMarkdown(source: string): string {
	return source
		.replace(/\uE000/g, '') // reserved as the link placeholder delimiter
		.replace(/\r\n?/g, '\n')
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block !== '')
		.map(renderBlock)
		.join('\n');
}
