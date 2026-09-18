/**
 * dotationPrint.js — Génération de fiches imprimables pour les dotations
 *
 * printBordereauIndividuel(dotation)  → fiche A4 portrait (dotation individuelle VDP)
 * printPVCollectif(dotation)          → PV A4 portrait/paysage (dotation collective entité)
 * printListeMagasin(magasin, stock)   → liste armes en stock par magasin
 */

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const fmt = (v) => (v == null || v === '' ? '—' : v);

const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('fr-FR'); } catch { return v; }
};

const fmtDateTime = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('fr-FR'); } catch { return v; }
};

const ensureDataUrl = (input) => {
  if (!input) return null;
  if (typeof input === 'string') {
    if (input.startsWith('data:')) return input;
    const t = input.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(t)) return `data:image/jpeg;base64,${t}`;
  }
  return null;
};

const openPrintWindow = (html, orientation = 'portrait') => {
  const w = window.open('', '_blank');
  if (!w) { alert('Autorisez les popups pour imprimer.'); return; }
  w.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>BVDP — Dotation</title>
<style>
  @page { size: A4 ${orientation}; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #1a1a1a; }
  .page { width: 100%; }

  /* ── Header ── */
  .header { display: flex; align-items: center; border-bottom: 2.5px solid #003087; padding-bottom: 8px; margin-bottom: 12px; }
  .header-logo { width: 60px; height: 60px; margin-right: 14px; object-fit: contain; }
  .header-logo-placeholder { width: 60px; height: 60px; margin-right: 14px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999; text-align: center; flex-shrink: 0; }
  .header-title h1 { font-size: 13pt; color: #003087; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-title h2 { font-size: 10pt; color: #555; font-weight: normal; margin-top: 2px; }
  .header-ref { margin-left: auto; text-align: right; font-size: 9pt; color: #555; }
  .header-ref .code { font-size: 12pt; font-weight: bold; color: #003087; }

  /* ── Section ── */
  .section { margin-bottom: 10px; }
  .section-title { background: #003087; color: white; font-weight: bold; font-size: 9pt;
    padding: 3px 8px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }

  /* ── Grid ── */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; }
  .field { margin-bottom: 3px; }
  .field label { font-size: 8pt; color: #666; display: block; }
  .field span { font-size: 10pt; font-weight: 500; }

  /* ── VDP block ── */
  .benef-block { display: flex; gap: 12px; align-items: flex-start; }
  .benef-photo { width: 80px; height: 90px; object-fit: cover; border: 1px solid #ccc; flex-shrink: 0; }
  .benef-photo-placeholder { width: 80px; height: 90px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #aaa; flex-shrink: 0; text-align: center; }
  .benef-info { flex: 1; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table th { background: #e8edf5; color: #003087; font-weight: bold; border: 1px solid #aab; padding: 4px 6px; text-align: left; }
  table td { border: 1px solid #ccd; padding: 4px 6px; vertical-align: top; }
  table tr:nth-child(even) td { background: #f7f9fc; }
  .num { text-align: center; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8pt; font-weight: bold; }
  .badge-green { background: #e6f7e9; color: #237c3a; }
  .badge-blue  { background: #e6f0ff; color: #1a56b0; }
  .badge-red   { background: #ffe6e6; color: #b01a1a; }
  .badge-grey  { background: #f0f0f0; color: #555; }

  /* ── Signatures ── */
  .signatures { display: grid; gap: 20px; margin-top: 14px; }
  .sig-box { border-top: 1px solid #aab; padding-top: 6px; }
  .sig-box .sig-title { font-weight: bold; font-size: 9pt; margin-bottom: 4px; }
  .sig-box .sig-name { font-size: 9pt; margin-bottom: 2px; }
  .sig-box .sig-line { margin-top: 28px; border-top: 1px solid #555; width: 70%; font-size: 8pt; color: #666; padding-top: 2px; }

  /* ── Footer ── */
  .footer { border-top: 1px solid #ccc; padding-top: 6px; margin-top: 10px; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }

  /* ── Observation ── */
  .obs-box { border: 1px solid #ddd; padding: 6px 8px; font-size: 9pt; color: #333; min-height: 30px; background: #fafafa; }

  /* ── Print only ── */
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
${html}
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`);
  w.document.close();
};

/* ── Items helpers ──────────────────────────────────────────────────────────── */

const collectItems = (dotation) => {
  const items = Array.isArray(dotation?.items) ? dotation.items : [];
  return items.map((it) => ({
    numero_serie: it.arme_numero_serie || it.numero_serie || `#${it.resource_id || it.arme_id || '?'}`,
    designation:  it.arme_designation  || it.designation  || '—',
    type:         it.arme_type         || it.type         || '—',
    etat:         it.arme_etat         || it.etat         || '—',
    quantite:     it.quantite          || 1,
    resource_type: it.resource_type    || 'arme',
  }));
};

/* ── BORDEREAU INDIVIDUEL ─────────────────────────────────────────────────── */

export const printBordereauIndividuel = (dotation) => {
  const d    = dotation?.dotation || dotation;
  const items = collectItems(d);
  const photoSrc = ensureDataUrl(d.vdp_photo || d.photo);

  const armeRows = items.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${fmt(it.numero_serie)}</td>
      <td>${fmt(it.designation)}</td>
      <td>${fmt(it.type)}</td>
      <td class="num">
        <span class="badge ${it.etat === 'disponible' || it.etat === 'bon' ? 'badge-green' : 'badge-grey'}">
          ${fmt(it.etat)}
        </span>
      </td>
      <td></td>
    </tr>`).join('');

  const html = `
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-logo-placeholder">BVDP<br/>Logo</div>
    <div class="header-title">
      <h1>Volontaires pour la Défense et la Protection (BVDP)</h1>
      <h2>BORDEREAU DE DOTATION INDIVIDUELLE D'ARME</h2>
    </div>
    <div class="header-ref">
      <div>Réf. :</div>
      <div class="code">${fmt(d.code)}</div>
      <div>Date : ${fmtDate(d.date_dotation)}</div>
    </div>
  </div>

  <!-- BÉNÉFICIAIRE -->
  <div class="section">
    <div class="section-title">Bénéficiaire</div>
    <div class="benef-block">
      ${photoSrc
        ? `<img class="benef-photo" src="${photoSrc}" alt="Photo VDP"/>`
        : `<div class="benef-photo-placeholder">Photo<br/>VDP</div>`}
      <div class="benef-info">
        <div class="grid2">
          <div class="field"><label>Nom</label><span>${fmt(d.vdp_nom)}</span></div>
          <div class="field"><label>Prénom</label><span>${fmt(d.vdp_prenom)}</span></div>
          <div class="field"><label>N° CNIB</label><span>${fmt(d.vdp_cnib || d.numero_cnib)}</span></div>
          <div class="field"><label>Contact</label><span>${fmt(d.contacts)}</span></div>
          <div class="field"><label>Entité</label><span>${fmt(d.entite_nom)}</span></div>
          <div class="field"><label>Sous-entité</label><span>${fmt(d.sous_entite_nom)}</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- SOURCE -->
  <div class="section">
    <div class="section-title">Informations de dotation</div>
    <div class="grid3">
      <div class="field"><label>Type</label><span>Dotation individuelle</span></div>
      <div class="field"><label>Date</label><span>${fmtDate(d.date_dotation)}</span></div>
      <div class="field"><label>Statut</label><span>${fmt(d.statut)}</span></div>
      <div class="field"><label>Magasin source</label><span>${fmt(d.magasin_source_nom || d.magasin_nom || (d.magasin_source_id ? `Magasin #${d.magasin_source_id}` : null))}</span></div>
    </div>
  </div>

  <!-- ARMES -->
  <div class="section">
    <div class="section-title">Arme(s) dotée(s) — ${items.length} article(s)</div>
    <table>
      <thead>
        <tr>
          <th class="num" style="width:30px">N°</th>
          <th>N° Série / Référence</th>
          <th>Désignation</th>
          <th>Type</th>
          <th style="width:80px">État</th>
          <th>Observation</th>
        </tr>
      </thead>
      <tbody>${armeRows}</tbody>
    </table>
  </div>

  ${d.observation ? `
  <div class="section">
    <div class="section-title">Observation</div>
    <div class="obs-box">${d.observation}</div>
  </div>` : ''}

  <!-- SIGNATURES -->
  <div class="signatures" style="grid-template-columns: 1fr 1fr;">
    <div class="sig-box">
      <div class="sig-title">Agent responsable de la dotation</div>
      <div class="sig-name">Nom : ___________________________________</div>
      <div class="sig-name">Grade / Fonction : _______________________</div>
      <div class="sig-line">Signature et cachet</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Bénéficiaire (VDP)</div>
      <div class="sig-name">${fmt(d.vdp_nom)} ${fmt(d.vdp_prenom)}</div>
      <div class="sig-name">CNIB : ${fmt(d.vdp_cnib || d.numero_cnib)}</div>
      <div class="sig-line">Signature du bénéficiaire</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>BVDP — Dotation individuelle | Réf. ${fmt(d.code)}</span>
    <span>Imprimé le ${fmtDateTime(new Date())}</span>
  </div>
</div>`;

  openPrintWindow(html, 'portrait');
};

/* ── PV COLLECTIF ─────────────────────────────────────────────────────────── */

export const printPVCollectif = (dotation) => {
  const d    = dotation?.dotation || dotation;
  const items = collectItems(d);
  const orientation = items.length > 8 ? 'landscape' : 'portrait';

  const armeRows = items.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${fmt(it.numero_serie)}</td>
      <td>${fmt(it.designation)}</td>
      <td>${fmt(it.type)}</td>
      <td class="num">
        <span class="badge ${it.etat === 'disponible' || it.etat === 'bon' ? 'badge-green' : 'badge-grey'}">
          ${fmt(it.etat)}
        </span>
      </td>
      <td class="num">${it.quantite}</td>
      <td></td>
    </tr>`).join('');

  const html = `
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-logo-placeholder">BVDP<br/>Logo</div>
    <div class="header-title">
      <h1>Volontaires pour la Défense et la Protection (BVDP)</h1>
      <h2>PROCÈS-VERBAL DE REMISE COLLECTIVE D'ARMES</h2>
    </div>
    <div class="header-ref">
      <div>Réf. :</div>
      <div class="code">${fmt(d.code)}</div>
      <div>Date : ${fmtDate(d.date_dotation)}</div>
    </div>
  </div>

  <!-- BÉNÉFICIAIRE -->
  <div class="section">
    <div class="section-title">Structure bénéficiaire</div>
    <div class="grid3">
      <div class="field"><label>Dénomination</label><span>${fmt(d.entite_nom || d.coordination_nom || d.sous_entite_nom)}</span></div>
      <div class="field"><label>Code</label><span>${fmt(d.entite_code || d.code_entite)}</span></div>
      <div class="field"><label>Coordination</label><span>${fmt(d.coordination_nom)}</span></div>
      <div class="field"><label>Région</label><span>${fmt(d.region_nom)}</span></div>
      <div class="field"><label>Province</label><span>${fmt(d.province_nom)}</span></div>
      <div class="field"><label>Commune</label><span>${fmt(d.commune_nom)}</span></div>
    </div>
  </div>

  <!-- SOURCE -->
  <div class="section">
    <div class="section-title">Informations de dotation</div>
    <div class="grid3">
      <div class="field"><label>Type</label><span>Dotation collective</span></div>
      <div class="field"><label>Date</label><span>${fmtDate(d.date_dotation)}</span></div>
      <div class="field"><label>Statut</label><span>${fmt(d.statut)}</span></div>
      <div class="field"><label>Magasin source</label><span>${fmt(d.magasin_source_nom || d.magasin_nom || (d.magasin_source_id ? `Magasin #${d.magasin_source_id}` : null))}</span></div>
      <div class="field"><label>Nb articles</label><span>${items.length}</span></div>
    </div>
  </div>

  <!-- ARMES -->
  <div class="section">
    <div class="section-title">Liste des armes remises — ${items.length} article(s)</div>
    <table>
      <thead>
        <tr>
          <th class="num" style="width:30px">N°</th>
          <th>N° Série / Référence</th>
          <th>Désignation</th>
          <th>Type</th>
          <th style="width:80px">État</th>
          <th class="num" style="width:40px">Qté</th>
          <th>Observation / Condition</th>
        </tr>
      </thead>
      <tbody>${armeRows}</tbody>
    </table>
  </div>

  ${d.observation ? `
  <div class="section">
    <div class="section-title">Observation générale</div>
    <div class="obs-box">${d.observation}</div>
  </div>` : ''}

  <!-- SIGNATURES -->
  <div class="signatures" style="grid-template-columns: 1fr 1fr 1fr;">
    <div class="sig-box">
      <div class="sig-title">Gestionnaire du magasin source</div>
      <div class="sig-name">Nom : ___________________________________</div>
      <div class="sig-name">Fonction : ______________________________</div>
      <div class="sig-line">Signature et cachet</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Représentant de la structure bénéficiaire</div>
      <div class="sig-name">Nom : ___________________________________</div>
      <div class="sig-name">Fonction : ______________________________</div>
      <div class="sig-line">Signature et cachet</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Témoin / Superviseur</div>
      <div class="sig-name">Nom : ___________________________________</div>
      <div class="sig-name">Fonction : ______________________________</div>
      <div class="sig-line">Signature</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>BVDP — PV dotation collective | Réf. ${fmt(d.code)}</span>
    <span>Imprimé le ${fmtDateTime(new Date())}</span>
  </div>
</div>`;

  openPrintWindow(html, orientation);
};

/* ── LISTE PAR MAGASIN ────────────────────────────────────────────────────── */

export const printListeMagasin = (magasin, stock = []) => {
  const armeStock = stock.filter((s) => s.resource_type === 'arme' || !s.resource_type);

  const rows = armeStock.map((s, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${fmt(s.numero_serie)}</td>
      <td>${fmt(s.designation)}</td>
      <td>${fmt(s.type || s.resource_type)}</td>
      <td class="num"><span class="badge badge-blue">${s.quantite ?? 1}</span></td>
      <td>${fmt(s.etat)}</td>
    </tr>`).join('');

  const html = `
<div class="page">
  <div class="header">
    <div class="header-logo-placeholder">BVDP<br/>Logo</div>
    <div class="header-title">
      <h1>Volontaires pour la Défense et la Protection (BVDP)</h1>
      <h2>INVENTAIRE DU MAGASIN — ${(magasin?.nom || '').toUpperCase()}</h2>
    </div>
    <div class="header-ref">
      <div>Code : <strong>${fmt(magasin?.code)}</strong></div>
      <div>Date : ${fmtDate(new Date())}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Informations du magasin</div>
    <div class="grid3">
      <div class="field"><label>Nom</label><span>${fmt(magasin?.nom)}</span></div>
      <div class="field"><label>Niveau</label><span>${fmt(magasin?.niveau)}</span></div>
      <div class="field"><label>Responsable</label><span>${magasin?.gestionnaire_nom ? `${magasin.gestionnaire_nom} ${magasin.gestionnaire_prenom || ''}` : '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Stock actuel — ${armeStock.length} ligne(s)</div>
    <table>
      <thead>
        <tr>
          <th class="num">N°</th>
          <th>N° Série / Référence</th>
          <th>Désignation</th>
          <th>Type</th>
          <th class="num">Qté</th>
          <th>État</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999">Aucun article en stock</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Certifications</div>
    <div class="grid2" style="margin-top:6px">
      <div class="sig-box">
        <div class="sig-title">Gestionnaire du magasin</div>
        <div class="sig-name">Nom : ___________________________________</div>
        <div class="sig-line">Signature et cachet</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">Superviseur</div>
        <div class="sig-name">Nom : ___________________________________</div>
        <div class="sig-line">Signature</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>BVDP — Inventaire magasin ${fmt(magasin?.code)}</span>
    <span>Imprimé le ${fmtDateTime(new Date())}</span>
  </div>
</div>`;

  openPrintWindow(html, 'portrait');
};
