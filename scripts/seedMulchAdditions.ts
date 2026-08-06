// A few genuinely new mulch products from the owner's detailed mulch list --
// most of that list (dyed black/brown/red, hardwood, cedar, cypress, pine
// straw, and the 5 rubber mulch colors) was already added earlier this
// session, so this only adds what wasn't already covered.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS: { category: string; name: string; description: string }[] = [
  { category: "Mulch", name: "Mini Pine Bark Nuggets", description: "Small tumbled bark pieces (1/2-1in), ideal for small beds and containers." },
  { category: "Mulch", name: "Coco Coir Brick Mulch", description: "Compressed coconut husk fiber block, expands with water into a moisture-locking blanket." },
  { category: "Mulch", name: "Cocoa Hull Mulch", description: "Fine, sweet-smelling cocoa bean shell byproduct, dark brown to black." },
];

async function main() {
  let created = 0;
  for (const item of ITEMS) {
    await prisma.materialCatalogItem.upsert({
      where: { category_name: { category: item.category, name: item.name } },
      update: { description: item.description },
      create: item,
    });
    created++;
  }
  console.log(`Seeded ${created} mulch items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
