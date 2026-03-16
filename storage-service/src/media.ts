export const media = {
  turtle: 'text/turtle',
  text: 'text/plain',
  n3: 'text/n3',
  jsonld: 'application/ld+json',
  json: 'application/json',
  rdfxml: 'application/rdf+xml',
} as const;

export type MediaType = typeof media[keyof typeof media];
