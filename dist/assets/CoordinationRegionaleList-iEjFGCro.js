import{r as c,a as X,e as Z,j as e}from"./index-DKyqVP6r.js";import{E as tt,a as et}from"./jspdf.plugin.autotable-CODx3WaQ.js";import{u as S,w as ot}from"./xlsx-nGF3hY23.js";import{s as $}from"./index-BQr7vixy.js";import{C as N}from"./index-tg_Ks76S.js";import{R as T,C as _}from"./row-fjdca5ke.js";import{I as it}from"./index-Mfp0EmDw.js";import{S as P}from"./index-D9j222H_.js";import{F as nt}from"./Table-d4PXuaBY.js";import{S as D}from"./index-7tl3SuU5.js";import{B as u}from"./button-Cf2Goh1L.js";import{R as rt}from"./ReloadOutlined-C-nbBXbW.js";import{R as st}from"./PlusOutlined-QZxB4lvw.js";import{M as at}from"./index-BAeB1-ah.js";import{D as R}from"./index-BRBPm3BF.js";import{R as dt}from"./EyeOutlined-qh41TsnE.js";import{P as lt}from"./index-DO1ld-X4.js";import"./InfoCircleFilled-DMDwlTGQ.js";import"./Skeleton-CkLa95QB.js";import"./EllipsisOutlined-WJzTcwvA.js";import"./useBreakpoint-CLx3D4jQ.js";import"./Overflow-GikAWld_.js";import"./PlusOutlined-ByZyTB3m.js";import"./index-BOWIBt1C.js";import"./getAllowClear-ikA_LELg.js";import"./SearchOutlined-Cz2pwBna.js";import"./Input-bsbeShzr.js";import"./ContextIsolator-DC5KAzmm.js";import"./TextArea-WicvUd4y.js";import"./PurePanel-DAEI6F6O.js";import"./useIcons-DK2b5h_3.js";import"./CheckOutlined-ibfetZQ_.js";import"./DownOutlined-D9vZwTSh.js";import"./styleChecker-BTZiFqkq.js";import"./index-CR0Zw8MX.js";import"./useBubbleLock-Ds4vqhwo.js";import"./FileOutlined-nKQzFF_w.js";import"./index-DrkWCuIY.js";import"./useForm-B0mdsUN-.js";import"./index-T7A22YUT.js";import"./extendsObject-78o_rR5W.js";import"./AntdIcon-Dx9R3x8l.js";import"./ActionButton-DPAjMeUb.js";import"./context-Cs2YySvI.js";import"./useClosable-DPMaBYKL.js";import"./index-DHfwFbMm.js";const{Option:ct}=P,mt=i=>{if(!i)return{entete:"",pied:""};const j=Array.isArray(i.institutions)?i.institutions:[],p=i.separator?`<div style="font-weight:bold;color:${i.separatorColor||"#222"};">${i.separator.repeat(i.separatorLength||10)}</div>`:"",f=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:2;">
        ${j.map(x=>`<div style="font-weight:${x.bold?"bold":"normal"};font-style:${x.italic?"italic":"normal"};text-decoration:${x.underline?"underline":"none"};color:${x.color||"#222"};">${x.text||""}</div>`).join("")}
        ${p}
      </div>
      <div style="text-align:center;">
        ${i.logoUrl?`<img src="${i.logoUrl}" alt="logo" style="max-height:60px;" />`:""}
      </div>
      <div style="flex:1;text-align:right;">
        <div>${i.pays||""}</div>
        <div>${i.devise||""}</div>
      </div>
    </div>
    <hr style="margin:8px 0;" />
  `,r=`
    <div style="margin-top:32px;text-align:${i.signataireAlign||"right"};">
      <div>${i.signataire||""}</div>
      <div>${i.grade||""}</div>
      <div>${i.titre||""}</div>
      ${i.signatureUrl?`<img src="${i.signatureUrl}" alt="signature" style="max-height:40px;" />`:""}
    </div>
  `;return{entete:f,pied:r}},pt=(i,j,p)=>{if(i?.documentTitle||i?.headerTitle)return i.documentTitle||i.headerTitle;const f=[];if(j.region){const r=p.find(x=>String(x.id)===String(j.region))?.nom;r&&f.push(`Région : ${r}`)}return`Liste des Coordinations Régionales${f.length?" — "+f.join(" | "):""}`};function re(){const[i,j]=c.useState(null),[p,f]=c.useState([]),[r,x]=c.useState([]),[k,U]=c.useState([]),[F,L]=c.useState(!1),[w,O]=c.useState(null),[v,H]=c.useState(""),[y,z]=c.useState(null),[B,I]=c.useState(!1),A=X();c.useEffect(()=>{L(!0),Promise.all([window.electronAPI.getCoordinationRegionaleList?.()||window.electronAPI.getCoordinationRegionales?.(),window.electronAPI.getRegions?.(),window.electronAPI.getEntitesList?.()||window.electronAPI.getEntites?.()]).then(([t,o,n])=>{f(Array.isArray(t)?t:[]),x(Array.isArray(o)?o:[]),U(Array.isArray(n)?n:[])}).catch(()=>{$.error("Erreur lors du chargement des données")}).finally(()=>L(!1))},[]),c.useEffect(()=>{(async()=>{try{const o=(await Z.getAppConfigList?.())?.find(n=>n.nom_param==="header_footer");o?.valeur&&j(JSON.parse(o.valeur))}catch{}})()},[]);const h=(t,o)=>t.find(n=>String(n.id)===String(o))?.nom||"",b=t=>h(k,t),C=c.useMemo(()=>{let t=[...p];return w&&(t=t.filter(o=>String(o.region_id)===String(w))),v.trim()&&(t=t.filter(o=>(o.nom||"").toLowerCase().includes(v.toLowerCase())||h(r,o.region_id).toLowerCase().includes(v.toLowerCase())||b(o.entite_id).toLowerCase().includes(v.toLowerCase()))),t},[p,w,v,r,k]),M=()=>{const t=[],o=(d,g,Q)=>d.push([Q+1,g.nom,g.code,h(r,g.region_id),b(g.entite_id)]);(d=>d.unshift(["#","Nom","Code","Région","Entité"]))(t),p.forEach((d,g)=>o(t,d,g));const s=t.map(d=>d.map(g=>`"${String(g).replace(/"/g,'""')}"`).join(";")).join(`
