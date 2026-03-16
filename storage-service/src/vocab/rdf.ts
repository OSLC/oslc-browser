const ns = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' as const;

export const rdf = {
  ns,
  prefix: 'rdf' as const,

  // Properties
  type: `${ns}type`,
  resource: `${ns}resource`,
} as const;
