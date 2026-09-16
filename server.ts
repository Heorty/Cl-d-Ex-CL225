import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();

app.use(express.json());

// Serve static photos uploaded by users (supports both /photos and /photo routes and subdirectories)
const PUBLIC_DIR = path.join(process.cwd(), "public");
const PHOTOS_DIR = path.join(PUBLIC_DIR, "photos");
const PHOTO_DIR = path.join(PUBLIC_DIR, "photo");

const DATA_DIR = path.join(process.cwd(), "data");
const RESPONSES_DIR = path.join(DATA_DIR, "responses");
const CONFIG_FILE = path.join(process.cwd(), "config", "survey-config.json");

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RESPONSES_DIR)) {
  fs.mkdirSync(RESPONSES_DIR, { recursive: true });
}
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Valid photo extensions (strictly image files, case-insensitive)
const VALID_PHOTO_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".svg",
  ".bmp",
  ".tiff",
  ".tif",
  ".heic",
  ".heif",
]);

// Helper to fix mojibake and normalize text with French accents
function cleanFrenchText(str: string): string {
  let cleaned = str;
  try {
    const fixed = Buffer.from(cleaned, "latin1").toString("utf8");
    if (fixed && !fixed.includes("\ufffd")) {
      cleaned = fixed;
    }
  } catch (e) {}

  return cleaned
    .replace(/ClÃ©s/gi, "Clés")
    .replace(/ClÃ©/gi, "Clé")
    .replace(/exposÃ©es/gi, "exposées")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã /g, "à")
    .replace(/Ã¹/g, "ù")
    .replace(/Ã®/g, "î")
    .replace(/Ã´/g, "ô")
    .replace(/d_Ex/gi, "d'Ex")
    .replace(/d_autres/gi, "d'autres")
    .replace(/Clun_s/gi, "Cluny")
    .replace(/Siber_s/gi, "Siber's")
    .replace(/Chalon_s/gi, "Châlons");
}

// Helper to strip diacritics and non-alphanumeric chars for bulletproof photo matching
function stripPunctuationAndAccents(str: string): string {
  let s = str;
  while (s.includes("%")) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Global lookup maps for zero-latency, 100% resilient photo resolution
const photoLookupMap = new Map<string, string>();
const photoIdMap = new Map<string, string>();

function rebuildPhotoLookupMap() {
  photoLookupMap.clear();
  photoIdMap.clear();

  const candidateBases = [PHOTOS_DIR, PHOTO_DIR];
  for (const base of candidateBases) {
    if (!fs.existsSync(base)) continue;
    try {
      const files = fs.readdirSync(base);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (!VALID_PHOTO_EXTENSIONS.has(ext)) continue;

        const fullPath = path.join(base, f);
        const cleanId = "photo_" + f.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

        photoIdMap.set(cleanId, fullPath);

        const keys = [
          f,
          f.toLowerCase(),
          f.normalize("NFC"),
          f.normalize("NFC").toLowerCase(),
          f.normalize("NFD"),
          f.normalize("NFD").toLowerCase(),
          encodeURIComponent(f),
          encodeURIComponent(f).toLowerCase(),
          encodeURIComponent(f.normalize("NFD")),
          encodeURIComponent(f.normalize("NFD")).toLowerCase(),
          cleanFrenchText(f),
          cleanFrenchText(f).toLowerCase(),
          cleanId,
          stripPunctuationAndAccents(f),
        ];

        // Also index promo slug (e.g. "cl098", "cl112-113-114-116", "cl180")
        const slugMatch = f.match(/cl\d+(?:-\d+)*/i);
        if (slugMatch) {
          keys.push(slugMatch[0].toLowerCase());
        }

        for (const k of keys) {
          if (k) photoLookupMap.set(k.toLowerCase(), fullPath);
        }
      }
    } catch (e) {
      console.error("Erreur indexation photos:", e);
    }
  }
}

// Initial index build
rebuildPhotoLookupMap();

