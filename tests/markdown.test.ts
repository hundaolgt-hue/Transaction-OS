import { describe, it, expect } from 'vitest';
import { renderMarkdown, stripMarkdown } from '../src/lib/markdown';

describe('renderMarkdown', () => {
  it('renders headings, emphasis and links', () => {
    expect(renderMarkdown('## Scope')).toBe('<h3>Scope</h3>');
    expect(renderMarkdown('**bold** and *italic*')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('[ECMA](https://ecma.gov.et)')).toContain('href="https://ecma.gov.et"');
  });

  it('renders tables', () => {
    const html = renderMarkdown('| Code | Status |\n|---|---|\n| C-1 | Accepted |');
    expect(html).toContain('<th>Code</th>');
    expect(html).toContain('<td>Accepted</td>');
  });

  it('renders ordered and unordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('renders blockquotes and rules', () => {
    expect(renderMarkdown('> note')).toContain('<blockquote>');
    expect(renderMarkdown('---')).toBe('<hr />');
  });

  // The renderer feeds dangerouslySetInnerHTML, so escaping is load-bearing.
  it('escapes raw HTML in the source', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML inside table cells, lists and headings', () => {
    expect(renderMarkdown('| <img src=x onerror=1> |\n|---|\n| a |')).not.toContain('<img');
    expect(renderMarkdown('- <b>x</b>')).not.toContain('<b>x</b>');
    expect(renderMarkdown('# <i>h</i>')).not.toContain('<i>h</i>');
  });

  it('rejects javascript: URLs in links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('href="javascript');
  });

  it('escapes HTML inside fenced code', () => {
    expect(renderMarkdown('```\n<b>x</b>\n```')).toContain('&lt;b&gt;');
  });

  it('handles an empty or undefined body without throwing', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(undefined as unknown as string)).toBe('');
  });
});

describe('stripMarkdown', () => {
  it('flattens markup and truncates', () => {
    expect(stripMarkdown('## Heading\n\n**bold** text')).toBe('Heading bold text');
    expect(stripMarkdown('a'.repeat(300), 50)).toHaveLength(51); // 50 chars + ellipsis
  });
});
