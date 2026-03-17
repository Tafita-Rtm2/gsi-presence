const router = require('express').Router();
const { v4 } = require('uuid');
const { auth, scanOrAdmin } = require('../middleware/auth');
const db = require('../utils/db');

/* ═══════════════════════════════════════════
   SCAN UNIQUE — ultra-rapide (<10ms)
═══════════════════════════════════════════ */
router.post('/', auth, scanOrAdmin, async (req, res) => {
  const t0 = Date.now();
  try {
    const { qr_code } = req.body;
    if (!qr_code?.trim())
      return res.status(400).json({ ok: false, error: 'QR vide' });

    /* 1. Chercher l'utilisateur */
    const user = await db.getUserByQR(qr_code.trim().toUpperCase());

    if (!user) {
      /* QR inconnu → notifier admin */
      const notif = {
        id: v4(), type: 'qr_unknown',
        message: `QR Code inconnu tenté : ${qr_code.substring(0, 10)}...`,
        severity: 'warning', read: false,
        timestamp: new Date().toISOString()
      };
      await db.saveNotification(notif);
      if (global.io) {
        global.io.to('admin').emit('scan:rejected', { qr: qr_code, time: notif.timestamp });
        global.io.to('admin').emit('notif:new', notif);
      }
      return res.status(404).json({ ok: false, error: 'QR non reconnu', code: 'UNKNOWN' });
    }

    if (!user.actif) {
      return res.status(403).json({ ok: false, error: 'Compte désactivé', code: 'INACTIVE' });
    }

    const now    = new Date();
    const today  = now.toISOString().split('T')[0];
    const heure  = now.toTimeString().split(' ')[0];

    /* 2. Vérifier doublon aujourd'hui */
    const todayScans = await db.getPresences({ userId: user.id, date: today });
    const isDuplicate = todayScans.length > 0;

    /* 3. Enregistrer présence */
    const presence = {
      id: v4(),
      user_id: user.id,
      nom_complet: user.nom_complet,
      type: user.type,
      sous_type: user.sous_type,
      campus: user.campus,
      photo: user.photo,
      numero_id: user.numero_id,
      date: today,
      heure,
      timestamp: now.toISOString(),
      scan_index: todayScans.length + 1,
      is_duplicate: isDuplicate
    };
    await db.savePresence(presence);

    /* 4. Broadcast temps réel */
    const payload = {
      ok: true,
      message: isDuplicate
        ? `${user.nom_complet} — Déjà enregistré aujourd'hui`
        : `Bienvenue ${user.nom_complet} !`,
      user: {
        id: user.id, nom_complet: user.nom_complet,
        type: user.type, photo: user.photo,
        campus: user.campus, numero_id: user.numero_id
      },
      presence: { date: today, heure, is_duplicate: isDuplicate },
      ms: Date.now() - t0
    };

    if (global.io) {
      global.io.to('admin').emit('scan:success', { ...payload, presence });
      global.io.to('scanner').emit('scan:result', payload);
    }

    res.json(payload);
  } catch (e) {
    console.error('[SCAN ERROR]', e.message);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

/* ═══════════════════════════════════════════
   SCAN BATCH — plusieurs QR d'un coup
═══════════════════════════════════════════ */
router.post('/batch', auth, scanOrAdmin, async (req, res) => {
  const { qr_codes } = req.body;
  if (!Array.isArray(qr_codes) || !qr_codes.length)
    return res.status(400).json({ error: 'Liste vide' });

  const results = await Promise.all(qr_codes.map(async qr => {
    const user = await db.getUserByQR(qr.trim().toUpperCase());
    if (!user) return { qr, ok: false, error: 'QR inconnu' };
    const today = new Date().toISOString().split('T')[0];
    const heure = new Date().toTimeString().split(' ')[0];
    await db.savePresence({ id: v4(), user_id: user.id, nom_complet: user.nom_complet, type: user.type, date: today, heure, timestamp: new Date().toISOString(), scan_index: 1, is_duplicate: false });
    return { qr, ok: true, nom: user.nom_complet, type: user.type };
  }));

  res.json({ ok: true, total: results.length, success: results.filter(r => r.ok).length, results });
});

module.exports = router;
