const ns = 'http://www.w3.org/ns/ldp#' as const;

export const ldp = {
  ns,
  prefix: 'ldp' as const,

  // Resources
  Resource: `${ns}Resource`,
  RDFSource: `${ns}RDFSource`,
  Container: `${ns}Container`,
  BasicContainer: `${ns}BasicContainer`,
  DirectContainer: `${ns}DirectContainer`,

  // Properties
  contains: `${ns}contains`,
  membershipResource: `${ns}membershipResource`,
  hasMemberRelation: `${ns}hasMemberRelation`,
  isMemberOfRelation: `${ns}isMemberOfRelation`,

  // Link relations
  constrainedBy: `${ns}constrainedBy`,

  // Preferences
  PreferContainment: `${ns}PreferContainment`,
  PreferMembership: `${ns}PreferMembership`,
  PreferMinimalContainer: `${ns}PreferMinimalContainer`,
  PreferEmptyContainer: `${ns}PreferEmptyContainer`,
} as const;
