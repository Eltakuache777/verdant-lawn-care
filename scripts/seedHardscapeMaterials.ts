// Adds hardscape materials (retaining wall blocks, pavers, bulk/river rock,
// edging, fire pit kits, and base/sand materials) requested by the owner,
// each named color variant as its own row -- same treatment as the
// tomato/pepper/tree-cultivar splits. Categorized under Rocks & Stone
// (or Mulch for the two genuinely new mulch products); skips a few
// entries that are functional duplicates of mulch colors already in the
// catalog (dyed red/black/brown mulch, plain pine straw).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS: { category: string; name: string; description: string }[] = [
  // ---- Retaining Wall Blocks & Structural Wall Stone ----
  { category: "Rocks & Stone", name: "Gray Mini Retaining Wall Block", description: "Small stacking block (~3x10x6in) with rear lip, garden borders." },
  { category: "Rocks & Stone", name: "Tan Mini Retaining Wall Block", description: "Small stacking block (~3x10x6in) with rear lip, garden borders." },
  { category: "Rocks & Stone", name: "Red/Charcoal Mini Retaining Wall Block", description: "Small stacking block (~3x10x6in) with rear lip, garden borders." },
  { category: "Rocks & Stone", name: "Charcoal Standard Retaining Wall Block", description: "Mid-size block (~4x12x7in) for structural tiers and tree rings." },
  { category: "Rocks & Stone", name: "Desert Sand Standard Retaining Wall Block", description: "Mid-size block (~4x12x7in) for structural tiers and tree rings." },
  { category: "Rocks & Stone", name: "Sierra Blend Standard Retaining Wall Block", description: "Mid-size block (~4x12x7in), terracotta/brown blend." },
  { category: "Rocks & Stone", name: "Quarry Gray Jumbo Retaining Wall Block", description: "Large hollow-core block (~6x16x10in) for walls up to 4ft." },
  { category: "Rocks & Stone", name: "Earth Blend Jumbo Retaining Wall Block", description: "Large hollow-core block (~6x16x10in) for walls up to 4ft." },
  { category: "Rocks & Stone", name: "Chestnut Brown Jumbo Retaining Wall Block", description: "Large hollow-core block (~6x16x10in) for walls up to 4ft." },
  { category: "Rocks & Stone", name: "Limestone Gray Tapered Edging Block", description: "Curved-sided block for circles, radiuses, winding contours." },
  { category: "Rocks & Stone", name: "Sandstone Tan Tapered Edging Block", description: "Curved-sided block for circles, radiuses, winding contours." },
  { category: "Rocks & Stone", name: "Autumn Blend Tapered Edging Block", description: "Curved-sided block for circles, radiuses, winding contours." },
  { category: "Rocks & Stone", name: "Granite Gray Split-Face Retaining Block", description: "Rough chiseled rock-like texture on the exposed face." },
  { category: "Rocks & Stone", name: "Canyon Blend Split-Face Retaining Block", description: "Rough chiseled rock-like texture on the exposed face." },
  { category: "Rocks & Stone", name: "Toasted Almond Split-Face Retaining Block", description: "Rough chiseled rock-like texture on the exposed face." },
  { category: "Rocks & Stone", name: "Pewter Gray Tumbled Wall Block", description: "Distressed rounded-edge block, mimics vintage European stone." },
  { category: "Rocks & Stone", name: "Sienna Gold Tumbled Wall Block", description: "Distressed rounded-edge block, mimics vintage European stone." },
  { category: "Rocks & Stone", name: "Adobe Clay Tumbled Wall Block", description: "Distressed rounded-edge block, mimics vintage European stone." },
  { category: "Rocks & Stone", name: "Gray Wall Cap Stone", description: "Flat smooth-topped finishing piece for retaining wall tops." },
  { category: "Rocks & Stone", name: "Charcoal Wall Cap Stone", description: "Flat smooth-topped finishing piece for retaining wall tops." },
  { category: "Rocks & Stone", name: "Tan Wall Cap Stone", description: "Flat smooth-topped finishing piece for retaining wall tops." },
  { category: "Rocks & Stone", name: "Terracotta Red Wall Cap Stone", description: "Flat smooth-topped finishing piece for retaining wall tops." },

  // ---- Pavers, Patio Blocks, & Step Stones ----
  { category: "Rocks & Stone", name: "Red Holland Paver", description: "Classic 4x8in rectangular brick paver for herringbone/basketweave patterns." },
  { category: "Rocks & Stone", name: "Charcoal Holland Paver", description: "Classic 4x8in rectangular brick paver for herringbone/basketweave patterns." },
  { category: "Rocks & Stone", name: "Red/Black Flash Holland Paver", description: "Classic 4x8in rectangular brick paver, mixed red/black tones." },
  { category: "Rocks & Stone", name: "Tan/Brown Blend Holland Paver", description: "Classic 4x8in rectangular brick paver, tan/brown blend." },
  { category: "Rocks & Stone", name: "Pewter Gray Square Interlocking Paver", description: "6x6in or 12x12in square grid paver." },
  { category: "Rocks & Stone", name: "Olde Towne Blend Square Interlocking Paver", description: "6x6in or 12x12in square grid paver, blended tones." },
  { category: "Rocks & Stone", name: "Terra Cotta Square Interlocking Paver", description: "6x6in or 12x12in square grid paver." },
  { category: "Rocks & Stone", name: "Heritage Blend Plaza Paver", description: "Multi-size cobblestone-style kit, brown/tan/charcoal blend." },
  { category: "Rocks & Stone", name: "Bella Blend Plaza Paver", description: "Multi-size cobblestone-style kit, peach/tan/gray blend." },
  { category: "Rocks & Stone", name: "Granite Flash Plaza Paver", description: "Multi-size cobblestone-style kit, granite-flecked finish." },
  { category: "Rocks & Stone", name: "Concrete Gray Patio Block (12x12)", description: "Budget-friendly thin concrete square slab." },
  { category: "Rocks & Stone", name: "Brick Red Patio Block (12x12)", description: "Budget-friendly thin concrete square slab." },
  { category: "Rocks & Stone", name: "Slate Gray Patio Block (16x16)", description: "Medium-weight square, grill pads and utility landings." },
  { category: "Rocks & Stone", name: "Khaki Tan Patio Block (16x16)", description: "Medium-weight square, grill pads and utility landings." },
  { category: "Rocks & Stone", name: "Ultra-White Patio Slab (18x18/24x24)", description: "Large-format slab for modern minimalist hardscapes." },
  { category: "Rocks & Stone", name: "Charcoal Black Patio Slab (18x18/24x24)", description: "Large-format slab for modern minimalist hardscapes." },
  { category: "Rocks & Stone", name: "Limestone White Patio Slab (18x18/24x24)", description: "Large-format slab for modern minimalist hardscapes." },
  { category: "Rocks & Stone", name: "Tuscan Blend Flagstone-Imitation Stepping Stone", description: "Cast concrete step molded to look like broken flagstone, gold/tan." },
  { category: "Rocks & Stone", name: "Chaco Canyon Flagstone-Imitation Stepping Stone", description: "Cast concrete step molded to look like broken flagstone, rusty brown/gray." },
  { category: "Rocks & Stone", name: "Slate Gray Flagstone-Imitation Stepping Stone", description: "Cast concrete step molded to look like broken flagstone." },
  { category: "Rocks & Stone", name: "Weathered Driftwood Log-Slice Stepping Stone", description: "Concrete step with faux woodgrain texture, brown tone." },
  { category: "Rocks & Stone", name: "Charcoal Burned Wood Log-Slice Stepping Stone", description: "Concrete step with faux woodgrain texture, dark tone." },
  { category: "Rocks & Stone", name: "Brick-Weave Stepping Stone", description: "Single block pre-stamped with faux grout lines, looks like 8 bricks." },
  { category: "Rocks & Stone", name: "River Rock-Imitation Stepping Stone", description: "Concrete disk with embedded real small river pebbles for traction." },
  { category: "Rocks & Stone", name: "Blue-Gray Natural Slate Stepping Stone", description: "Unaltered real slate sheet, quarry-cleaved." },
  { category: "Rocks & Stone", name: "Charcoal Black Natural Slate Stepping Stone", description: "Unaltered real slate sheet, quarry-cleaved." },
  { category: "Rocks & Stone", name: "Rusty Copper Natural Slate Stepping Stone", description: "Unaltered real slate sheet, quarry-cleaved." },
  { category: "Rocks & Stone", name: "Ivory/Cream Natural Travertine Paver", description: "Naturally porous premium stone, rectangular cut." },
  { category: "Rocks & Stone", name: "Noche Walnut Natural Travertine Paver", description: "Naturally porous premium stone, rectangular cut." },
  { category: "Rocks & Stone", name: "Silver/Gray Natural Travertine Paver", description: "Naturally porous premium stone, rectangular cut." },
  { category: "Rocks & Stone", name: "Golden Quartz Natural Flagstone Slab", description: "Massive jagged natural rock, heavy-duty paths." },
  { category: "Rocks & Stone", name: "Arizona Red Rock Natural Flagstone Slab", description: "Massive jagged natural rock, heavy-duty paths." },
  { category: "Rocks & Stone", name: "Oklahoma Blue/Gray Natural Flagstone Slab", description: "Massive jagged natural rock, heavy-duty paths." },

  // ---- Bulk Rock, River Rock, & Small Stones ----
  { category: "Rocks & Stone", name: "Mixed Earthtone Pea Pebble", description: "Smooth tumbled 3/8in stone for dog runs, drainage, walkways." },
  { category: "Rocks & Stone", name: "Pure White Pea Pebble", description: "Smooth tumbled 3/8in stone for dog runs, drainage, walkways." },
  { category: "Rocks & Stone", name: "Amber Gold Pea Pebble", description: "Smooth tumbled 3/8in stone for dog runs, drainage, walkways." },
  { category: "Rocks & Stone", name: "Midnight Black Pea Pebble", description: "Smooth tumbled 3/8in stone for dog runs, drainage, walkways." },
  { category: "Rocks & Stone", name: "Desert Gold Decomposed Granite", description: "Finely crushed rock matrix, packs tight for paths/fire rings." },
  { category: "Rocks & Stone", name: "Red Rose Country Decomposed Granite", description: "Finely crushed rock matrix, packs tight for paths/fire rings." },
  { category: "Rocks & Stone", name: "Natural Silver-Gray Decomposed Granite", description: "Finely crushed rock matrix, packs tight for paths/fire rings." },
  { category: "Rocks & Stone", name: "Variegated Small River Rock", description: "Water-worn creekbed stone, 1/2-1in, gray/brown mix." },
  { category: "Rocks & Stone", name: "Creamy Tan Small River Rock", description: "Water-worn creekbed stone, 1/2-1in." },
  { category: "Rocks & Stone", name: "Glacier Gray Medium/Large River Rock", description: "Water-tumbled stone, 1-3in, creek beds and pond edging." },
  { category: "Rocks & Stone", name: "Multi-Color Yukon Earth River Rock", description: "Water-tumbled stone, 1-3in, creek beds and pond edging." },
  { category: "Rocks & Stone", name: "White Marble River Rock", description: "Water-tumbled stone, 1-3in, creek beds and pond edging." },
  { category: "Rocks & Stone", name: "Matte Jet Black Mexican Beach Pebble", description: "Premium glassy-smooth egg-shaped stone, architectural accent." },
  { category: "Rocks & Stone", name: "Mixed Pastel Buff Mexican Beach Pebble", description: "Premium glassy-smooth egg-shaped stone, architectural accent." },
  { category: "Rocks & Stone", name: "Shiny Polished Black Mexican Beach Pebble", description: "Premium glassy-smooth egg-shaped stone, architectural accent." },
  { category: "Rocks & Stone", name: "Pure Ice White Mexican Beach Pebble", description: "Premium glassy-smooth egg-shaped stone, architectural accent." },
  { category: "Rocks & Stone", name: "Chalk White Crushed Limestone", description: "Sharp jagged chips for drainage channels and paver sub-base." },
  { category: "Rocks & Stone", name: "Industrial Gray Crushed Limestone", description: "Sharp jagged chips for drainage channels and paver sub-base." },
  { category: "Rocks & Stone", name: "Snow White Marble Chips", description: "Sparkling crystal-infused crushed stone accent." },
  { category: "Rocks & Stone", name: "Pearl Pink Marble Chips", description: "Sparkling crystal-infused crushed stone accent." },
  { category: "Rocks & Stone", name: "Deep Crimson Red Lava Rock", description: "Porous lightweight volcanic rock, moisture retention/weed control." },
  { category: "Rocks & Stone", name: "Charcoal Black Lava Rock", description: "Porous lightweight volcanic rock, moisture retention/weed control." },

  // ---- Edging, Borders, & Fire Pit Kits ----
  { category: "Rocks & Stone", name: "Natural Gray Scalloped Edger", description: "Interlocking border strip with wavy decorative top." },
  { category: "Rocks & Stone", name: "Terracotta Red Scalloped Edger", description: "Interlocking border strip with wavy decorative top." },
  { category: "Rocks & Stone", name: "Charcoal Scalloped Edger", description: "Interlocking border strip with wavy decorative top." },
  { category: "Rocks & Stone", name: "Red/Charcoal Bullet Edger", description: "Rounded-nose interlocking stake, separates turf from beds." },
  { category: "Rocks & Stone", name: "Sandstone Tan Bullet Edger", description: "Rounded-nose interlocking stake, separates turf from beds." },
  { category: "Rocks & Stone", name: "Concrete Gray Bullet Edger", description: "Rounded-nose interlocking stake, separates turf from beds." },
  { category: "Rocks & Stone", name: "Quarry Gray Belgian Cobble Edger", description: "Boxy split-face mini block, raised garden bed perimeter." },
  { category: "Rocks & Stone", name: "Earth-Brown Multi Belgian Cobble Edger", description: "Boxy split-face mini block, raised garden bed perimeter." },
  { category: "Rocks & Stone", name: "Charcoal Black Belgian Cobble Edger", description: "Boxy split-face mini block, raised garden bed perimeter." },
  { category: "Rocks & Stone", name: "Sienna Tan Circular Fire Pit Kit", description: "Palletized ring kit -- wedge stones, steel insert, adhesive." },
  { category: "Rocks & Stone", name: "Cobblestone Gray Circular Fire Pit Kit", description: "Palletized ring kit -- wedge stones, steel insert, adhesive." },
  { category: "Rocks & Stone", name: "Desert Adobe Circular Fire Pit Kit", description: "Palletized ring kit -- wedge stones, steel insert, adhesive." },
  { category: "Rocks & Stone", name: "Slate Charcoal Square Fire Pit Kit", description: "Angular stone blocks for a modern square wood-burning pit." },
  { category: "Rocks & Stone", name: "Warm Chestnut Square Fire Pit Kit", description: "Angular stone blocks for a modern square wood-burning pit." },

  // ---- New Mulch products (skipping ones that duplicate existing dyed/pine straw entries) ----
  { category: "Mulch", name: "Amber-Brown Pine Bark Nuggets", description: "Chunky, slow-decomposing real pine bark, larger than shredded mulch." },
  { category: "Mulch", name: "Red-Brown Core Pine Bark Nuggets", description: "Chunky, slow-decomposing real pine bark, larger than shredded mulch." },
  { category: "Mulch", name: "Jungle Black Rubber Playground Mulch", description: "Shredded tire rubber, non-decomposing playground cushion." },
  { category: "Mulch", name: "Cocoa Brown Rubber Playground Mulch", description: "Shredded tire rubber, non-decomposing playground cushion." },
  { category: "Mulch", name: "Redwood Crimson Rubber Playground Mulch", description: "Shredded tire rubber, non-decomposing playground cushion." },
  { category: "Mulch", name: "Caribbean Blue Rubber Playground Mulch", description: "Shredded tire rubber, non-decomposing playground cushion." },
  { category: "Mulch", name: "Forest Green Rubber Playground Mulch", description: "Shredded tire rubber, non-decomposing playground cushion." },

  // ---- Basework, Sands, & Stabilizing Aggregates ----
  { category: "Rocks & Stone", name: "Paver Base (Class 5 Gravel)", description: "Coarse gravel/stone dust blend packed beneath patios for stabilization." },
  { category: "Rocks & Stone", name: "All-Purpose Leveling Sand", description: "Coarse sharp sand for the final flat bed before laying pavers/brick." },
  { category: "Rocks & Stone", name: "Creamy White Play Sand", description: "Screened, washed, fine-grain sand for sandboxes." },
  { category: "Rocks & Stone", name: "Beach Tan Play Sand", description: "Screened, washed, fine-grain sand for sandboxes." },
  { category: "Rocks & Stone", name: "Tan Polymeric Joint Sand", description: "Water-activated locking sand swept into paver joints, prevents weeds." },
  { category: "Rocks & Stone", name: "Steel Gray Polymeric Joint Sand", description: "Water-activated locking sand swept into paver joints, prevents weeds." },
  { category: "Rocks & Stone", name: "Charcoal Slate Polymeric Joint Sand", description: "Water-activated locking sand swept into paver joints, prevents weeds." },
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
  console.log(`Seeded ${created} hardscape material items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
