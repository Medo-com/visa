const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const visaData = require(path.join(__dirname, '..', 'data', 'visaRules.json'));

const groups = visaData.countryGroups;

// ---------------------------------------------------------------------------
// Helper — check if a country belongs to a group
// ---------------------------------------------------------------------------
function inGroup(country, groupName) {
  return groups[groupName] && groups[groupName].includes(country);
}

// ---------------------------------------------------------------------------
// Helper — resolve visa rule using explicit pairs first, then group fallbacks
// ---------------------------------------------------------------------------
function resolveVisaRule(nationality, destination) {
  // 1. Explicit pair
  const key = `${nationality}-${destination}`;
  if (visaData.visaRules[key]) return { ...visaData.visaRules[key] };

  // 2. Group-based rules (checked in priority order)

  // EU ↔ EU (freedom of movement)
  if (inGroup(nationality, 'EU_SCHENGEN') && inGroup(destination, 'EU_SCHENGEN')) {
    return { ...visaData.groupRules['EU_to_EU'] };
  }

  // To United States
  if (destination === 'United States') {
    if (nationality === 'Canada') {
      return {
        visaRequired: false, visaType: 'Visa-Free',
        maxStay: '6 months',
        documents: ['Valid Passport'], applicationLink: '',
        notes: 'Canadian citizens do not need a visa or ESTA for the US.'
      };
    }
    if (inGroup(nationality, 'US_VWP')) return { ...visaData.groupRules['US_VWP_to_US'] };
    return { ...visaData.groupRules['DEFAULT_to_US'] };
  }

  // To United Kingdom
  if (destination === 'United Kingdom') {
    if (inGroup(nationality, 'UK_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_UK'] };
    return { ...visaData.groupRules['DEFAULT_to_UK'] };
  }

  // To Schengen countries
  if (inGroup(destination, 'EU_SCHENGEN') && destination !== 'Ireland') {
    if (inGroup(nationality, 'UK_VISA_FREE') || inGroup(nationality, 'STRONG_PASSPORTS')) {
      return { ...visaData.groupRules['STRONG_to_SCHENGEN'] };
    }
    const rule = { ...visaData.groupRules['DEFAULT_to_SCHENGEN'] };
    // Add destination-specific Schengen application link if available
    if (visaData.schengenApplicationLinks[destination]) {
      rule.applicationLink = visaData.schengenApplicationLinks[destination];
    }
    return rule;
  }

  // To Canada
  if (destination === 'Canada') {
    if (nationality === 'United States') {
      return {
        visaRequired: false, visaType: 'Visa-Free',
        maxStay: '6 months',
        documents: ['Valid Passport'], applicationLink: '',
        notes: 'US citizens do not need a visa or eTA for Canada.'
      };
    }
    if (inGroup(nationality, 'CANADA_VISA_EXEMPT')) return { ...visaData.groupRules['EXEMPT_to_CANADA'] };
    return { ...visaData.groupRules['DEFAULT_to_CANADA'] };
  }

  // To Australia
  if (destination === 'Australia') {
    if (inGroup(nationality, 'AUSTRALIA_ETA')) return { ...visaData.groupRules['ETA_to_AUSTRALIA'] };
    if (inGroup(nationality, 'AUSTRALIA_EVISA')) return { ...visaData.groupRules['EVISA_to_AUSTRALIA'] };
    return { ...visaData.groupRules['DEFAULT_to_AUSTRALIA'] };
  }

  // To India
  if (destination === 'India') {
    return { ...visaData.groupRules['ANY_to_INDIA'] };
  }

  // To Japan
  if (destination === 'Japan') {
    if (inGroup(nationality, 'JAPAN_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_JAPAN'] };
    return { ...visaData.groupRules['ANY_to_JAPAN'] };
  }

  // To UAE
  if (destination === 'UAE') {
    if (inGroup(nationality, 'UAE_VOA')) return { ...visaData.groupRules['STRONG_to_UAE'] };
    return { ...visaData.groupRules['DEFAULT_to_UAE'] };
  }

  // To Turkey
  if (destination === 'Turkey') {
    return { ...visaData.groupRules['ANY_to_TURKEY'] };
  }

  // To China
  if (destination === 'China') {
    return { ...visaData.groupRules['ANY_to_CHINA'] };
  }

  // To Russia
  if (destination === 'Russia') {
    return { ...visaData.groupRules['ANY_to_RUSSIA'] };
  }

  // To Brazil
  if (destination === 'Brazil') {
    if (inGroup(nationality, 'MERCOSUR')) return { ...visaData.groupRules['MERCOSUR_to_BRAZIL'] };
    return { ...visaData.groupRules['DEFAULT_to_BRAZIL'] };
  }

  // ── New Zealand ──
  if (destination === 'New Zealand') {
    if (inGroup(nationality, 'NEW_ZEALAND_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_NEW_ZEALAND'] };
    return { ...visaData.groupRules['DEFAULT_to_NEW_ZEALAND'] };
  }

  // ── Israel ──
  if (destination === 'Israel') {
    if (inGroup(nationality, 'ISRAEL_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_ISRAEL'] };
    return { ...visaData.groupRules['DEFAULT_to_ISRAEL'] };
  }

  // ── Argentina ──
  if (destination === 'Argentina') {
    if (inGroup(nationality, 'LATAM_VISA_FREE') || inGroup(nationality, 'MERCOSUR')) return { ...visaData.groupRules['STRONG_to_ARGENTINA'] };
    return { ...visaData.groupRules['DEFAULT_to_ARGENTINA'] };
  }

  // ── Latin America (Chile, Colombia, Costa Rica, Ecuador, Peru, Panama,
  //    Paraguay, Uruguay, Bolivia, Guatemala, Honduras, El Salvador,
  //    Nicaragua, Dominican Republic, Jamaica, Mexico) ──
  const latinAmCountries = [
    'Chile', 'Colombia', 'Costa Rica', 'Ecuador', 'Peru', 'Panama',
    'Paraguay', 'Uruguay', 'Bolivia', 'Guatemala', 'Honduras',
    'El Salvador', 'Nicaragua', 'Dominican Republic', 'Jamaica', 'Mexico'
  ];
  if (latinAmCountries.includes(destination)) {
    if (inGroup(nationality, 'LATAM_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_LATAM'] };
    return { ...visaData.groupRules['DEFAULT_to_LATAM'] };
  }

  // ── Egypt ──
  if (destination === 'Egypt') {
    if (inGroup(nationality, 'EGYPT_VOA')) return { ...visaData.groupRules['STRONG_to_EGYPT'] };
    return { ...visaData.groupRules['DEFAULT_to_EGYPT'] };
  }

  // ── Jordan ──
  if (destination === 'Jordan') {
    if (inGroup(nationality, 'JORDAN_VOA')) return { ...visaData.groupRules['STRONG_to_JORDAN'] };
    return { ...visaData.groupRules['DEFAULT_to_JORDAN'] };
  }

  // ── Cambodia ──
  if (destination === 'Cambodia') {
    return { ...visaData.groupRules['ANY_to_CAMBODIA'] };
  }

  // ── Laos ──
  if (destination === 'Laos') {
    return { ...visaData.groupRules['ANY_to_LAOS'] };
  }

  // ── Ethiopia ──
  if (destination === 'Ethiopia') {
    if (inGroup(nationality, 'ETHIOPIA_EVISA')) return { ...visaData.groupRules['STRONG_to_ETHIOPIA'] };
    return { ...visaData.groupRules['DEFAULT_to_ETHIOPIA'] };
  }

  // ── Kenya ──
  if (destination === 'Kenya') {
    return { ...visaData.groupRules['STRONG_to_KENYA'] };
  }

  // ── Tanzania ──
  if (destination === 'Tanzania') {
    if (inGroup(nationality, 'TANZANIA_EVISA')) return { ...visaData.groupRules['STRONG_to_TANZANIA'] };
    return { ...visaData.groupRules['DEFAULT_to_TANZANIA'] };
  }

  // ── Saudi Arabia ──
  if (destination === 'Saudi Arabia') {
    if (inGroup(nationality, 'SAUDI_EVISA')) return { ...visaData.groupRules['STRONG_to_SAUDI'] };
    return { ...visaData.groupRules['DEFAULT_to_SAUDI'] };
  }

  // ── Qatar ──
  if (destination === 'Qatar') {
    if (inGroup(nationality, 'QATAR_VOA')) return { ...visaData.groupRules['STRONG_to_QATAR'] };
    return { ...visaData.groupRules['DEFAULT_to_QATAR'] };
  }

  // ── Oman ──
  if (destination === 'Oman') {
    if (inGroup(nationality, 'OMAN_EVISA')) return { ...visaData.groupRules['STRONG_to_OMAN'] };
    return { ...visaData.groupRules['DEFAULT_to_OMAN'] };
  }

  // ── Bahrain ──
  if (destination === 'Bahrain') {
    if (inGroup(nationality, 'BAHRAIN_EVISA')) return { ...visaData.groupRules['STRONG_to_BAHRAIN'] };
    return { ...visaData.groupRules['DEFAULT_to_BAHRAIN'] };
  }

  // ── Kuwait ──
  if (destination === 'Kuwait') {
    if (inGroup(nationality, 'KUWAIT_EVISA')) return { ...visaData.groupRules['STRONG_to_KUWAIT'] };
    return { ...visaData.groupRules['DEFAULT_to_KUWAIT'] };
  }

  // ── Rwanda ──
  if (destination === 'Rwanda') {
    return { ...visaData.groupRules['STRONG_to_RWANDA'] };
  }

  // ── Mozambique ──
  if (destination === 'Mozambique') {
    return { ...visaData.groupRules['ANY_to_MOZAMBIQUE'] };
  }

  // ── Georgia ──
  if (destination === 'Georgia') {
    if (inGroup(nationality, 'GEORGIA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_GEORGIA'] };
    return { ...visaData.groupRules['DEFAULT_to_GEORGIA'] };
  }

  // ── Serbia ──
  if (destination === 'Serbia') {
    if (inGroup(nationality, 'SERBIA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_SERBIA'] };
    return { ...visaData.groupRules['DEFAULT_to_SERBIA'] };
  }

  // ── Albania ──
  if (destination === 'Albania') {
    if (inGroup(nationality, 'ALBANIA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_ALBANIA'] };
    return { ...visaData.groupRules['DEFAULT_to_ALBANIA'] };
  }

  // ── Ukraine ──
  if (destination === 'Ukraine') {
    if (inGroup(nationality, 'UKRAINE_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_UKRAINE'] };
    return { ...visaData.groupRules['DEFAULT_to_UKRAINE'] };
  }

  // ── Moldova ──
  if (destination === 'Moldova') {
    if (inGroup(nationality, 'SERBIA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_MOLDOVA'] };
    return { ...visaData.groupRules['DEFAULT_to_MOLDOVA'] };
  }

  // ── Mongolia ──
  if (destination === 'Mongolia') {
    if (inGroup(nationality, 'MONGOLIA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_MONGOLIA'] };
    return { ...visaData.groupRules['DEFAULT_to_MONGOLIA'] };
  }

  // ── Morocco ──
  if (destination === 'Morocco') {
    if (inGroup(nationality, 'MOROCCO_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_MOROCCO'] };
    return { ...visaData.groupRules['DEFAULT_to_MOROCCO'] };
  }

  // ── Tunisia ──
  if (destination === 'Tunisia') {
    if (inGroup(nationality, 'TUNISIA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_TUNISIA'] };
    return { ...visaData.groupRules['DEFAULT_to_TUNISIA'] };
  }

  // ── South Africa ──
  if (destination === 'South Africa') {
    if (inGroup(nationality, 'SOUTH_AFRICA_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_SOUTH_AFRICA'] };
    return { ...visaData.groupRules['DEFAULT_to_SOUTH_AFRICA'] };
  }

  // ── Philippines ──
  if (destination === 'Philippines') {
    if (inGroup(nationality, 'PHILIPPINES_VISA_FREE')) return { ...visaData.groupRules['STRONG_to_PHILIPPINES'] };
    return { ...visaData.groupRules['DEFAULT_to_PHILIPPINES'] };
  }

  // ── Countries with simple universal rules ──
  const universalRuleDests = {
    'Algeria': 'ANY_to_ALGERIA',
    'Iran': 'ANY_to_IRAN',
    'Pakistan': 'ANY_to_PAKISTAN',
    'Nigeria': 'ANY_to_NIGERIA',
    'Ghana': 'ANY_to_GHANA',
    'Cameroon': 'ANY_to_CAMEROON',
    'Senegal': 'ANY_to_SENEGAL',
    'Uganda': 'ANY_to_UGANDA',
    'Zambia': 'ANY_to_ZAMBIA',
    'Zimbabwe': 'ANY_to_ZIMBABWE',
    'Lebanon': 'ANY_to_LEBANON',
    'Myanmar': 'ANY_to_MYANMAR',
    'Kazakhstan': 'ANY_to_KAZAKHSTAN',
    'Uzbekistan': 'ANY_to_UZBEKISTAN',
    'Azerbaijan': 'ANY_to_AZERBAIJAN',
    'Armenia': 'ANY_to_ARMENIA',
    'Belarus': 'ANY_to_BELARUS',
    'Cuba': 'ANY_to_CUBA',
    'North Korea': 'ANY_to_NORTH_KOREA',
    'Somalia': 'ANY_to_SOMALIA',
    'Yemen': 'ANY_to_YEMEN',
    'Sudan': 'ANY_to_SUDAN',
    'Libya': 'ANY_to_LIBYA',
    'Iraq': 'ANY_to_IRAQ',
    'Afghanistan': 'ANY_to_AFGHANISTAN',
    'Bangladesh': 'ANY_to_BANGLADESH',
    'Venezuela': 'ANY_to_VENEZUELA'
  };
  if (universalRuleDests[destination] && visaData.groupRules[universalRuleDests[destination]]) {
    return { ...visaData.groupRules[universalRuleDests[destination]] };
  }

  // ── General fallback — best-effort based on passport strength ──
  if (inGroup(nationality, 'STRONG_PASSPORTS') || inGroup(nationality, 'US_VWP')) {
    return {
      visaRequired: true,
      visaType: 'Likely Visa Required',
      maxStay: 'Varies — check visa terms',
      documents: ['Valid Passport', 'Visa (check embassy)'],
      applicationLink: '',
      notes: `Specific rules for ${nationality} → ${destination} are not in our database. Strong-passport holders may have e-Visa or visa-on-arrival options — check the embassy of ${destination}.`
    };
  }

  return {
    visaRequired: true,
    visaType: 'Likely Visa Required',
    maxStay: 'Varies — check visa terms',
    documents: ['Valid Passport', 'Visa (check embassy)'],
    applicationLink: '',
    notes: `Specific rules for ${nationality} → ${destination} are not in our database. Contact the embassy of ${destination} for current requirements.`
  };
}

