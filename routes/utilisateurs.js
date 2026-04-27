// routes/utilisateurs.js
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const roleMiddleware = require('../utils/roleMiddleware');
const db = require('../database/database');

const execAll = (sql, params = []) => db.all(sql, params);
const execGet = (sql, params = []) => db.get(sql, params);
const execRun = (sql, params = []) => db.run(sql, params);

const router = express.Router();

const TABLE = 'utilisateurs';
const SEARCH_FIELDS = ['nom', 'prenom', 'email', 'username'];
const SORTABLE_FIELDS = ['id', 'nom', 'prenom', 'email', 'created_at'];
const DEFAULT_STAT_LABEL = 'Non renseigné';

const nowISO = () => new Date().toISOString();

const sanitizeUser = (row = {}) => {
  const clone = { ...row };
  delete clone.password_hash;
  delete clone.roles;
  return clone;
};

const formatAggregatedUser = (row) => {
  const base = sanitizeUser(row);
  const labels = row.roles_concat
    ? row.roles_concat.split(',').map((val) => val.trim()).filter(Boolean)
    : [];
  const ids = row.role_ids_concat
    ? row.role_ids_concat
        .split(',')
        .map((val) => Number(val))
        .filter(Number.isFinite)
    : [];
  if (!labels.length && row.primary_role_nom) {
    labels.push(row.primary_role_nom);
  }
  if (!ids.length && Number.isFinite(Number(row.primary_role_id))) {
    ids.push(Number(row.primary_role_id));
  }
  delete base.roles_concat;
  delete base.role_ids_concat;
  delete base.primary_role_id;
  delete base.primary_role_nom;
  return {
    ...base,
    role_labels: labels,
    role_ids: ids,
    role_nom: labels.join(', ') || null,
  };
};

const formatSingleRoleUser = (row) => {
  const base = sanitizeUser(row);
  const label = base.role_nom ? [base.role_nom] : [];
  const ids =
    base.role_id !== undefined && base.role_id !== null && Number.isFinite(Number(base.role_id))
      ? [Number(base.role_id)]
      : [];
  return {
    ...base,
    role_labels: label,
    role_ids: ids,
  };
};

const tableCache = {};
async function tableExists(name) {
  if (tableCache[name] !== undefined) return tableCache[name];
  const exists = typeof db.tableExists === 'function'
    ? await db.tableExists(name)
    : !!(await execGet(
        "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name = ? LIMIT 1",
        [name]
      ));
  tableCache[name] = exists;
  return exists;
}

async function fetchGroupedStats({ join = '', labelExpr, idExpr = null }) {
  if (!labelExpr) {
    throw new Error('labelExpr requis pour fetchGroupedStats');
  }
  const idSelect = idExpr ? `${idExpr} AS id,` : '';
  const groupBy = idExpr ? 'id, label' : 'label';
  const sql = `
    SELECT ${idSelect} ${labelExpr} AS label, COUNT(DISTINCT u.id) AS total
    FROM ${TABLE} u
    ${join}
    WHERE u.deleted_at IS NULL
    GROUP BY ${groupBy}
    ORDER BY total DESC, label ASC
  `;
  const rows = await execAll(sql);
  return rows.map((row) => ({
    id: row.id ?? null,
    label: row.label || DEFAULT_STAT_LABEL,
    total: Number(row.total) || 0,
  }));
}

