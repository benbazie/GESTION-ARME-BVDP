import{a as H,r as u,e as W,R as J,j as n,L as V}from"./index-DKyqVP6r.js";import{F as N,a as P,b as D,P as j,c as F,d as K,T as Y,A as C,e as Z}from"./index-DDihIDqM.js";import{s as q}from"./server.browser-C4hwhejo.js";import{s as T}from"./index-BQr7vixy.js";import{C as L}from"./index-tg_Ks76S.js";import{T as Q}from"./index-WhiNQoRE.js";import{S as R}from"./index-7tl3SuU5.js";import{B as A}from"./button-Cf2Goh1L.js";import{R as X}from"./PlusOutlined-QZxB4lvw.js";import{R as ee}from"./ReloadOutlined-C-nbBXbW.js";import{I as te}from"./index-Mfp0EmDw.js";import{R as ne}from"./SearchOutlined-Dn74gCml.js";import{F as I}from"./Table-d4PXuaBY.js";import{E as re}from"./index-D9j222H_.js";import{R as ie}from"./PrinterOutlined-DDj61nTJ.js";import{R as oe}from"./FileExcelOutlined-BpdVF-2E.js";import{R as se}from"./FileWordOutlined-DCqdRZTp.js";import"./InfoCircleFilled-DMDwlTGQ.js";import"./Skeleton-CkLa95QB.js";import"./EllipsisOutlined-WJzTcwvA.js";import"./useBreakpoint-CLx3D4jQ.js";import"./Overflow-GikAWld_.js";import"./PlusOutlined-ByZyTB3m.js";import"./EditOutlined-DdmGLkPL.js";import"./styleChecker-BTZiFqkq.js";import"./ContextIsolator-DC5KAzmm.js";import"./index-DrkWCuIY.js";import"./TextArea-WicvUd4y.js";import"./getAllowClear-ikA_LELg.js";import"./SearchOutlined-Cz2pwBna.js";import"./CheckOutlined-ibfetZQ_.js";import"./AntdIcon-Dx9R3x8l.js";import"./Input-bsbeShzr.js";import"./DownOutlined-D9vZwTSh.js";import"./index-CR0Zw8MX.js";import"./useBubbleLock-Ds4vqhwo.js";import"./FileOutlined-nKQzFF_w.js";import"./PurePanel-DAEI6F6O.js";import"./useForm-B0mdsUN-.js";import"./useIcons-DK2b5h_3.js";import"./index-T7A22YUT.js";import"./extendsObject-78o_rR5W.js";const ae=(x=2e3)=>new Promise((h,E)=>{if(typeof window>"u")return h(null);if(window.electronAPI)return h(window.electronAPI);const m=Date.now(),k=()=>{if(window.electronAPI)return h(window.electronAPI);if(Date.now()-m>x)return h(null);setTimeout(k,50)};k()}),le=()=>{const x=typeof window<"u"&&window.electronAPI?window.electronAPI:null;return x?Object.assign({},x):null};async function de(x=[],...h){const E=Array.isArray(x)?x:[x],m=typeof window<"u",k=()=>{try{return m&&(localStorage.getItem("auth-token")||localStorage.getItem("auth_token"))||null}catch{return null}},O=async(d,...r)=>{try{const o=String(d||"").replace(/^(get|create|update|delete)/i,"").replace(/List$|ById$|ByID$/i,"").replace(/[A-Z]/g,s=>"_"+s.toLowerCase()).replace(/^_/,"").toLowerCase().trim();if(!o)return null;const c=/^get/i.test(d)?"GET":/^create/i.test(d)?"POST":/^update/i.test(d)?"PUT":/^delete/i.test(d)?"DELETE":"GET",a=`${typeof location<"u"&&location.origin?`${location.origin}`:"http://localhost:3001"}/api/${o}${c==="GET"&&r[0]&&(typeof r[0]=="string"||typeof r[0]=="number")?`/${r[0]}`:""}`,f={"Content-Type":"application/json"},S=k();if(S&&(f.Authorization=S.startsWith("Bearer ")?S:`Bearer ${S}`),c==="GET"){const s=r[0]&&typeof r[0]=="object"?new URLSearchParams(Object.entries(r[0]).filter(([,g])=>g!=null&&g!=="")).toString():"",p=s?`${a}?${s}`:a,w=await fetch(p,{method:"GET",headers:f});if(w.status===401){const g=new Error("Unauthorized");throw g.status=401,g}return w.ok?await w.json().catch(()=>null):null}if(c==="POST"){const s=await fetch(a,{method:"POST",headers:f,body:JSON.stringify(r[0]||{})});if(s.status===401){const p=new Error("Unauthorized");throw p.status=401,p}return s.ok?await s.json().catch(()=>null):null}if(c==="PUT"){const s=r[0]&&(r[0].id||r[0]._id)?`/${r[0].id||r[0]._id}`:"",p=await fetch(`${a}${s}`,{method:"PUT",headers:f,body:JSON.stringify(r[0]||{})});if(p.status===401){const w=new Error("Unauthorized");throw w.status=401,w}return p.ok?await p.json().catch(()=>null):null}if(c==="DELETE"){const s=r[0]||"",p=await fetch(`${a}/${s}`,{method:"DELETE",headers:f});if(p.status===401){const w=new Error("Unauthorized");throw w.status=401,w}return p.ok?await p.json().catch(()=>null):null}}catch(o){if(o&&o.status===401)throw o;return null}return null};for(const d of E)try{const r=le();if(r&&typeof r[d]=="function")return await r[d](...h);if(m&&window.electronAPI&&typeof window.electronAPI.call=="function")try{return await window.electronAPI.call(d,...h.length?h:[{}])}catch(c){if(c&&c.status===401)throw c}if(m&&window.api&&typeof window.api.call=="function")try{return await window.api.call(d,...h.length?h:[{}])}catch{}if(m&&window.api&&typeof window.api[d]=="function")try{return await window.api[d](...h)}catch{}const o=await O(d,...h);if(o!==null)return o}catch(r){if(r&&r.status===401)throw r;console.warn(`[safeCall] ${d} failed:`,r&&(r.message||r))}return[]}const{Title:ce,Text:z}=Q;function Xe(){const x=H(),[h,E]=u.useState([]),[m,k]=u.useState(""),[O,d]=u.useState(!1),r=u.useRef(!0),[o,c]=u.useState({});u.useEffect(()=>(r.current=!0,(async()=>(await ae(1500),await _()))(),()=>{r.current=!1}),[]),u.useEffect(()=>{(async()=>{try{const t=(await W.getAppConfigList()).find(i=>i.nom_param==="header_footer");t?.valeur&&c(JSON.parse(t.valeur))}catch{}})()},[]);const _=async()=>{d(!0);try{const e=await de(["getLotsList","getLots","getLotList","getlots","lots"],{});let t=[];if(Array.isArray(e)?t=e:e&&Array.isArray(e.rows)?t=e.rows:e&&Array.isArray(e.data)?t=e.data:e&&Array.isArray(e.items)?t=e.items:t=[],!r.current)return;E(t)}catch(e){console.error("getLots",e),e&&e.status===401?T.error("Non autorisé. Veuillez vous connecter."):T.error("Erreur lors du chargement des lots"),r.current&&E([])}finally{r.current&&d(!1)}};u.useEffect(()=>{const e=t=>{(t.key==="auth-token"||t.key==="auth_token")&&_()};return window.addEventListener&&window.addEventListener("storage",e),()=>window.removeEventListener&&window.removeEventListener("storage",e)},[]);const a=u.useMemo(()=>{const e=m.toLowerCase().trim();return h.filter(i=>String(i.designation||i.name||i.libelle||"").toLowerCase().includes(e)).map((i,b)=>({...i,__rowNumber:b+1}))},[h,m]),f=[{title:"N°",dataIndex:"__rowNumber",key:"rowNumber",width:80,align:"center",exporter:e=>e.__rowNumber??"—"},{title:"Désignation",dataIndex:"designation",key:"designation",render:(e,t)=>t.designation||t.name||t.libelle||"—",sorter:(e,t)=>String(e.designation||e.name||"").localeCompare(String(t.designation||t.name||"")),exporter:e=>e.designation||e.name||e.libelle||"—"},{title:"Date de début",dataIndex:"periode_debut",key:"periode_debut",render:(e,t)=>{const i=e||t.date_debut||t.periode_debut;return i?new Date(i).toLocaleDateString():"N/A"},sorter:(e,t)=>new Date(e.periode_debut||e.date_debut||0)-new Date(t.periode_debut||t.date_debut||0)},{title:"Date de fin",dataIndex:"periode_fin",key:"periode_fin",render:(e,t)=>{const i=e||t.date_fin||t.periode_fin;return i?new Date(i).toLocaleDateString():"N/A"},sorter:(e,t)=>new Date(e.periode_fin||e.date_fin||0)-new Date(t.periode_fin||t.date_fin||0)},{title:"Description",dataIndex:"description",key:"description",ellipsis:!0,render:(e,t)=>t.description||t.justificatif||"—"},{title:"Actions",key:"actions",render:(e,t)=>n.jsx(R,{children:n.jsx(V,{to:`/dashboard/lots/edit/${t.id||t._id||t.uuid||""}`,children:n.jsx(A,{type:"primary",children:"Modifier"})})})}],S=u.useCallback(e=>{if(!e)return{entete:"",pied:""};const t=e.separator?`<div style="font-weight:bold;color:${e.separatorColor||"#222"};">${e.separator.repeat(e.separatorLength||12)}</div>`:"",i=`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="flex:2;min-width:160px;text-align:${e.minInstitAlign||"left"};">
          ${e.ministere?`<div style="font-weight:bold;font-size:${e.ministereFontSize||16}px;">${e.ministere}</div>`:""}
          ${t}
          ${(e.institutions||[]).map($=>`
            <div style="
              font-weight:${$.bold?"bold":"normal"};
              font-style:${$.italic?"italic":"normal"};
              text-decoration:${$.underline?"underline":"none"};
              color:${$.color||"#222"};
              font-size:${e.institFontSize||14}px;">
              ${$.text||""}
            </div>`).join(t)}
        </div>
        <div style="flex:1;text-align:center;">
          ${e.logoUrl?`<img src="${e.logoUrl}" alt="logo" style="max-height:60px;" />`:""}
        </div>
        <div style="flex:1;min-width:160px;text-align:${e.styleOptions?.pays?.align||"right"};">
          ${e.pays?`<div style="
              font-weight:${e.styleOptions?.pays?.bold?"bold":"normal"};
              font-style:${e.styleOptions?.pays?.italic?"italic":"normal"};
              text-decoration:${e.styleOptions?.pays?.underline?"underline":"none"};
              color:${e.styleOptions?.pays?.color||"#222"};
              font-size:${e.styleOptions?.pays?.fontSize||14}px;">
              ${e.pays}
            </div>`:""}
          ${e.styleOptions?.paysSeparator?.char?`<div style="
              color:${e.styleOptions.paysSeparator.color||"#222"};
              font-weight:${e.styleOptions.paysSeparator.bold?"bold":"normal"};
              font-style:${e.styleOptions.paysSeparator.italic?"italic":"normal"};
              text-decoration:${e.styleOptions.paysSeparator.underline?"underline":"none"};
              font-size:${e.styleOptions?.paysSeparator.fontSize||12}px;">
              ${e.styleOptions.paysSeparator.char.repeat(e.styleOptions.paysSeparator.count||10)}
            </div>`:""}
          ${e.devise?`<div style="
              font-style:${e.styleOptions?.devise?.italic?"italic":"normal"};
              font-weight:${e.styleOptions?.devise?.bold?"bold":"normal"};
              text-decoration:${e.styleOptions?.devise?.underline?"underline":"none"};
              color:${e.styleOptions?.devise?.color||"#222"};
              font-size:${e.styleOptions?.devise?.fontSize||12}px;">
              ${e.devise}
            </div>`:""}
        </div>
      </div>
    `,b=e.signataire?`
      <div style="display:flex;justify-content:${e.signataireAlign||"right"};margin-top:24px;">
        <div style="text-align:${e.signataireAlign||"right"};margin-top:${e.signataireOffsetY||0}px;">
          ${e.signataire?`<div>${e.signataire}</div>`:""}
          ${e.grade?`<div>${e.grade}</div>`:""}
          ${e.titre?`<div>${e.titre}</div>`:""}
          ${e.signatureUrl?`<img src="${e.signatureUrl}" alt="signature" style="max-height:48px;" />`:""}
        </div>
      </div>
    `:"";return{entete:i,pied:b}},[]),s=u.useCallback(()=>{if(o?.documentTitle||o?.headerTitle)return o.documentTitle||o.headerTitle;const e=["Liste des lots"];return m.trim()&&e.push(`Recherche : ${m.trim()}`),e.join(" — ")},[o,m]),p=u.useCallback(()=>{const e=[`Total : ${a.length} lot${a.length>1?"s":""}`];return m.trim()&&e.push(`Filtre recherche : "${m.trim()}"`),e},[a,m]),w=u.useCallback(e=>e==null||e===""?"—":typeof e=="string"||typeof e=="number"?String(e):J.isValidElement(e)?q.renderToStaticMarkup(e):typeof e=="object"?JSON.stringify(e):String(e),[]),g=u.useCallback(e=>{const{entete:t,pied:i}=S(o),b=p(e),$=f.filter(l=>l.key!=="actions").map(l=>`<th>${l.title}</th>`).join(""),y=e.length?e.map(l=>`<tr>${f.filter(v=>v.key!=="actions").map(v=>{const M=v.exporter?v.exporter(l):typeof v.render=="function"?v.render(l[v.dataIndex],l,0):l[v.dataIndex];return`<td>${w(M)}</td>`}).join("")}</tr>`).join(""):`<tr><td colspan="${Math.max(1,f.length-1)}">Aucune donnée</td></tr>`;return`
      ${t}
      <div style="text-align:center;margin:12px 0 18px 0;">
        <h1 style="margin:0;font-size:20px;">${s()}</h1>
      </div>
      ${b.length?`<div style="margin-bottom:12px;font-size:13px;">${b.map(l=>`<div>${l}</div>`).join("")}</div>`:""}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${$}</tr></thead>
        <tbody>${y}</tbody>
      </table>
      ${i}
    `},[f,o,S,s,p,w]),U=u.useCallback((e=a)=>{if(!e.length){T.warning("Aucune donnée à imprimer.");return}const t=g(e),i=window.open("","_blank","width=1200,height=900");i&&(i.document.write(`
        <html>
          <head>
            <title>${s()}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f25; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #b0c4b1; padding: 6px 8px; font-size: 12px; text-align: left; }
              th { background: #e3f1e6; text-transform: uppercase; letter-spacing: 0.4px; }
            </style>
          </head>
          <body>${t}</body>
        </html>
      `),i.document.close(),i.focus(),i.print())},[a,g,s]),B=u.useCallback((e=a)=>{if(!e.length){T.warning("Aucune donnée à exporter.");return}const t=g(e),i=new Blob([`<html><head><meta charset="utf-8"/></head><body>${t}</body></html>`],{type:"application/vnd.ms-excel"});N.saveAs(i,"lots.xls")},[a,g]),G=u.useCallback((e=a)=>{if(!e.length){T.warning("Aucune donnée à exporter.");return}const t=p(e),i=new P({children:f.filter(y=>y.key!=="actions").map(y=>new D({children:[new j({children:[new F({text:String(y.title),bold:!0})]})]}))}),b=e.map(y=>new P({children:f.filter(l=>l.key!=="actions").map(l=>(typeof l.render=="function"?l.render(y[l.dataIndex],y,0)??y[l.dataIndex]:y[l.dataIndex],new D({children:[new j({children:[new F({text:w(raw)})]})]})))})),$=new K({sections:[{children:[new j({text:s(),heading:"Heading1",alignment:C.CENTER}),...t.length?[new j({text:" "}),...t.map(y=>new j({text:y}))]:[],new Y({rows:[i,...b]}),...o?.signataire?[new j({text:" "}),new j({text:o.signataire,alignment:C.RIGHT}),o.grade?new j({text:o.grade,alignment:C.RIGHT}):null,o.titre?new j({text:o.titre,alignment:C.RIGHT}):null].filter(Boolean):[]]}]});Z.toBlob($).then(y=>N.saveAs(y,"lots.docx")).then(()=>T.success("Export Word généré.")).catch(()=>T.error("Échec de l’export Word."))},[a,f,p,s,o]);return n.jsxs("div",{className:"lot-list-page",children:[n.jsx("div",{className:"lot-list-overlay"}),n.jsxs(L,{className:"lot-list-shell",bordered:!1,children:[n.jsxs("div",{className:"lot-list-header",children:[n.jsxs("div",{children:[n.jsx(ce,{level:3,className:"lot-list-title",children:"Gestion des lots"}),n.jsx(z,{className:"lot-list-subtitle",children:"Consultez, recherchez et mettez à jour les lots d’armement en un coup d’œil."})]}),n.jsxs(R,{className:"lot-list-actions",wrap:!0,children:[n.jsx(A,{type:"primary",icon:n.jsx(X,{}),onClick:()=>x("/dashboard/lots/add"),children:"Ajouter un lot"}),n.jsx(A,{icon:n.jsx(ee,{}),onClick:_,children:"Rafraîchir"})]})]}),n.jsx(L,{className:"lot-list-search-card",size:"small",bordered:!1,children:n.jsx(te,{className:"lot-list-search-input",placeholder:"Rechercher par désignation...",prefix:n.jsx(ne,{}),value:m,onChange:e=>k(e.target.value),allowClear:!0})}),n.jsx(L,{className:"lot-list-table-card",size:"small",bordered:!1,children:n.jsx(I,{columns:f,dataSource:a,rowKey:e=>e.id||e._id||e.uuid||Math.random().toString(36).slice(2,9),pagination:{pageSize:10,showSizeChanger:!1},bordered:!0,loading:O,locale:{emptyText:n.jsx(re,{description:"Aucun lot trouvé"})},summary:()=>n.jsx(I.Summary,{children:n.jsxs(I.Summary.Row,{children:[n.jsx(I.Summary.Cell,{index:0,children:"Total"}),n.jsx(I.Summary.Cell,{index:1,colSpan:f.length-1,children:`${a.length} lot${a.length>1?"s":""}`})]})})})}),n.jsx(L,{className:"lot-list-preview-card",size:"small",bordered:!1,children:n.jsxs(R,{direction:"vertical",size:"middle",style:{width:"100%"},children:[n.jsx(z,{strong:!0,children:"Impression & export"}),n.jsx(z,{type:"secondary",children:"Utilise la configuration d’entête/pied définie dans l’administration."}),n.jsxs(R,{wrap:!0,children:[n.jsx(A,{onClick:()=>U(),icon:n.jsx(ie,{}),children:"Imprimer"}),n.jsx(A,{onClick:()=>B(),icon:n.jsx(oe,{}),children:"Export Excel"}),n.jsx(A,{onClick:()=>G(),icon:n.jsx(se,{}),children:"Export Word"})]})]})})]})]})}export{Xe as default};
