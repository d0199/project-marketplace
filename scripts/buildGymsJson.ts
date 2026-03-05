/**
 * scripts/buildGymsJson.ts
 * Converts data/gyms_wa.csv → data/gyms.json
 *
 * Run:  npx tsx scripts/buildGymsJson.ts
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// CSV parser (handles double-quoted fields containing commas)
// ---------------------------------------------------------------------------
function parseCSV(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const fields: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      fields.push(cur.trim());
      return fields;
    });
}

// ---------------------------------------------------------------------------
// Deterministic pick from an array using a string key
// ---------------------------------------------------------------------------
function pick<T>(arr: T[], key: string): T {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (((h << 5) + h) ^ key.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------
function extractStreet(address: string): string {
  // Take everything before the first comma, strip common noise prefixes
  let street = address.split(",")[0].trim();
  street = street.replace(/^(opp\s+[^,]+,\s*|Rear\/|Enter via [^,]+,\s*|Outside [^,]+,\s*)/i, "");
  return street.trim();
}

function extractPostcode(address: string): string {
  const m = address.match(/\b6\d{3}\b/);
  return m ? m[0] : "";
}

// ---------------------------------------------------------------------------
// Gym classification
// ---------------------------------------------------------------------------
type GymType =
  | "chain24"
  | "largechain"
  | "f45"
  | "crossfit"
  | "pilates"
  | "boxing"
  | "leisure"
  | "speedfit"
  | "womens"
  | "strength"
  | "boutique"
  | "default";

function classify(name: string): GymType {
  const n = name.toLowerCase();
  if (n.includes("speedfit")) return "speedfit";
  if (/crossfit|hyrox/.test(n)) return "crossfit";
  if (/pilates|yoga/.test(n)) return "pilates";
  if (/boxing|mma|martial|muay thai|rumble boxing|combat/.test(n)) return "boxing";
  if (/women|ladies|female|sista fitness/.test(n)) return "womens";
  if (/aquatic|leisure centre|recreation centre|leisureplex|pcyc|swan active|beatty park/.test(n)) return "leisure";
  if (/f45|fitstop|bft body/.test(n)) return "f45";
  if (/goodlife|world gym|genesis health|gold.s gym|fitness first|fitness cartel/.test(n)) return "largechain";
  if (/snap fitness|anytime fitness|plus fitness|jetts|revo fitness|sista fitness|zap fitness|club lime|24.7|247|pumpt/.test(n)) return "chain24";
  if (/strength|barbell|powerlifting|performance|conditioning|s&c/.test(n)) return "strength";
  if (/studio|pt|personal training/.test(n)) return "boutique";
  return "default";
}

// ---------------------------------------------------------------------------
// Amenity inference
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
    case "chain24":
      add("gym", "access247");
      break;
    case "largechain":
      add("gym", "classes", "pt");
      if (/goodlife|world gym/.test(n)) add("sauna");
      if (/goodlife/.test(n)) add("pool");
      add("parking");
      break;
    case "f45":
      add("classes", "pt");
      set.add("cardio");
      break;
    case "crossfit":
      add("gym", "classes");
      break;
    case "pilates":
      add("pilates", "pt");
      break;
    case "boxing":
      add("boxing", "gym");
      break;
    case "leisure":
      add("pool", "gym", "classes", "childcare", "parking", "cafe");
      break;
    case "speedfit":
      add("pt");
      break;
    case "womens":
      add("gym", "classes", "pt");
      break;
    case "strength":
      add("gym", "pt");
      break;
    case "boutique":
      add("gym", "pt");
      break;
    default:
      add("gym");
  }

  // Extra passes on the name
  if (/24.7|247|anytime/.test(n) && !set.has("24/7 access")) set.add("24/7 access");
  if (/pool|aquatic|swim/.test(n)) add("pool");
  if (/sauna/.test(n)) add("sauna");
  if (/café|cafe|coffee/.test(n)) add("cafe");
  if (/park/.test(n)) add("parking");

  return [...set];
}

// ---------------------------------------------------------------------------
// Price inference (per week, AUD)
// ---------------------------------------------------------------------------
function inferPrice(type: GymType, id: string): number {
  const pools: Record<GymType, number[]> = {
    chain24:   [10, 12, 14, 15, 16, 18],
    largechain:[25, 28, 30, 32, 35],
    f45:       [40, 45, 48, 50, 55],
    crossfit:  [38, 40, 42, 45],
    pilates:   [28, 30, 35, 38, 40],
    boxing:    [28, 30, 32, 35, 38],
    leisure:   [12, 14, 15, 18, 20],
    speedfit:  [55, 60, 65, 70],
    womens:    [15, 18, 20, 22, 25],
    strength:  [35, 38, 40, 42, 45],
    boutique:  [35, 38, 40, 45, 50],
    default:   [18, 20, 22, 25, 28, 30],
  };
  return pick(pools[type], id);
}

// ---------------------------------------------------------------------------
// Description generation
// ---------------------------------------------------------------------------
const DESCRIPTIONS: Record<GymType, Array<(name: string, suburb: string) => string>> = {
  chain24: [
    (_, s) => `A conveniently located 24/7 gym in ${s} offering round-the-clock access to quality cardio machines, strength equipment, and free weights. Perfect for busy schedules, with no lock-in contracts and fully equipped change rooms.`,
    (_, s) => `Your local ${s} fitness destination is open every hour of every day, so you can train on your own terms. Expect a well-maintained floor of cardio equipment, pin-loaded machines, and a free weights area — everything you need, without the extras you don't.`,
    (_, s) => `Compact and efficient, this ${s} facility gives members access to a full suite of gym equipment any time, day or night. Swipe-card entry, clean facilities, and straightforward month-to-month memberships make it easy to get started.`,
    (_, s) => `No frills, no fuss — just solid equipment available whenever you want it. This 24/7 gym packs cardio, machine weights, and a free weights section into a clean, well-lit space in ${s}.`,
    (_, s) => `Open around the clock with secure key-fob entry, this ${s} gym caters to early risers, shift workers, and night owls alike. A reliable roster of treadmills, bikes, cables, and dumbbells keeps your training consistent.`,
    (_, s) => `Whether you're squeezing in a pre-dawn session or a midnight run, this ${s} facility has you covered. Members enjoy modern cardio and strength equipment, clean amenities, and flexible no lock-in memberships.`,
    (n, _) => `${n} makes fitness effortless with 24-hour access, no peak-hour wait times, and a straightforward equipment layout that covers everything from cardio to compound lifts. Show up, train, repeat.`,
  ],
  largechain: [
    (_, s) => `A full-service health club in ${s} offering a comprehensive range of fitness options under one roof. From an extensive free weights area and machine circuit to studio classes and expert personal trainers, everything is here for members at every fitness level.`,
    (_, s) => `One of ${s}'s premier fitness destinations, this club features a large gym floor loaded with cardio and strength equipment, a group fitness studio running daily classes, and a team of personal trainers ready to help you reach your goals.`,
    (_, s) => `This well-established health club in ${s} combines a spacious gym floor with a diverse group fitness timetable, making it popular with everyone from casual gym-goers to serious athletes. Facilities include an extensive free weights area and modern amenities.`,
    (n, s) => `${n} in ${s} is a flagship fitness facility with a large floor plan covering cardio machines, selectorised and free weights, a dedicated functional training zone, and a busy group fitness studio. Memberships include access to the full range of classes.`,
    (_, s) => `Known for its extensive equipment range and diverse class schedule, this ${s} health club is a popular choice for members of all fitness backgrounds. Professional staff are on hand during peak hours to assist and motivate.`,
    (_, s) => `A comprehensive health club experience in ${s}, offering everything from beginners' classes to advanced strength training. The large floor plan, varied class timetable, and experienced coaching team make this a versatile training destination.`,
  ],
  f45: [
    (n, _) => `${n} delivers team training that pushes you further than you'd go alone. Each 45-minute session combines functional movements and HIIT principles, with coaches guiding you through a different workout every day — no two sessions are the same.`,
    (_, s) => `Built around the power of the group, this ${s} studio delivers coached HIIT and functional training sessions designed to maximise results in minimal time. Rotating workouts and motivating coaches keep every visit fresh and effective.`,
    (_, s) => `This ${s} studio runs structured group training sessions that blend cardio, strength, and functional movements. With coaches on the floor and workouts programmed daily, all you have to do is show up and put in the work.`,
    (_, s) => `Small-group training at its finest in ${s}. Sessions are carefully programmed to deliver full-body conditioning, alternating between cardio and resistance work for a comprehensive workout in under an hour. New members always welcome.`,
    (_, s) => `A performance-focused training studio in ${s} where group energy drives individual results. Expert coaches guide members through varied functional training sessions designed to improve endurance, build strength, and elevate overall fitness.`,
    (n, _) => `${n}'s science-backed programming pairs strength and cardio elements in sessions designed to work every muscle group across the week. Coaches are present for every session, providing cues, corrections, and the encouragement to push harder.`,
  ],
  crossfit: [
    (n, _) => `${n} is a CrossFit affiliate built around constantly varied, high-intensity functional movements. Daily WODs are coached by certified trainers, with a box environment where community is as important as the training itself.`,
    (_, s) => `This ${s} CrossFit box brings a community-first approach to fitness, with coaches who adapt workouts to suit everyone from beginners to competitive athletes. Daily programmed WODs blend weightlifting, gymnastics, and metabolic conditioning.`,
    (_, s) => `Train hard, train together. This ${s} affiliate runs a structured CrossFit program with an emphasis on movement quality and progressive overload. Fully equipped with barbells, pull-up rigs, kettlebells, rowers, and assault bikes.`,
    (n, _) => `Certified CrossFit coaching, quality programming, and a genuinely supportive community make ${n} a standout choice for athletes at every stage. Introductory foundations courses are available for those new to the methodology.`,
    (_, s) => `More than a gym — a training community in ${s}. This CrossFit box runs daily WODs, Olympic weightlifting sessions, and open gym times in a purpose-built space stocked with everything a serious athlete needs.`,
  ],
  pilates: [
    (n, _) => `${n} is a dedicated pilates and movement studio offering reformer and mat-based classes for all experience levels. Small class sizes ensure personalised attention, making this ideal for rehabilitation, injury prevention, and core strength.`,
    (_, s) => `Specialising in reformer pilates with a focus on precision, control, and body awareness, this ${s} studio offers classes from beginner to advanced. Experienced instructors guide you through exercises designed to improve posture, strength, and flexibility.`,
    (_, s) => `This boutique movement studio in ${s} brings a mindful approach to fitness, combining pilates principles with contemporary movement science. Whether you're recovering from injury or improving athletic performance, experienced instructors have you covered.`,
    (_, s) => `A calm and focused environment in ${s} where pilates and yoga classes help members build strength from the inside out. Fully equipped reformer rooms and experienced practitioners make this a go-to destination for mindful movement.`,
    (_, s) => `The philosophy here is simple: move well, move often. Offering reformer pilates, yoga, and mobility sessions in ${s}, this studio prioritises technique and body awareness. Classes are kept small to maximise coaching quality.`,
    (n, s) => `${n} in ${s} delivers small-group reformer and mat pilates with an emphasis on individualised instruction. Whether you're managing a specific condition or simply want to move better, every class is adapted to the needs of the group.`,
  ],
  boxing: [
    (n, _) => `${n} is a dedicated combat sports and fitness facility covering boxing, Muay Thai, and general conditioning. Suitable for competitive fighters and complete beginners alike, with experienced coaches running structured classes throughout the week.`,
    (_, s) => `Hit the bags, learn technique, and get in the best shape of your life at this ${s} gym. Specialising in boxing and martial arts training, classes cater to all ages and experience levels in a professionally run environment.`,
    (_, s) => `Whether you're training for competition or using martial arts as a fitness pathway, this ${s} facility delivers expert coaching in striking and conditioning. Well-equipped with bags, rings, and matted areas, plus a full weights section.`,
    (_, s) => `A boxing gym at heart with a genuine fitness community built around the sweet science in ${s}. Members train alongside serious amateurs and fitness enthusiasts in a motivating, no-nonsense environment led by experienced coaches.`,
    (n, _) => `${n} offers structured classes in boxing, MMA, and kickboxing alongside a functional strength and conditioning program. Members enjoy the unique combination of skill development and high-intensity training that only combat sports can deliver.`,
  ],
  leisure: [
    (n, s) => `${n} is a comprehensive community leisure facility in ${s} offering gym access, group fitness classes, and aquatic facilities. Catering for all ages and abilities, it's a one-stop destination for the whole family.`,
    (_, s) => `This council-operated recreation centre in ${s} provides affordable access to gym equipment, group fitness classes, aquatic facilities, and court sports. A genuine community hub where fitness is accessible to everyone.`,
    (_, s) => `With a fully equipped gymnasium, group exercise studio, aquatic centre, and community spaces, this ${s} leisure complex is one of the most comprehensive fitness facilities in the region. Programs run for toddlers through to seniors.`,
    (_, s) => `An affordable and family-friendly facility in ${s} offering swimming, gym access, fitness classes, and sports programs in one location. Memberships are competitively priced and designed to suit every budget.`,
    (_, s) => `Local government-operated and community-focused, this ${s} leisure centre provides high-quality fitness facilities at accessible price points. The gym floor, group fitness schedule, and aquatic areas make it a versatile training destination for residents of all ages.`,
  ],
  speedfit: [
    (n, s) => `${n} in ${s} uses EMS (electro-muscle stimulation) technology to activate up to 90% of muscle fibres simultaneously during a 20-minute session — delivering results equivalent to hours of conventional training. Sessions are always coach-guided.`,
    (n, _) => `${n} harnesses bio-electric impulses to supercharge muscle activation during short, intensely effective sessions. Supervised one-on-one training ensures correct technique and maximum results, making it ideal for time-poor professionals and rehabilitation clients.`,
    (n, s) => `Achieving a complete full-body workout in just 20 minutes — that's the science behind ${n}'s EMS technology in ${s}. Suitable for injury rehab, performance training, or those with tight schedules, every session is individually supervised.`,
  ],
  womens: [
    (n, s) => `${n} in ${s} is a welcoming women-only gym providing a comfortable, judgement-free space to train. Equipment ranges from cardio machines to free weights, with a supportive community and knowledgeable staff who understand women's fitness goals.`,
    (_, s) => `Designed by women, for women — this ${s} gym offers a private and empowering environment to work towards your goals. From cardio and resistance training to group classes, the focus is always on making fitness enjoyable and achievable.`,
    (_, s) => `A safe, supportive, and fully equipped fitness space exclusively for women in ${s}. Classes, personal training, and open gym sessions are available, with a team of female trainers who understand the unique challenges and goals of women's fitness.`,
    (_, s) => `This women's fitness centre in ${s} creates a comfortable environment where members of all fitness levels can train with confidence. A well-equipped floor, friendly staff, and a genuinely supportive community make it a standout option locally.`,
  ],
  strength: [
    (n, _) => `${n} is a serious training space for lifters who demand quality equipment and minimal distraction. Stocked with competition barbells, racks, platforms, and an extensive selection of plates and dumbbells — everything a committed lifter needs.`,
    (_, s) => `Where performance meets purpose in ${s}. This facility combines strength training fundamentals with modern conditioning methods, working with members individually to build capacity, resilience, and athletic performance.`,
    (_, s) => `A focused, coach-led gym environment in ${s} dedicated to building real strength and athletic performance. Members work with experienced coaches on structured programming that emphasises progressive overload, technique, and long-term development.`,
    (_, s) => `This ${s} performance centre offers a professional training environment with premium equipment and expert coaching. Programs are tailored to individual goals, with a strong emphasis on technique, progressive loading, and sustainable results.`,
    (n, _) => `Quality equipment, expert programming, and a community of dedicated athletes define ${n}. Whether you're chasing a powerlifting total, building muscle, or improving general athleticism, the coaches here have the knowledge to guide you there.`,
  ],
  boutique: [
    (n, s) => `${n} in ${s} is a coach-led boutique studio where sessions are designed around individual goals rather than generic programming. Small class sizes and an expert team create a training experience that genuinely moves the needle.`,
    (_, s) => `A ${s} studio built around personalised coaching and real results. Whether it's one-on-one personal training, small group sessions, or semi-private programming, every member gets the attention they need to make consistent progress.`,
    (n, _) => `${n} strips away the noise and focuses on what matters: good coaching, sound programming, and a supportive training environment. Members benefit from expert guidance delivered in an atmosphere that's professional without being intimidating.`,
    (_, s) => `This ${s} boutique facility delivers a premium training experience in a small, focused setting. Expert coaches, evidence-based programming, and a genuine investment in member outcomes set this studio apart from the standard gym.`,
  ],
  default: [
    (n, s) => `${n} in ${s} is a well-equipped, independently operated gym delivering quality training in a friendly environment. Whether you prefer structured classes, personal training, or independent sessions, you'll find a welcoming community and the tools to reach your goals.`,
    (_, s) => `A local gem in ${s}, offering a fully equipped gym floor, experienced trainers, and a genuine commitment to member results. The atmosphere is motivating without being intimidating — ideal for members at every fitness level.`,
    (_, s) => `This independently run fitness facility in ${s} prides itself on quality coaching and a genuine community feel. Members have access to a well-stocked gym floor and a team of passionate trainers who go beyond the standard script to help people succeed.`,
    (n, s) => `Built by fitness enthusiasts for fitness enthusiasts, ${n} in ${s} offers a well-curated equipment range and a knowledgeable coaching team. Memberships are flexible and the community is welcoming — come as you are, leave fitter.`,
    (_, s) => `More personal than a big-box gym, more equipped than a micro-studio. This ${s} facility strikes the right balance, offering a quality training environment with staff who actually know your name.`,
    (_, s) => `A home for ${s} fitness enthusiasts who want more than a machine circuit and a TV screen. Solid equipment, engaged coaching, and a genuine sense of community keep members coming back week after week.`,
    (n, _) => `${n} creates an environment where every member can thrive. A comprehensive equipment range, flexible membership options, and enthusiastic staff combine to form a fitness community that's genuinely invested in your success.`,
    (_, s) => `An independently owned gym in ${s} that takes pride in a welcoming, results-focused atmosphere. Members enjoy a well-maintained floor of cardio and strength equipment alongside access to knowledgeable, approachable trainers.`,
  ],
};

function generateDescription(type: GymType, name: string, suburb: string, id: string): string {
  return pick(DESCRIPTIONS[type], id)(name, suburb);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const CSV_PATH = path.join(__dirname, "../data/gyms_wa.csv");
const OUT_PATH = path.join(__dirname, "../data/gyms.json");

const raw = fs.readFileSync(CSV_PATH, "utf-8");
const rows = parseCSV(raw);
const [header, ...dataRows] = rows;

const colIndex = Object.fromEntries(header.map((h, i) => [h, i]));

const gyms = dataRows.map((row, i) => {
  const id = `gym-${String(i + 1).padStart(3, "0")}`;
  const googlePlaceId = row[colIndex.id] ?? "";
  const name = row[colIndex.name] ?? "";
  const address = row[colIndex.address] ?? "";
  const suburb = row[colIndex.suburb] ?? "";
  const lat = parseFloat(row[colIndex.lat]) || 0;
  const lng = parseFloat(row[colIndex.lng]) || 0;
  const phone = row[colIndex.phone] ?? "";
  const website = row[colIndex.website] ?? "";

  const postcode = extractPostcode(address);
  const street = extractStreet(address);

  const type = classify(name);
  const description = generateDescription(type, name, suburb, id);
  const amenities = inferAmenities(type, name);
  const pricePerWeek = inferPrice(type, id);

  return {
    id,
    googlePlaceId,
    ownerId: "owner-3",
    name,
    description,
    address: {
      street,
      suburb,
      state: "WA",
      postcode,
    },
    phone,
    email: "",
    website,
    lat,
    lng,
    amenities,
    hours: {},
    pricePerWeek,
    images: [],
  };
});

fs.writeFileSync(OUT_PATH, JSON.stringify(gyms, null, 2));
console.log(`Wrote ${gyms.length} gyms to ${OUT_PATH}`);