const USER_STAT_CONFIGS = [
  {
    key: 'byRole',
    join: 'LEFT JOIN roles pr ON pr.id = u.role_id',
    labelExpr: "COALESCE(pr.nom, 'Sans rôle')",
    idExpr: 'pr.id',
  },
  {
    key: 'byGrade',
    labelExpr: "COALESCE(NULLIF(TRIM(u.grade), ''), 'Grade non défini')",
  },
  {
    key: 'byEntite',
    join: 'LEFT JOIN entites e ON e.id = u.entite_id',
    labelExpr: "COALESCE(e.nom, 'Sans entité')",
    idExpr: 'e.id',
  },
  {
    key: 'bySousEntite',
    join: 'LEFT JOIN sous_entites se ON se.id = u.sous_entite_id',
    labelExpr: "COALESCE(se.nom, 'Sans sous-entité')",
    idExpr: 'se.id',
  },
  {
    key: 'byCoordinationRegionale',
    join: 'LEFT JOIN coordination_regionale cr ON cr.id = u.coordination_regionale_id',
    labelExpr: "COALESCE(cr.nom, 'Sans coord. régionale')",
    idExpr: 'cr.id',
  },
  {
    key: 'byCoordinationProvinciale',
    join: 'LEFT JOIN coordination_provinciale cp ON cp.id = u.coordination_provinciale_id',
    labelExpr: "COALESCE(cp.nom, 'Sans coord. provinciale')",
    idExpr: 'cp.id',
  },
  {
    key: 'byCoordinationCommunale',
    join: 'LEFT JOIN coordination_communale cc ON cc.id = u.coordination_communale_id',
    labelExpr: "COALESCE(cc.nom, 'Sans coord. communale')",
    idExpr: 'cc.id',
  },
];

const toRoleIds = (input) => {
  if (input === undefined || input === null) return null;
  if (Array.isArray(input)) {
    return input
      .map((value) => Number(value))
      .filter(Number.isFinite);
  }
  return String(input)
    .split(/[,|;]/)
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
};

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

async function syncUserRoles(userId, roleInput) {
  if (roleInput === undefined) return;
  const hasPivot = await tableExists('user_roles');
  if (!hasPivot) return;
  const roleIds = toRoleIds(roleInput);
  if (roleIds === null) return;
  await execRun('DELETE FROM user_roles WHERE user_id = ?', [userId]);
  if (!roleIds.length) return;
  for (const roleId of roleIds) {
    await execRun('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
  }
}

async function fetchUserById(id, includeDeleted = false) {
  const hasPivot = await tableExists('user_roles');
  if (hasPivot) {
    const row = await execGet(
      `
        SELECT
          u.*,
          e.nom  AS entite_nom,
          se.nom AS sous_entite_nom,
          cr.nom AS coordination_regionale_nom,
          cp.nom AS coordination_provinciale_nom,
          cc.nom AS coordination_communale_nom,
          pr.id  AS primary_role_id,
          pr.nom AS primary_role_nom,
          GROUP_CONCAT(DISTINCT r.nom) AS roles_concat,
          GROUP_CONCAT(DISTINCT r.id)  AS role_ids_concat
        FROM ${TABLE} u
        LEFT JOIN entites e ON e.id = u.entite_id
        LEFT JOIN sous_entites se ON se.id = u.sous_entite_id
        LEFT JOIN coordination_regionale cr ON cr.id = u.coordination_regionale_id
        LEFT JOIN coordination_provinciale cp ON cp.id = u.coordination_provinciale_id
        LEFT JOIN coordination_communale cc ON cc.id = u.coordination_communale_id
        LEFT JOIN roles pr ON pr.id = u.role_id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r       ON r.id = ur.role_id
        WHERE u.id = ?
        ${includeDeleted ? '' : 'AND u.deleted_at IS NULL'}
        GROUP BY u.id
      `,
      [id]
    );
    return row ? formatAggregatedUser(row) : null;
  }
  const row = await execGet(
    `
      SELECT
        u.*,
        e.nom  AS entite_nom,
        se.nom AS sous_entite_nom,
        cr.nom AS coordination_regionale_nom,
        cp.nom AS coordination_provinciale_nom,
        cc.nom AS coordination_communale_nom,
        r.nom AS role_nom
      FROM ${TABLE} u
      LEFT JOIN entites e ON e.id = u.entite_id
      LEFT JOIN sous_entites se ON se.id = u.sous_entite_id
      LEFT JOIN coordination_regionale cr ON cr.id = u.coordination_regionale_id
      LEFT JOIN coordination_provinciale cp ON cp.id = u.coordination_provinciale_id
      LEFT JOIN coordination_communale cc ON cc.id = u.coordination_communale_id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      ${includeDeleted ? '' : 'AND u.deleted_at IS NULL'}
    `,
    [id]
  );
  return row ? formatSingleRoleUser(row) : null;
}

const BASE_USER_SELECT = `
  SELECT
    u.*,
    e.nom  AS entite_nom,
    se.nom AS sous_entite_nom,
    cr.nom AS coordination_regionale_nom,
    cp.nom AS coordination_provinciale_nom,
    cc.nom AS coordination_communale_nom,
    pr.id  AS primary_role_id,
    pr.nom AS primary_role_nom,
    GROUP_CONCAT(DISTINCT r.nom) AS roles_concat,
    GROUP_CONCAT(DISTINCT r.id)  AS role_ids_concat
  FROM utilisateurs u
  LEFT JOIN entites e ON e.id = u.entite_id
  LEFT JOIN sous_entites se ON se.id = u.sous_entite_id
  LEFT JOIN coordination_regionale cr ON cr.id = u.coordination_regionale_id
  LEFT JOIN coordination_provinciale cp ON cp.id = u.coordination_provinciale_id
  LEFT JOIN coordination_communale cc ON cc.id = u.coordination_communale_id
  LEFT JOIN roles pr ON pr.id = u.role_id
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r       ON r.id = ur.role_id
`;

const buildUserListSql = (clauses = []) => {
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return `
    ${BASE_USER_SELECT}
    ${where}
    GROUP BY u.id
    ORDER BY COALESCE(u.updated_at, u.created_at) DESC
  `;
};

router.post(
  '/',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username = (body.username || body.nom_utilisateur || '').trim();
    const rawPassword = (body.password || body.mot_de_passe || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'username requis' });
    }
    if (!rawPassword) {
      return res.status(400).json({ error: 'password requis' });
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const now = nowISO();
    const payload = {
      nom: toNullableString(body.nom),
      prenom: toNullableString(body.prenom),
      grade: toNullableString(body.grade),
      contact: toNullableString(body.contact),
      email: toNullableString(body.email),
      username,
      password_hash: passwordHash,
      role_id: toNullableNumber(body.role_id),
      entite_id: toNullableNumber(body.entite_id),
      sous_entite_id: toNullableNumber(body.sous_entite_id),
      coordination_regionale_id: toNullableNumber(body.coordination_regionale_id),
      coordination_provinciale_id: toNullableNumber(body.coordination_provinciale_id),
      coordination_communale_id: toNullableNumber(body.coordination_communale_id),
      created_at: now,
      updated_at: now,
    };
    console.log('[utilisateurs] create payload', payload);
    const columns = Object.keys(payload);
    const placeholders = columns.map(() => '?').join(',');
    const result = await execRun(
      `INSERT INTO ${TABLE} (${columns.join(',')}) VALUES (${placeholders})`,
      Object.values(payload)
    );
    await syncUserRoles(result.lastID, body.roles ?? body.role_ids);
    const created = await fetchUserById(result.lastID);
    res.status(201).json(created);
  })
);

