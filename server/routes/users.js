const router  = require('express').Router();
const { v4 }  = require('uuid');
const QRCode  = require('qrcode');
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const { auth, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');

/* ── Upload config ── */
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../data/uploads/photos'),
  filename: (_, f, cb) => cb(null, v4() + path.extname(f.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, f.mimetype.startsWith('image/'))
});

function makeQRSecret(id) {
  return crypto.createHmac('sha256', process.env.QR_SALT || 'gsi')
    .update(id).digest('hex').toUpperCase().substring(0, 20);
}

async function buildQR(secret) {
  return QRCode.toDataURL(secret, {
    width: 400, margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H'
  });
}

/* ── GET all users ── */
router.get('/', auth, adminOnly, async (req, res) => {
  const users = (await db.getUsers()).map(({ password, ...u }) => u);
  res.json(users);
});

/* ── CREATE user ── */
router.post('/', auth, adminOnly, upload.single('photo'), async (req, res) => {
  try {
    const { nom_complet, email, telephone, adresse, type,
            sous_type, campus, filiere, niveau, mot_de_passe } = req.body;
    if (!nom_complet || !type)
      return res.status(400).json({ error: 'Nom et type obligatoires' });
    if (email && await db.getUserByEmail(email))
      return res.status(409).json({ error: 'Email déjà utilisé' });

    const id       = v4();
    const qr_code  = makeQRSecret(id);
    const qr_image = await buildQR(qr_code);
    const numero_id = `GSI${Date.now().toString().slice(-8)}`;

    const user = {
      id, numero_id, nom_complet,
      email: email || null,
      telephone: telephone || null,
      adresse: adresse || null,
      type,                                  // etudiant | professeur | travailleur
      sous_type: sous_type || null,          // ex: "Directeur", "Comptable"...
      campus: campus || 'ANTANANARIVO (ANALAKELY)',
      filiere: filiere || null,
      niveau: niveau || null,
      photo: req.file ? `/uploads/photos/${req.file.filename}` : null,
      qr_code, qr_image,
      password: mot_de_passe ? await bcrypt.hash(mot_de_passe, 12) : null,
      actif: true,
      created_at: new Date().toISOString()
    };

    await db.saveUser(user);
    const { password, ...safe } = user;
    if (global.io) global.io.to('admin').emit('user:created', safe);
    res.status(201).json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── UPDATE user ── */
router.put('/:id', auth, adminOnly, upload.single('photo'), async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Introuvable' });
    const upd = { ...req.body };
    if (req.file) upd.photo = `/uploads/photos/${req.file.filename}`;
    if (upd.mot_de_passe) { upd.password = await bcrypt.hash(upd.mot_de_passe, 12); delete upd.mot_de_passe; }
    const updated = { ...user, ...upd, updated_at: new Date().toISOString() };
    await db.saveUser(updated);
    const { password, ...safe } = updated;
    if (global.io) global.io.to('admin').emit('user:updated', safe);
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── GET single ── */
router.get('/:id', auth, adminOnly, async (req, res) => {
  const u = await db.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Introuvable' });
  const { password, ...safe } = u;
  res.json(safe);
});

/* ── TOGGLE active ── */
router.patch('/:id/toggle', auth, adminOnly, async (req, res) => {
  const u = await db.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Introuvable' });
  u.actif = !u.actif;
  u.updated_at = new Date().toISOString();
  await db.saveUser(u);
  if (global.io) global.io.to('admin').emit('user:updated', { id: u.id, actif: u.actif });
  res.json({ actif: u.actif });
});

/* ── DELETE ── */
router.delete('/:id', auth, adminOnly, async (req, res) => {
  await db.deleteUser(req.params.id);
  if (global.io) global.io.to('admin').emit('user:deleted', req.params.id);
  res.json({ ok: true });
});

/* ── REGENERATE QR ── */
router.post('/:id/regen-qr', auth, adminOnly, async (req, res) => {
  const u = await db.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Introuvable' });
  u.qr_code  = makeQRSecret(u.id + Date.now());
  u.qr_image = await buildQR(u.qr_code);
  await db.saveUser(u);
  res.json({ qr_code: u.qr_code, qr_image: u.qr_image });
});

/* ── IMPORT étudiant existant (carte GSI déjà émise) ── */
router.post('/import', auth, adminOnly, async (req, res) => {
  try {
    const { qr_code, numero_id, nom_complet, campus, filiere, niveau } = req.body;
    if (!qr_code || !numero_id)
      return res.status(400).json({ error: 'qr_code et numero_id requis' });
    if (await db.getUserByQR(qr_code))
      return res.status(409).json({ error: 'QR code déjà enregistré' });

    const id = v4();
    const qr_image = await buildQR(qr_code);
    const user = {
      id, numero_id,
      nom_complet: nom_complet || 'Étudiant GSI',
      email: null, telephone: null, adresse: null,
      type: 'etudiant', sous_type: null,
      campus: campus || 'ANTANANARIVO (ANALAKELY)',
      filiere: filiere || null, niveau: niveau || null,
      photo: null, qr_code, qr_image, password: null,
      actif: true, created_at: new Date().toISOString()
    };
    await db.saveUser(user);
    if (global.io) global.io.to('admin').emit('user:created', user);
    res.status(201).json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
