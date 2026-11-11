import { nodePath, type Atlas } from './model.ts';

/** Stable IDs preserve progress; redirects preserve links when pages change home. */
export function atlasRedirects(atlas: Atlas): Record<string, string> {
  const redirects: Record<string, string> = {};
  for (const node of atlas.nodes.values()) {
    const target = nodePath(atlas, node);
    for (const alias of node.aliases) {
      redirects[target.replace(new RegExp(`/${node.id}/$`), `/${alias}/`)] = target;
    }
    if (node.level !== 'territory') {
      for (const previous of node.previousPaths) redirects[previous] = target;
    }
  }
  return redirects;
}