router.get(
  '/',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const { q, sortBy, sortDir, includeDeleted } = req.query || {};
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const hasPivot = await tableExists('user_roles');

    const filters = [];
    const params = [];

    if (includeDeleted !== 'true') {
      filters.push('u.deleted_at IS NULL');
    }
    if (q) {
      const like = `%${q}%`;
      filters.push(
        `(${SEARCH_FIELDS.map((field) => `u.${field} LIKE ?`).join(' OR ')})`
      );
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    const sql = buildUserListSql(filters);

    const queryParams = [...params];
    if (Number.isFinite(limit)) {
      sql += ' LIMIT ?';
      queryParams.push(limit);
      if (Number.isFinite(offset)) {
        sql += ' OFFSET ?';
        queryParams.push(offset);
      }
    }

    const rows = await execAll(sql, queryParams);
    const formatted = rows.map((row) =>
      hasPivot ? formatAggregatedUser(row) : formatSingleRoleUser(row)
    );

    let totalSql = `SELECT COUNT(*) AS cnt FROM ${TABLE} u`;
    const totalParams = [];
    if (includeDeleted !== 'true') {
      totalSql += ' WHERE u.deleted_at IS NULL';
    }
    if (q) {
      totalSql += includeDeleted === 'true' ? ' WHERE ' : ' AND ';
      totalSql += SEARCH_FIELDS.map((field) => `u.${field} LIKE ?`).join(' OR ');
      totalParams.push(...SEARCH_FIELDS.map(() => `%${q}%`));
    }
    if (!totalSql.includes('WHERE') && includeDeleted !== 'true' && !q) {
      // nothing to add
    }

    const totalRow = await execGet(totalSql, totalParams);
    res.json({ rows: formatted, total: totalRow?.cnt ?? formatted.length });
  })
);

