const i=t=>t==null||t===""?"—":t,l=t=>{if(!t)return"—";try{return new Date(t).toLocaleDateString("fr-FR")}catch{return t}},_=t=>{if(!t)return"—";try{return new Date(t).toLocaleString("fr-FR")}catch{return t}},v=t=>{if(!t)return null;if(typeof t=="string"){if(t.startsWith("data:"))return t;const e=t.replace(/\s+/g,"");if(/^[A-Za-z0-9+/=]+$/.test(e))return`data:image/jpeg;base64,${e}`}return null},c=(t,e="portrait")=>{const s=window.open("","_blank");if(!s){alert("Autorisez les popups pour imprimer.");return}s.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>BVDP — Dotation</title>
<style>
  @page { size: A4 ${e}; margin: 15mm 12mm; }
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
${t}
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`),s.document.close()},p=t=>(Array.isArray(t?.items)?t.items:[]).map(s=>({numero_serie:s.arme_numero_serie||s.numero_serie||`#${s.resource_id||s.arme_id||"?"}`,designation:s.arme_designation||s.designation||"—",type:s.arme_type||s.type||"—",etat:s.arme_etat||s.etat||"—",quantite:s.quantite||1,resource_type:s.resource_type||"arme"})),g=t=>{const e=t?.dotation||t,s=p(e),n=v(e.vdp_photo||e.photo),o=s.map((a,r)=>`
    <tr>
      <td class="num">${r+1}</td>
      <td>${i(a.numero_serie)}</td>
      <td>${i(a.designation)}</td>
      <td>${i(a.type)}</td>
      <td class="num">
        <span class="badge ${a.etat==="disponible"||a.etat==="bon"?"badge-green":"badge-grey"}">
          ${i(a.etat)}
        </span>
      </td>
      <td></td>
    </tr>`).join(""),d=`
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
      <div class="code">${i(e.code)}</div>
      <div>Date : ${l(e.date_dotation)}</div>
    </div>
  </div>

  <!-- BÉNÉFICIAIRE -->
  <div class="section">
    <div class="section-title">Bénéficiaire</div>
    <div class="benef-block">
      ${n?`<img class="benef-photo" src="${n}" alt="Photo VDP"/>`:'<div class="benef-photo-placeholder">Photo<br/>VDP</div>'}
      <div class="benef-info">
        <div class="grid2">
          <div class="field"><label>Nom</label><span>${i(e.vdp_nom)}</span></div>
          <div class="field"><label>Prénom</label><span>${i(e.vdp_prenom)}</span></div>
          <div class="field"><label>N° CNIB</label><span>${i(e.vdp_cnib||e.numero_cnib)}</span></div>
          <div class="field"><label>Contact</label><span>${i(e.contacts)}</span></div>
          <div class="field"><label>Entité</label><span>${i(e.entite_nom)}</span></div>
          <div class="field"><label>Sous-entité</label><span>${i(e.sous_entite_nom)}</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- SOURCE -->
  <div class="section">
    <div class="section-title">Informations de dotation</div>
    <div class="grid3">
      <div class="field"><label>Type</label><span>Dotation individuelle</span></div>
      <div class="field"><label>Date</label><span>${l(e.date_dotation)}</span></div>
      <div class="field"><label>Statut</label><span>${i(e.statut)}</span></div>
      <div class="field"><label>Magasin source</label><span>${i(e.magasin_source_nom||e.magasin_nom||(e.magasin_source_id?`Magasin #${e.magasin_source_id}`:null))}</span></div>
    </div>
  </div>

  <!-- ARMES -->
  <div class="section">
    <div class="section-title">Arme(s) dotée(s) — ${s.length} article(s)</div>
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
      <tbody>${o}</tbody>
    </table>
  </div>

  ${e.observation?`
  <div class="section">
    <div class="section-title">Observation</div>
    <div class="obs-box">${e.observation}</div>
  </div>`:""}

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
      <div class="sig-name">${i(e.vdp_nom)} ${i(e.vdp_prenom)}</div>
      <div class="sig-name">CNIB : ${i(e.vdp_cnib||e.numero_cnib)}</div>
      <div class="sig-line">Signature du bénéficiaire</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>BVDP — Dotation individuelle | Réf. ${i(e.code)}</span>
    <span>Imprimé le ${_(new Date)}</span>
  </div>
</div>`;c(d,"portrait")},b=t=>{const e=t?.dotation||t,s=p(e),n=s.length>8?"landscape":"portrait",o=s.map((a,r)=>`
    <tr>
      <td class="num">${r+1}</td>
      <td>${i(a.numero_serie)}</td>
      <td>${i(a.designation)}</td>
      <td>${i(a.type)}</td>
      <td class="num">
        <span class="badge ${a.etat==="disponible"||a.etat==="bon"?"badge-green":"badge-grey"}">
          ${i(a.etat)}
        </span>
      </td>
      <td class="num">${a.quantite}</td>
      <td></td>
    </tr>`).join(""),d=`
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
      <div class="code">${i(e.code)}</div>
      <div>Date : ${l(e.date_dotation)}</div>
    </div>
  </div>

  <!-- BÉNÉFICIAIRE -->
  <div class="section">
    <div class="section-title">Structure bénéficiaire</div>
    <div class="grid3">
      <div class="field"><label>Dénomination</label><span>${i(e.entite_nom||e.coordination_nom||e.sous_entite_nom)}</span></div>
      <div class="field"><label>Code</label><span>${i(e.entite_code||e.code_entite)}</span></div>
      <div class="field"><label>Coordination</label><span>${i(e.coordination_nom)}</span></div>
      <div class="field"><label>Région</label><span>${i(e.region_nom)}</span></div>
      <div class="field"><label>Province</label><span>${i(e.province_nom)}</span></div>
      <div class="field"><label>Commune</label><span>${i(e.commune_nom)}</span></div>
    </div>
  </div>

  <!-- SOURCE -->
  <div class="section">
    <div class="section-title">Informations de dotation</div>
    <div class="grid3">
      <div class="field"><label>Type</label><span>Dotation collective</span></div>
      <div class="field"><label>Date</label><span>${l(e.date_dotation)}</span></div>
      <div class="field"><label>Statut</label><span>${i(e.statut)}</span></div>
      <div class="field"><label>Magasin source</label><span>${i(e.magasin_source_nom||e.magasin_nom||(e.magasin_source_id?`Magasin #${e.magasin_source_id}`:null))}</span></div>
      <div class="field"><label>Nb articles</label><span>${s.length}</span></div>
    </div>
  </div>

  <!-- ARMES -->
  <div class="section">
    <div class="section-title">Liste des armes remises — ${s.length} article(s)</div>
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
      <tbody>${o}</tbody>
    </table>
  </div>

  ${e.observation?`
  <div class="section">
    <div class="section-title">Observation générale</div>
    <div class="obs-box">${e.observation}</div>
  </div>`:""}

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
    <span>BVDP — PV dotation collective | Réf. ${i(e.code)}</span>
    <span>Imprimé le ${_(new Date)}</span>
  </div>
</div>`;c(d,n)},m=(t,e=[])=>{const s=e.filter(d=>d.resource_type==="arme"||!d.resource_type),n=s.map((d,a)=>`
    <tr>
      <td class="num">${a+1}</td>
      <td>${i(d.numero_serie)}</td>
      <td>${i(d.designation)}</td>
      <td>${i(d.type||d.resource_type)}</td>
      <td class="num"><span class="badge badge-blue">${d.quantite??1}</span></td>
      <td>${i(d.etat)}</td>
    </tr>`).join(""),o=`
<div class="page">
  <div class="header">
    <div class="header-logo-placeholder">BVDP<br/>Logo</div>
    <div class="header-title">
      <h1>Volontaires pour la Défense et la Protection (BVDP)</h1>
      <h2>INVENTAIRE DU MAGASIN — ${(t?.nom||"").toUpperCase()}</h2>
    </div>
    <div class="header-ref">
      <div>Code : <strong>${i(t?.code)}</strong></div>
      <div>Date : ${l(new Date)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Informations du magasin</div>
    <div class="grid3">
      <div class="field"><label>Nom</label><span>${i(t?.nom)}</span></div>
      <div class="field"><label>Niveau</label><span>${i(t?.niveau)}</span></div>
      <div class="field"><label>Responsable</label><span>${t?.gestionnaire_nom?`${t.gestionnaire_nom} ${t.gestionnaire_prenom||""}`:"—"}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Stock actuel — ${s.length} ligne(s)</div>
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
      <tbody>${n||'<tr><td colspan="6" style="text-align:center;color:#999">Aucun article en stock</td></tr>'}</tbody>
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
    <span>BVDP — Inventaire magasin ${i(t?.code)}</span>
    <span>Imprimé le ${_(new Date)}</span>
  </div>
</div>`;c(o,"portrait")};export{g as a,m as b,b as p};
