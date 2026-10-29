import { db } from "./db";

export type TaxonomyTree = {
  id: string;
  name: string;
  subjects: { id: string; name: string; topics: { id: string; name: string }[] }[];
}[];

export async function getTaxonomy(): Promise<TaxonomyTree> {
  return db.unit.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      subjects: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, topics: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
    },
  });
}
