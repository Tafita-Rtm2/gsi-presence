const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');

router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  const users = await db.getUsers();
  const today = new Date().toISOString().split('T')[0];
  const todayP = await db.getPresences({ date: today });
  const allP = await db.getPresences();
  const active = users.filter(u => u.actif);
  const uniq = (type) => [...new Set(todayP.filter(p => !type || p.type === type).map(p => p.user_id))].length;
  const absent = (type) => {
    const typeUsers = active.filter(u => !type || u.type === type).map(u => u.id);
    const present = new Set(todayP.filter(p => !type || p.type === type).map(p => p.user_id));
    return typeUsers.filter(id => !present.has(id));
  };
  res.json({
    totaux: {
      etudiants: active.filter(u => u.type==='etudiant').length,
      professeurs: active.filter(u => u.type==='professeur').length,
      travailleurs: active.filter(u => u.type==='travailleur').length,
      total: active.length
    },
    aujourd_hui: {
      etudiants_presents: uniq('etudiant'),
      professeurs_presents: uniq('professeur'),
      travailleurs_presents: uniq('travailleur'),
      total_presents: uniq(null),
      total_scans: todayP.length,
      absents_etudiants: absent('etudiant').length,
      absents_professeurs: absent('professeur').length,
      absents_travailleurs: absent('travailleur').length,
      absents_ids: absent(null)
    },
    recents: todayP.slice(-30).reverse(),
    total_presences: allP.length
  });
});

router.get('/weekly', authMiddleware, adminOnly, async (req, res) => {
  const allP = await db.getPresences();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const dayP = allP.filter(p => p.date === date);
    last7.push({ date, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), count: dayP.length, etudiants: dayP.filter(p=>p.type==='etudiant').length, professeurs: dayP.filter(p=>p.type==='professeur').length, travailleurs: dayP.filter(p=>p.type==='travailleur').length });
  }
  res.json(last7);
});

router.get('/user/:id', authMiddleware, adminOnly, async (req, res) => {
  const { filter, month, year } = req.query;
  const allP = await db.getPresences({ userId: req.params.id });
  const user = await db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  let presences = allP;
  if (month) presences = presences.filter(p => p.date && p.date.startsWith(month));
  else if (year) presences = presences.filter(p => p.date && p.date.startsWith(year));
  const dates = [...new Set(presences.map(p => p.date))];
  const now = new Date();
  const allDates = [];
  const start = month ? new Date(month + '-01') : year ? new Date(year + '-01-01') : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = month ? new Date(start.getFullYear(), start.getMonth()+1, 0) : year ? new Date(year, 12, 0) : now;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (d.getDay() !== 0) allDates.push(dateStr);
  }
  const presentSet = new Set(dates);
  const calendar = allDates.map(date => ({ date, present: presentSet.has(date), scans: presences.filter(p => p.date === date) }));
  res.json({ user: { id: user.id, nom_complet: user.nom_complet, type: user.type, photo: user.photo, campus: user.campus, filiere: user.filiere, niveau: user.niveau }, presences, calendar, total_present: dates.length, total_absent: allDates.filter(d => !presentSet.has(d)).length, total_jours: allDates.length });
});

router.get('/absents-today', authMiddleware, adminOnly, async (req, res) => {
  const users = await db.getUsers();
  const today = new Date().toISOString().split('T')[0];
  const todayP = await db.getPresences({ date: today });
  const presentIds = new Set(todayP.map(p => p.user_id));
  const absents = users.filter(u => u.actif && !presentIds.has(u.id));
  res.json(absents.map(({ password, qr_image, ...u }) => u));
});

module.exports = router;