`),l=new Blob([s],{type:"text/csv"}),m=URL.createObjectURL(l),a=document.createElement("a");a.href=m,a.download="coordinations_regionales.csv",a.click(),URL.revokeObjectURL(m)},W=()=>{const t=[],o=(m,a,d)=>m.push([d+1,a.nom,a.code,h(r,a.region_id),b(a.entite_id)]);(m=>m.unshift(["#","Nom","Code","Région","Entité"]))(t),p.forEach((m,a)=>o(t,m,a));const s=S.aoa_to_sheet(t),l=S.book_new();S.book_append_sheet(l,s,"CoordinationsRegionales"),ot(l,"coordinations_regionales.xlsx")},V=()=>{let t='<table border="1" style="border-collapse:collapse;"><tr><th>#</th><th>Nom</th><th>Code</th><th>Région</th><th>Entité</th></tr>';p.forEach((l,m)=>{t+=`<tr>
        <td>${m+1}</td>
        <td>${l.nom}</td>
        <td>${l.code}</td>
        <td>${h(r,l.region_id)}</td>
        <td>${b(l.entite_id)}</td>
      </tr>`}),t+="</table>";const o=new Blob([`<html><head><meta charset="utf-8"></head><body>${t}</body></html>`],{type:"application/msword"}),n=URL.createObjectURL(o),s=document.createElement("a");s.href=n,s.download="coordinations_regionales.doc",s.click(),URL.revokeObjectURL(n)},q=()=>{const t=new tt({orientation:p.length>6?"landscape":"portrait",unit:"pt",format:"a4"});t.text("Liste des Coordinations Régionales",40,30),et(t,{startY:50,head:[["#","Nom","Code","Région","Entité"]],body:p.map((o,n)=>[n+1,o.nom,o.code,h(r,o.region_id),b(o.entite_id)]),styles:{fontSize:9},headStyles:{fillColor:[24,144,255]},margin:{left:20,right:20}}),t.save("coordinations_regionales.pdf")},J=()=>{const{entete:t,pied:o}=mt(i),n=pt(i,{region:w},r),s=`
      <div class="print-summary">
        <div><strong>Région :</strong> ${w?h(r,w):"Toutes"}</div>
        <div><strong>Total filtré :</strong> ${C.length}</div>
      </div>
    `,l=C.map((d,g)=>`
        <tr>
          <td>${g+1}</td>
          <td>${d.nom||"—"}</td>
          <td>${d.code||"—"}</td>
          <td>${h(r,d.region_id)||"—"}</td>
          <td>${b(d.entite_id)||"—"}</td>
        </tr>
      `).join(""),m=`
      <div>${t}</div>
      <div style="text-align:center;font-size:20px;font-weight:bold;margin:12px 0;">${n}</div>
      ${s}
      <table class="print-table">
        <thead>
          <tr>
            <th>#</th><th>Nom</th><th>Code</th><th>Région</th><th>Entité</th>
          </tr>
        </thead>
        <tbody>${l||'<tr><td colspan="5">Aucune donnée</td></tr>'}</tbody>
      </table>
      <div>${o}</div>
    `,a=window.open("","_blank","width=1200,height=900");a&&(a.document.write(`
      <html>
        <head>
          <title>${n}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f25; }
            .print-summary div { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #c7d4dd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f0f6fb; text-transform: uppercase; }
          </style>
        </head>
        <body>${m}</body>
      </html>
    `),a.document.close(),a.focus(),a.print())},K=async t=>{const o=window.electronAPI||window.api||{},n=o.deleteCoordinationRegionale||o.removeCoordinationRegionale||(o.call?s=>o.call("deleteCoordinationRegionale",s):null);if(typeof n!="function"){$.error("Suppression indisponible.");return}try{await n(t.id??t),$.success("Coordination supprimée."),f(s=>s.filter(l=>l.id!==t.id))}catch(s){console.error("[CoordinationRegionaleList] delete",s),$.error("Échec de la suppression.")}},Y=t=>{z(t),I(!0)},G=[{title:"N°",dataIndex:"numero",key:"numero",width:60,align:"center",render:(t,o,n)=>n+1},{title:"Nom",dataIndex:"nom",key:"nom",render:t=>e.jsx("b",{children:t})},{title:"Code",dataIndex:"code",key:"code",align:"center"},{title:"Région",dataIndex:"region_id",key:"region_id",render:t=>h(r,t)},{title:"Entité",dataIndex:"entite_id",key:"entite_id",render:t=>b(t)},{title:"Actions",key:"actions",width:220,render:(t,o)=>e.jsxs(D,{children:[e.jsx(u,{type:"link",icon:e.jsx(dt,{}),onClick:()=>Y(o),children:"Détails"}),e.jsx(u,{type:"link",onClick:()=>A(`/dashboard/coordinations/regionale/edit/${o.id}`),children:"Modifier"}),e.jsx(lt,{title:"Supprimer cette coordination ?",okText:"Oui",cancelText:"Non",onConfirm:()=>K(o),children:e.jsx(u,{type:"link",danger:!0,children:"Supprimer"})})]})}],E=c.useMemo(()=>{const t=C.length,o={};return C.forEach(n=>{const s=h(r,n.region_id)||"Inconnue";o[s]=(o[s]||0)+1}),{total:t,parRegion:o}},[C,r]);return e.jsxs("div",{className:"coord-regionale-list-container",children:[e.jsxs(N,{title:e.jsxs(T,{justify:"space-between",align:"middle",children:[e.jsx(_,{children:e.jsx("span",{style:{fontSize:22,fontWeight:700},children:"Liste des Coordinations Régionales"})}),e.jsx(_,{children:e.jsxs(D,{children:[e.jsx(u,{icon:e.jsx(rt,{}),onClick:()=>window.location.reload()}),e.jsx(u,{onClick:M,children:"CSV"}),e.jsx(u,{onClick:W,children:"Excel"}),e.jsx(u,{onClick:V,children:"Word"}),e.jsx(u,{onClick:q,children:"PDF"}),e.jsx(u,{onClick:J,children:"Imprimer"}),e.jsx(u,{type:"primary",icon:e.jsx(st,{}),onClick:()=>A("/dashboard/coordinations/regionale/add"),children:"Ajouter"})]})})]}),style:{margin:"24px"},className:"coord-regionale-list-card",children:[e.jsxs(T,{gutter:16,style:{marginBottom:16},children:[e.jsx(_,{xs:24,sm:12,md:6,children:e.jsx(it,{placeholder:"Recherche...",value:v,onChange:t=>H(t.target.value),allowClear:!0})}),e.jsx(_,{xs:24,sm:12,md:6,children:e.jsx(P,{placeholder:"Filtrer par région",allowClear:!0,style:{width:"100%"},value:w,onChange:O,children:r.map(t=>e.jsx(ct,{value:t.id,children:t.nom},t.id))})})]}),e.jsx(nt,{columns:G,dataSource:C,rowKey:"id",pagination:{pageSize:12},bordered:!0,className:"coord-regionale-table",loading:F}),e.jsxs(N,{type:"inner",title:"Statistiques",style:{marginTop:24,background:"#f6faff",border:"1px solid #e6f7ff"},children:[e.jsxs("div",{style:{fontWeight:600,fontSize:16,marginBottom:8},children:["Total : ",E.total," coordination",E.total>1?"s":""]}),e.jsx("div",{children:Object.entries(E.parRegion).map(([t,o])=>e.jsxs("div",{style:{marginBottom:4},children:[e.jsx("span",{style:{color:"#1890ff",fontWeight:500},children:t})," : ",e.jsx("b",{children:o})]},t))})]})]}),e.jsx(at,{open:B,title:y?y.nom:"Détails",onCancel:()=>I(!1),footer:null,children:y&&e.jsxs(R,{bordered:!0,column:1,size:"small",children:[e.jsx(R.Item,{label:"Nom",children:y.nom}),e.jsx(R.Item,{label:"Code",children:y.code||"—"}),e.jsx(R.Item,{label:"Entité",children:b(y.entite_id)||"—"}),e.jsx(R.Item,{label:"Région",children:h(r,y.region_id)||"—"}),e.jsx(R.Item,{label:"Description",children:y.description||"—"})]})})]})}export{re as default};
