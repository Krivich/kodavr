import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../scripts/lib/markdown.mjs';

describe('renderMarkdown', () => {
  it('KDV-BUILD-01: converts markdown constructs into real HTML elements', () => {
    const html = renderMarkdown(
      [
        '# Title',
        '',
        'Text with **bold**, *em* and a [link](https://example.test/x).',
        '',
        '- one',
        '- two',
        '',
        '```js',
        'const x = 1;',
        '```',
      ].join('\n'),
    );

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>em</em>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('<a href="https://example.test/x"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('&lt;h1&gt;');
  });

  it('KDV-BUILD-02: strips scripts, event handlers and javascript: URLs', () => {
    const html = renderMarkdown(
      [
        '<script>alert(1)</script>',
        '',
        '<img src="x" onerror="alert(1)">',
        '',
        '[x](javascript:alert(1))',
        '',
        '<style>body{color:red}</style>',
        '',
        '<div style="color:red">styled</div>',
        '',
        '<iframe src="https://evil.test"></iframe>',
        '',
        '<form action="/steal"><input name="secret"></form>',
      ].join('\n'),
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<style');
    expect(html).not.toContain('style="color:red"');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<form');
    expect(html).not.toMatch(/\son\w+=/i);
  });

  it('KDV-BUILD-02: keeps safe links and root-relative images, drops data: URLs', () => {
    const html = renderMarkdown(
      [
        '![ok](/assets/pic.png)',
        '',
        '![bad](data:image/png;base64,AAAA)',
        '',
        '[mail](mailto:someone@example.test)',
      ].join('\n\n'),
    );

    expect(html).toContain('src="/assets/pic.png"');
    expect(html).toContain('href="mailto:someone@example.test"');
    expect(html).not.toContain('data:');
  });
});