// Robust, high-performance photo serving route with automatic Unicode NFD/NFC, slug and ID resolution
app.get(["/photos/*", "/photo/*", "/api/photo/:id"], (req, res) => {
  try {
    let rawKey = req.params.id || req.params[0] || req.path.replace(/^\/(?:photos|photo|api\/photo)\//, "");

    // Handle double or multiple URI encoding
    let decodedKey = rawKey;
    while (decodedKey.includes("%")) {
      try {
        const next = decodeURIComponent(decodedKey);
        if (next === decodedKey) break;
        decodedKey = next;
      } catch {
        break;
      }
    }

    let resolvedFile: string | null = null;

    // 1. Fast lookup from pre-indexed map
    const candidates = [
      rawKey.toLowerCase(),
      decodedKey.toLowerCase(),
      decodedKey.normalize("NFC").toLowerCase(),
      decodedKey.normalize("NFD").toLowerCase(),
      cleanFrenchText(decodedKey).toLowerCase(),
      stripPunctuationAndAccents(decodedKey),
    ];

    for (const c of candidates) {
      if (photoLookupMap.has(c)) {
        resolvedFile = photoLookupMap.get(c)!;
        break;
      }
      if (photoIdMap.has(c)) {
        resolvedFile = photoIdMap.get(c)!;
        break;
      }
    }

    // 2. Direct filesystem fallback check
    if (!resolvedFile) {
      const candidateBases = [PHOTOS_DIR, PHOTO_DIR];
      for (const base of candidateBases) {
        if (!fs.existsSync(base)) continue;

        const checkPaths = [
          path.join(base, decodedKey),
          path.join(base, rawKey),
          path.join(base, decodedKey.normalize("NFC")),
          path.join(base, decodedKey.normalize("NFD")),
        ];

        for (const cp of checkPaths) {
          if (fs.existsSync(cp) && fs.statSync(cp).isFile()) {
            resolvedFile = cp;
            break;
          }
        }
        if (resolvedFile) break;
      }
    }

    // 3. Fuzzy search by stripped alphanumeric token if still not found
    if (!resolvedFile) {
      const strippedTarget = stripPunctuationAndAccents(decodedKey);
      if (strippedTarget.length >= 3) {
        for (const [key, fullPath] of photoLookupMap.entries()) {
          if (stripPunctuationAndAccents(key) === strippedTarget) {
            resolvedFile = fullPath;
            break;
          }
        }
      }
    }

    if (resolvedFile && fs.existsSync(resolvedFile)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const ext = path.extname(resolvedFile).toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (ext === ".png") {
        res.setHeader("Content-Type", "image/png");
      } else if (ext === ".webp") {
        res.setHeader("Content-Type", "image/webp");
      }

      return res.sendFile(resolvedFile, {
        maxAge: 31536000000, // 1 year in milliseconds
        etag: true,
        lastModified: true,
        acceptRanges: true,
      });
    }

    // Explicitly return 404 for missing photos instead of falling through to HTML SPA
    return res.status(404).type("text/plain").send("Photo not found");
  } catch (err) {
    return res.status(500).type("text/plain").send("Error loading photo");
  }
});

// Function to parse the title of a key from its filename
// Handles Windows/Mac uploads with mojibake (e.g. "ClÃ©") and prefix formats ("120-IM_Clé cl111" or "120_IM_Clé cl98")
function parseKeyTitleFromFilename(filename: string): string {
  let cleaned = filename.replace(/\.[^/.]+$/, "");
  cleaned = cleanFrenchText(cleaned);

  // Match prefixes like "120-IM_Clé cl98", "129-IM_Clé Me212", or "120_IM_Clé cl98"
  const prefixMatch = cleaned.match(/^\d+[-_][A-Za-z0-9]+[-_](.+)$/);
  const rawTitle = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : cleaned.trim();

  // If rawTitle is "Clé cl098" or "cl098", format nicely: "Clé Cluny 98"
  const clMatch = rawTitle.match(/^(?:Clé\s+)?cl(\d{2,3}(?:-\d{2,3})*)$/i);
  if (clMatch) {
    const numPart = clMatch[1].replace(/^0+/, "");
    return `Clé Cluny ${numPart}`;
  }

  return rawTitle;
}

// Helper to deduce category and campus tags from the subfolder structure
function parseCategoryAndTags(subDir: string, filename: string): { category: string; tags: string[] } {
  const tags: string[] = [];
  let category = "Clé d'Ex";

  const cleanedSub = cleanFrenchText(subDir.replace(/_/g, " "));
  const lowerSub = cleanedSub.toLowerCase();
  const lowerFile = filename.toLowerCase();

  // Detect Gadz'Arts Campus / Centre
  if (
    lowerSub.includes("clun") ||
    lowerFile.includes("clun") ||
    lowerFile.includes("cl1") ||
    lowerFile.includes("cl2") ||
    lowerFile.includes("cl0")
  ) {
    category = "Cluny";
    tags.push("Cluny");
    if (lowerSub.includes("ex")) tags.push("Ex-Cluny");
  } else if (lowerSub.includes("birse") || lowerSub.includes("lille") || lowerFile.includes("li")) {
    category = "Birse (Lille)";
    tags.push("Lille", "Birse");
  } else if (lowerSub.includes("boquette") || lowerSub.includes("angers") || lowerFile.includes("an")) {
    category = "Boquette (Angers)";
    tags.push("Angers", "Boquette");
  } else if (lowerSub.includes("siber") || lowerSub.includes("aix") || lowerFile.includes("me")) {
    category = "Siber's (Aix-en-Provence)";
    tags.push("Aix", "Siber's");
  } else if (lowerSub.includes("chalon") || lowerFile.includes("ch")) {
    category = "Châlons";
    tags.push("Châlons");
  } else if (lowerSub.includes("paris") || lowerFile.includes("pa")) {
    category = "Paris";
    tags.push("Paris");
  } else if (lowerSub.includes("bordeaux") || lowerFile.includes("bo")) {
    category = "Bordeaux";
    tags.push("Bordeaux");
  } else if (lowerSub.includes("metz")) {
    category = "Metz";
    tags.push("Metz");
  } else if (subDir) {
    // Default to the cleanest folder name
    const parts = subDir.split(/[/\\]/);
    const lastPart = cleanFrenchText(parts[parts.length - 1].replace(/_/g, " "));
    category = lastPart;
    tags.push(lastPart);
  }

  return { category, tags };
}

interface ScannedPhotoItem {
  relPath: string; // e.g. "Clefs d_autres centres/Siber_s/129-IM_Clé Me212.jpg"
  subDir: string;
  filename: string;
  baseDirName: string; // "photos" or "photo"
}

// Scan strictly the public/photos folder for valid photo files (no subdirectories)
function scanDirectoryForPhotos(
  rootDir: string = PHOTOS_DIR,
  baseDirName: string = "photos"
): ScannedPhotoItem[] {
  let items: ScannedPhotoItem[] = [];
  if (!fs.existsSync(rootDir)) return items;

  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      // Ignore hidden files and system directories
      if (entry.name.startsWith(".")) continue;

      // Strictly files directly inside public/photos
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Strictly filter: must be an image, NEVER non-image files like .pdf, .txt, .docx
        if (VALID_PHOTO_EXTENSIONS.has(ext)) {
          items.push({
            relPath: entry.name,
            subDir: "",
            filename: entry.name,
            baseDirName,
          });
        }
      }
    }
  } catch (err) {
    console.error(`Erreur lors du scan photo dans ${rootDir}:`, err);
  }

  return items;
}

