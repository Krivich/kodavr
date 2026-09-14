import { describe, it, expect } from 'vitest';
import { serializeJsonLd } from '../../scripts/lib/jsonld.mjs';

// The SERIALIZER is the security boundary: the graph values come from dump
// manifests (author-controlled), so the emitted `<script>` payload must never
// contain a literal `</script>` that would break out of the element.
describe('JSON-LD serializer', () => {
  it('KDV-SURFACE-11: emits well-formed JSON with @context and @graph', () => {
    const out = serializeJsonLd([{ '@type': 'WebSite', name: 'Kodavr' }]);
    expect(JSON.parse(out)).toEqual({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'WebSite', name: 'Kodavr' }],
    });
  });

  it('KDV-SURFACE-11: escapes `<` so an author value can never close the script tag', () => {
    const out = serializeJsonLd([
      { '@type': 'Article', description: '</script><script>alert(1)</script>' },
    ]);
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>');
    // The escape is JSON-legal: parsing restores the original value verbatim.
    expect(JSON.parse(out)['@graph'][0].description).toBe('</script><script>alert(1)</script>');
  });
});
