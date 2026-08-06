// One-time seed for the MaterialCatalogItem browsable reference catalog --
// real landscaping materials/plants researched for Austin/Central Texas
// (matching the business's actual service area). Run with:
//   npx tsx scripts/seedMaterialCatalog.ts
// Safe to re-run: upserts on the [category, name] unique constraint.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS: { category: string; name: string; description?: string }[] = [
  // Rocks & Stone
  { category: "Rocks & Stone", name: "River Rock", description: "Smooth, rounded stones, 1-4in. Natural edging for beds and drainage areas." },
  { category: "Rocks & Stone", name: "Pea Gravel", description: "Small rounded rock, 1/4-5/8in. Walkways, playgrounds, drainage." },
  { category: "Rocks & Stone", name: "Crushed Granite", description: "Angular crushed stone. Driveways and base material." },
  { category: "Rocks & Stone", name: "Decomposed Granite", description: "Fine weathered granite. Paths, patios, xeriscaping." },
  { category: "Rocks & Stone", name: "Flagstone (Limestone)", description: "Flat natural stone slabs for patios and walkways." },
  { category: "Rocks & Stone", name: "Flagstone (Sandstone)", description: "Flat natural stone slabs, warm tones. Patios and walkways." },
  { category: "Rocks & Stone", name: "Boulders", description: "Large accent stones, 1ft+ diameter. Focal points, retaining features." },
  { category: "Rocks & Stone", name: "Lava Rock", description: "Lightweight porous volcanic rock. Ground cover, fire features." },
  { category: "Rocks & Stone", name: "Cobblestone", description: "Rounded paving stones. Borders, driveways, accents." },
  { category: "Rocks & Stone", name: "Drainage Gravel", description: "Coarse gravel for French drains and drainage beds." },
  { category: "Rocks & Stone", name: "Slate", description: "Flat, layered natural stone. Walkways and accents, gray/blue tones." },
  { category: "Rocks & Stone", name: "Bluestone", description: "Dense blue-gray flagstone. Premium patios and steps." },
  { category: "Rocks & Stone", name: "Rip Rap", description: "Large angular stones, 6-24in. Erosion control on slopes and drainage." },
  { category: "Rocks & Stone", name: "Crushed Limestone", description: "Common Central Texas base rock, white to gray. Driveways and road base." },
  { category: "Rocks & Stone", name: "Limestone Road Base", description: "Compactable limestone fines, standard driveway and path sub-base in this area." },
  { category: "Rocks & Stone", name: "Caliche", description: "Native Central Texas calcium-carbonate base material, common for driveways." },
  { category: "Rocks & Stone", name: "Moss Rock", description: "Native Texas limestone boulders with natural moss/lichen patina, popular accent stone." },

  // Mulch
  { category: "Mulch", name: "Hardwood Mulch", description: "Rich dark color from oak/maple/beech. Slowly acidifies soil." },
  { category: "Mulch", name: "Cedar Mulch", description: "Natural insect-deterrent oils, slow to decompose, fades to gray over time." },
  { category: "Mulch", name: "Pine Bark Mulch", description: "Decomposes faster, needs more frequent refresh." },
  { category: "Mulch", name: "Cypress Mulch", description: "Long-lasting and naturally insect-repellent." },
  { category: "Mulch", name: "Pine Straw", description: "Lightweight dried pine needles, ideal on slopes." },
  { category: "Mulch", name: "Dyed Red Mulch", description: "Recycled wood, tinted for uniform red color." },
  { category: "Mulch", name: "Dyed Black Mulch", description: "Recycled wood, tinted for uniform black color." },
  { category: "Mulch", name: "Dyed Brown Mulch", description: "Recycled wood, tinted for uniform dark brown color." },
  { category: "Mulch", name: "Rubber Mulch", description: "Durable, long-lasting. Playgrounds and pet-friendly areas." },
  { category: "Mulch", name: "Straw Mulch", description: "Lightweight, biodegradable. Garden beds and new lawn seeding." },

  // Soil
  { category: "Soil", name: "Topsoil", description: "General-purpose soil for lawns and beds." },
  { category: "Soil", name: "Garden Soil", description: "Screened topsoil amended with compost, for garden beds." },
  { category: "Soil", name: "Compost", description: "Nutrient-rich organic matter to improve any soil type." },
  { category: "Soil", name: "Sandy Loam", description: "Balanced sand/silt/clay mix with good drainage." },
  { category: "Soil", name: "Raised Bed Soil", description: "Lightweight blend suited for raised garden beds." },
  { category: "Soil", name: "Clay Soil Amendment", description: "Improves drainage and workability of heavy clay soil." },

  // Trees (Austin / Central Texas appropriate)
  { category: "Trees", name: "Live Oak", description: "Sprawling evergreen canopy, drought-tolerant once established." },
  { category: "Trees", name: "Texas Red Oak", description: "Native, brilliant red/orange fall foliage, drought tolerant." },
  { category: "Trees", name: "Monterrey Oak", description: "Fast-growing, drought-tolerant shade tree." },
  { category: "Trees", name: "Cedar Elm", description: "Highly resilient native, reliable shade and wildlife habitat." },
  { category: "Trees", name: "Texas Redbud", description: "10-20ft, pink/purple blooms in March-April." },
  { category: "Trees", name: "Mexican Sycamore", description: "Fast-growing native, large green leaves with silver undersides." },
  { category: "Trees", name: "Crape Myrtle", description: "Summer-blooming ornamental, available in white, pink, red, purple." },
  { category: "Trees", name: "Bald Cypress", description: "Deciduous conifer, tolerates wet or dry soil, feathery foliage." },
  { category: "Trees", name: "Texas Mountain Laurel", description: "Evergreen, fragrant purple spring blooms." },
  { category: "Trees", name: "Desert Willow", description: "Small ornamental tree, orchid-like pink/lavender blooms." },
  { category: "Trees", name: "Chinese Pistache", description: "Excellent fall color, heat and drought tolerant." },
  { category: "Trees", name: "Yaupon Holly", description: "Evergreen, red berries, works as tree or large shrub." },

  // Flowers / plants (Austin / Central Texas appropriate + popular annuals, wide color range)
  { category: "Flowers", name: "Texas Lantana", description: "Yellow, orange, and pink clustered blooms, spring through fall." },
  { category: "Flowers", name: "Purple Coneflower", description: "Purple daisy-like blooms, drought tolerant, attracts pollinators." },
  { category: "Flowers", name: "Autumn Sage", description: "Red, pink, coral, or white blooms, spring until frost." },
  { category: "Flowers", name: "Texas Sage", description: "Compact shrub with pink-lavender blooms." },
  { category: "Flowers", name: "Blackfoot Daisy", description: "Low-growing white daisy-like blooms, very drought resistant." },
  { category: "Flowers", name: "Turk's Cap", description: "Red tubular blooms, spring through fall, hummingbird favorite." },
  { category: "Flowers", name: "Zexmenia", description: "Golden-yellow daisies, blooms May-November." },
  { category: "Flowers", name: "Prairie Verbena", description: "Round clusters of light purple blooms." },
  { category: "Flowers", name: "Esperanza (Yellow Bells)", description: "Bright yellow trumpet blooms, heat tolerant shrub." },
  { category: "Flowers", name: "Marigold", description: "Yellow and orange annual blooms, easy care." },
  { category: "Flowers", name: "Petunia", description: "Annual available in many colors: pink, purple, white, red, and mixes." },
  { category: "Flowers", name: "Zinnia", description: "Annual available in many sizes and colors, from pastel to bright." },
  { category: "Flowers", name: "Black-Eyed Susan", description: "Yellow petals with a dark center, blooms summer into fall." },
  { category: "Flowers", name: "Daylily", description: "Available in many colors and sizes, low maintenance perennial." },
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
  console.log(`Seeded ${created} material catalog items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