// Scan exclusively the public/photos folder for photos
function getLocalPhotosFromDir(): any[] {
  if (!fs.existsSync(PHOTOS_DIR)) return [];

  const allScanned: ScannedPhotoItem[] = scanDirectoryForPhotos(PHOTOS_DIR, "photos");

  if (allScanned.length === 0) return [];

  // Sort photos in natural numerical promotion order (e.g. Cluny 98, Cluny 102, ... Cluny 203)
  allScanned.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: "base" })
  );

  const fallbackGradients = [
    "from-amber-900 via-stone-900 to-amber-700",
    "from-stone-900 via-zinc-800 to-amber-800",
    "from-yellow-950 via-amber-900 to-stone-800",
    "from-zinc-900 via-stone-800 to-amber-900",
    "from-amber-800 via-stone-900 to-yellow-700",
  ];

  return allScanned.map((item, idx) => {
    const cleanId = "photo_" + item.relPath.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const title = parseKeyTitleFromFilename(item.filename);
    const { category, tags } = parseCategoryAndTags(item.subDir, item.filename);

    // Encode URI segments to safely handle spaces, accents, and special characters
    const urlSegments = item.relPath
      .split(/[/\\]/)
      .map(encodeURIComponent)
      .join("/");
    const imageUrl = `/${item.baseDirName}/${urlSegments}`;

    return {
      id: cleanId,
      title: title,
      category: category,
      imageUrl: imageUrl,
      fallbackGradient: fallbackGradients[idx % fallbackGradients.length],
      description: item.subDir
        ? cleanFrenchText(item.subDir.replace(/[/\\]/g, " • ").replace(/_/g, " "))
        : "",
      tags: tags,
    };
  });
}

// Helper to sanitize filename from buque and fam'ss (always lowercased for case-insensitivity)
function getSafeFileName(buque: string, famss: string): string {
  const cleanBuque = buque.trim().toLowerCase().replace(/[^a-z0-9à-ÿ]/gi, "_");
  const cleanFamss = famss.trim().toLowerCase().replace(/[^a-z0-9]/gi, "_");
  return `${cleanBuque}_famss${cleanFamss}.json`;
}

