// Third and final batch of variety splits -- remaining Flowers entries
// with multiple named colors still folded into a description.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SPLITS: {
  category: string;
  oldName: string;
  varieties: { name: string; description: string }[];
}[] = [
  { category: "Flowers", oldName: "Peony", varieties: [
    { name: "Pink Peony", description: "Large, full spring blooms." },
    { name: "White Peony", description: "Large, full spring blooms." },
    { name: "Red Peony", description: "Large, full spring blooms." },
  ]},
  { category: "Flowers", oldName: "Weigela", varieties: [
    { name: "Pink Weigela", description: "Arching shrub with spring trumpet blooms." },
    { name: "Red Weigela", description: "Arching shrub with spring trumpet blooms." },
  ]},
  { category: "Flowers", oldName: "Spirea", varieties: [
    { name: "White Spirea", description: "Dense flower clusters, spring/summer." },
    { name: "Pink Spirea", description: "Dense flower clusters, spring/summer." },
  ]},
  { category: "Flowers", oldName: "Rose of Sharon (Althea)", varieties: [
    { name: "Purple Rose of Sharon", description: "Hardy hibiscus shrub, summer blooms." },
    { name: "Pink Rose of Sharon", description: "Hardy hibiscus shrub, summer blooms." },
    { name: "White Rose of Sharon", description: "Hardy hibiscus shrub, summer blooms." },
  ]},
  { category: "Flowers", oldName: "Bougainvillea", varieties: [
    { name: "Pink Bougainvillea", description: "Vibrant papery bracts, climbing habit." },
    { name: "Purple Bougainvillea", description: "Vibrant papery bracts, climbing habit." },
  ]},
  { category: "Flowers", oldName: "Canna Lily", varieties: [
    { name: "Pink Canna Lily", description: "Large tropical leaves, bold summer blooms." },
    { name: "Orange Canna Lily", description: "Large tropical leaves, bold summer blooms." },
    { name: "Red Canna Lily", description: "Large tropical leaves, bold summer blooms." },
  ]},
  { category: "Flowers", oldName: "Mandevilla Vine", varieties: [
    { name: "Pink Mandevilla Vine", description: "Climbing trellis vine, trumpet blooms." },
    { name: "Red Mandevilla Vine", description: "Climbing trellis vine, trumpet blooms." },
  ]},
  { category: "Flowers", oldName: "Ixora", varieties: [
    { name: "Red Ixora", description: "Clustered tropical blooms." },
    { name: "Orange Ixora", description: "Clustered tropical blooms." },
    { name: "Yellow Ixora", description: "Clustered tropical blooms." },
  ]},
  { category: "Flowers", oldName: "African Violet", varieties: [
    { name: "Purple African Violet", description: "Fuzzy-leafed miniature indoor bloomer." },
    { name: "Pink African Violet", description: "Fuzzy-leafed miniature indoor bloomer." },
    { name: "White African Violet", description: "Fuzzy-leafed miniature indoor bloomer." },
  ]},
  { category: "Flowers", oldName: "Anthurium (Flamingo Flower)", varieties: [
    { name: "Pink Anthurium", description: "Waxy heart-shaped blooms." },
    { name: "Red Anthurium", description: "Waxy heart-shaped blooms." },
    { name: "White Anthurium", description: "Waxy heart-shaped blooms." },
  ]},
];

async function main() {
  let createdCount = 0;
  let deletedCount = 0;

  for (const split of SPLITS) {
    for (const variety of split.varieties) {
      await prisma.materialCatalogItem.upsert({
        where: { category_name: { category: split.category, name: variety.name } },
        update: { description: variety.description },
        create: { category: split.category, name: variety.name, description: variety.description },
      });
      createdCount++;
    }
    const deleted = await prisma.materialCatalogItem
      .delete({ where: { category_name: { category: split.category, name: split.oldName } } })
      .catch(() => null);
    if (deleted) deletedCount++;
  }

  console.log(`Created/updated ${createdCount} split-variety items, deleted ${deletedCount} old consolidated items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