// ---------------------------------------------------------------------------
// GET /api/countries
// ---------------------------------------------------------------------------
router.get('/countries', (req, res) => {
  res.json({ countries: visaData.countries });
});

// ---------------------------------------------------------------------------
// POST /api/check-visa
// ---------------------------------------------------------------------------
router.post('/check-visa', (req, res) => {
  let { nationality, destination, transit } = req.body;

  // ---- Validation ----
  if (!nationality || !destination) {
    return res.status(400).json({ error: 'Nationality and destination are required.' });
  }

  // Case-insensitive country matching
  const validCountries = visaData.countries;
  const findCountry = (input) => validCountries.find(c => c.toLowerCase() === input.toLowerCase());

  nationality = findCountry(nationality) || nationality;
  destination = findCountry(destination) || destination;

  if (nationality === destination) {
    return res.status(400).json({ error: 'Nationality and destination cannot be the same country.' });
  }
  if (!validCountries.includes(nationality)) {
    return res.status(400).json({ error: `Nationality "${nationality}" is not supported yet.` });
  }
  if (!validCountries.includes(destination)) {
    return res.status(400).json({ error: `Destination "${destination}" is not supported yet.` });
  }

  const transitCountries = Array.isArray(transit) ? transit : [];
  const normalizedTransit = transitCountries.map(t => findCountry(t) || t);
  for (const t of normalizedTransit) {
    if (!validCountries.includes(t)) {
      return res.status(400).json({ error: `Transit country "${t}" is not supported yet.` });
    }
  }

  // ---- Resolve destination visa rule ----
  const rule = resolveVisaRule(nationality, destination);
  let destinationResult;

  if (rule) {
    destinationResult = {
      visaRequired: rule.visaRequired,
      visaType: rule.visaType,
      maxStay: rule.maxStay,
      documents: rule.documents,
      applicationLink: rule.applicationLink,
      notes: rule.notes,
      message: rule.visaRequired
        ? `You will need a visa (${rule.visaType}) before traveling to ${destination}.`
        : `No visa required for ${nationality} citizens visiting ${destination}. Enjoy your trip!`
    };
  } else {
    destinationResult = {
      visaRequired: true,
      visaType: 'Unknown — check embassy',
      maxStay: 'Varies — check visa terms',
      documents: ['Valid Passport'],
      applicationLink: '',
      notes: `We do not have specific visa data for ${nationality} → ${destination}. Please check with the embassy.`,
      message: `Visa information for ${nationality} → ${destination} is not yet available. Contact the embassy.`
    };
  }

  // ---- Resolve transit rules ----
  const transitResults = normalizedTransit
    .filter(tc => tc !== nationality && tc !== destination)
    .map(tc => {
      const transitRule = visaData.transitRules[tc];
      if (!transitRule) {
        return {
          country: tc,
          transitVisaRequired: null,
          notes: `Transit data not available for ${tc}.`,
          applicationLink: ''
        };
      }
      const needsVisa = transitRule.transitVisaRequired.includes(nationality);
      return {
        country: tc,
        transitVisaRequired: needsVisa,
        notes: transitRule.notes,
        applicationLink: needsVisa ? transitRule.applicationLink : '',
        message: needsVisa
          ? `Transit visa REQUIRED when transiting through ${tc}.`
          : `No transit visa needed for ${nationality} citizens transiting through ${tc}.`
      };
    });

  // ---- Response ----
  res.json({
    nationality,
    destination,
    visa: destinationResult,
    transit: transitResults,
    hasTransitIssues: transitResults.some(t => t.transitVisaRequired === true)
  });
});

