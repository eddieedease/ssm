import { Block, uid } from './model';

/** Blocks from the root down to the block with this id; empty if absent. */
export function pathTo(blocks: Block[], id: string): Block[] {
  for (const block of blocks) {
    if (block.id === id) return [block];
    const rest = pathTo(block.children ?? [], id);
    if (rest.length) return [block, ...rest];
  }
  return [];
}

export function findBlock(blocks: Block[], id: string): Block | null {
  return pathTo(blocks, id).at(-1) ?? null;
}

/** The array holding a block, plus its index. */
export function locate(blocks: Block[], id: string): { list: Block[]; index: number } | null {
  const index = blocks.findIndex((b) => b.id === id);
  if (index >= 0) return { list: blocks, index };
  for (const block of blocks) {
    const found = locate(block.children ?? [], id);
    if (found) return found;
  }
  return null;
}

export function withNewIds(block: Block): Block {
  return { ...structuredClone(block), id: uid(), children: block.children?.map(withNewIds) };
}

export function getPath(target: any, path: string): any {
  return path.split('.').reduce((value, key) => value?.[key], target);
}

export function setPath(target: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const owner = keys.reduce((obj, key) => obj[key], target);
  owner[last] = value;
}
