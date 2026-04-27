import{r as s,a as G,j as o}from"./index-DKyqVP6r.js";import{E as J,a as Q}from"./jspdf.plugin.autotable-CODx3WaQ.js";import{u as C,w as Z}from"./xlsx-nGF3hY23.js";import{s as y}from"./index-BQr7vixy.js";import{C as ee}from"./index-tg_Ks76S.js";import{R as A,C as w}from"./row-fjdca5ke.js";import{I as oe}from"./index-Mfp0EmDw.js";import{S as v}from"./index-D9j222H_.js";import{F as te}from"./Table-d4PXuaBY.js";import{S as I}from"./index-7tl3SuU5.js";import{B as m}from"./button-Cf2Goh1L.js";import{R as re}from"./ReloadOutlined-C-nbBXbW.js";import{R as x}from"./DownloadOutlined-B1U2Jd2W.js";import{R as ne}from"./PrinterOutlined-DDj61nTJ.js";import{R as ie}from"./PlusOutlined-QZxB4lvw.js";import{R as ae}from"./EditOutlined-DpW5MRR2.js";import{R as le}from"./DeleteOutlined-Cq95VXQv.js";import"./InfoCircleFilled-DMDwlTGQ.js";import"./Skeleton-CkLa95QB.js";import"./EllipsisOutlined-WJzTcwvA.js";import"./useBreakpoint-CLx3D4jQ.js";import"./Overflow-GikAWld_.js";import"./PlusOutlined-ByZyTB3m.js";import"./index-BOWIBt1C.js";import"./getAllowClear-ikA_LELg.js";import"./SearchOutlined-Cz2pwBna.js";import"./Input-bsbeShzr.js";import"./ContextIsolator-DC5KAzmm.js";import"./TextArea-WicvUd4y.js";import"./PurePanel-DAEI6F6O.js";import"./useIcons-DK2b5h_3.js";import"./CheckOutlined-ibfetZQ_.js";import"./DownOutlined-D9vZwTSh.js";import"./styleChecker-BTZiFqkq.js";import"./index-CR0Zw8MX.js";import"./useBubbleLock-Ds4vqhwo.js";import"./FileOutlined-nKQzFF_w.js";import"./index-DrkWCuIY.js";import"./useForm-B0mdsUN-.js";import"./index-T7A22YUT.js";import"./extendsObject-78o_rR5W.js";import"./AntdIcon-Dx9R3x8l.js";import"./DownloadOutlined-DTidZHln.js";import"./EditOutlined-DdmGLkPL.js";import"./DeleteOutlined-DFutYCzo.js";const{Option:E}=v;function ro(){const[d,j]=s.useState([]),[p,L]=s.useState([]),[u,$]=s.useState([]),[h,z]=s.useState([]),[f,B]=s.useState([]),[se,N]=s.useState([]),[F,k]=s.useState(!1),[U,T]=s.useState(null),[D,O]=s.useState(null),[W,K]=s.useState(""),[_,de]=s.useState("parent_id"),[S,ce]=s.useState("province_id"),[me,R]=s.useState(null),P=G(),n=(e,t)=>e.find(r=>String(r.id)===String(t))?.nom||"";s.useEffect(()=>{k(!0),Promise.all([window.electronAPI.getCoordinationCommunaleList?.()||window.electronAPI.getCoordinationCommunales?.(),window.electronAPI.getProvinces?.(),window.electronAPI.getRegions?.(),window.electronAPI.getCommunes?.(),window.electronAPI.getCoordinationProvincialeList?.()||window.electronAPI.getCoordinationProvinciales?.(),window.electronAPI.getLocalites?.()]).then(([e,t,r,i,a,l])=>{j(Array.isArray(e)?e:[]),L(Array.isArray(t)?t:[]),$(Array.isArray(r)?r:[]),z(Array.isArray(i)?i:[]),B(Array.isArray(a)?a:[]),N(Array.isArray(l)?l:[])}).catch(()=>{y.error("Erreur lors du chargement des données")}).finally(()=>k(!1))},[]),s.useMemo(()=>{const e={},t=new Set,r=new Set;d.forEach(l=>{const c=l[_],b=l[S];t.add(c),r.add(b),e[c]||(e[c]={}),e[c][b]=(e[c][b]||0)+1});const i=Array.from(t),a=Array.from(r);return{rows:e,rowArr:i,colArr:a}},[d,_,S]);const M=async e=>{if(window.confirm("Confirmer la suppression de cette coordination communale ?")){R(e);try{await window.electronAPI.deleteCoordinationCommunale?.(e),j(t=>t.filter(r=>r.id!==e)),y.success("Coordination communale supprimée.")}catch{y.error("Erreur lors de la suppression")}finally{R(null)}}},H=()=>{const e=[["#","Nom","Code","Commune","Province","Région","Coord. Provinciale"]];d.forEach((l,c)=>{e.push([c+1,l.nom,l.code,n(h,l.commune_id),n(p,l.province_id),n(u,l.region_id),n(f,l.parent_id)])});const t=e.map(l=>l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join(`
`),r=new Blob([t],{type:"text/csv"}),i=URL.createObjectURL(r),a=document.createElement("a");a.href=i,a.download="coordinations_communales.csv",a.click(),URL.revokeObjectURL(i)},V=()=>{const e=[["#","Nom","Code","Commune","Province","Région","Coord. Provinciale"]];d.forEach((i,a)=>{e.push([a+1,i.nom,i.code,n(h,i.commune_id),n(p,i.province_id),n(u,i.region_id),n(f,i.parent_id)])});const t=C.aoa_to_sheet(e),r=C.book_new();C.book_append_sheet(r,t,"CoordinationsCommunales"),Z(r,"coordinations_communales.xlsx")},X=()=>{let e='<table border="1" style="border-collapse:collapse;"><tr><th>#</th><th>Nom</th><th>Code</th><th>Commune</th><th>Province</th><th>Région</th><th>Coord. Provinciale</th></tr>';d.forEach((a,l)=>{e+=`<tr>
        <td>${l+1}</td>
        <td>${a.nom}</td>
        <td>${a.code}</td>
        <td>${n(h,a.commune_id)}</td>
        <td>${n(p,a.province_id)}</td>
        <td>${n(u,a.region_id)}</td>
        <td>${n(f,a.parent_id)}</td>
      </tr>`}),e+="</table>";const t=new Blob([`<html><head><meta charset="utf-8"></head><body>${e}</body></html>`],{type:"application/msword"}),r=URL.createObjectURL(t),i=document.createElement("a");i.href=r,i.download="coordinations_communales.doc",i.click(),URL.revokeObjectURL(r)},Y=()=>{const e=new J({orientation:g.length>6?"landscape":"portrait",unit:"pt",format:"a4"});e.text("Liste des Coordinations Communales",40,30),Q(e,{startY:50,head:[["#","Nom","Code","Commune","Province","Région","Coord. Provinciale"]],body:d.map((t,r)=>[r+1,t.nom,t.code,n(h,t.commune_id),n(p,t.province_id),n(u,t.region_id),n(f,t.parent_id)]),styles:{fontSize:9},headStyles:{fillColor:[24,144,255]},margin:{left:20,right:20}}),e.save("coordinations_communales.pdf")},q=()=>{const e=document.createElement("style");e.innerHTML=`
      @media print {
        @page { size: ${g.length>6?"landscape":"auto"}; }
      }
    `,document.head.appendChild(e),window.print(),setTimeout(()=>{document.head.removeChild(e)},1e3)},g=[{title:"N°",dataIndex:"numero",key:"numero",width:60,align:"center",fixed:"left",render:(e,t,r)=>r+1,resizable:!0},{title:"Nom",dataIndex:"nom",key:"nom",width:220,render:e=>o.jsx("b",{children:e}),resizable:!0,ellipsis:!1,onCell:()=>({style:{whiteSpace:"normal",wordBreak:"break-word"}})},{title:"Code",dataIndex:"code",key:"code",width:200,align:"center",resizable:!0,ellipsis:!1,onCell:()=>({style:{whiteSpace:"normal",wordBreak:"break-word"}})},{title:"Commune",dataIndex:"commune_id",key:"commune_id",width:180,render:e=>n(h,e),resizable:!0,ellipsis:!1,onCell:()=>({style:{whiteSpace:"normal",wordBreak:"break-word"}})},{title:"Province",dataIndex:"province_id",key:"province_id",width:180,render:e=>n(p,e),resizable:!0,ellipsis:!1,onCell:()=>({style:{whiteSpace:"normal",wordBreak:"break-word"}})},{title:"Région",dataIndex:"region_id",key:"region_id",width:180,render:e=>n(u,e),resizable:!0,ellipsis:!1,onCell:()=>({style:{whiteSpace:"normal",wordBreak:"break-word"}})},{title:"Coord. Provinciale",dataIndex:"parent_id",key:"parent_id",width:220,render:e=>n(f,e),resizable:!0,ellipsis:!1,onCell:()=>({style:{whiteSpace:"normal",wordBreak:"break-word"}})},{title:"Actions",key:"actions",width:100,align:"center",fixed:"right",render:(e,t)=>o.jsxs(I,{children:[o.jsx(m,{type:"link",icon:o.jsx(ae,{}),onClick:()=>P(`/dashboard/coordinations/communale/edit/${t.id}`)}),o.jsx(m,{type:"link",danger:!0,icon:o.jsx(le,{}),onClick:()=>M(t.id)})]})}];return o.jsxs("div",{className:"coord-communale-list-container",children:[o.jsxs(ee,{title:o.jsxs(A,{justify:"space-between",align:"middle",children:[o.jsx(w,{children:o.jsx("span",{style:{fontSize:22,fontWeight:700},children:"Liste des Coordinations Communales"})}),o.jsx(w,{children:o.jsxs(I,{children:[o.jsx(m,{icon:o.jsx(re,{}),onClick:()=>window.location.reload()}),o.jsx(m,{icon:o.jsx(x,{}),onClick:H,children:"CSV"}),o.jsx(m,{icon:o.jsx(x,{}),onClick:V,children:"Excel"}),o.jsx(m,{icon:o.jsx(x,{}),onClick:X,children:"Word"}),o.jsx(m,{icon:o.jsx(x,{}),onClick:Y,children:"PDF"}),o.jsx(m,{icon:o.jsx(ne,{}),onClick:q,children:"Imprimer"}),o.jsx(m,{type:"primary",icon:o.jsx(ie,{}),onClick:()=>P("/dashboard/coordinations/communale/add"),children:"Ajouter"})]})})]}),style:{margin:"24px"},className:"coord-communale-list-card",children:[o.jsxs(A,{gutter:16,style:{marginBottom:16},children:[o.jsx(w,{xs:24,sm:12,md:6,children:o.jsx(oe,{placeholder:"Recherche...",value:W,onChange:e=>K(e.target.value),allowClear:!0})}),o.jsx(w,{xs:24,sm:12,md:6,children:o.jsx(v,{placeholder:"Filtrer par région",allowClear:!0,style:{width:"100%"},value:D,onChange:O,children:u.map(e=>o.jsx(E,{value:e.id,children:e.nom},e.id))})}),o.jsx(w,{xs:24,sm:12,md:6,children:o.jsx(v,{placeholder:"Filtrer par province",allowClear:!0,style:{width:"100%"},value:U,onChange:T,children:p.map(e=>o.jsx(E,{value:e.id,children:e.nom},e.id))})})]}),o.jsx("div",{style:{overflowX:"auto"},children:o.jsx(te,{columns:g,dataSource:d,rowKey:"id",pagination:{pageSize:12},bordered:!0,className:"coord-communale-table strong-grid",loading:F,scroll:{x:"max-content"}})}),o.jsxs("div",{style:{marginTop:16,fontWeight:600},children:["Total : ",d.length," coordination",d.length>1?"s":""]}),o.jsx("style",{children:`
          .coord-communale-table.strong-grid th,
          .coord-communale-table.strong-grid td {
            border: 2px solid #222 !important;
          }
          .coord-communale-table.strong-grid {
            border: 2px solid #222 !important;
          }
          .coord-communale-table .ant-table-cell {
            white-space: normal !important;
            word-break: break-word !important;
          }
        `})]}),o.jsx("style",{children:`
        .coord-communale-list-container {
          background: #f8fafc;
          min-height: 100vh;
          padding: 24px;
        }
        .coord-communale-list-card {
          box-shadow: 0 2px 12px #e6f7ff;
          border-radius: 12px;
        }
        .coord-communale-table th, .coord-communale-table td {
          font-size: 15px;
        }
        .coord-communale-table tr:nth-child(even) {
          background: #f6faff;
        }
        .coord-communale-table tr:hover {
          background: #e6f7ff;
        }
        .pivot-table {
          width: 100%;
          border-collapse: collapse;
        }
        .pivot-table th, .pivot-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .pivot-table th {
          background-color: #f2f2f2;
          font-weight: 600;
        }
        .pivot-table tr:hover {
          background-color: #f1f1f1;
        }
      `})]})}export{ro as default};
