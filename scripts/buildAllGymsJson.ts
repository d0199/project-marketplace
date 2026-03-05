/**
 * scripts/buildEasternGymsJson.ts
 * Converts data/gyms_eastern.csv → data/gyms_eastern.json
 * ready for bulk import into DynamoDB via scripts/seed.ts
 *
 * Run:  npx tsx scripts/buildEasternGymsJson.ts
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// CSV parser (handles double-quoted fields containing commas / newlines)
// ---------------------------------------------------------------------------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      fields.push(cur.trim()); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      fields.push(cur.trim()); cur = "";
      if (fields.some((f) => f !== "")) rows.push(fields);
      fields = [];
    } else {
      cur += ch;
    }
  }
  if (cur || fields.length) { fields.push(cur.trim()); if (fields.some((f) => f !== "")) rows.push(fields); }
  return rows;
}

// ---------------------------------------------------------------------------
// Deterministic pick from array using a string key
// ---------------------------------------------------------------------------
function pick<T>(arr: T[], key: string): T {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (((h << 5) + h) ^ key.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

// ---------------------------------------------------------------------------
// Address helpers — works for all Australian states
// ---------------------------------------------------------------------------
function extractStreet(address: string): string {
  let street = address.split(",")[0].trim();
  street = street.replace(/^(opp\s+[^,]+,\s*|Rear\/|Enter via [^,]+,\s*|Outside [^,]+,\s*)/i, "");
  return street.trim();
}

function extractSuburb(address: string, state: string): string {
  // Formatted address is typically: "Street, Suburb STATE POSTCODE, Australia"
  // Split by comma, walk parts looking for "SUBURB STATE" pattern
  const parts = address.split(",").map((p) => p.trim());
  for (const part of parts) {
    const m = part.match(new RegExp(`^(.+?)\\s+${state}\\s+\\d{4}$`, "i"));
    if (m) return m[1].trim();
  }
  // Fallback — second comma-separated segment
  return parts[1] ?? "";
}

function extractPostcode(address: string): string {
  // All Australian postcodes: 0200–9999 (in practice 2000–7999 for the states we cover)
  const m = address.match(/\b[2-9]\d{3}\b/);
  return m ? m[0] : "";
}

// ---------------------------------------------------------------------------
// Gym classification (same as WA script)
// ---------------------------------------------------------------------------
type GymType =
  | "chain24" | "largechain" | "f45" | "crossfit" | "pilates"
  | "boxing" | "leisure" | "speedfit" | "womens" | "strength"
  | "boutique" | "default";

function classify(name: string): GymType {
  const n = name.toLowerCase();
  if (n.includes("speedfit")) return "speedfit";
  if (/crossfit|hyrox/.test(n)) return "crossfit";
  if (/pilates|yoga/.test(n)) return "pilates";
  if (/boxing|mma|martial|muay thai|rumble boxing|combat/.test(n)) return "boxing";
  if (/women|ladies|female|sista fitness/.test(n)) return "womens";
  if (/aquatic|leisure centre|recreation centre|leisureplex|pcyc|beatty park|wave pool|ymca|lesiure/.test(n)) return "leisure";
  if (/f45|fitstop|bft body|orange theory|orangetheory/.test(n)) return "f45";
  if (/goodlife|world gym|genesis health|gold.s gym|fitness first|fitness cartel|virgin active|les mills/.test(n)) return "largechain";
  if (/snap fitness|anytime fitness|plus fitness|jetts|revo fitness|zap fitness|club lime|24.7|247|pumpt|crunch fitness/.test(n)) return "chain24";
  if (/strength|barbell|powerlifting|performance|conditioning|s&c|athletic/.test(n)) return "strength";
  if (/studio|pt studio|personal training/.test(n)) return "boutique";
  return "default";
}

// ---------------------------------------------------------------------------
// Amenity inference (same as WA script)
// ---------------------------------------------------------------------------
const AM = {
  gym: ["cardio", "free weights", "showers", "lockers"],
  access247: ["24/7 access"],
  classes: ["group classes"],
  pool: ["pool"],
  pt: ["personal training"],
  boxing: ["boxing/mma"],
  pilates: ["yoga/pilates"],
  parking: ["parking"],
  childcare: ["childcare"],
  sauna: ["sauna"],
  cafe: ["café"],
};

function inferAmenities(type: GymType, name: string): string[] {
  const n = name.toLowerCase();
  const set = new Set<string>();
  const add = (...keys: (keyof typeof AM)[]) =>
    keys.forEach((k) => AM[k].forEach((a) => set.add(a)));

  switch (type) {
    case "chain24":    add("gym", "access247"); break;
    case "largechain": add("gym", "classes", "pt");
      if (/goodlife|world gym|virgin active/.test(n)) add("sauna");
      if (/goodlife|virgin active/.test(n)) add("pool");
      add("parking"); break;
    case "f45":        add("classes", "pt"); set.add("cardio"); break;
    case "crossfit":   add("gym", "classes"); break;
    case "pilates":    add("pilates", "pt"); break;
    case "boxing":     add("boxing", "gym"); break;
    case "leisure":    add("pool", "gym", "classes", "childcare", "parking", "cafe"); break;
    case "speedfit":   add("pt"); break;
    case "womens":     add("gym", "classes", "pt"); break;
    case "strength":   add("gym", "pt"); break;
    case "boutique":   add("gym", "pt"); break;
    default:           add("gym");
  }

  if (/24.7|247|anytime/.test(n) && !set.has("24/7 access")) set.add("24/7 access");
  if (/pool|aquatic|swim/.test(n)) add("pool");
  if (/sauna/.test(n)) add("sauna");
  if (/café|cafe|coffee/.test(n)) add("cafe");
  if (/park/.test(n)) add("parking");

  return [...set];
}

// ---------------------------------------------------------------------------
// Price inference
// ---------------------------------------------------------------------------
function inferPrice(type: GymType, id: string): number {
  const pools: Record<GymType, number[]> = {
    chain24:    [10, 12, 14, 15, 16, 18],
    largechain: [25, 28, 30, 32, 35],
    f45:        [40, 45, 48, 50, 55],
    crossfit:   [38, 40, 42, 45],
    pilates:    [28, 30, 35, 38, 40],
    boxing:     [28, 30, 32, 35, 38],
    leisure:    [12, 14, 15, 18, 20],
    speedfit:   [55, 60, 65, 70],
    womens:     [15, 18, 20, 22, 25],
    strength:   [35, 38, 40, 42, 45],
    boutique:   [35, 38, 40, 45, 50],
    default:    [18, 20, 22, 25, 28, 30],
  };
  return pick(pools[type], id);
}

// ---------------------------------------------------------------------------
// Description generation (same bank as WA script)
// ---------------------------------------------------------------------------
const DESCRIPTIONS: Record<GymType, Array<(name: string, suburb: string) => string>> = {
  chain24: [
    (_, s) => `A conveniently located 24/7 gym in ${s} offering round-the-clock access to quality cardio machines, strength equipment, and free weights. Perfect for busy schedules, with no lock-in contracts and fully equipped change rooms.`,
    (_, s) => `Your local ${s} fitness destination is open every hour of every day, so you can train on your own terms. Expect a well-maintained floor of cardio equipment, pin-loaded machines, and a free weights area — everything you need, without the extras you don't.`,
    (_, s) => `Compact and efficient, this ${s} facility gives members access to a full suite of gym equipment any time, day or night. Swipe-card entry, clean facilities, and straightforward month-to-month memberships make it easy to get started.`,
    (_, s) => `No frills, no fuss — just solid equipment available whenever you want it. This 24/7 gym packs cardio, machine weights, and a free weights section into a clean, well-lit space in ${s}.`,
    (_, s) => `Open around the clock with secure key-fob entry, this ${s} gym caters to early risers, shift workers, and night owls alike. A reliable roster of treadmills, bikes, cables, and dumbbells keeps your training consistent.`,
  ],
  largechain: [
    (_, s) => `A full-service health club in ${s} offering a comprehensive range of fitness options under one roof. From an extensive free weights area and machine circuit to studio classes and expert personal trainers, everything is here for members at every fitness level.`,
    (_, s) => `One of ${s}'s premier fitness destinations, this club features a large gym floor loaded with cardio and strength equipment, a group fitness studio running daily classes, and a team of personal trainers ready to help you reach your goals.`,
    (_, s) => `This well-established health club in ${s} combines a spacious gym floor with a diverse group fitness timetable, making it popular with everyone from casual gym-goers to serious athletes.`,
    (n, s) => `${n} in ${s} is a flagship fitness facility with a large floor plan covering cardio machines, selectorised and free weights, a dedicated functional training zone, and a busy group fitness studio.`,
  ],
  f45: [
    (n, _) => `${n} delivers team training that pushes you further than you'd go alone. Each 45-minute session combines functional movements and HIIT principles, with coaches guiding you through a different workout every day.`,
    (_, s) => `Built around the power of the group, this ${s} studio delivers coached HIIT and functional training sessions designed to maximise results in minimal time. Rotating workouts and motivating coaches keep every visit fresh.`,
    (_, s) => `Small-group training at its finest in ${s}. Sessions blend cardio and resistance work for a comprehensive workout in under an hour. New members always welcome.`,
  ],
  crossfit: [
    (n, _) => `${n} is a CrossFit affiliate built around constantly varied, high-intensity functional movements. Daily WODs are coached by certified trainers, with a box environment where community is as important as the training.`,
    (_, s) => `This ${s} CrossFit box brings a community-first approach to fitness, with coaches who adapt workouts to suit everyone from beginners to competitive athletes.`,
    (_, s) => `Train hard, train together. This ${s} affiliate runs a structured CrossFit program with an emphasis on movement quality and progressive overload.`,
  ],
  pilates: [
    (n, _) => `${n} is a dedicated pilates and movement studio offering reformer and mat-based classes for all experience levels. Small class sizes ensure personalised attention.`,
    (_, s) => `Specialising in reformer pilates with a focus on precision, control, and body awareness, this ${s} studio offers classes from beginner to advanced.`,
    (_, s) => `A calm and focused environment in ${s} where pilates and yoga classes help members build strength from the inside out.`,
  ],
  boxing: [
    (n, _) => `${n} is a dedicated combat sports and fitness facility covering boxing, Muay Thai, and general conditioning. Suitable for competitive fighters and complete beginners alike.`,
    (_, s) => `Hit the bags, learn technique, and get in the best shape of your life at this ${s} gym. Specialising in boxing and martial arts training, classes cater to all ages and experience levels.`,
    (_, s) => `A boxing gym at heart with a genuine fitness community built around the sweet science in ${s}. Members train alongside serious amateurs and fitness enthusiasts.`,
  ],
  leisure: [
    (n, s) => `${n} is a comprehensive community leisure facility in ${s} offering gym access, group fitness classes, and aquatic facilities. Catering for all ages and abilities.`,
    (_, s) => `This council-operated recreation centre in ${s} provides affordable access to gym equipment, group fitness classes, aquatic facilities, and court sports.`,
    (_, s) => `An affordable and family-friendly facility in ${s} offering swimming, gym access, fitness classes, and sports programs in one location.`,
  ],
  speedfit: [
    (n, s) => `${n} in ${s} uses EMS technology to activate up to 90% of muscle fibres simultaneously during a 20-minute session — delivering results equivalent to hours of conventional training.`,
    (n, _) => `${n} harnesses bio-electric impulses to supercharge muscle activation during short, intensely effective sessions. Supervised one-on-one training ensures correct technique and maximum results.`,
  ],
  womens: [
    (n, s) => `${n} in ${s} is a welcoming women-only gym providing a comfortable, judgement-free space to train.`,
    (_, s) => `Designed by women, for women — this ${s} gym offers a private and empowering environment to work towards your goals.`,
    (_, s) => `A safe, supportive, and fully equipped fitness space exclusively for women in ${s}. Classes, personal training, and open gym sessions are available.`,
  ],
  strength: [
    (n, _) => `${n} is a serious training space for lifters who demand quality equipment and minimal distraction. Stocked with competition barbells, racks, platforms, and an extensive selection of plates and dumbbells.`,
    (_, s) => `A focused, coach-led gym environment in ${s} dedicated to building real strength and athletic performance.`,
    (_, s) => `This ${s} performance centre offers a professional training environment with premium equipment and expert coaching.`,
  ],
  boutique: [
    (n, s) => `${n} in ${s} is a coach-led boutique studio where sessions are designed around individual goals rather than generic programming.`,
    (_, s) => `A ${s} studio built around personalised coaching and real results. Whether it's one-on-one personal training or small group sessions, every member gets the attention they need.`,
    (_, s) => `This ${s} boutique facility delivers a premium training experience in a small, focused setting. Expert coaches and evidence-based programming set it apart.`,
  ],
  default: [
    (n, s) => `${n} in ${s} is a well-equipped, independently operated gym delivering quality training in a friendly environment.`,
    (_, s) => `A local gem in ${s}, offering a fully equipped gym floor, experienced trainers, and a genuine commitment to member results.`,
    (_, s) => `This independently run fitness facility in ${s} prides itself on quality coaching and a genuine community feel.`,
    (n, s) => `Built by fitness enthusiasts for fitness enthusiasts, ${n} in ${s} offers a well-curated equipment range and a knowledgeable coaching team.`,
    (_, s) => `More personal than a big-box gym, more equipped than a micro-studio. This ${s} facility strikes the right balance.`,
  ],
};

function generateDescription(type: GymType, name: string, suburb: string, id: string): string {
  return pick(DESCRIPTIONS[type], id)(name, suburb);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const CSV_PATH = path.join(process.cwd(), "data", "gyms_all.csv");
const OUT_PATH = path.join(process.cwd(), "data", "gyms_all.json");

if (!fs.existsSync(CSV_PATH)) {
  console.error(`CSV not found: ${CSV_PATH}`);
  console.error("Run seedAllGymsCSV.ts first.");
  process.exit(1);
}

const raw = fs.readFileSync(CSV_PATH, "utf-8");
const rows = parseCSV(raw);
const [header, ...dataRows] = rows;

const colIndex = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

// IDs start from 1 — importGyms.ts dedupes against DynamoDB so no collision
const existingCount = 0;

const gyms = dataRows
  .filter((row) => row[colIndex.name]?.trim())  // skip blank rows
  .map((row, i) => {
    const seqId = existingCount + i + 1;
    const id = `gym-${String(seqId).padStart(3, "0")}`;
    const googlePlaceId = row[colIndex.id] ?? "";
    const name = row[colIndex.name] ?? "";
    const address = row[colIndex.address] ?? "";
    const state = (row[colIndex.state] ?? "").toUpperCase();
    const lat = parseFloat(row[colIndex.lat]) || 0;
    const lng = parseFloat(row[colIndex.lng]) || 0;
    const phone = row[colIndex.phone] ?? "";
    const website = row[colIndex.website] ?? "";

    const postcode = extractPostcode(address);
    const street = extractStreet(address);
    const suburb = extractSuburb(address, state) || row[colIndex.suburb] || "";

    const type = classify(name);
    const description = generateDescription(type, name, suburb, id);
    const amenities = inferAmenities(type, name);
    const pricePerWeek = inferPrice(type, id);

    return {
      id,
      googlePlaceId,
      ownerId: "unclaimed",
      isActive: true,
      isTest: false,
      isFeatured: false,
      priceVerified: false,
      isPaid: false,
      name,
      description,
      address: { street, suburb, state, postcode },
      phone,
      email: "",
      website,
      lat,
      lng,
      amenities,
      hours: {},
      memberOffers: [],
      memberOffersScroll: false,
      pricePerWeek,
      images: [],
    };
  });

fs.writeFileSync(OUT_PATH, JSON.stringify(gyms, null, 2));

const byState = gyms.reduce<Record<string, number>>((acc, g) => {
  acc[g.address.state] = (acc[g.address.state] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nWrote ${gyms.length} gyms to data/gyms_all.json`);
for (const [state, count] of Object.entries(byState).sort()) {
  console.log(`  ${state}: ${count}`);
}
console.log(`\nNext step: npx tsx scripts/importGyms.ts data/gyms_all.json\n`);
