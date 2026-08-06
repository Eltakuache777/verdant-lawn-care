// New soil/sand/amendment types from the owner's detailed soil list --
// skips items already covered (leveling sand, polymeric joint sand, and
// washed play sand were already added under Rocks & Stone in the
// hardscape batch; brand names aren't tracked here, this catalog is
// about material types, not retail SKUs).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS: { category: string; name: string; description: string }[] = [
  // Potting soils
  { category: "Soil", name: "All-Purpose Potting Mix", description: "Light, well-draining mix with peat moss and perlite, for containers." },
  { category: "Soil", name: "Moisture-Control Potting Mix", description: "Potting mix infused with water-absorbing polymers/coir." },
  { category: "Soil", name: "Organic Potting Soil", description: "Chemical-free mix with compost, worm castings, and natural amendments." },
  { category: "Soil", name: "Cactus & Succulent Potting Mix", description: "Fast-draining sand-and-forest-product blend, prevents root rot." },
  { category: "Soil", name: "Orchid Potting Mix", description: "Coarse bark, charcoal, and perlite blend for tree-dwelling orchid roots." },
  { category: "Soil", name: "Seed Starting Mix", description: "Light, sterilized peat and vermiculite blend for fragile seedling roots." },
  { category: "Soil", name: "African Violet Soil", description: "Slightly acidic, extra-porous specialty blend." },
  { category: "Soil", name: "Bonsai Soil", description: "Heavy granular substrate -- calcined clay, lava rock, pine bark." },

  // Garden soils
  { category: "Soil", name: "Vegetable & Herb Garden Soil", description: "Enriched with extra calcium to prevent blossom end rot." },
  { category: "Soil", name: "Tree, Shrub & Landscape Soil", description: "Heavy-duty structural soil with continuous-release plant food." },
  { category: "Soil", name: "Lawn & Turf Soil", description: "Fine-screened soil for top-dressing lawns and patching bare spots." },

  // Sands
  { category: "Soil", name: "Concrete Sand (Torpedo Sand)", description: "Coarse sharp sand for mixing mortar and concrete." },
  { category: "Soil", name: "All-Purpose Utility Sand", description: "Coarse sand for winter traction or weighing down base weights." },
  { category: "Soil", name: "Horticultural Sand", description: "Coarse, chemical-free grit mixed into soil to break up heavy clay." },
  { category: "Soil", name: "Pool Filter Sand", description: "Precisely sized washed silica sand for pool filtration systems." },

  // Manures & composts
  { category: "Soil", name: "Composted Cow Manure", description: "Dehydrated, odorless, weed-free organic matter to replenish soil." },
  { category: "Soil", name: "Steer Manure", description: "Nitrogen-rich natural animal fertilizer amendment." },
  { category: "Soil", name: "Chicken/Poultry Manure", description: "High-nitrogen composted or pelletized manure." },
  { category: "Soil", name: "Mushroom Compost", description: "Spent mushroom substrate, excellent water retention." },
  { category: "Soil", name: "Leaf Mold", description: "Fully decomposed leaf litter, rich in forest microorganisms." },
  { category: "Soil", name: "Composted Forest Products", description: "Double-decomposed bark chips, conditions hard soils." },
  { category: "Soil", name: "Worm Castings", description: "Pure earthworm waste, gentle non-burning root food." },

  // Raw amendments
  { category: "Soil", name: "Perlite", description: "Lightweight popped volcanic glass, opens air pockets in potting soil." },
  { category: "Soil", name: "Vermiculite", description: "Spongy mineral flakes, hold water and nutrients in sandy soil." },
  { category: "Soil", name: "Sphagnum Peat Moss", description: "Acidic fibrous moss, retains water in soil blends." },
  { category: "Soil", name: "Garden Lime", description: "Raises soil pH (sweetens sour/acidic soil)." },
  { category: "Soil", name: "Soil Acidifier (Garden Sulfur)", description: "Lowers soil pH for blueberries and blue hydrangeas." },
  { category: "Soil", name: "Gypsum", description: "Breaks up heavy clay soil bonds without changing pH." },
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
  console.log(`Seeded ${created} soil items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
