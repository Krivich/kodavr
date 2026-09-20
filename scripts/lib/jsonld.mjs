/**
 * CONTRACT: scripts/lib/jsonld.mjs
 * ROLE: safe schema.org JSON-LD graphs for every page
 * EXPORTS:
 *   JSONLD_CONTEXT — the schema.org @context string
 *   jsonldArticle — the Article node for a dump
 *   jsonldBreadcrumb — the BreadcrumbList for a dump page
 *   jsonldCollectionPage — the CollectionPage node for the home feed
 *   jsonldItemList — the ItemList of dumps on the home feed
 *   jsonldOrganization — the Organization node
 *   jsonldWebpage — the WebPage node for a route
 *   jsonldWebsite — the WebSite node (every page carries it)
 *   serializeJsonLd — serializes a graph, escaping angle brackets against injection
 * INVARIANTS:
 *   — every serialized graph is safe inside a script tag (angle brackets are escaped)
 *   — `inLanguage` is caller-supplied and never assumed: the frame nodes (WebSite/
 *     WebPage/CollectionPage) take the page's UI locale, the Article takes the dump
 *     body's own language (KDV-I18N-05) — the body is never translated
 */

// scripts/lib/jsonld.mjs — server-rendered Schema.org JSON-LD (§6.4, §A4).
//
// One `@graph` per page, assembled from the same dataset that renders the meta
// block: `WebSite` + `WebPage` everywhere, `Article` + `BreadcrumbList` on a
// dump, `CollectionPage` + `ItemList` on the home feed, and nothing on the
// noindex 404. The builders are pure: the callers (pages.mjs / dumps.mjs) inject
// the single-sourced site constants (name, tagline, social card), so this module
// has no import back into pages.mjs and no cycle.
//
// SAFE serialization: `JSON.stringify` then `<` → `\u003c`. The graph carries
// author-controlled manifest values, so the emitted payload must never contain a
// literal `</script>` that would break out of the surrounding element.

export const JSONLD_CONTEXT = 'https://schema.org';

export function serializeJsonLd(graph) {
  return JSON.stringify({ '@context': JSONLD_CONTEXT, '@graph': graph }).replace(/</g, '\\u003c');
}

export function jsonldOrganization({ name, url, logo }) {
  return { '@type': 'Organization', name, url, logo };
}

export function jsonldWebsite({ name, base, description, image, inLanguage = 'en' }) {
  return {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name,
    url: `${base}/`,
    description,
    inLanguage,
    publisher: jsonldOrganization({ name, url: `${base}/`, logo: image }),
  };
}

export function jsonldWebpage({ websiteId, url, name, description, inLanguage = 'en' }) {
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { '@id': websiteId },
    inLanguage,
  };
}

export function jsonldArticle({
  url,
  title,
  summary,
  hook,
  datePublished,
  dateModified,
  authorGithub = null,
  organization,
  license,
  tags = [],
  section,
  image,
  inLanguage = 'en',
}) {
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: title,
    description: summary,
    abstract: hook,
    datePublished,
    dateModified,
    // §8.2: the merged PR's GitHub account when known, else the platform itself.
    author: authorGithub
      ? { '@type': 'Person', name: authorGithub }
      : organization,
    publisher: organization,
    license,
    keywords: tags,
    articleSection: section,
    mainEntityOfPage: url,
    image,
    isAccessibleForFree: true,
    inLanguage,
  };
}

export function jsonldBreadcrumb({ base, url, title }) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: title, item: url },
    ],
  };
}

export function jsonldCollectionPage({
  websiteId,
  url,
  name,
  description,
  itemListId,
  inLanguage = 'en',
}) {
  return {
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name,
    description,
    isPartOf: { '@id': websiteId },
    inLanguage,
    mainEntity: { '@id': itemListId },
  };
}

export function jsonldItemList({ id, items }) {
  return {
    '@type': 'ItemList',
    '@id': id,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
  };
}