// Case-insensitive response file finder
function findExistingResponseFile(buque: string, famss: string): { filename: string; filePath: string } | null {
  const targetSafe = getSafeFileName(buque, famss);
  const directPath = path.join(RESPONSES_DIR, targetSafe);
  if (fs.existsSync(directPath)) {
    return { filename: targetSafe, filePath: directPath };
  }

  // Scan RESPONSES_DIR to match case-insensitively with any existing file
  try {
    const files = fs.readdirSync(RESPONSES_DIR);
    const matched = files.find((f) => f.toLowerCase() === targetSafe.toLowerCase());
    if (matched) {
      return { filename: matched, filePath: path.join(RESPONSES_DIR, matched) };
    }
  } catch {}

  return null;
}

// Seed initial responses disabled - clean real responses only
function seedInitialResponsesIfEmpty() {
  // Demo responses removed per user request
}

seedInitialResponsesIfEmpty();

// --- API Endpoints ---

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 2. Survey & Photos configuration
app.get("/api/config", (_req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      const config = JSON.parse(content);

      // Check if photos exist in public/photos
      const localPhotos = getLocalPhotosFromDir();
      if (localPhotos.length > 0) {
        config.photos = localPhotos;
      }

      // Default swipeBatchSize to 30 if not specified
      if (!config.swipeBatchSize && !config.project?.swipeBatchSize) {
        config.swipeBatchSize = 30;
      }

      return res.json(config);
    }
    return res.status(404).json({ error: "Fichier de configuration introuvable" });
  } catch (err) {
    console.error("Erreur lecture config:", err);
    return res.status(500).json({ error: "Erreur lecture configuration" });
  }
});

// Update survey configuration parameter (e.g. swipeBatchSize)
app.post("/api/config", (req, res) => {
  try {
    const { swipeBatchSize, targetAudience } = req.body;
    if (!fs.existsSync(CONFIG_FILE)) {
      return res.status(404).json({ error: "Fichier de configuration introuvable" });
    }
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content);

    if (typeof swipeBatchSize === "number" && swipeBatchSize > 0) {
      config.swipeBatchSize = Math.round(swipeBatchSize);
      if (config.project) config.project.swipeBatchSize = Math.round(swipeBatchSize);
      if (!config.settings) config.settings = {};
      config.settings.swipeBatchSize = Math.round(swipeBatchSize);
    }

    if (typeof targetAudience === "number" && targetAudience > 0) {
      if (config.project) config.project.targetAudience = Math.round(targetAudience);
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");

    // Return updated config with photos
    const localPhotos = getLocalPhotosFromDir();
    if (localPhotos.length > 0) {
      config.photos = localPhotos;
    }

    return res.json({ success: true, config });
  } catch (err: any) {
    console.error("Erreur mise a jour config:", err);
    return res.status(500).json({ error: "Erreur mise à jour configuration" });
  }
});

// 3. Get existing response for a user (case-insensitive)
app.get("/api/user-response", (req, res) => {
  const buque = (req.query.buque as string || "").trim();
  const famss = (req.query.famss as string || "").trim();

  if (!buque || !famss) {
    return res.status(400).json({ error: "Buque et Fam'ss obligatoires" });
  }

  const existing = findExistingResponseFile(buque, famss);

  if (existing && fs.existsSync(existing.filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(existing.filePath, "utf-8"));
      return res.json({ found: true, data });
    } catch {
      return res.status(500).json({ error: "Erreur lecture données existantes" });
    }
  }

  return res.json({ found: false, data: null });
});

// 4. Submit or update response (case-insensitive file matching)
app.post("/api/response", (req, res) => {
  const { buque, famss, answers, swipes, superlikeNotes } = req.body;

  if (!buque || !famss) {
    return res.status(400).json({ error: "La buque et la fam'ss sont requises" });
  }

  const existing = findExistingResponseFile(buque, famss);
  const filename = existing ? existing.filename : getSafeFileName(buque, famss);
  const filePath = path.join(RESPONSES_DIR, filename);

  let record: any = {};
  if (fs.existsSync(filePath)) {
    try {
      record = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      record = {};
    }
  }

  const now = new Date().toISOString();
  // Preserve original canonical casing if already set, or use provided
  record.buque = record.buque || buque.trim();
  record.famss = record.famss || famss.trim();
  record.answers = answers || record.answers || {};
  record.swipes = swipes || record.swipes || {};
  record.superlikeNotes = superlikeNotes || record.superlikeNotes || {};
  record.submittedAt = record.submittedAt || now;
  record.updatedAt = now;

  try {
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
    return res.json({ success: true, message: "Réponses enregistrées avec succès !", data: record });
  } catch (err) {
    console.error("Erreur écriture réponse:", err);
    return res.status(500).json({ error: "Erreur lors de la sauvegarde du fichier" });
  }
});

