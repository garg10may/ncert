import type { NcertCatalogBook, NcertTheme, NcertThemeSlug } from "@/lib/ncert/types";

const NCERT_BASE_URL = "https://ncert.nic.in";

const CLASS_LABELS: Record<number, string> = {
  1: "Class I",
  2: "Class II",
  3: "Class III",
  4: "Class IV",
  5: "Class V",
  6: "Class VI",
  7: "Class VII",
  8: "Class VIII",
  9: "Class IX",
  10: "Class X",
  11: "Class XI",
  12: "Class XII",
};

const RAW_CATALOG = [
  [1, "English", "Mridang", "aemr1=0-9"],
  [1, "Mathematics", "Joyful-Mathematics (English)", "aejm1=0-13"],
  [2, "Mathematics", "Joyful-Mathematics (English)", "bejm1=0-11"],
  [2, "English", "Mridang", "bemr1=0-13"],
  [3, "Mathematics", "Maths Mela", "cemm1=0-14"],
  [3, "English", "Santoor", "cesa1=0-12"],
  [3, "The World Around Us", "Our Wondrous World", "ceev1=0-12"],
  [3, "Arts", "Bansuri - I", "cebu1=0-20"],
  [3, "Physical Education and Well Being", "Khel Yoga", "ceky1=0-7"],
  [4, "Mathematics", "Math-Mela", "demm1=0-14"],
  [4, "English", "Santoor", "desa1=0-12"],
  [4, "The World Around Us", "Our Wonderous World", "deev1=0-10"],
  [4, "Arts", "Bansuri", "debu1=0-18"],
  [4, "Physical Education and Well Being", "Khel Yoga", "deky1=0-3"],
  [5, "Mathematics", "Math-Mela", "eemm1=0-15"],
  [5, "English", "Santoor", "eesa1=0-10"],
  [5, "The World Around Us", "Our Wonderous World", "eeev1=0-10"],
  [5, "Arts", "Bansuri", "eebu1=0-19"],
  [5, "Physical Education and Well Being", "Khel Yoga", "eeky1=0-3"],
  [6, "English", "Poorvi", "fepr1=0-5"],
  [6, "Mathematics", "Ganita Prakash", "fegp1=0-10"],
  [6, "Social Science", "Exploring Society India and Beyond", "fees1=0-14"],
  [6, "Science", "Curiosity", "fecu1=0-12"],
  [6, "Arts", "Kriti-I", "fekr1=0-22"],
  [6, "Physical Education and Well Being", "Khel Yatra", "feky1=0-5"],
  [6, "Vocational Education", "Kaushal Bodh", "fekb1=0-6"],
  [7, "English", "Poorvi", "gepr1=0-5"],
  [7, "Mathematics", "Ganita Prakash", "gegp1=0-8"],
  [7, "Mathematics", "Ganita Prakash-II", "gegp2=0-7"],
  [7, "Social Science", "Exploring Society India and Beyond Part-I", "gees1=0-12"],
  [7, "Social Science", "Exploring Society India and Beyond Part-II", "gees2=0-8"],
  [7, "Science", "Curiosity", "gecu1=0-12"],
  [7, "Arts", "Kriti", "gekr1=0-20"],
  [7, "Physical Education and Well Being", "Khel Yatra", "geky1=0-6"],
  [7, "Vocational Education", "Kaushal Bodh", "gekb1=0-7"],
  [8, "English", "Poorvi", "hepr1=0-5"],
  [8, "Mathematics", "Ganita Prakash Part-I", "hegp1=0-7"],
  [8, "Mathematics", "Ganita Prakash Part-II", "hegp2=0-7"],
  [8, "Social Science", "Exploring Society India and Beyond Part-I", "hees1=0-7"],
  [8, "Science", "Curiosity", "hecu1=0-13"],
  [8, "Arts", "Kriti", "hekr1=0-19"],
  [8, "Physical Education and Well Being", "Khel Yatra", "heky1=0-6"],
  [8, "Vocational Education", "Kaushal Bodh", "hekb1=0-8"],
  [9, "English", "Beehive", "iebe1=0-9"],
  [9, "English", "Moments Supplementary Reader", "iemo1=0-9"],
  [9, "English", "Words and Expressions 1", "iewe1=0-9"],
  [9, "Mathematics", "Mathematics", "iemh1=0-12"],
  [9, "Science", "Science", "iesc1=0-12"],
  [9, "Social Science", "Democratic Politics-I", "iess4=0-5"],
  [9, "Social Science", "Contemporary India-I", "iess1=0-6"],
  [9, "Social Science", "Economics", "iess2=0-4"],
  [9, "Social Science", "India and the Contemporary World-I", "iess3=0-5"],
  [9, "Health and Physical Education", "Health and Physical Education", "iehp1=0-14"],
  [10, "Mathematics", "Mathematics", "jemh1=0-14"],
  [10, "Science", "Science", "jesc1=0-13"],
  [10, "Social Science", "Contemporary India", "jess1=0-7"],
  [10, "Social Science", "Understanding Economic Development", "jess2=0-5"],
  [10, "Social Science", "India and the Contemporary World-II", "jess3=0-5"],
  [10, "Social Science", "Democratic Politics", "jess4=0-5"],
  [10, "English", "First Flight", "jeff1=0-9"],
  [10, "English", "Foot Prints Without feet Supp. Reader", "jefp1=0-9"],
  [10, "English", "Words and Expressions 2", "jewe2=0-9"],
  [10, "Health and Physical Education", "Health and Physical Education", "jehp1=0-13"],
  [11, "Accountancy", "Financial Accounting-I", "keac1=0-7"],
  [11, "Accountancy", "Accountancy-II", "keac2=0-2"],
  [11, "Chemistry", "Chemistry Part-I", "kech1=0-6"],
  [11, "Chemistry", "Chemistry Part II", "kech2=0-3"],
  [11, "Mathematics", "Mathematics", "kemh1=0-14"],
  [11, "Biology", "Biology", "kebo1=0-19"],
  [11, "Psychology", "Introduction to Psychology", "kepy1=0-8"],
  [11, "Geography", "Fundamental of Physical Geography", "kegy2=0-14"],
  [11, "Geography", "Pratical Work in Geography", "kegy3=0-6"],
  [11, "Geography", "India Physical Environment", "kegy1=0-6"],
  [11, "Physics", "Physics Part-I", "keph1=0-7"],
  [11, "Physics", "Physics Part-II", "keph2=0-7"],
  [11, "Sociology", "Introducing Sociology", "kesy1=0-5"],
  [11, "Sociology", "Understanding Society", "kesy2=0-5"],
  [11, "English", "Woven Words", "keww1=0-27"],
  [11, "English", "Hornbill", "kehb1=0-14"],
  [11, "English", "Snapshots Suppl.Reader English", "kesp1=0-5"],
  [11, "Political Science", "Political Theory", "keps1=0-8"],
  [11, "Political Science", "India Constitution at Work", "keps2=0-10"],
  [11, "History", "Themes in World History", "kehs1=0-7"],
  [11, "Economics", "Indian Economic Development", "keec1=0-8"],
  [11, "Economics", "Statistics for Economics", "kest1=0-8"],
  [11, "Business Studies", "Business Studies", "kebs1=0-11"],
  [11, "Home Science", "Human Ecology and Family Sciences Part I", "kehe1=0-7"],
  [11, "Home Science", "Human Ecology and Family Sciences Part II", "kehe2=0-4"],
  [11, "Fine Art", "An Introduction to Indian Art Part-I", "kefa1=0-8"],
  [11, "Informatics Practices", "Informatics Practices", "keip1=0-8"],
  [11, "Computer Science", "Computer Science", "kecs1=0-11"],
  [11, "Health and Physical Education", "Health and Physical Education", "kehp1=0-11"],
  [11, "Biotechnology", "Biotechnology", "kebt1=0-12"],
  [11, "Knowledge Traditions Practices of India", "Knowledge Traditions Practices of India", "keks1=0-9"],
  [12, "Mathematics", "Mathematics Part-I", "lemh1=0-6"],
  [12, "Mathematics", "Mathematics Part-II", "lemh2=0-7"],
  [12, "Physics", "Physics Part-I", "leph1=0-8"],
  [12, "Physics", "Physics Part-II", "leph2=0-6"],
  [12, "Accountancy", "Accountancy-I", "leac1=0-4"],
  [12, "Accountancy", "Accountancy Part-II", "leac2=0-6"],
  [12, "Accountancy", "Computerised Accounting System", "leca1=0-4"],
  [12, "English", "Kaliedoscope", "lekl1=0-21"],
  [12, "English", "Flamingo", "lefl1=0-13"],
  [12, "English", "Vistas", "levt1=0-6"],
  [12, "Biology", "Biology", "lebo1=0-13"],
  [12, "History", "Themes in Indian History-I", "lehs1=0-4"],
  [12, "History", "Themes in Indian History-II", "lehs2=0-4"],
  [12, "History", "Themes in Indian History-III", "lehs3=0-4"],
  [12, "Geography", "Fundamentals of Human Geography", "legy1=0-8"],
  [12, "Geography", "Practical Work in Geography Part II", "legy3=0-4"],
  [12, "Geography", "India -People And Economy", "legy2=0-9"],
  [12, "Psychology", "Psychology", "lepy1=0-7"],
  [12, "Sociology", "Indian Society", "lesy1=0-7"],
  [12, "Sociology", "Social Change and Development in India", "lesy2=0-8"],
  [12, "Chemistry", "Chemistry-I", "lech1=0-5"],
  [12, "Chemistry", "Chemistry-II", "lech2=0-5"],
  [12, "Political Science", "Contemporary World Politics", "leps1=0-7"],
  [12, "Political Science", "Politics in India Since Independence", "leps2=0-8"],
  [12, "Economics", "Introductory Microeconomics", "leec2=0-5"],
  [12, "Economics", "Introductory Macroeconomics", "leec1=0-6"],
  [12, "Business Studies", "Business Studies-I", "lebs1=0-8"],
  [12, "Business Studies", "Business Studies-II", "lebs2=0-3"],
  [12, "Home Science", "Human Ecology and Family Sciences Part I", "lehe1=0-7"],
  [12, "Home Science", "Human Ecology and Family Sciences Part II", "lehe2=0-7"],
  [12, "Home Science", "Manav Paristhitik avam Parivar Vigyan Bhag 1", "lehh1=0-7"],
  [12, "Home Science", "Manav Paristhitiki avam Parivar Vigyan Bhag 2", "lehh2=0-7"],
  [12, "Fine Art", "An Introduction to Indian Art Part-II", "lefa1=0-8"],
  [12, "Computer Science", "Computer Science", "lecs1=0-13"],
  [12, "Informatics Practices", "Informatics Practices", "leip1=0-7"],
  [12, "Biotechnology", "Biotechnology", "lebt1=0-13"],
] as const;

