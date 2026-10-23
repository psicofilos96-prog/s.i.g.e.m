export type ComponentDefault = { component_id: string; display_name: string; valid_from: string; source_ref: string };

/** Defaults are data, never normative versions; any real version reserves the identity. */
export function unversionedComponentDefaults(defaults: readonly ComponentDefault[], versionedIds: readonly string[]) {
  const reserved = new Set(versionedIds);
  return defaults.filter((d) => !reserved.has(d.component_id));
}