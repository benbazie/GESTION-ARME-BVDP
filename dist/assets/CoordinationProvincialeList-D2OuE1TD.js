import{r as d,a as ie,e as ne,j as t}from"./index-DKyqVP6r.js";import{E as re,a as ae}from"./jspdf.plugin.autotable-CODx3WaQ.js";import{u as L,w as se}from"./xlsx-nGF3hY23.js";import{s as k}from"./index-BQr7vixy.js";import{C as F}from"./index-tg_Ks76S.js";import{R as U,C as S}from"./row-fjdca5ke.js";import{I as le}from"./index-Mfp0EmDw.js";import{S as I}from"./index-D9j222H_.js";import{F as de}from"./Table-d4PXuaBY.js";import{S as O}from"./index-7tl3SuU5.js";import{B as g}from"./button-Cf2Goh1L.js";import{R as ce}from"./ReloadOutlined-C-nbBXbW.js";import{R as pe}from"./PlusOutlined-QZxB4lvw.js";import{M as me}from"./index-BAeB1-ah.js";import{D as w}from"./index-BRBPm3BF.js";import{R as he}from"./EyeOutlined-qh41TsnE.js";import{P as ge}from"./index-DO1ld-X4.js";import"./InfoCircleFilled-DMDwlTGQ.js";import"./Skeleton-CkLa95QB.js";import"./EllipsisOutlined-WJzTcwvA.js";import"./useBreakpoint-CLx3D4jQ.js";import"./Overflow-GikAWld_.js";import"./PlusOutlined-ByZyTB3m.js";import"./index-BOWIBt1C.js";import"./getAllowClear-ikA_LELg.js";import"./SearchOutlined-Cz2pwBna.js";import"./Input-bsbeShzr.js";import"./ContextIsolator-DC5KAzmm.js";import"./TextArea-WicvUd4y.js";import"./PurePanel-DAEI6F6O.js";import"./useIcons-DK2b5h_3.js";import"./CheckOutlined-ibfetZQ_.js";import"./DownOutlined-D9vZwTSh.js";import"./styleChecker-BTZiFqkq.js";import"./index-CR0Zw8MX.js";import"./useBubbleLock-Ds4vqhwo.js";import"./FileOutlined-nKQzFF_w.js";import"./index-DrkWCuIY.js";import"./useForm-B0mdsUN-.js";import"./index-T7A22YUT.js";import"./extendsObject-78o_rR5W.js";import"./AntdIcon-Dx9R3x8l.js";import"./ActionButton-DPAjMeUb.js";import"./context-Cs2YySvI.js";import"./useClosable-DPMaBYKL.js";import"./index-DHfwFbMm.js";const{Option:E}=I,ue=a=>{if(!a)return{entete:"",pied:""};const p=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:2;">
        ${(Array.isArray(a.institutions)?a.institutions:[]).map(l=>`<div style="font-weight:${l.bold?"bold":"normal"};font-style:${l.italic?"italic":"normal"};text-decoration:${l.underline?"underline":"none"};color:${l.color||"#222"};">${l.text||""}</div>`).join("")}
      </div>
      <div style="text-align:center;">${a.logoUrl?`<img src="${a.logoUrl}" alt="logo" style="max-height:60px;" />`:""}</div>
      <div style="flex:1;text-align:right;">
        <div>${a.pays||""}</div>
        <div>${a.devise||""}</div>
      </div>
    </div>
    <hr style="margin:8px 0;" />
  `,R=`
    <div style="margin-top:32px;text-align:${a.signataireAlign||"right"};">
      <div>${a.signataire||""}</div>
      <div>${a.grade||""}</div>
      <div>${a.titre||""}</div>
      ${a.signatureUrl?`<img src="${a.signatureUrl}" alt="signature" style="max-height:40px;" />`:""}
    </div>
  `;return{entete:p,pied:R}},ve=(a,u,p,R,l)=>{if(a?.documentTitle||a?.headerTitle)return a.documentTitle||a.headerTitle;const f=[];if(u.region){const s=p.find(y=>String(y.id)===String(u.region))?.nom;s&&f.push(`Région : ${s}`)}if(u.province){const s=R.find(y=>String(y.id)===String(u.province))?.nom;s&&f.push(`Province : ${s}`)}if(u.regionale){const s=l.find(y=>String(y.id)===String(u.regionale))?.nom;s&&f.push(`Coord. Régionale : ${s}`)}return`Liste des Coordinations Provinciales${f.length?" — "+f.join(" | "):""}`};function dt(){const[a,u]=d.useState(null),[p,R]=d.useState([]),[l,f]=d.useState([]),[s,y]=d.useState([]),[h,z]=d.useState([]),[j,B]=d.useState(null),[C,M]=d.useState(null),[b,W]=d.useState(null),[_,H]=d.useState(""),[V,T]=d.useState(!1),[v,q]=d.useState(null),[J,N]=d.useState(!1),D=ie();d.useEffect(()=>{T(!0),Promise.all([window.electronAPI.getCoordinationProvincialeList?.()||window.electronAPI.getCoordinationProvinciales?.(),window.electronAPI.getProvinces?.(),window.electronAPI.getRegions?.(),window.electronAPI.getCoordinationRegionaleList?.()||window.electronAPI.getCoordinationRegionales?.()]).then(([e,o,n,r])=>{R(Array.isArray(e)?e:[]),f(Array.isArray(o)?o:[]),y(Array.isArray(n)?n:[]),z(Array.isArray(r)?r:[])}).catch(()=>{k.error("Erreur lors du chargement des données")}).finally(()=>T(!1))},[]),d.useEffect(()=>{(async()=>{try{const o=(await ne.getAppConfigList?.())?.find(n=>n.nom_param==="header_footer");o?.valeur&&u(JSON.parse(o.valeur))}catch{}})()},[]);const i=(e,o)=>e.find(n=>String(n.id)===String(o))?.nom||"",$=d.useMemo(()=>{let e=[...p];return j&&(e=e.filter(o=>String(o.province_id)===String(j))),C&&(e=e.filter(o=>String(o.region_id)===String(C))),b&&(e=e.filter(o=>String(o.parent_id)===String(b))),_.trim()&&(e=e.filter(o=>(o.nom||"").toLowerCase().includes(_.toLowerCase())||i(l,o.province_id).toLowerCase().includes(_.toLowerCase()))),e},[p,j,C,b,_,l]),K=()=>{const e=[["#","Nom","Code","Province","Région","Coord. Régionale"]];p.forEach((m,x)=>{e.push([x+1,m.nom,m.code,i(l,m.province_id),i(s,m.region_id),i(h,m.parent_id)])});const o=e.map(m=>m.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(";")).join(`
`),n=new Blob([o],{type:"text/csv"}),r=URL.createObjectURL(n),c=document.createElement("a");c.href=r,c.download="coordinations_provinciales.csv",c.click(),URL.revokeObjectURL(r)},Y=()=>{const e=[["#","Nom","Code","Province","Région","Coord. Régionale"]];p.forEach((r,c)=>{e.push([c+1,r.nom,r.code,i(l,r.province_id),i(s,r.region_id),i(h,r.parent_id)])});const o=L.aoa_to_sheet(e),n=L.book_new();L.book_append_sheet(n,o,"CoordinationsProvinciales"),se(n,"coordinations_provinciales.xlsx")},G=()=>{let e='<table border="1" style="border-collapse:collapse;"><tr><th>#</th><th>Nom</th><th>Code</th><th>Province</th><th>Région</th><th>Coord. Régionale</th></tr>';p.forEach((c,m)=>{e+=`<tr>
        <td>${m+1}</td>
        <td>${c.nom}</td>
        <td>${c.code}</td>
        <td>${i(l,c.province_id)}</td>
        <td>${i(s,c.region_id)}</td>
        <td>${i(h,c.parent_id)}</td>
      </tr>`}),e+="</table>";const o=new Blob([`<html><head><meta charset="utf-8"></head><body>${e}</body></html>`],{type:"application/msword"}),n=URL.createObjectURL(o),r=document.createElement("a");r.href=n,r.download="coordinations_provinciales.doc",r.click(),URL.revokeObjectURL(n)},Q=()=>{const e=new re({orientation:p.length>6?"landscape":"portrait",unit:"pt",format:"a4"});e.text("Liste des Coordinations Provinciales",40,30),ae(e,{startY:50,head:[["#","Nom","Code","Province","Région","Coord. Régionale"]],body:p.map((o,n)=>[n+1,o.nom,o.code,i(l,o.province_id),i(s,o.region_id),i(h,o.parent_id)]),styles:{fontSize:9},headStyles:{fillColor:[24,144,255]},margin:{left:20,right:20}}),e.save("coordinations_provinciales.pdf")},X=()=>{const{entete:e,pied:o}=ue(a),n=ve(a,{region:C,province:j,regionale:b},s,l,h),r=`
      <div class="print-summary">
        <div><strong>Région :</strong> ${C?i(s,C):"Toutes"}</div>
        <div><strong>Province :</strong> ${j?i(l,j):"Toutes"}</div>
        <div><strong>Coord. Régionale :</strong> ${b?i(h,b):"Toutes"}</div>
        <div><strong>Total filtré :</strong> ${$.length}</div>
      </div>
    `,c=$.map((P,oe)=>`
        <tr>
          <td>${oe+1}</td>
          <td>${P.nom||"—"}</td>
          <td>${P.code||"—"}</td>
          <td>${i(l,P.province_id)||"—"}</td>
          <td>${i(s,P.region_id)||"—"}</td>
          <td>${i(h,P.parent_id)||"—"}</td>
        </tr>
      `).join(""),m=`
      <div>${e}</div>
      <div style="text-align:center;font-size:20px;font-weight:bold;margin:12px 0;">${n}</div>
      ${r}
      <table class="print-table">
        <thead>
          <tr>
            <th>#</th><th>Nom</th><th>Code</th><th>Province</th><th>Région</th><th>Coord. Régionale</th>
          </tr>
        </thead>
        <tbody>${c||'<tr><td colspan="6">Aucune donnée</td></tr>'}</tbody>
      </table>
      <div>${o}</div>
    `,x=window.open("","_blank","width=1200,height=900");x&&(x.document.write(`
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
    `),x.document.close(),x.focus(),x.print())},Z=async e=>{const o=window.electronAPI||window.api||{},n=o.deleteCoordinationProvinciale||o.removeCoordinationProvinciale||(o.call?r=>o.call("deleteCoordinationProvinciale",r):null);if(typeof n!="function"){k.error("Suppression indisponible.");return}try{await n(e.id??e),k.success("Coordination supprimée."),R(r=>r.filter(c=>c.id!==e.id))}catch(r){console.error("[CoordinationProvincialeList] delete",r),k.error("Échec de la suppression.")}},ee=e=>{q(e),N(!0)},te=[{title:"N°",dataIndex:"numero",key:"numero",width:60,align:"center",render:(e,o,n)=>n+1},{title:"Nom",dataIndex:"nom",key:"nom",render:e=>t.jsx("b",{children:e})},{title:"Code",dataIndex:"code",key:"code",align:"center"},{title:"Province",dataIndex:"province_id",key:"province_id",render:e=>i(l,e)},{title:"Région",dataIndex:"region_id",key:"region_id",render:e=>i(s,e)},{title:"Coord. Régionale",dataIndex:"parent_id",key:"parent_id",render:e=>i(h,e)},{title:"Actions",key:"actions",width:220,render:(e,o)=>t.jsxs(O,{children:[t.jsx(g,{type:"link",icon:t.jsx(he,{}),onClick:()=>ee(o),children:"Détails"}),t.jsx(g,{type:"link",onClick:()=>D(`/dashboard/coordinations/provinciale/edit/${o.id}`),children:"Modifier"}),t.jsx(ge,{title:"Supprimer cette coordination ?",okText:"Oui",cancelText:"Non",onConfirm:()=>Z(o),children:t.jsx(g,{type:"link",danger:!0,children:"Supprimer"})})]})}],A=d.useMemo(()=>{const e=$.length,o={};return $.forEach(n=>{const r=i(s,n.region_id)||"Inconnue";o[r]=(o[r]||0)+1}),{total:e,parRegion:o}},[$,s]);return t.jsxs("div",{className:"coord-provinciale-list-container",children:[t.jsxs(F,{title:t.jsxs(U,{justify:"space-between",align:"middle",children:[t.jsx(S,{children:t.jsx("span",{style:{fontSize:22,fontWeight:700},children:"Liste des Coordinations Provinciales"})}),t.jsx(S,{children:t.jsxs(O,{children:[t.jsx(g,{icon:t.jsx(ce,{}),onClick:()=>window.location.reload()}),t.jsx(g,{onClick:K,children:"CSV"}),t.jsx(g,{onClick:Y,children:"Excel"}),t.jsx(g,{onClick:G,children:"Word"}),t.jsx(g,{onClick:Q,children:"PDF"}),t.jsx(g,{onClick:X,children:"Imprimer"}),t.jsx(g,{type:"primary",icon:t.jsx(pe,{}),onClick:()=>D("/dashboard/coordinations/provinciale/add"),children:"Ajouter"})]})})]}),style:{margin:"24px"},className:"coord-provinciale-list-card",children:[t.jsxs(U,{gutter:16,style:{marginBottom:16},children:[t.jsx(S,{xs:24,sm:12,md:6,children:t.jsx(le,{placeholder:"Recherche...",value:_,onChange:e=>H(e.target.value),allowClear:!0})}),t.jsx(S,{xs:24,sm:12,md:6,children:t.jsx(I,{placeholder:"Filtrer par région",allowClear:!0,style:{width:"100%"},value:C,onChange:M,children:s.map(e=>t.jsx(E,{value:e.id,children:e.nom},e.id))})}),t.jsx(S,{xs:24,sm:12,md:6,children:t.jsx(I,{placeholder:"Filtrer par province",allowClear:!0,style:{width:"100%"},value:j,onChange:B,children:l.map(e=>t.jsx(E,{value:e.id,children:e.nom},e.id))})}),t.jsx(S,{xs:24,sm:12,md:6,children:t.jsx(I,{placeholder:"Filtrer par coordination régionale",allowClear:!0,style:{width:"100%"},value:b,onChange:W,children:h.map(e=>t.jsx(E,{value:e.id,children:e.nom},e.id))})})]}),t.jsx(de,{columns:te,dataSource:$,rowKey:"id",pagination:{pageSize:12},bordered:!0,className:"coord-provinciale-table",loading:V}),t.jsxs(F,{type:"inner",title:"Statistiques",style:{marginTop:24,background:"#f6faff",border:"1px solid #e6f7ff"},children:[t.jsxs("div",{style:{fontWeight:600,fontSize:16,marginBottom:8},children:["Total : ",A.total," coordination",A.total>1?"s":""]}),t.jsx("div",{children:Object.entries(A.parRegion).map(([e,o])=>t.jsxs("div",{style:{marginBottom:4},children:[t.jsx("span",{style:{color:"#1890ff",fontWeight:500},children:e})," : ",t.jsx("b",{children:o})]},e))})]})]}),t.jsx(me,{open:J,title:v?v.nom:"Détails coordination provinciale",onCancel:()=>N(!1),footer:null,children:v&&t.jsxs(w,{bordered:!0,column:1,size:"small",children:[t.jsx(w.Item,{label:"Nom",children:v.nom}),t.jsx(w.Item,{label:"Code",children:v.code||"—"}),t.jsx(w.Item,{label:"Province",children:i(l,v.province_id)||"—"}),t.jsx(w.Item,{label:"Région",children:i(s,v.region_id)||"—"}),t.jsx(w.Item,{label:"Coordination régionale",children:i(h,v.parent_id)||"—"}),t.jsx(w.Item,{label:"Description",children:v.description||"—"})]})})]})}export{dt as default};