export const NCERT_THEMES: readonly NcertTheme[] = [
  { slug: "language", label: "Language", accent: "bg-sky-100 text-sky-900" },
  { slug: "mathematics", label: "Mathematics", accent: "bg-emerald-100 text-emerald-900" },
  { slug: "science", label: "Science", accent: "bg-teal-100 text-teal-900" },
  { slug: "geography", label: "Geography", accent: "bg-lime-100 text-lime-900" },
  { slug: "history", label: "History", accent: "bg-amber-100 text-amber-900" },
  { slug: "politics", label: "Politics", accent: "bg-rose-100 text-rose-900" },
  { slug: "economics", label: "Economics", accent: "bg-orange-100 text-orange-900" },
  { slug: "arts", label: "Arts", accent: "bg-fuchsia-100 text-fuchsia-900" },
  { slug: "technology", label: "Technology", accent: "bg-cyan-100 text-cyan-900" },
  { slug: "health", label: "Health", accent: "bg-red-100 text-red-900" },
  { slug: "commerce", label: "Commerce", accent: "bg-violet-100 text-violet-900" },
  { slug: "social-science", label: "Social Science", accent: "bg-yellow-100 text-yellow-900" },
  { slug: "vocational", label: "Vocational", accent: "bg-stone-200 text-stone-900" },
] as const;

