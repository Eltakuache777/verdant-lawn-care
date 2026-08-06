// Splits every named variety/cultivar previously folded into a description
// (e.g. "Crape Myrtle: white, pink, red, purple") into its own catalog row
// (e.g. "White Crape Myrtle", "Red Crape Myrtle") -- per explicit request
// to treat every category the same way the vegetable varieties were
// treated (separate rows, not consolidated). This script ADDS the split
// rows and DELETES the old consolidated parent rows it replaces, so the
// catalog doesn't end up with both a "Crape Myrtle" AND five color rows.
//
// Run with: npx tsx scripts/seedMaterialCatalogVarieties.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Each entry: the OLD consolidated [category, name] to delete, and the NEW
// split rows to create in its place.
const SPLITS: {
  category: string;
  oldName: string;
  varieties: { name: string; description: string }[];
}[] = [
  // ---- Trees ----
  { category: "Trees", oldName: "Dogwood", varieties: [
    { name: "Cherokee Chief Dogwood", description: "Deep pink spring blooms, ornamental flowering tree." },
    { name: "Cherokee Brave Dogwood", description: "Ruby-red spring blooms, ornamental flowering tree." },
    { name: "Kousa Dogwood", description: "White star-shaped summer blooms, ornamental flowering tree." },
  ]},
  { category: "Trees", oldName: "Magnolia", varieties: [
    { name: "Little Gem Magnolia", description: "Dwarf Southern Magnolia, large fragrant white blooms." },
    { name: "Southern Magnolia", description: "Large fragrant white blooms, glossy evergreen leaves." },
    { name: "Sweetbay Magnolia", description: "Smaller magnolia, lemon-scented white summer blooms." },
  ]},
  { category: "Trees", oldName: "Eastern Redbud", varieties: [
    { name: "Forest Pansy Redbud", description: "Purple-leaf redbud, pink spring blooms." },
    { name: "Oklahoma Redbud", description: "Glossy leaves, deep magenta spring blooms." },
    { name: "Rising Sun Redbud", description: "Gold-orange new foliage, pink spring blooms." },
    { name: "Ruby Falls Weeping Redbud", description: "Weeping form, purple foliage, pink spring blooms." },
  ]},
  { category: "Trees", oldName: "Ornamental Cherry", varieties: [
    { name: "Kwanzan Cherry", description: "Double pink spring blooms, non-fruiting ornamental." },
    { name: "Yoshino Cherry", description: "White spring blooms, classic ornamental cherry." },
    { name: "Weeping Yoshino Cherry", description: "Weeping form, white spring blooms." },
    { name: "Autumnalis Cherry", description: "Blooms in fall and again in spring, pale pink." },
  ]},
  { category: "Trees", oldName: "Japanese Maple", varieties: [
    { name: "Bloodgood Japanese Maple", description: "Deep red foliage all season." },
    { name: "Emperor Japanese Maple", description: "Red foliage, more heat tolerant than most." },
    { name: "Crimson Queen Weeping Japanese Maple", description: "Weeping form, deep red lacy foliage." },
    { name: "Coral Bark Japanese Maple", description: "Coral-red winter bark, green summer foliage turning gold." },
  ]},
  { category: "Trees", oldName: "Flowering Pear", varieties: [
    { name: "Cleveland Select Pear", description: "White spring blooms, narrow columnar form." },
    { name: "Chanticleer Pear", description: "White spring blooms, narrow columnar form, less storm-prone." },
  ]},
  { category: "Trees", oldName: "Flowering Plum", varieties: [
    { name: "Purple Leaf Newport Plum", description: "Purple foliage all season, pink spring blooms." },
    { name: "Thundercloud Plum", description: "Dark purple foliage, pale pink spring blooms." },
  ]},
  { category: "Trees", oldName: "Ornamental Crabapple", varieties: [
    { name: "Prairifire Crabapple", description: "Red spring blooms, purple-red foliage, small persistent fruit." },
    { name: "Robinson Crabapple", description: "Pink spring blooms, bronze-red foliage." },
    { name: "Profusion Crabapple", description: "Deep pink-red spring blooms, purple foliage." },
  ]},
  { category: "Trees", oldName: "Apple Tree", varieties: [
    { name: "Honeycrisp Apple Tree", description: "Crisp, sweet-tart classic apple." },
    { name: "Gala Apple Tree", description: "Sweet, mild apple, reliable producer." },
    { name: "Fuji Apple Tree", description: "Sweet, dense, long-storing apple." },
    { name: "Granny Smith Apple Tree", description: "Tart green apple, good keeper." },
  ]},
  { category: "Trees", oldName: "Peach Tree", varieties: [
    { name: "Elberta Peach Tree", description: "Classic freestone peach." },
    { name: "Redhaven Peach Tree", description: "Early-season freestone peach." },
    { name: "Belle of Georgia Peach Tree", description: "White-fleshed heirloom peach." },
    { name: "Bonanza Dwarf Peach Tree", description: "Compact dwarf, good for small yards/patios." },
  ]},
  { category: "Trees", oldName: "Pear Tree (Fruiting)", varieties: [
    { name: "Bartlett Pear Tree", description: "Classic sweet, juicy pear." },
    { name: "Kieffer Pear Tree", description: "Disease-resistant, good for canning." },
    { name: "Orient Pear Tree", description: "Disease-resistant, crisp pear." },
  ]},
  { category: "Trees", oldName: "Asian Pear Tree", varieties: [
    { name: "Shinseiki Asian Pear Tree", description: "Crisp, apple-like Asian pear." },
    { name: "Hosui Asian Pear Tree", description: "Sweet, juicy bronze-skinned Asian pear." },
  ]},
  { category: "Trees", oldName: "Plum Tree (Fruiting)", varieties: [
    { name: "Santa Rosa Plum Tree", description: "Sweet-tart classic plum." },
    { name: "Methley Plum Tree", description: "Self-fruitful, sweet red plum." },
    { name: "Burbank Plum Tree", description: "Juicy red-skinned plum." },
  ]},
  { category: "Trees", oldName: "Cherry Tree (Fruiting)", varieties: [
    { name: "Bing Cherry Tree", description: "Classic sweet dark cherry." },
    { name: "Black Tartarian Cherry Tree", description: "Early, sweet dark cherry." },
    { name: "Montmorency Sour Cherry Tree", description: "Classic pie/baking cherry." },
  ]},
  { category: "Trees", oldName: "Fig Tree", varieties: [
    { name: "Brown Turkey Fig Tree", description: "Reliable, cold-hardy fig." },
    { name: "Celeste Fig Tree", description: "Sweet, small fig, cold hardy." },
    { name: "Chicago Hardy Fig Tree", description: "Very cold-hardy fig variety." },
    { name: "Black Mission Fig Tree", description: "Rich, sweet dark-skinned fig." },
  ]},
  { category: "Trees", oldName: "Olive Tree", varieties: [
    { name: "Arbequina Olive Tree", description: "Cold-hardier olive, self-fruitful." },
    { name: "Little Ollie Dwarf Olive Tree", description: "Non-fruiting dwarf ornamental olive." },
  ]},
  { category: "Trees", oldName: "Pecan Tree", varieties: [
    { name: "Stewart Pecan Tree", description: "Classic Texas pecan variety." },
    { name: "Desirable Pecan Tree", description: "High-yield commercial pecan variety." },
    { name: "Cape Fear Pecan Tree", description: "Reliable pecan variety." },
  ]},
  { category: "Trees", oldName: "Lemon Tree", varieties: [
    { name: "Meyer Lemon Tree", description: "Sweeter, cold-hardier dwarf lemon." },
    { name: "Eureka Lemon Tree", description: "Classic tart grocery-store lemon." },
  ]},
  { category: "Trees", oldName: "Lime Tree", varieties: [
    { name: "Key Lime Tree", description: "Small, aromatic classic pie lime." },
    { name: "Persian Lime Tree", description: "Larger, seedless common lime." },
  ]},
  { category: "Trees", oldName: "Orange Tree", varieties: [
    { name: "Washington Navel Orange Tree", description: "Classic seedless eating orange." },
    { name: "Valencia Orange Tree", description: "Juicy orange, good for juicing." },
  ]},
  { category: "Trees", oldName: "Shade Maple", varieties: [
    { name: "Autumn Blaze Maple", description: "Fast-growing, brilliant red fall color." },
    { name: "Red Sunset Maple", description: "Reliable red fall color, strong branching." },
    { name: "Sugar Maple", description: "Classic orange-red fall color, slower growing." },
    { name: "Silver Maple", description: "Fast-growing shade tree, yellow fall color." },
  ]},
  { category: "Trees", oldName: "Oak (Shade)", varieties: [
    { name: "Shumard Oak", description: "Fast-growing shade oak, red fall color." },
    { name: "Pin Oak", description: "Pyramidal shade oak, russet fall color." },
    { name: "White Oak", description: "Long-lived stately shade oak." },
    { name: "Bur Oak", description: "Very hardy, drought-tolerant shade oak." },
  ]},
  { category: "Trees", oldName: "Elm (Shade)", varieties: [
    { name: "American Elm", description: "Classic vase-shaped shade tree, disease-resistant cultivars available." },
    { name: "Lacebark Elm", description: "Mottled ornamental bark, fast-growing shade tree." },
  ]},
  { category: "Trees", oldName: "Poplar & Aspen", varieties: [
    { name: "Lombardy Poplar", description: "Tall narrow columnar screening tree, very fast growing." },
    { name: "Quaking Aspen", description: "Fluttering leaves, striking white bark." },
    { name: "Tulip Poplar", description: "Tall native shade tree, tulip-shaped spring blooms." },
  ]},
  { category: "Trees", oldName: "Honey Locust", varieties: [
    { name: "Sunburst Honey Locust", description: "Golden new foliage, light filtered shade." },
    { name: "Shademaster Honey Locust", description: "Fast-growing, seedless, filtered canopy shade." },
  ]},
  { category: "Trees", oldName: "Arborvitae", varieties: [
    { name: "Green Giant Arborvitae", description: "Fast-growing evergreen privacy screening, can reach 40ft+." },
    { name: "Emerald Green Arborvitae", description: "Narrow pyramidal evergreen, classic privacy hedge." },
    { name: "Little Giant Dwarf Arborvitae", description: "Compact globe-shaped dwarf evergreen." },
  ]},
  { category: "Trees", oldName: "Cypress (Privacy)", varieties: [
    { name: "Leyland Cypress", description: "Very fast-growing evergreen privacy screen." },
    { name: "Italian Cypress", description: "Narrow columnar evergreen accent tree." },
  ]},
  { category: "Trees", oldName: "Pine", varieties: [
    { name: "Loblolly Pine", description: "Fast-growing Southern pine, tall straight trunk." },
    { name: "Eastern White Pine", description: "Soft long needles, fast-growing shade/screen pine." },
    { name: "Slash Pine", description: "Fast-growing Southern pine." },
    { name: "Austrian Pine", description: "Dense dark green needles, good windbreak pine." },
  ]},
  { category: "Trees", oldName: "Spruce", varieties: [
    { name: "Colorado Blue Spruce", description: "Striking blue-silver needles, classic specimen conifer." },
    { name: "Norway Spruce", description: "Fast-growing dark green conifer, good windbreak." },
    { name: "Alberta Dwarf Spruce", description: "Compact cone-shaped dwarf conifer." },
  ]},
  { category: "Trees", oldName: "Juniper", varieties: [
    { name: "Skyrocket Juniper", description: "Very narrow columnar blue-green conifer accent." },
    { name: "Spartan Juniper", description: "Dense columnar dark green privacy conifer." },
    { name: "Blue Point Juniper", description: "Pyramidal blue-green conifer." },
  ]},
  { category: "Trees", oldName: "Cedar", varieties: [
    { name: "Deodara Cedar", description: "Graceful weeping-branched large conifer." },
    { name: "Eastern Red Cedar", description: "Native, dense evergreen, good windbreak/wildlife tree." },
  ]},
  { category: "Trees", oldName: "Holly Tree", varieties: [
    { name: "Nellie R. Stevens Holly", description: "Fast-growing evergreen with red berries, popular privacy screen." },
    { name: "Foster Holly", description: "Narrow pyramidal evergreen with red berries." },
    { name: "American Holly", description: "Classic spiny evergreen with red berries." },
  ]},
  { category: "Trees", oldName: "Palm", varieties: [
    { name: "Windmill Palm", description: "Cold-hardiest common landscape palm." },
    { name: "Pygmy Date Palm", description: "Small accent palm, feathery fronds." },
    { name: "Queen Palm", description: "Tall graceful feather-leafed palm." },
    { name: "Sago Palm", description: "Technically a cycad; stiff dark green fronds, slow growing." },
  ]},
  { category: "Trees", oldName: "Ficus Tree", varieties: [
    { name: "Fiddle Leaf Fig", description: "Large glossy violin-shaped leaves, indoor/patio tree." },
    { name: "Weeping Fig (Benjamina)", description: "Classic indoor/patio tree, small glossy leaves." },
    { name: "Rubber Tree", description: "Bold glossy leaves, indoor/patio tree." },
  ]},

  // ---- Bushes & Hedges ----
  { category: "Bushes & Hedges", oldName: "Boxwood", varieties: [
    { name: "Green Velvet Boxwood", description: "Compact rounded form, classic dark green formal hedge." },
    { name: "Wintergreen Boxwood", description: "Cold-hardy, holds green color through winter." },
    { name: "Winter Gem Boxwood", description: "Fast-growing, cold-hardy formal hedge." },
    { name: "American Boxwood", description: "Traditional large formal hedge boxwood." },
    { name: "English Boxwood", description: "Slow-growing, very dense, classic formal boxwood." },
  ]},
  { category: "Bushes & Hedges", oldName: "Euonymus", varieties: [
    { name: "Golden Euonymus", description: "Bright yellow-green variegated evergreen shrub." },
    { name: "Burning Bush (Euonymus alatus)", description: "Brilliant fiery red fall foliage shrub." },
  ]},
  { category: "Bushes & Hedges", oldName: "Pittosporum", varieties: [
    { name: "Variegated Pittosporum", description: "Cream-edged glossy leaves, dense evergreen hedge." },
    { name: "Wheeler's Dwarf Pittosporum", description: "Compact low-growing evergreen border shrub." },
  ]},
  { category: "Bushes & Hedges", oldName: "Nandina (Heavenly Bamboo)", varieties: [
    { name: "Firepower Nandina", description: "Compact dwarf, fiery red winter foliage." },
    { name: "Gulf Stream Nandina", description: "Compact, blue-green foliage turning red in winter." },
    { name: "Lemon Lime Nandina", description: "Bright chartreuse-green compact foliage shrub." },
  ]},

  // ---- Plants ----
  { category: "Plants", oldName: "Pothos", varieties: [
    { name: "Golden Pothos", description: "Classic trailing vine houseplant, green and yellow variegation." },
    { name: "Marble Queen Pothos", description: "Trailing vine, heavy white/cream variegation." },
    { name: "Neon Pothos", description: "Trailing vine, bright chartreuse foliage." },
  ]},
  { category: "Plants", oldName: "Philodendron", varieties: [
    { name: "Heartleaf Philodendron", description: "Classic trailing vine, heart-shaped leaves." },
    { name: "Philodendron Brasil", description: "Trailing vine, green and yellow striped leaves." },
    { name: "Pink Princess Philodendron", description: "Dark leaves with vivid pink variegation, collector plant." },
  ]},
  { category: "Plants", oldName: "Snake Plant", varieties: [
    { name: "Snake Plant (Laurentii)", description: "Upright striped leaves with yellow edges, very low maintenance." },
    { name: "Snake Plant (Black Coral)", description: "Dark green upright architectural leaves, very low maintenance." },
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