router.get(
  '/stats',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const totalRow = await execGet(
      `SELECT COUNT(*) AS total FROM ${TABLE} u WHERE u.deleted_at IS NULL`
    );
    const response = {
      total: Number(totalRow?.total) || 0,
    };
    for (const config of USER_STAT_CONFIGS) {
      response[config.key] = await fetchGroupedStats(config);
    }
    res.json(response);
  })
);

router.get(
  '/:id',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const user = await fetchUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json(user);
  })
);

router.put(
  '/:id',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const existingRow = await execGet(
      `SELECT id FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!existingRow) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const body = req.body || {};
    console.log('[utilisateurs] raw body', body);
    const updates = {};
    if (body.nom !== undefined) updates.nom = toNullableString(body.nom);
    if (body.prenom !== undefined) updates.prenom = toNullableString(body.prenom);
    if (body.grade !== undefined) updates.grade = toNullableString(body.grade);
    if (body.contact !== undefined) updates.contact = toNullableString(body.contact);
    if (body.email !== undefined) updates.email = toNullableString(body.email);
    if (body.username !== undefined) {
      const nextUsername = String(body.username).trim();
      if (!nextUsername.length) {
        return res.status(400).json({ error: 'username requis' });
      }
      updates.username = nextUsername;
    }
    if (body.role_id !== undefined) updates.role_id = toNullableNumber(body.role_id);
    if (body.entite_id !== undefined) updates.entite_id = toNullableNumber(body.entite_id);
    if (body.sous_entite_id !== undefined) updates.sous_entite_id = toNullableNumber(body.sous_entite_id);
    if (body.coordination_regionale_id !== undefined)
      updates.coordination_regionale_id = toNullableNumber(body.coordination_regionale_id);
    if (body.coordination_provinciale_id !== undefined)
      updates.coordination_provinciale_id = toNullableNumber(body.coordination_provinciale_id);
    if (body.coordination_communale_id !== undefined)
      updates.coordination_communale_id = toNullableNumber(body.coordination_communale_id);

    const rawPassword =
      body.password || body.mot_de_passe || body.newPassword || '';
    if (typeof rawPassword === 'string' && rawPassword.trim()) {
      updates.password_hash = await bcrypt.hash(rawPassword.trim(), 10);
    }

    if (!Object.keys(updates).length && body.roles === undefined && body.role_ids === undefined) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour', body });
    }

    updates.updated_at = nowISO();
    console.log('[utilisateurs] update body', body);
    console.log('[utilisateurs] update set', updates);
    const setters = Object.keys(updates).map((key) => `${key} = ?`);
    await execRun(
      `UPDATE ${TABLE} SET ${setters.join(', ')} WHERE id = ?`,
      [...Object.values(updates), id]
    );

    if (body.roles !== undefined || body.role_ids !== undefined) {
      await syncUserRoles(id, body.roles ?? body.role_ids);
    }

    const updated = await fetchUserById(id);
    res.json(updated);
  })
);

router.put(
  '/:id/password',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const nextPassword = (req.body?.newPassword || req.body?.password || '').trim();
    if (!nextPassword || nextPassword.length < 6) {
      return res.status(400).json({ error: 'Mot de passe invalide (minimum 6 caractères)' });
    }

    const existingUser = await fetchUserById(id, true);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await execRun(
      `UPDATE ${TABLE} SET password_hash = ?, updated_at = ? WHERE id = ?`,
      [passwordHash, nowISO(), id]
    );

    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  roleMiddleware('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const hard = req.query.hard === 'true';

    if (hard) {
      await execRun(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
      await syncUserRoles(id, []);
      return res.json({ ok: true, id, hard: true });
    }

    const now = nowISO();
    const result = await execRun(
      `UPDATE ${TABLE} SET deleted_at = ? WHERE id = ?`,
      [now, id]
    );
    if (!result.changes) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json({ ok: true, id });
  })
);

module.exports = router;
