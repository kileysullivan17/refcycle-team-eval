import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export const CatalogSchema = z
  .object({
    categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), order: z.number().int() }).strict()),
    entries: z.array(
      z
        .object({
          id: z.string().min(1),
          category: z.string().min(1),
          name: z.string().min(1),
          query: z.string().min(1),
          rule_ids: z.array(z.string().min(1)),
          covered_in: z.array(z.string().min(1)),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((c, ctx) => {
    const cats = new Set(c.categories.map((x) => x.id));
    const ids = new Set<string>();
    for (const e of c.entries) {
      if (!cats.has(e.category)) ctx.addIssue({ code: 'custom', message: `Entry ${e.id} has unknown category ${e.category}` });
      if (ids.has(e.id)) ctx.addIssue({ code: 'custom', message: `Duplicate entry id ${e.id}` });
      ids.add(e.id);
      if (e.query !== e.name) ctx.addIssue({ code: 'custom', message: `Entry ${e.id} query must equal name (Q6)` });
    }
  });
export type Catalog = z.infer<typeof CatalogSchema>;

/** Loads and validates the static catalog file (CONTRACTS 5.1). Categories come back in `order`. */
export async function loadCatalog(file: string): Promise<Catalog> {
  const catalog = CatalogSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  return { categories: [...catalog.categories].sort((a, b) => a.order - b.order), entries: catalog.entries };
}