// 5. Global aggregated stats (for live tally & promo participation meter)
app.get("/api/stats", (_req, res) => {
  try {
    const files = fs.readdirSync(RESPONSES_DIR).filter((f) => f.endsWith(".json"));
    const responses: any[] = [];

    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(RESPONSES_DIR, f), "utf-8");
        responses.push(JSON.parse(content));
      } catch (e) {
        console.error("Fichier corrompu:", f, e);
      }
    }

    // Aggregate stats
    const questionStats: Record<string, Record<string, number>> = {};
    const textResponses: Record<string, Array<{ buque: string; famss: string; text: string }>> = {};
    const superlikeHighlights: Array<{ buque: string; famss: string; photoId: string; element: string; reason: string }> = [];
    const photoStats: Record<string, { like: number; superlike: number; dislike: number; score: number }> = {};
    // Deduplicate respondents case-insensitively
    const respondentsMap = new Map<string, any>();
    for (const r of responses) {
      const key = `${(r.buque || '').trim().toLowerCase()}_${(r.famss || '').trim().toLowerCase()}`;
      if (!respondentsMap.has(key) || new Date(r.updatedAt).getTime() > new Date(respondentsMap.get(key).updatedAt).getTime()) {
        respondentsMap.set(key, {
          buque: r.buque,
          famss: r.famss,
          updatedAt: r.updatedAt,
          hasAnswers: Object.keys(r.answers || {}).length > 0,
          hasSwipes: Object.keys(r.swipes || {}).length > 0
        });
      }
    }
    const respondents = Array.from(respondentsMap.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    for (const r of responses) {
      // Questions
      if (r.answers) {
        for (const [qId, ans] of Object.entries(r.answers)) {
          if (!questionStats[qId]) questionStats[qId] = {};
          if (Array.isArray(ans)) {
            for (const item of ans) {
              questionStats[qId][item] = (questionStats[qId][item] || 0) + 1;
            }
          } else if (typeof ans === "string" && ans.trim()) {
            questionStats[qId][ans] = (questionStats[qId][ans] || 0) + 1;
            // Also store text responses for open feedback
            if (!textResponses[qId]) textResponses[qId] = [];
            textResponses[qId].push({
              buque: r.buque || "PG",
              famss: r.famss || "",
              text: ans.trim()
            });
          }
        }
      }

      // Superlike notes & comments
      if (r.superlikeNotes) {
        for (const [photoId, note] of Object.entries(r.superlikeNotes as Record<string, any>)) {
          if (note && (note.element || note.reason)) {
            superlikeHighlights.push({
              buque: r.buque || "PG",
              famss: r.famss || "",
              photoId,
              element: note.element || "Coup de cœur",
              reason: note.reason || ""
            });
          }
        }
      }

      // Swipes
      if (r.swipes) {
        for (const [photoId, vote] of Object.entries(r.swipes)) {
          if (!photoStats[photoId]) {
            photoStats[photoId] = { like: 0, superlike: 0, dislike: 0, score: 0 };
          }
          if (vote === "superlike") {
            photoStats[photoId].superlike += 1;
            photoStats[photoId].score += 2;
          } else if (vote === "like") {
            photoStats[photoId].like += 1;
            photoStats[photoId].score += 1;
          } else if (vote === "dislike") {
            photoStats[photoId].dislike += 1;
            photoStats[photoId].score -= 1;
          }
        }
      }
    }

    return res.json({
      totalResponses: responses.length,
      targetAudience: 160,
      completionRate: Math.min(100, Math.round((responses.length / 160) * 100)),
      questionStats,
      photoStats,
      respondents,
      textResponses,
      superlikeHighlights
    });
  } catch (err) {
    console.error("Erreur calcul stats:", err);
    return res.status(500).json({ error: "Erreur calcul statistiques" });
  }
});

// 6. Export all responses for the Clé d'Ex committee
app.get("/api/export", (_req, res) => {
  try {
    const files = fs.readdirSync(RESPONSES_DIR).filter((f) => f.endsWith(".json"));
    const all = files.map((f) => {
      const content = fs.readFileSync(path.join(RESPONSES_DIR, f), "utf-8");
      return JSON.parse(content);
    });
    res.setHeader("Content-Disposition", 'attachment; filename="reponses_cle_dex_225.json"');
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(all, null, 2));
  } catch (err) {
    return res.status(500).json({ error: "Erreur export" });
  }
});

// Vite middleware and SPA serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur Clé d'Ex 225 démarré sur http://localhost:${PORT}`);
  });
}

startServer();
