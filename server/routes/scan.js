# Créer server/routes/scan.js
cat > server/routes/scan.js << 'EOF'
const router = require('express').Router();
const { v4 } = require('uuid');
const { auth, scanOrAdmin } = require('../middleware/auth');
const db = require('../utils/db');
router.post('/', auth, scanOrAdmin, async (req, res) => {
  const t0 = Date.now();
  try {
    const { qr_code } = req.body;
    if (!qr_code?.trim()) return res.status(400).json({ ok:false, error:'QR vide' });
    const user = await db.getUserByQR(qr_code.trim().toUpperCase());
    if (!user) {
      const notif = { id:v4(), type:'qr_unknown', message:`QR inconnu: ${qr_code.substring(0,10)}...`, severity:'warning', read:false, timestamp:new Date().toISOString() };
      await db.saveNotification(notif);
      if(global.io) { global.io.to('admin').emit('scan:rejected',{qr:qr_code}); global.io.to('admin').emit('notif:new',notif); }
      return res.status(404).json({ ok:false, error:'QR non reconnu', code:'UNKNOWN' });
    }
    if (!user.actif) return res.status(403).json({ ok:false, error:'Compte désactivé', code:'INACTIVE' });
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const heure = now.toTimeString().split(' ')[0];
    const todayScans = await db.getPresences({ userId:user.id, date:today });
    const isDuplicate = todayScans.length > 0;
    const presence = { id:v4(), user_id:user.id, nom_complet:user.nom_complet, type:user.type, sous_type:user.sous_type, campus:user.campus, photo:user.photo, numero_id:user.numero_id, date:today, heure, timestamp:now.toISOString(), scan_index:todayScans.length+1, is_duplicate:isDuplicate };
    await db.savePresence(presence);
    const payload = { ok:true, message:isDuplicate?`${user.nom_complet} — Déjà enregistré`:`Bienvenue ${user.nom_complet} !`, user:{id:user.id,nom_complet:user.nom_complet,type:user.type,photo:user.photo,campus:user.campus,numero_id:user.numero_id}, presence:{date:today,heure,is_duplicate:isDuplicate}, ms:Date.now()-t0 };
    if(global.io) { global.io.to('admin').emit('scan:success',{...payload,presence}); global.io.to('scanner').emit('scan:result',payload); }
    res.json(payload);
  } catch(e) { res.status(500).json({ ok:false, error:'Erreur serveur' }); }
});
module.exports = router;
EOF
