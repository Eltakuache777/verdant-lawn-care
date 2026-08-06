// Second batch of variety splits -- remaining Trees/Bushes with named
// cultivars, plus the Flowers category (the largest remaining chunk of
// consolidated "color X, Y, Z" descriptions). Same pattern as
// seedMaterialCatalogVarieties.ts: create the split rows, delete the old
// consolidated parent row.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SPLITS: {
  category: string;
  oldName: string;
  varieties: { name: string; description: string }[];
}[] = [
  // ---- Trees ----
  { category: "Trees", oldName: "Crape Myrtle", varieties: [
    { name: "Natchez White Crape Myrtle", description: "White summer blooms, cinnamon-colored bark." },
    { name: "Tuscarora Pink Crape Myrtle", description: "Coral-pink summer blooms." },
    { name: "Dynamite Red Crape Myrtle", description: "Vivid red summer blooms." },
    { name: "Catawba Purple Crape Myrtle", description: "Deep purple summer blooms." },
    { name: "Muskogee Lavender Crape Myrtle", description: "Lavender summer blooms, large mature size." },
  ]},

  // ---- Bushes & Hedges ----
  { category: "Bushes & Hedges", oldName: "Distylium", varieties: [
    { name: "Blue Cascade Distylium", description: "Low spreading evergreen, blue-green foliage, boxwood alternative." },
    { name: "Cinnamon Girl Distylium", description: "Bronze-red new growth, evergreen privacy hedge." },
    { name: "Vintage Jade Distylium", description: "Mounding evergreen, dark green foliage, boxwood alternative." },
  ]},
  { category: "Bushes & Hedges", oldName: "Anise Shrub (Illicium)", varieties: [
    { name: "Florida Sunshine Anise Shrub", description: "Bright chartreuse-gold evergreen foliage." },
    { name: "BananAppeal Anise Shrub", description: "Compact evergreen with fragrant foliage." },
  ]},

  // ---- Flowers ----
  { category: "Flowers", oldName: "Petunia", varieties: [
    { name: "Pink Petunia", description: "Trailing/mounding annual, pink blooms." },
    { name: "Purple Petunia", description: "Trailing/mounding annual, purple blooms." },
    { name: "White Petunia", description: "Trailing/mounding annual, white blooms." },
    { name: "Red Petunia", description: "Trailing/mounding annual, red blooms." },
  ]},
  { category: "Flowers", oldName: "Begonia", varieties: [
    { name: "Wax-Leaf Begonia", description: "Compact, glossy leaves, shade/sun tolerant annual." },
    { name: "Angel Wing Begonia", description: "Wing-shaped spotted leaves, cascading blooms." },
    { name: "Dragon Wing Begonia", description: "Large glossy leaves, heavy continuous bloomer." },
    { name: "Tuberous Begonia", description: "Large showy blooms, shade container favorite." },
  ]},
  { category: "Flowers", oldName: "Vinca (Madagascar Periwinkle)", varieties: [
    { name: "Pink Vinca", description: "Heat-tolerant annual, pink star-shaped blooms." },
    { name: "White Vinca", description: "Heat-tolerant annual, white star-shaped blooms." },
    { name: "Purple Vinca", description: "Heat-tolerant annual, purple star-shaped blooms." },
  ]},
  { category: "Flowers", oldName: "Celosia", varieties: [
    { name: "Plume Celosia", description: "Feathery plume-shaped blooms in bold colors." },
    { name: "Cockscomb Celosia", description: "Brain-like crested blooms in bold colors." },
    { name: "Wheat Celosia", description: "Slender wheat-like bloom spikes." },
  ]},
  { category: "Flowers", oldName: "Dianthus", varieties: [
    { name: "Carnation", description: "Classic fragrant ruffled blooms." },
    { name: "Sweet William", description: "Clustered small fragrant blooms, biennial." },
  ]},
  { category: "Flowers", oldName: "Rose", varieties: [
    { name: "Knock Out Rose", description: "Continuous-blooming, disease-resistant landscape rose." },
    { name: "Drift Rose", description: "Compact groundcover-habit landscape rose." },
    { name: "Hybrid Tea Rose", description: "Classic large single-bloom cutting rose." },
  ]},
  { category: "Flowers", oldName: "Azalea", varieties: [
    { name: "Pink Azalea", description: "Spring-blooming shrub, part shade." },
    { name: "Red Azalea", description: "Spring-blooming shrub, part shade." },
    { name: "White Azalea", description: "Spring-blooming shrub, part shade." },
    { name: "Purple Azalea", description: "Spring-blooming shrub, part shade." },
  ]},
  { category: "Flowers", oldName: "Hydrangea", varieties: [
    { name: "Blue Hydrangea", description: "Mophead blooms, blue in acidic soil; needs shade in Texas heat." },
    { name: "Pink Hydrangea", description: "Mophead blooms, pink in alkaline soil; needs shade in Texas heat." },
    { name: "White Hydrangea", description: "Panicle or mophead blooms; needs shade in Texas heat." },
  ]},
  { category: "Flowers", oldName: "Butterfly Bush (Buddleja)", varieties: [
    { name: "Purple Butterfly Bush", description: "Long purple bloom spikes, attracts butterflies." },
    { name: "Pink Butterfly Bush", description: "Long pink bloom spikes, attracts butterflies." },
    { name: "White Butterfly Bush", description: "Long white bloom spikes, attracts butterflies." },
  ]},
  { category: "Flowers", oldName: "Lily", varieties: [
    { name: "Asiatic Lily", description: "Bold upward-facing blooms, early summer." },
    { name: "Oriental Lily", description: "Large fragrant blooms, mid-late summer." },
    { name: "Easter Lily", description: "Classic white trumpet blooms, potted holiday favorite." },
  ]},
  { category: "Flowers", oldName: "Caladium", varieties: [
    { name: "Pink Caladium", description: "Heart-shaped leaves with pink patterning, shade plant." },
    { name: "White Caladium", description: "Heart-shaped leaves with white patterning, shade plant." },
    { name: "Green Caladium", description: "Heart-shaped green and white patterned leaves, shade plant." },
  ]},
  { category: "Flowers", oldName: "Marigold", varieties: [
    { name: "Yellow Marigold", description: "Classic easy-care annual bloom." },
    { name: "Orange Marigold", description: "Classic easy-care annual bloom." },
  ]},
  { category: "Flowers", oldName: "Lavender", varieties: [
    { name: "English Lavender", description: "Classic fragrant purple spikes, more cold-hardy." },
    { name: "Spanish Lavender", description: "Fragrant purple spikes with distinctive top bracts." },
  ]},
  { category: "Flowers", oldName: "Poinsettia", varieties: [
    { name: "Red Poinsettia", description: "Classic holiday plant, red bracts." },
    { name: "White Poinsettia", description: "Holiday plant, white bracts." },
    { name: "Pink Poinsettia", description: "Holiday plant, pink bracts." },
  ]},
  { category: "Flowers", oldName: "Orchid", varieties: [
    { name: "Phalaenopsis Orchid", description: "Classic moth orchid, long-lasting indoor blooms." },
    { name: "Dendrobium Orchid", description: "Upright cane-growing orchid, indoor potted blooms." },
  ]},
  { category: "Flowers", oldName: "Hibiscus", varieties: [
    { name: "Red Hibiscus", description: "Large tropical blooms, braided tree or bush form." },
    { name: "Pink Hibiscus", description: "Large tropical blooms, braided tree or bush form." },
    { name: "Yellow Hibiscus", description: "Large tropical blooms, braided tree or bush form." },
    { name: "White Hibiscus", description: "Large tropical blooms, braided tree or bush form." },
  ]},
  { category: "Flowers", oldName: "Garden Mum", varieties: [
    { name: "Bronze Garden Mum", description: "Fall-blooming perennial/annual." },
    { name: "Yellow Garden Mum", description: "Fall-blooming perennial/annual." },
    { name: "Purple Garden Mum", description: "Fall-blooming perennial/annual." },
    { name: "White Garden Mum", description: "Fall-blooming perennial/annual." },
    { name: "Red Garden Mum", description: "Fall-blooming perennial/annual." },
  ]},
  { category: "Flowers", oldName: "Camellia", varieties: [
    { name: "Pink Camellia", description: "Fall or spring blooming evergreen shrub." },
    { name: "Red Camellia", description: "Fall or spring blooming evergreen shrub." },
    { name: "White Camellia", description: "Fall or spring blooming evergreen shrub." },
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
