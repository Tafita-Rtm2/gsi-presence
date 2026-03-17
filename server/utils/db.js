const path = require('path');
const fs = require('fs-extra');

const DB_PATH = path.join(__dirname, '../../data/db.json');

async function readDB() {
  try { return await fs.readJSON(DB_PATH); }
  catch { return { users: [], presences: [] }; }
}
async function writeDB(data) { await fs.writeJSON(DB_PATH, data, { spaces: 2 }); }

async function getUsers() { const db = await readDB(); return db.users || []; }

async function saveUser(user) {
  const db = await readDB();
  const idx = db.users.findIndex(u => u.id === user.id);
  if (idx >= 0) db.users[idx] = user; else db.users.push(user);
  await writeDB(db); return user;
}
async function deleteUser(id) {
  const db = await readDB();
  db.users = db.users.filter(u => u.id !== id);
  await writeDB(db);
}
async function getUserById(id) { const db = await readDB(); return db.users.find(u => u.id === id) || null; }
async function getUserByQR(qr) { const db = await readDB(); return db.users.find(u => u.qr_code === qr) || null; }
async function getUserByEmail(email) { const db = await readDB(); return db.users.find(u => u.email === email) || null; }

async function savePresence(presence) {
  const db = await readDB();
  if (!db.presences) db.presences = [];
  db.presences.push(presence);
  await writeDB(db); return presence;
}
async function getPresences(filters = {}) {
  const db = await readDB();
  let p = db.presences || [];
  if (filters.date) p = p.filter(x => x.date === filters.date);
  if (filters.userId) p = p.filter(x => x.user_id === filters.userId);
  if (filters.type) p = p.filter(x => x.type === filters.type);
  if (filters.month) p = p.filter(x => x.date && x.date.startsWith(filters.month));
  if (filters.year) p = p.filter(x => x.date && x.date.startsWith(filters.year));
  return p;
}
async function getTodayPresences() {
  return getPresences({ date: new Date().toISOString().split('T')[0] });
}

module.exports = { readDB, writeDB, getUsers, saveUser, deleteUser, getUserById, getUserByQR, getUserByEmail, savePresence, getPresences, getTodayPresences };

