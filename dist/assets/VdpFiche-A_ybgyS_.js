import{r,f as Ce,a as Ne,e as W,j as i,S as Se}from"./index-CtHPLFdv.js";import{P as u,T as ie,a as ne,b as D,c as A,d as Ae,e as Oe,F as ze}from"./index-rrb6PML1.js";import{h as Q}from"./moment-B-YVwB4U.js";import{M as Ie}from"./index-DpDWAvrJ.js";import{s as J}from"./index-RDPXErcB.js";import{C}from"./index-DUK1egeB.js";import{R as k,C as v}from"./row-D9ZTaTvs.js";import{S as Y}from"./index-CXpdMUlQ.js";import{A as Re}from"./index-B_5sCBSo.js";import{R as Pe}from"./UserOutlined-DjC3pNMS.js";import{T as re}from"./index-Dw-hpPUX.js";import{S as se}from"./index-DyZcxu5Z.js";import{D as De}from"./index-C3yMoXjl.js";import{D as y}from"./index-B71bantX.js";import{B as T}from"./button-CgQ4ael-.js";import{R as ke}from"./PrinterOutlined-Cvf-b-ec.js";import{R as Te}from"./FileWordOutlined-BdmhxBI2.js";import{R as ae}from"./ArrowLeftOutlined-vvKSHi8a.js";import{I as Le}from"./AntdIcon-CWJxPu1m.js";import"./InfoCircleFilled-j5IoLnqa.js";import"./useBreakpoint-B4QN9pDU.js";import"./ActionButton-CjMdM_tS.js";import"./ContextIsolator-DlX_0Hdr.js";import"./Skeleton-CMOB5rzJ.js";import"./context-2xcN-vVU.js";import"./index-CH5g8BdY.js";import"./useClosable-Bi0Qb7aM.js";import"./extendsObject-78o_rR5W.js";import"./PurePanel-B1eXZPtq.js";import"./EllipsisOutlined-BTKS4bhM.js";import"./Overflow-C3MG8MYX.js";import"./PlusOutlined-ByZyTB3m.js";import"./index-COVbtRWC.js";import"./index-DgdC4e8W.js";var Ve={icon:{tag:"svg",attrs:{viewBox:"64 64 896 896",focusable:"false"},children:[{tag:"path",attrs:{d:"M869 487.8L491.2 159.9c-2.9-2.5-6.6-3.9-10.5-3.9h-88.5c-7.4 0-10.8 9.2-5.2 14l350.2 304H152c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h585.1L386.9 854c-5.6 4.9-2.2 14 5.2 14h91.5c1.9 0 3.8-.7 5.2-2L869 536.2a32.07 32.07 0 000-48.4z"}}]},name:"arrow-right",theme:"outlined"};function K(){return K=Object.assign?Object.assign.bind():function(n){for(var a=1;a<arguments.length;a++){var t=arguments[a];for(var h in t)Object.prototype.hasOwnProperty.call(t,h)&&(n[h]=t[h])}return n},K.apply(this,arguments)}const Ee=(n,a)=>r.createElement(Le,K({},n,{ref:a,icon:Ve})),Be=r.forwardRef(Ee),Me={},oe=()=>{const n=window.api?.client?.defaults?.baseURL||window.api?.baseURL||window.api?.API_BASE_URL||Me?.VITE_API_URL;return n?String(n).replace(/\/$/,""):typeof window<"u"&&window.location?.origin?`${window.location.origin.replace(/\/$/,"")}/api`:"http://127.0.0.1:3001/api"},le=async(n,a,t=null)=>{const h=a.startsWith("/")?`${oe()}${a}`:`${oe()}/${a}`,f={method:n,headers:{"Content-Type":"application/json"},credentials:"include"};try{const w=localStorage.getItem("auth-token")||localStorage.getItem("auth_token");w&&(f.headers.Authorization=w.startsWith("Bearer ")?w:`Bearer ${w}`)}catch{}if(t&&typeof t=="object"){const w=new URLSearchParams(Object.entries(t).filter(([,j])=>j!=null&&j!=="")).toString(),O=await fetch(w?`${h}?${w}`:h,f);if(!O.ok)throw new Error(`HTTP ${O.status}`);return O.status===204?null:O.json()}const m=await fetch(h,f);if(!m.ok)throw new Error(`HTTP ${m.status}`);return m.status===204?null:m.json()},Fe=n=>n?Array.isArray(n)?n[0]||null:Array.isArray(n?.rows)?n.rows[0]||null:Array.isArray(n?.data)?n.data[0]||null:n.data&&typeof n.data=="object"?n.data:n.item&&typeof n.item=="object"?n.item:typeof n=="object"?n:null:null,He=(n,a)=>{const t=Array.isArray(n)?n:Array.isArray(n?.rows)?n.rows:Array.isArray(n?.data)?n.data:[],h=String(a);return t.find(f=>[f?.id,f?.ID,f?.uuid,f?.UUID].filter(m=>m!=null).some(m=>String(m)===h))||null};function Nt(){const{id:n}=Ce(),a=Ne(),[t,h]=r.useState(null),[f,m]=r.useState(!0),[w,O]=r.useState([]),[j,qe]=r.useState({prev:null,next:null}),[L,Ue]=r.useState(null),X=r.useCallback(async()=>{m(!0);try{const e=Number.isNaN(Number(n))?n:Number(n),l=[async()=>window.api?.call?.("getVdp",{id:n}),async()=>window.api?.call?.("getVdpById",e),async()=>typeof W?.getVdpById=="function"?W.getVdpById(e):null,async()=>le("GET",`/vdp/${n}`)];let s=null,o=null;for(const g of l)try{const _=await g();if(s=Fe(_),s)break}catch(_){o=_}if(!s){const g=[async()=>window.api?.call?.("getVdpList"),async()=>typeof W?.getVdpList=="function"?W.getVdpList():null,async()=>le("GET","/vdp")];for(const _ of g)try{const b=await _();if(s=He(b,e),s)break}catch(b){o=b}}if(!s)return console.error("[VdpFiche] VDP introuvable :",o),Ie.error({title:"Introuvable",content:"Aucun VDP trouvé pour cet identifiant."}),a("/dashboard/vdp",{replace:!0});h(s)}catch(e){console.error("loadVdp",e),J.error("Erreur lors du chargement de la fiche VDP.")}finally{m(!1)}},[n,a]);r.useEffect(()=>{X()},[X]);const z=r.useMemo(()=>!t?.photo||typeof t.photo!="string"?null:/^data:|^https?:\/\//i.test(t.photo)?t.photo:`data:image/jpeg;base64,${t.photo}`,[t?.photo]),Z=r.useMemo(()=>t?.date_naissance?Q().diff(Q(t.date_naissance),"years"):null,[t?.date_naissance]),ce=r.useMemo(()=>t?.statut_vdp==="En service"?"green":"volcano",[t?.statut_vdp]),G=r.useMemo(()=>t?.code_qr?t.code_qr.startsWith("data:")?t.code_qr:`data:image/png;base64,${t.code_qr}`:null,[t?.code_qr]),V=r.useMemo(()=>{const e=s=>!s||typeof s!="string"?null:s.startsWith("data:")?s:`data:image/png;base64,${s}`;return[{key:"vdp",label:"Signature du VDP",name:[t?.nom,t?.prenom].filter(Boolean).join(" ").trim()||"_____________________",src:e(t?.signature_vdp_url||t?.signature_vdp||t?.signature_agent||t?.signature)||null},{key:"chef",label:"Signature du Chef",name:t?.chef_nom||t?.chef_responsable||t?.responsable||"_____________________",src:e(t?.signature_chef_url||t?.signature_chef||t?.signature_responsable)||null}]},[t]),N=r.useCallback(e=>e?Q(e).format("DD/MM/YYYY"):"N/C",[]),d=r.useMemo(()=>[{title:"Identité",rows:[{label:"Nom",value:t?.nom||"N/C"},{label:"Prénom",value:t?.prenom||"N/C"},{label:"Sexe",value:t?.sexe||"N/C"},{label:"Date de naissance",value:N(t?.date_naissance)},{label:"Lieu de naissance",value:t?.lieu_naissance||"N/C"},{label:"Statut matrimonial",value:t?.statut_matrimonial||"N/C"},{label:"Nombre d'enfants",value:t?.nb_enfants??"N/C"}]},{title:"Documents",rows:[{label:"Numéro CNIB",value:t?.numero_cnib||"N/C"},{label:"Date CNIB",value:N(t?.date_cnib)},{label:"Type VDP",value:t?.type_vdp||"N/C"},{label:"Date de recrutement",value:N(t?.date_recrutement)},{label:"Statut VDP",value:t?.statut_vdp||"N/C"}]},{title:"Coordonnées",rows:[{label:"Contact principal",value:t?.contacts||"N/C"},{label:"Contact d'urgence 1",value:t?.contact_urgence1||"N/C"},{label:"Contact d'urgence 2",value:t?.contact_urgence2||"N/C"},{label:"Contact d'urgence 3",value:t?.contact_urgence3||"N/C"},{label:"Personne à prévenir",value:t?.nom_personne_prevenir||"N/C"},{label:"Lien",value:t?.lien_personne_prevenir||"N/C"}]},{title:"Localisation",rows:[{label:"Entité",value:t?.entite_nom||"N/C"},{label:"Sous-entité",value:t?.sous_entite_nom||"N/C"},{label:"Coordination",value:t?.coordination_nom||"N/C"},{label:"Région",value:t?.region_nom||"N/C"},{label:"Province",value:t?.province_nom||"N/C"},{label:"Commune",value:t?.commune_nom||"N/C"},{label:"Localité",value:t?.localite_nom||"N/C"}]},{title:"Observations",rows:[{label:"Observations",value:t?.observation||"Aucune remarque"}]}],[t,N]),de=r.useMemo(()=>d.find(e=>e.title==="Identité"),[d]),pe=r.useMemo(()=>d.find(e=>e.title==="Documents"),[d]),ue=r.useMemo(()=>d.find(e=>e.title==="Coordonnées"),[d]),me=r.useMemo(()=>d.find(e=>e.title==="Localisation"),[d]),ge=r.useMemo(()=>d.find(e=>e.title==="Observations"),[d]),I=de?.rows||[],E=pe?.rows||[],R=ue?.rows||[],B=me?.rows||[],_e=ge?.rows?.[0]?.value||"Aucune remarque",he=r.useMemo(()=>t?.sexe==="Féminin"?"magenta":t?.sexe==="Masculin"?"geekblue":"gold",[t?.sexe]),fe=r.useMemo(()=>[{label:"Date de recrutement",value:N(t?.date_recrutement)},{label:"Statut VDP",value:t?.statut_vdp||"N/C"},{label:"Type VDP",value:t?.type_vdp||"N/C"}],[N,t?.date_recrutement,t?.statut_vdp,t?.type_vdp]),S=r.useMemo(()=>({borderRadius:18,boxShadow:"0 18px 40px -28px rgba(15,76,58,0.55)"}),[]),M=r.useCallback(()=>{const e=L&&typeof L=="object"?L:null,l=[t?.nom,t?.prenom].filter(Boolean).join(" ").trim(),s=e?.documentTitle||e?.headerTitle||"Fiche VDP",o=l?`${s} — ${l}`:s,g=[],_=[];if(!e)return{documentTitle:o,headerHtml:"",footerHtml:"",headerLines:g,footerLines:_};e.ministere&&g.push(e.ministere),Array.isArray(e.institutions)&&g.push(...e.institutions.map(x=>x?.text).filter(Boolean)),e.pays&&g.push(e.pays);const b=e.separator&&e.separatorLength?`<div style="font-weight:bold;color:${e.separatorColor||"#222"};">${e.separator.repeat(e.separatorLength)}</div>`:"",F=Array.isArray(e.institutions)?e.institutions.map(x=>`<div style="font-weight:${x?.bold?"bold":"normal"};font-style:${x?.italic?"italic":"normal"};text-decoration:${x?.underline?"underline":"none"};color:${x?.color||"#222"};font-size:${e.institFontSize||14}px;">${x?.text||""}</div>`).join(b||""):"",p=`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div style="flex:2;min-width:180px;text-align:${e.ministere?"left":"center"};">
          ${e.ministere?`<div style="font-weight:bold;font-size:${e.ministereFontSize||16}px;">${e.ministere}</div>`:""}
          ${b}
          ${F}
        </div>
        <div style="flex:1;text-align:center;">
          ${e.logoUrl?`<img src="${e.logoUrl}" alt="Logo" style="max-height:60px;object-fit:contain;" />`:""}
        </div>
        <div style="flex:1;min-width:180px;text-align:${e.styleOptions?.pays?.align||"right"};font-family:${e.styleOptions?.pays?.fontFamily||"inherit"};">
          ${e.pays?`<div style="font-weight:${e.styleOptions?.pays?.bold?"bold":"normal"};font-style:${e.styleOptions?.pays?.italic?"italic":"normal"};text-decoration:${e.styleOptions?.pays?.underline?"underline":"none"};color:${e.styleOptions?.pays?.color||"#222"};font-size:${e.styleOptions?.pays?.fontSize||16}px;">${e.pays}</div>`:""}
          ${e.styleOptions?.paysSeparator?.char&&e.styleOptions?.paysSeparator?.count?`<div style="color:${e.styleOptions.paysSeparator.color||"#222"};font-weight:${e.styleOptions.paysSeparator.bold?"bold":"normal"};font-style:${e.styleOptions.paysSeparator.italic?"italic":"normal"};text-decoration:${e.styleOptions.paysSeparator.underline?"underline":"none"};font-family:${e.styleOptions.paysSeparator.fontFamily||"inherit"};font-size:${e.styleOptions.paysSeparator.fontSize||14}px;text-align:${e.styleOptions.paysSeparator.align||"right"};">${e.styleOptions.paysSeparator.char.repeat(e.styleOptions.paysSeparator.count)}</div>`:""}
          ${e.devise?`<div style="font-style:${e.styleOptions?.devise?.italic?"italic":"normal"};font-weight:${e.styleOptions?.devise?.bold?"bold":"normal"};text-decoration:${e.styleOptions?.devise?.underline?"underline":"none"};color:${e.styleOptions?.devise?.color||"#222"};font-size:${e.styleOptions?.devise?.fontSize||14}px;">${e.devise}</div>`:""}
        </div>
      </div>
    `,H=e.signataire?`
        <div style="display:flex;justify-content:${e.signataireAlign||"right"};margin-top:24px;">
          <div style="text-align:${e.signataireAlign||"right"};margin-left:${e.signataireAlign==="left"&&e.signataireOffset||0}px;margin-right:${e.signataireAlign==="right"&&e.signataireOffset||0}px;margin-top:${e.signataireOffsetY||0}px;">
            <div>${e.signataire}</div>
            ${e.grade?`<div>${e.grade}</div>`:""}
            ${e.titre?`<div>${e.titre}</div>`:""}
            ${e.signatureUrl?`<img src="${e.signatureUrl}" alt="Signature" style="max-height:40px;object-fit:contain;" />`:""}
          </div>
        </div>
      `:"";return _.push(e.signataire||"",e.grade||"",e.titre||""),{documentTitle:o,headerHtml:p,footerHtml:H,headerLines:g,footerLines:_}},[L,t]),ee=r.useCallback(()=>{if(!t)return"";const{documentTitle:e,headerHtml:l,footerHtml:s}=M(),o=["#cf142b","#0b6b3c"],b=[{label:"Nom complet",value:[t?.nom,t?.prenom].filter(Boolean).join(" ").trim()||"N/C"},{label:"Sexe",value:t?.sexe||"N/C"},{label:"Type VDP",value:t?.type_vdp||"N/C"},{label:"Statut",value:t?.statut_vdp||"N/C"},{label:"CNIB",value:t?.numero_cnib||"N/C"},{label:"Contact",value:t?.contacts||"N/C"},{label:"Entité",value:t?.entite_nom||"N/C"}].filter(c=>c.value&&c.value!=="N/C").map((c,$)=>`
        <div class="print-identity__item">
          <span class="print-identity__label" style="color:${o[$%o.length]};">${c.label}</span>
          <span class="print-identity__value">${c.value}</span>
        </div>
      `).join(""),[F,p,H,x,...q]=d,P=(c,$=0)=>c.map((U,je)=>`
            <tr class="print-section__row">
              <th style="color:${o[(je+$)%o.length]};">${U.label}</th>
              <td>${U.value??"N/C"}</td>
            </tr>
          `).join(""),ve=`
      <div class="print-signatures">
        ${V.map((c,$)=>`
          <div class="print-signatures__slot">
            <div class="print-signatures__role" style="color:${o[$%o.length]};">${c.label}</div>
            ${c.src?`<img class="print-signatures__image" src="${c.src}" alt="${c.label}" />`:'<div class="print-signatures__image print-signatures__image--placeholder"></div>'}
            <div class="print-signatures__name">${c.name||""}</div>
          </div>`).join("")}
        <div class="print-signatures__qr-wrapper">
          ${G?`<img class="print-signatures__qr" src="${G}" alt="QR Code" />`:'<div class="print-signatures__qr print-signatures__qr--placeholder">QR absent</div>'}
        </div>
      </div>
    `,ye=I.length||E.length?`
        <section class="print-section print-section--split">
          <div class="print-section__block">
            <div class="print-section__title-each">Identité</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${P(I)}</tbody>
            </table>
          </div>
          <div class="print-section__block">
            <div class="print-section__title-each">Documents</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${P(E,I.length)}</tbody>
            </table>
          </div>
        </section>
      `:"",we=R.length||B.length?`
        <section class="print-section print-section--split">
          <div class="print-section__block">
            <div class="print-section__title-each">Coordonnées</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${P(R)}</tbody>
            </table>
          </div>
          <div class="print-section__block">
            <div class="print-section__title-each">Localisation</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${P(B,R.length)}</tbody>
            </table>
          </div>
        </section>
      `:"",$e=q.map((c,$)=>{const U=P(c.rows,$);return`
          <section class="print-section">
            <header class="print-section__header">
              <span class="print-section__badge" style="background:${o[$%o.length]};"></span>
              <h3 class="print-section__title">${c.title}</h3>
            </header>
            <table class="print-section__table">
              <tbody>${U}</tbody>
            </table>
          </section>
        `}).join("");return`
      <html>
        <head>
          <title>${e}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2f25; margin: 0; }
            .print-surface { max-width: 19.2cm; margin: 0 auto; padding: 20px 24px 26px; }
            .print-header { margin-bottom: 10px; }
            .print-title { margin: 0 0 14px; text-align: center; color: #0b6b3c; font-size: 18px; letter-spacing: 0.4px; text-transform: uppercase; }
            .print-identity { display: flex; gap: 18px; align-items: flex-start; margin-bottom: 16px; }
            .print-identity__photo { width: 110px; height: 130px; object-fit: cover; border-radius: 10px; border: 2px solid #9bb6a1; background: #f6fff8; }
            .print-identity__photo--placeholder { display: flex; align-items: center; justify-content: center; color: #708b74; font-size: 12px; text-align: center; }
            .print-identity__details { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px 12px; }
            .print-identity__item { display: flex; flex-direction: column; border-bottom: 1px solid #e0ece4; padding-bottom: 4px; }
            .print-identity__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
            .print-identity__value { font-size: 13px; color: #142c21; }
            .print-section { page-break-inside: avoid; }
            .print-section--split { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 14px; }
            .print-section__block { border: 1px solid #d6e4d7; border-radius: 12px; padding: 10px 14px 12px; background: #fafdfb; }
            .print-section__title-each { font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #0b6b3c; margin-bottom: 6px; }
            .print-section__header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
            .print-section__badge { width: 10px; height: 10px; border-radius: 50%; }
            .print-section__title { margin: 0; font-size: 14px; color: #0b6b3c; text-transform: uppercase; letter-spacing: 0.4px; }
            .print-section__table { width: 100%; border-collapse: collapse; }
            .print-section__table th,
            .print-section__table td { border-bottom: 1px solid #d6e4d7; padding: 4px 8px; font-size: 12.5px; text-align: left; }
            .print-section__table th { width: 32%; font-weight: 600; }
            .print-section__table--tight th,
            .print-section__table--tight td { padding: 4px 8px; }
            .print-signatures { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; page-break-inside: avoid; }
            .print-signatures__slot { flex: 1; text-align: center; }
            .print-signatures__role { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 700; }
            .print-signatures__image { width: 140px; height: 70px; border: 1px solid #b0c4b1; border-radius: 10px; object-fit: contain; background: #fff; margin: 0 auto; }
            .print-signatures__image--placeholder { display: flex; align-items: center; justify-content: center; color: #92a59b; font-size: 12px; }
            .print-signatures__name { margin-top: 8px; font-size: 12.5px; font-weight: 500; }
            .print-signatures__qr-wrapper { width: 140px; display: flex; justify-content: center; }
            .print-signatures__qr { width: 120px; height: 120px; border-radius: 12px; border: 2px solid #9bb6a1; object-fit: cover; }
            .print-signatures__qr--placeholder { display: flex; align-items: center; justify-content: center; color: #708b74; font-size: 12px; background: #f6fff8; }
            .print-footer { margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="print-surface">
            ${l?`<div class="print-header">${l}</div>`:""}
            <h1 class="print-title">${e}</h1>
            <div class="print-identity">
              ${z?`<img class="print-identity__photo" src="${z}" alt="Photo" />`:'<div class="print-identity__photo print-identity__photo--placeholder">Aucune photo</div>'}
              <div class="print-identity__details">
                ${b}
              </div>
            </div>
            <div class="print-sections">
              ${ye}
              ${we}
              ${$e}
            </div>
            ${ve}
            ${s?`<div class="print-footer">${s}</div>`:""}
          </div>
        </body>
      </html>
    `},[M,R,d,E,I,B,z,G,V,t?.contacts,t?.entite_nom,t?.numero_cnib,t?.sexe,t?.statut_vdp,t?.type_vdp]),be=r.useCallback(()=>{if(!t)return;const e=ee(),l=window.open("","","width=1200,height=800");if(!l){J.error("Impossible d'ouvrir la fenêtre d'impression.");return}l.document.write(e),l.document.close(),l.focus(),l.print()},[t,ee]),xe=r.useCallback(async()=>{if(!t)return;const{documentTitle:e,headerLines:l,footerLines:s}=M(),o=d.flatMap(p=>{const H=new u({text:p.title,heading:"Heading2"}),x=new ie({rows:p.rows.map(q=>new ne({children:[new D({children:[new u({children:[new A({text:q.label||"",bold:!0})]})],shading:{fill:"E3F1E6"}}),new D({children:[new u({children:[new A({text:String(q.value??"N/C")})]})]})]}))});return[H,x]}),g=V.map(p=>new ne({children:[new D({children:[new u({children:[new A({text:p.label,bold:!0})]})],shading:{fill:"E3F1E6"}}),new D({children:[p.src?new u({children:[new A({text:"[Signature manuscrite]",italics:!0})]}):new u({children:[new A({text:"____________________"})]})]}),new D({children:[new u({children:[new A({text:p.name||""})]})]})]})),_=new Ae({sections:[{children:[...l.map(p=>new u({text:p,alignment:"center",bold:!0})),new u({text:e,heading:"Heading1",alignment:"center"}),new u({text:""}),...o,new u({text:""}),new ie({rows:g}),new u({text:""}),...s.filter(Boolean).map(p=>new u({text:p,alignment:"right"}))]}]}),b=await Oe.toBlob(_),F=[`VDP_${t?.nom||"Fiche"}`,t?.prenom].filter(Boolean).join("_").replace(/\s+/g,"_");ze.saveAs(b,`${F||"VDP_Fiche"}.docx`),J.success("Export Word généré.")},[t,M,d,V]),te=r.useCallback(e=>{e&&a(`/dashboard/vdp/fiche/${e}`)},[a]);return f?i.jsx(Se,{size:"large",style:{display:"block",margin:"100px auto"}}):i.jsx(C,{title:i.jsxs(k,{justify:"space-between",align:"middle",children:[i.jsx(v,{children:i.jsx("h3",{style:{margin:0},children:"Fiche VDP"})}),i.jsx(v,{children:i.jsxs(Y,{children:[i.jsx(re,{color:ce,children:t?.statut_vdp||"N/C"}),i.jsx(T,{icon:i.jsx(ke,{}),onClick:be,children:"Imprimer"}),i.jsx(T,{icon:i.jsx(Te,{}),onClick:xe,children:"Exporter"}),i.jsx(T,{type:"link",icon:i.jsx(ae,{}),onClick:()=>a(-1),children:"Retour"}),i.jsx(T,{icon:i.jsx(ae,{}),disabled:!j.prev,onClick:()=>te(j.prev)}),i.jsx(T,{icon:i.jsx(Be,{}),disabled:!j.next,onClick:()=>te(j.next)})]})})]}),style:{margin:24},children:i.jsxs(k,{gutter:[24,24],children:[i.jsx(v,{xs:24,md:8,children:i.jsx(C,{style:S,bordered:!1,children:i.jsxs(Y,{direction:"vertical",size:"large",style:{width:"100%"},children:[i.jsxs("div",{style:{textAlign:"center"},children:[i.jsx(Re,{size:120,src:z,icon:!z&&i.jsx(Pe,{}),style:{marginBottom:12}}),i.jsxs("div",{style:{fontWeight:600,fontSize:18},children:[t?.nom||"—"," ",t?.prenom||""]}),i.jsx(re,{color:he,style:{marginTop:6},children:t?.sexe||"N/C"}),i.jsx("div",{style:{color:"#6c757d",marginTop:6},children:t?.type_vdp||"Type non défini"})]}),i.jsxs(k,{gutter:12,justify:"center",children:[i.jsx(v,{span:12,children:i.jsx(se,{title:"Âge",value:Z??"N/C",suffix:Z!==null?"ans":""})}),i.jsx(v,{span:12,children:i.jsx(se,{title:"Type",value:t?.type_vdp||"N/C"})})]}),i.jsx(De,{plain:!0,children:"Contacts"}),i.jsxs(Y,{direction:"vertical",size:6,children:[i.jsxs("div",{children:[i.jsx("strong",{children:"Tél."})," : ",t?.contacts||"N/C"]}),i.jsxs("div",{children:[i.jsx("strong",{children:"Urgence 1"})," : ",t?.contact_urgence1||"N/C"]}),t?.contact_urgence2&&i.jsxs("div",{children:[i.jsx("strong",{children:"Urgence 2"})," : ",t.contact_urgence2]}),t?.contact_urgence3&&i.jsxs("div",{children:[i.jsx("strong",{children:"Urgence 3"})," : ",t.contact_urgence3]}),i.jsxs("div",{children:[i.jsx("strong",{children:"Personne à prévenir"})," :"," ",t?.nom_personne_prevenir||"N/C"," (",t?.lien_personne_prevenir||"N/R",")"]})]})]})})}),i.jsx(v,{xs:24,md:16,children:i.jsxs(Y,{direction:"vertical",size:"large",style:{width:"100%"},children:[i.jsx(C,{style:S,title:"Identité et documents",children:i.jsxs(k,{gutter:[16,16],children:[i.jsx(v,{xs:24,lg:12,children:i.jsx(y,{column:1,size:"small",bordered:!0,labelStyle:{width:150,fontWeight:600},children:I.map(e=>i.jsx(y.Item,{label:e.label,children:e.value??"N/C"},`identite-${e.label}`))})}),i.jsx(v,{xs:24,lg:12,children:i.jsx(y,{column:1,size:"small",bordered:!0,labelStyle:{width:150,fontWeight:600},children:E.map(e=>i.jsx(y.Item,{label:e.label,children:e.value??"N/C"},`document-${e.label}`))})})]})}),i.jsxs(k,{gutter:16,children:[i.jsx(v,{xs:24,lg:12,children:i.jsx(C,{style:S,title:"Coordonnées",children:i.jsx(y,{column:1,size:"small",bordered:!0,labelStyle:{width:150,fontWeight:600},children:R.map(e=>i.jsx(y.Item,{label:e.label,children:e.value??"N/C"},`coord-${e.label}`))})})}),i.jsx(v,{xs:24,lg:12,children:i.jsx(C,{style:S,title:"Localisation",children:i.jsx(y,{column:1,size:"small",bordered:!0,labelStyle:{width:150,fontWeight:600},children:B.map(e=>i.jsx(y.Item,{label:e.label,children:e.value??"N/C"},`loc-${e.label}`))})})})]}),i.jsx(C,{style:S,title:"Parcours opérationnel",children:i.jsx(y,{column:1,size:"small",bordered:!0,labelStyle:{width:150,fontWeight:600},children:fe.map(e=>i.jsx(y.Item,{label:e.label,children:e.value??"N/C"},`parcours-${e.label}`))})}),i.jsx(C,{style:S,title:"Observations",children:i.jsx("div",{style:{minHeight:72,lineHeight:1.6},children:_e})})]})})]})})}export{Nt as default};
