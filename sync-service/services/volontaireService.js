const axios = require('axios');
const pool = require('../config/db');
const { getCheckpoint, saveCheckpoint } = require('./checkpointService');
const { getAccessToken } = require('./keycloakService');

const BASE = process.env.API_URL;
const PAGE_SIZE = 100;
const MODULE = 'volontaires';

function parseDate(val) {
    if (!val) return null;
    if (typeof val === 'number') return new Date(val).toISOString().split('T')[0];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        const [d, m, y] = val.split('/');
        return `${y}-${m}-${d}`;
    }
    return val;
}

async function upsertVdp(v) {
    const numeroCnib = v.noNip || null;

    const params = [
        v.nom                    || null,  // $1  nom
        v.prenoms                || null,  // $2  prenom
        parseDate(v.dtNaissance),          // $3  date_naissance
        v.lieuNaiss              || null,  // $4  lieu_naissance
        v.sexe                   || null,  // $5  sexe
        parseDate(v.dtCnib),               // $6  date_cnib
        v.etatContrat            || null,  // $7  statut_vdp
        v.situatMatrimo          || null,  // $8  statut_matrimonial
        v.nbEnfant               ?? null,  // $9  nb_enfants
        v.libelleCourtVolontaire || v.codeTypeVolontaire || null, // $10 type_vdp
        v.contact1               || null,  // $11 contacts
        v.contactPersPrev1       || null,  // $12 contact_urgence1
        v.contact2               || null,  // $13 contact_urgence2
        v.contact3               || null,  // $14 contact_urgence3
        v.personnePrev1          || null,  // $15 nom_personne_prevenir
        v.personnePrev2          || null,  // $16 lien_personne_prevenir
        v.noMatricule            || null,  // $17 no_matricule
        v.idIdentification       || null,  // $18 id_identification
        v.nomJf                  || null,  // $19 nom_jf
        v.niveauInstruction      || null,  // $20 niveau_instruction
        v.emploiTenu             || null,  // $21 emploi_tenu
        v.nomBapteme             || null,  // $22 nom_bapteme
        v.nomPromotion           || null,  // $23 nom_promotion
        v.idPromotion            || null,  // $24 id_promotion
        v.nbFemme                ?? null,  // $25 nb_femme
        v.contactPersPrev2       || null,  // $26 contact_pers_prev2
        v.localiteOrigine        || null,  // $27 localite_origine
        numeroCnib,                        // $28 numero_cnib
    ];

    const existing = await pool.query(
        'SELECT id FROM vdp WHERE numero_cnib = $1',
        [numeroCnib]
    );

    if (existing.rows.length > 0) {
        await pool.query(`
            UPDATE vdp SET
                nom = $1, prenom = $2, date_naissance = $3, lieu_naissance = $4,
                sexe = $5, date_cnib = $6, statut_vdp = $7, statut_matrimonial = $8,
                nb_enfants = $9, type_vdp = $10, contacts = $11,
                contact_urgence1 = $12, contact_urgence2 = $13, contact_urgence3 = $14,
                nom_personne_prevenir = $15, lien_personne_prevenir = $16,
                no_matricule = $17, id_identification = $18,
                nom_jf = $19, niveau_instruction = $20, emploi_tenu = $21,
                nom_bapteme = $22, nom_promotion = $23, id_promotion = $24,
                nb_femme = $25, contact_pers_prev2 = $26, localite_origine = $27,
                synced = true
            WHERE numero_cnib = $28
        `, params);
    } else {
        await pool.query(`
            INSERT INTO vdp (
                nom, prenom, date_naissance, lieu_naissance, sexe,
                date_cnib, statut_vdp, statut_matrimonial, nb_enfants, type_vdp,
                contacts, contact_urgence1, contact_urgence2, contact_urgence3,
                nom_personne_prevenir, lien_personne_prevenir,
                no_matricule, id_identification,
                nom_jf, niveau_instruction, emploi_tenu,
                nom_bapteme, nom_promotion, id_promotion,
                nb_femme, contact_pers_prev2, localite_origine,
                numero_cnib, synced
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,true
            )
        `, params);
    }
}

async function syncVolontaires(token) {
    const checkpoint = await getCheckpoint(MODULE);
    let page = checkpoint?.last_page ?? 0;
    let totalPages = null;
    let totalSynced = 0;

    console.log(`📄 Reprise depuis la page ${page}`);

    do {
        console.log(`📥 Page ${page}${totalPages ? `/${totalPages - 1}` : ''}`);

        const token = await getAccessToken(); // renouvelle si expiré
        const res = await axios.get(`${BASE}/volontaires/page`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { page, size: PAGE_SIZE }
        });

        const items  = res.data.content ?? res.data;
        const isLast = res.data.last    ?? (items.length < PAGE_SIZE);
        totalPages   = res.data.totalPages ?? null;

        for (const v of items) {
            await upsertVdp(v);
        }

        totalSynced += items.length;
        await saveCheckpoint(MODULE, page, 'in_progress');

        if (isLast) break;
        page++;

    } while (true);

    await saveCheckpoint(MODULE, 0, 'done');
    console.log(`✅ Volontaires sync OK — ${totalSynced} enregistrements traités`);
}

module.exports = { syncVolontaires };