const THEME_OVERRIDES: Record<string, NcertThemeSlug[]> = {
  fees1: ["social-science", "geography"],
  gees1: ["social-science", "geography"],
  gees2: ["social-science", "history"],
  hees1: ["social-science", "geography"],
  iess1: ["social-science", "geography"],
  iess2: ["social-science", "economics"],
  iess3: ["social-science", "history"],
  iess4: ["social-science", "politics"],
  jess1: ["social-science", "geography"],
  jess2: ["social-science", "economics"],
  jess3: ["social-science", "history"],
  jess4: ["social-science", "politics"],
  kegy1: ["geography", "social-science"],
  kegy2: ["geography", "social-science"],
  kegy3: ["geography", "social-science"],
  legy1: ["geography", "social-science"],
  legy2: ["geography", "social-science"],
  legy3: ["geography", "social-science"],
};

const CANONICAL_SUBJECT_OVERRIDES: Record<string, string> = {
  "Health and Physical Education": "Health and Physical Education",
  "Physical Education and Well Being": "Health and Physical Education",
  "The World Around Us": "Environmental Studies",
  "Vocational Education": "Vocational Education",
};

function classifyThemes(routeKey: string, subject: string, title: string): NcertThemeSlug[] {
  const overrideThemes = THEME_OVERRIDES[routeKey];
  if (overrideThemes) {
    return [...overrideThemes];
  }

  const haystack = `${subject} ${title}`.toLowerCase();
  const themes = new Set<NcertThemeSlug>();

  if (
    /english|hindi|urdu|sanskrit|language|reader|woven words|hornbill|snapshots|flamingo|vistas|kaliedoscope|poorvi|santoor|mridang/.test(
      haystack,
    )
  ) {
    themes.add("language");
  }

  if (/math|mathematics|ganita/.test(haystack)) {
    themes.add("mathematics");
  }

  if (
    /science|physics|chemistry|biology|biotechnology|curiosity/.test(haystack)
  ) {
    themes.add("science");
  }

  if (
    /geography|geograph|bhugol|india physical environment|contemporary india|people and economy|wondrous world|wonderous world|exploring society/.test(
      haystack,
    )
  ) {
    themes.add("geography");
  }

  if (/history|contemporary world|themes in world history|themes in indian history/.test(haystack)) {
    themes.add("history");
  }

  if (/political|politics|constitution|democratic politics/.test(haystack)) {
    themes.add("politics");
  }

  if (/economics|economic|development|statistics/.test(haystack)) {
    themes.add("economics");
  }

  if (/arts|art|kriti|bansuri|fine art|sangeet/.test(haystack)) {
    themes.add("arts");
  }

  if (/computer science|informatics|ict|technology/.test(haystack)) {
    themes.add("technology");
  }

  if (/health|physical education|khel/.test(haystack)) {
    themes.add("health");
  }

  if (/accountancy|business studies|commerce/.test(haystack)) {
    themes.add("commerce");
  }

  if (
    /social science|history|geography|political science|economics|sociology/.test(
      haystack,
    )
  ) {
    themes.add("social-science");
  }

  if (/vocational|kaushal/.test(haystack)) {
    themes.add("vocational");
  }

  if (themes.size === 0) {
    themes.add("language");
  }

  return [...themes];
}