// ---------------------------------------------------------------------------
// GET /api/visa-free/:nationality
// Returns all destinations a nationality can visit without a traditional visa
// (visa-free, eTA, ESTA, visa on arrival, e-Visa, tourist card, etc.)
// ---------------------------------------------------------------------------
router.get('/visa-free/:nationality', (req, res) => {
  const validCountries = visaData.countries;
  const findCountry = (input) => validCountries.find(c => c.toLowerCase() === input.toLowerCase());
  const nationality = findCountry(req.params.nationality);

  if (!nationality) {
    return res.status(400).json({ error: `Nationality "${req.params.nationality}" is not supported.` });
  }

  const results = [];
  for (const dest of validCountries) {
    if (dest === nationality) continue;
    const rule = resolveVisaRule(nationality, dest);
    if (!rule) continue;

    const vt = (rule.visaType || '').toLowerCase();
    const noTraditionalVisa = !rule.visaRequired
      || vt.includes('on arrival')
      || vt.includes('e-visa')
      || vt.includes('evisa')
      || vt.includes('eta')
      || vt.includes('esta')
      || vt.includes('evisitor')
      || vt.includes('tourist card')
      || vt.includes('free');

    if (noTraditionalVisa) {
      results.push({
        destination: dest,
        visaType: rule.visaType,
        maxStay: rule.maxStay,
        visaRequired: rule.visaRequired,
        notes: rule.notes || ''
      });
    }
  }

  // Sort: visa-free first, then by destination name
  results.sort((a, b) => {
    if (a.visaRequired !== b.visaRequired) return a.visaRequired ? 1 : -1;
    return a.destination.localeCompare(b.destination);
  });

  res.json({ nationality, total: results.length, destinations: results });
});

// ---------------------------------------------------------------------------
// POST /contact — receive contact form and email it
// ---------------------------------------------------------------------------
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || '';
const messagesPath = path.join(__dirname, '..', 'data', 'messages.json');

// Create a reusable transporter (Gmail-compatible; uses env vars for credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const entry = {
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    subject: String(subject).slice(0, 300),
    message: String(message).slice(0, 5000),
    date: new Date().toISOString()
  };

  // 1. Persist to messages.json
  let messages = [];
  try {
    if (fs.existsSync(messagesPath)) {
      messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
    }
  } catch { /* start fresh */ }
  messages.push(entry);
  fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));

  // 2. Attempt to send email (non-blocking — still returns 200 even if mail fails)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `"Visa Atlas Contact" <${process.env.SMTP_USER}>`,
        to: CONTACT_EMAIL,
        replyTo: entry.email,
        subject: `[Visa Atlas] ${entry.subject}`,
        text: `Name: ${entry.name}\nEmail: ${entry.email}\n\n${entry.message}`
      });
    } catch (err) {
      console.error('Email send failed:', err.message);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
