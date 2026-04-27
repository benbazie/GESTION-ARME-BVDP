import{j as s,r as x}from"./index-DKyqVP6r.js";import{F as u,a as j,b as g,P as f,c as k,d as S,T as D,e as T}from"./index-DDihIDqM.js";import{u as l,a as E}from"./xlsx-nGF3hY23.js";import{E as v}from"./jspdf.plugin.autotable-CODx3WaQ.js";import{S as C}from"./index-7tl3SuU5.js";import{B as p}from"./button-Cf2Goh1L.js";import{s as d}from"./index-BQr7vixy.js";import{R as I}from"./SearchOutlined-Dn74gCml.js";import"./InfoCircleFilled-DMDwlTGQ.js";import"./SearchOutlined-Cz2pwBna.js";import"./AntdIcon-Dx9R3x8l.js";function _({data:o,fileName:i}){const h=()=>{try{const e=l.json_to_sheet(o),r=l.book_new();l.book_append_sheet(r,e,"Data");const c=E(r,{bookType:"xlsx",type:"array"}),t=new Blob([c],{type:"application/octet-stream"});u.saveAs(t,`${i}.xlsx`)}catch{d.error("Erreur export Excel")}},y=()=>{try{const e=l.json_to_sheet(o),r=l.sheet_to_csv(e),c=new Blob([r],{type:"text/csv"});u.saveAs(c,`${i}.csv`)}catch{d.error("Erreur export CSV")}},w=()=>{try{const e=JSON.stringify(o,null,2),r=new Blob([e],{type:"application/json"});u.saveAs(r,`${i}.json`)}catch{d.error("Erreur export JSON")}},m=()=>{try{const e=new v;if(o.length>0){const r=Object.keys(o[0]),c=o.map(t=>r.map(n=>t[n]));e.autoTable({head:[r],body:c})}e.save(`${i}.pdf`)}catch{d.error("Erreur export PDF")}},b=async()=>{try{if(!o.length)return;const e=Object.keys(o[0]),r=[new j({children:e.map(n=>new g({children:[new f({children:[new k({text:n,bold:!0})]})]}))}),...o.map(n=>new j({children:e.map(a=>new g({children:[new f(String(n[a]??""))]}))}))],c=new S({sections:[{children:[new f({text:i,heading:"Heading1"}),new D({rows:r})]}]}),t=await T.toBlob(c);u.saveAs(t,`${i}.docx`)}catch{d.error("Erreur export Word")}};return s.jsxs(C,{children:[s.jsx(p,{onClick:h,type:"primary",children:"Excel (.xlsx)"}),s.jsx(p,{onClick:y,children:"CSV (.csv)"}),s.jsx(p,{onClick:w,children:"JSON (.json)"}),s.jsx(p,{onClick:m,children:"PDF (.pdf)"}),s.jsx(p,{onClick:b,children:"Word (.docx)"})]})}function M(){const[o,i]=x.useState([]),[h,y]=x.useState(""),[w,m]=x.useState(!1),b=["title","description","date"],e=async()=>{m(!0);try{const t=await window.api.call("getDocumentsImpression",{});i(t.map(n=>({...n,key:n.id.toString()})))}catch(t){message.error(t.message||"Erreur lors du chargement des documents d'impression")}finally{m(!1)}};x.useEffect(()=>{e()},[]);const r=()=>{const t=window.open("","_blank"),n=`
      <html>
        <head>
          <title>Documents & Impression</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Documents & Impression</h1>
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Description</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${o.map(a=>`
                  <tr>
                    <td>${a.title}</td>
                    <td>${a.description}</td>
                    <td>${a.date}</td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;t.document.write(n),t.document.close(),t.print()},c=o.filter(t=>t.title.toLowerCase().includes(h.toLowerCase()));return s.jsxs("div",{className:"documents-impression-container",children:[s.jsx("h1",{children:"Documents & Impression"}),s.jsx(_,{data:o,columns:b,fileName:"Documents_Impression"}),s.jsx(Button,{onClick:r,style:{marginBottom:"20px"},children:"Imprimer"}),s.jsx(Input,{placeholder:"Rechercher par titre...",prefix:s.jsx(I,{}),value:h,onChange:t=>y(t.target.value),style:{marginBottom:"20px",maxWidth:"300px"}}),s.jsx(Table,{columns:[{title:"Titre",dataIndex:"title",key:"title"},{title:"Description",dataIndex:"description",key:"description",ellipsis:!0},{title:"Date",dataIndex:"date",key:"date"}],dataSource:c,loading:w,pagination:{pageSize:10},rowKey:"key"})]})}export{M as default};