function getCanonicalSubject(subject: string): string {
  return CANONICAL_SUBJECT_OVERRIDES[subject] ?? subject;
}

function buildBook(classValue: number, subject: string, title: string, routeQuery: string): NcertCatalogBook {
  const routeKey = routeQuery.split("=")[0];
  const canonicalSubject = getCanonicalSubject(subject);
  const themes = classifyThemes(routeKey, subject, title);

  return {
    id: routeKey,
    classLabel: CLASS_LABELS[classValue],
    classValue,
    language: "english",
    medium: "english",
    subject,
    canonicalSubject,
    title,
    routeKey,
    routeQuery,
    route: `${NCERT_BASE_URL}/textbook.php?${routeQuery}`,
    themes,
    batchKeys: [
      `class:${classValue}`,
      `subject:${canonicalSubject.toLowerCase()}`,
      ...themes.map((theme) => `theme:${theme}`),
    ],
    downloadReady: true,
    searchText: `${CLASS_LABELS[classValue]} ${subject} ${canonicalSubject} ${title} ${themes.join(" ")}`.toLowerCase(),
  };
}

export const NCERT_CATALOG = RAW_CATALOG.map(([classValue, subject, title, routeQuery]) =>
  buildBook(classValue, subject, title, routeQuery),
).sort((left, right) => {
  if (left.classValue !== right.classValue) {
    return left.classValue - right.classValue;
  }

  return left.subject.localeCompare(right.subject) || left.title.localeCompare(right.title);
});

export const NCERT_CLASS_OPTIONS = Object.entries(CLASS_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}));

export const NCERT_SUBJECT_OPTIONS = [...new Set(NCERT_CATALOG.map((book) => book.subject))];

export function getNcertCatalogBook(bookId: string): NcertCatalogBook | undefined {
  return NCERT_CATALOG.find((book) => book.id === bookId);
}

export function getNcertTheme(slug: NcertThemeSlug): NcertTheme | undefined {
  return NCERT_THEMES.find((theme) => theme.slug === slug);
}
