// src/components/VdpFiche.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  Descriptions,
  Button,
  Spin,
  Row,
  Col,
  message,
  Modal,
  Tag,
  Divider,
  Statistic,
  Avatar,
  Space,
} from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, PrinterOutlined, FileWordOutlined, UserOutlined } from "@ant-design/icons";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun } from "docx";
import api from "../api";
import moment from "moment";
import { useNavigate, useParams } from "react-router-dom";
import "./VdpFiche.css";

const resolveApiBase = () => {
  const candidate =
    window.api?.client?.defaults?.baseURL ||
    window.api?.baseURL ||
    window.api?.API_BASE_URL ||
    import.meta.env?.VITE_API_URL;
  if (candidate) return String(candidate).replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  }
  return "http://127.0.0.1:3001/api";
};

const requestJson = async (method, path, body = null) => {
  const target = path.startsWith("/")
    ? `${resolveApiBase()}${path}`
    : `${resolveApiBase()}/${path}`;
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  try {
    const stored =
      localStorage.getItem("auth-token") || localStorage.getItem("auth_token");
    if (stored) {
      init.headers.Authorization = stored.startsWith("Bearer ")
        ? stored
        : `Bearer ${stored}`;
    }
  } catch {
    /* noop */
  }
  if (body && method !== "GET") init.body = JSON.stringify(body);
  if (method === "GET" && body && typeof body === "object") {
    const qs = new URLSearchParams(
      Object.entries(body).filter(([, value]) => value != null && value !== "")
    ).toString();
    const res = await fetch(qs ? `${target}?${qs}` : target, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? null : res.json();
  }
  const res = await fetch(target, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
};

const unwrapVdp = (payload) => {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (Array.isArray(payload?.rows)) return payload.rows[0] || null;
  if (Array.isArray(payload?.data)) return payload.data[0] || null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.item && typeof payload.item === "object") return payload.item;
  return typeof payload === "object" ? payload : null;
};

const pickVdpFromCollection = (collection, key) => {
  const entries = Array.isArray(collection)
    ? collection
    : Array.isArray(collection?.rows)
    ? collection.rows
    : Array.isArray(collection?.data)
    ? collection.data
    : [];
  const target = String(key);
  return (
    entries.find((item) =>
      [item?.id, item?.ID, item?.uuid, item?.UUID]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value) === target)
    ) || null
  );
};

export default function VdpFiche() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vdp, setVdp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalogIds, setCatalogIds] = useState([]);
  const [navState, setNavState] = useState({ prev: null, next: null });
  const [headerFooterConfig, setHeaderFooterConfig] = useState(null);

  // 1. Charger la fiche VDP via IPC
  const loadVdp = useCallback(async () => {
    setLoading(true);
    try {
      const normalizedId = Number.isNaN(Number(id)) ? id : Number(id);
      const fetchers = [
        async () => window.api?.call?.("getVdp", { id }),
        async () => window.api?.call?.("getVdpById", normalizedId),
        async () =>
          typeof api?.getVdpById === "function"
            ? api.getVdpById(normalizedId)
            : null,
        async () => requestJson("GET", `/vdp/${id}`),
      ];
      let detail = null;
      let lastError = null;
      for (const fetcher of fetchers) {
        try {
          const candidate = await fetcher();
          detail = unwrapVdp(candidate);
          if (detail) break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!detail) {
        const listFetchers = [
          async () => window.api?.call?.("getVdpList"),
          async () =>
            typeof api?.getVdpList === "function" ? api.getVdpList() : null,
          async () => requestJson("GET", "/vdp"),
        ];
        for (const fetcher of listFetchers) {
          try {
            const collection = await fetcher();
            detail = pickVdpFromCollection(collection, normalizedId);
            if (detail) break;
          } catch (err) {
            lastError = err;
          }
        }
      }
      if (!detail) {
        console.error("[VdpFiche] VDP introuvable :", lastError);
        Modal.error({
          title: "Introuvable",
          content: "Aucun VDP trouvé pour cet identifiant.",
        });
        return navigate("/dashboard/vdp", { replace: true });
      }
      setVdp(detail);
    } catch (err) {
      console.error("loadVdp", err);
      message.error("Erreur lors du chargement de la fiche VDP.");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadVdp();
  }, [loadVdp]);

  const photoSrc = useMemo(() => {
    if (!vdp?.photo || typeof vdp.photo !== "string") return null;
    if (/^data:|^https?:\/\//i.test(vdp.photo)) return vdp.photo;
    return `data:image/jpeg;base64,${vdp.photo}`;
  }, [vdp?.photo]);
  const age = useMemo(() => {
    if (!vdp?.date_naissance) return null;
    return moment().diff(moment(vdp.date_naissance), "years");
  }, [vdp?.date_naissance]);
  const statusColor = useMemo(
    () => (vdp?.statut_vdp === "En service" ? "green" : "volcano"),
    [vdp?.statut_vdp]
  );
  const qrSrc = useMemo(() => {
    if (!vdp?.code_qr) return null;
    return vdp.code_qr.startsWith("data:")
      ? vdp.code_qr
      : `data:image/png;base64,${vdp.code_qr}`;
  }, [vdp?.code_qr]);

  const signatureBlocks = useMemo(() => {
    const ensureDataUrl = (value) => {
      if (!value || typeof value !== "string") return null;
      return value.startsWith("data:")
        ? value
        : `data:image/png;base64,${value}`;
    };
    const fullName = [vdp?.nom, vdp?.prenom].filter(Boolean).join(" ").trim();
    return [
      {
        key: "vdp",
        label: "Signature du VDP",
        name: fullName || "_____________________",
        src:
          ensureDataUrl(
            vdp?.signature_vdp_url ||
              vdp?.signature_vdp ||
              vdp?.signature_agent ||
              vdp?.signature
          ) || null,
      },
      {
        key: "chef",
        label: "Signature du Chef",
        name:
          vdp?.chef_nom ||
          vdp?.chef_responsable ||
          vdp?.responsable ||
          "_____________________",
        src:
          ensureDataUrl(
            vdp?.signature_chef_url ||
              vdp?.signature_chef ||
              vdp?.signature_responsable
          ) || null,
      },
    ];
  }, [vdp]);

  const formatDate = useCallback((value) => (value ? moment(value).format("DD/MM/YYYY") : "N/C"), []);
  const detailSections = useMemo(
    () => [
      {
        title: "Identité",
        rows: [
          { label: "Nom", value: vdp?.nom || "N/C" },
          { label: "Prénom", value: vdp?.prenom || "N/C" },
          { label: "Sexe", value: vdp?.sexe || "N/C" },
          { label: "Date de naissance", value: formatDate(vdp?.date_naissance) },
          { label: "Lieu de naissance", value: vdp?.lieu_naissance || "N/C" },
          { label: "Statut matrimonial", value: vdp?.statut_matrimonial || "N/C" },
          { label: "Nombre d'enfants", value: vdp?.nb_enfants ?? "N/C" },
        ],
      },
      {
        title: "Documents",
        rows: [
          { label: "Numéro CNIB", value: vdp?.numero_cnib || "N/C" },
          { label: "Date CNIB", value: formatDate(vdp?.date_cnib) },
          { label: "Type VDP", value: vdp?.type_vdp || "N/C" },
          { label: "Date de recrutement", value: formatDate(vdp?.date_recrutement) },
          { label: "Statut VDP", value: vdp?.statut_vdp || "N/C" },
        ],
      },
      {
        title: "Coordonnées",
        rows: [
          { label: "Contact principal", value: vdp?.contacts || "N/C" },
          { label: "Contact d'urgence 1", value: vdp?.contact_urgence1 || "N/C" },
          { label: "Contact d'urgence 2", value: vdp?.contact_urgence2 || "N/C" },
          { label: "Contact d'urgence 3", value: vdp?.contact_urgence3 || "N/C" },
          { label: "Personne à prévenir", value: vdp?.nom_personne_prevenir || "N/C" },
          { label: "Lien", value: vdp?.lien_personne_prevenir || "N/C" },
        ],
      },
      {
        title: "Localisation",
        rows: [
          { label: "Entité", value: vdp?.entite_nom || "N/C" },
          { label: "Sous-entité", value: vdp?.sous_entite_nom || "N/C" },
          { label: "Coordination", value: vdp?.coordination_nom || "N/C" },
          { label: "Région", value: vdp?.region_nom || "N/C" },
          { label: "Province", value: vdp?.province_nom || "N/C" },
          { label: "Commune", value: vdp?.commune_nom || "N/C" },
          { label: "Localité", value: vdp?.localite_nom || "N/C" },
        ],
      },
      {
        title: "Observations",
        rows: [{ label: "Observations", value: vdp?.observation || "Aucune remarque" }],
      },
    ],
    [vdp, formatDate]
  );

  const identitySection = useMemo(
    () => detailSections.find((section) => section.title === "Identité"),
    [detailSections]
  );
  const documentsSection = useMemo(
    () => detailSections.find((section) => section.title === "Documents"),
    [detailSections]
  );
  const coordonneesSection = useMemo(
    () => detailSections.find((section) => section.title === "Coordonnées"),
    [detailSections]
  );
  const localisationSection = useMemo(
    () => detailSections.find((section) => section.title === "Localisation"),
    [detailSections]
  );
  const observationsSection = useMemo(
    () => detailSections.find((section) => section.title === "Observations"),
    [detailSections]
  );

  const identityRows = identitySection?.rows || [];
  const documentRows = documentsSection?.rows || [];
  const coordRows = coordonneesSection?.rows || [];
  const localisationRows = localisationSection?.rows || [];
  const observationText = observationsSection?.rows?.[0]?.value || "Aucune remarque";

  const sexeTagColor = useMemo(() => {
    if (vdp?.sexe === "Féminin") return "magenta";
    if (vdp?.sexe === "Masculin") return "geekblue";
    return "gold";
  }, [vdp?.sexe]);

  const parcoursRows = useMemo(
    () => [
      { label: "Date de recrutement", value: formatDate(vdp?.date_recrutement) },
      { label: "Statut VDP", value: vdp?.statut_vdp || "N/C" },
      { label: "Type VDP", value: vdp?.type_vdp || "N/C" },
    ],
    [formatDate, vdp?.date_recrutement, vdp?.statut_vdp, vdp?.type_vdp]
  );

  const sectionCardStyle = useMemo(
    () => ({ borderRadius: 18, boxShadow: "0 18px 40px -28px rgba(15,76,58,0.55)" }),
    []
  );

  const computeLayout = useCallback(() => {
    const cfg =
      headerFooterConfig && typeof headerFooterConfig === "object"
        ? headerFooterConfig
        : null;
    const person = [vdp?.nom, vdp?.prenom].filter(Boolean).join(" ").trim();
    const baseTitle = cfg?.documentTitle || cfg?.headerTitle || "Fiche VDP";
    const documentTitle = person ? `${baseTitle} — ${person}` : baseTitle;
    const headerLines = [];
    const footerLines = [];
    if (!cfg) {
      return {
        documentTitle,
        headerHtml: "",
        footerHtml: "",
        headerLines,
        footerLines,
      };
    }
    if (cfg.ministere) headerLines.push(cfg.ministere);
    if (Array.isArray(cfg.institutions)) {
      headerLines.push(
        ...cfg.institutions.map((inst) => inst?.text).filter(Boolean)
      );
    }
    if (cfg.pays) headerLines.push(cfg.pays);
    const separator =
      cfg.separator && cfg.separatorLength
        ? `<div style="font-weight:bold;color:${cfg.separatorColor || "#222"};">${cfg.separator.repeat(
            cfg.separatorLength
          )}</div>`
        : "";
    const institutions = Array.isArray(cfg.institutions)
      ? cfg.institutions
          .map(
            (inst) => `<div style="font-weight:${inst?.bold ? "bold" : "normal"};font-style:${inst?.italic ? "italic" : "normal"};text-decoration:${inst?.underline ? "underline" : "none"};color:${inst?.color || "#222"};font-size:${cfg.institFontSize || 14}px;">${inst?.text || ""}</div>`
          )
          .join(separator || "")
      : "";
    const headerHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div style="flex:2;min-width:180px;text-align:${cfg.ministere ? "left" : "center"};">
          ${cfg.ministere ? `<div style="font-weight:bold;font-size:${cfg.ministereFontSize || 16}px;">${cfg.ministere}</div>` : ""}
          ${separator}
          ${institutions}
        </div>
        <div style="flex:1;text-align:center;">
          ${cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Logo" style="max-height:60px;object-fit:contain;" />` : ""}
        </div>
        <div style="flex:1;min-width:180px;text-align:${cfg.styleOptions?.pays?.align || "right"};font-family:${cfg.styleOptions?.pays?.fontFamily || "inherit"};">
          ${cfg.pays ? `<div style="font-weight:${cfg.styleOptions?.pays?.bold ? "bold" : "normal"};font-style:${cfg.styleOptions?.pays?.italic ? "italic" : "normal"};text-decoration:${cfg.styleOptions?.pays?.underline ? "underline" : "none"};color:${cfg.styleOptions?.pays?.color || "#222"};font-size:${cfg.styleOptions?.pays?.fontSize || 16}px;">${cfg.pays}</div>` : ""}
          ${
            cfg.styleOptions?.paysSeparator?.char && cfg.styleOptions?.paysSeparator?.count
              ? `<div style="color:${cfg.styleOptions.paysSeparator.color || "#222"};font-weight:${cfg.styleOptions.paysSeparator.bold ? "bold" : "normal"};font-style:${cfg.styleOptions.paysSeparator.italic ? "italic" : "normal"};text-decoration:${cfg.styleOptions.paysSeparator.underline ? "underline" : "none"};font-family:${cfg.styleOptions.paysSeparator.fontFamily || "inherit"};font-size:${cfg.styleOptions.paysSeparator.fontSize || 14}px;text-align:${cfg.styleOptions.paysSeparator.align || "right"};">${cfg.styleOptions.paysSeparator.char.repeat(cfg.styleOptions.paysSeparator.count)}</div>`
              : ""
          }
          ${cfg.devise ? `<div style="font-style:${cfg.styleOptions?.devise?.italic ? "italic" : "normal"};font-weight:${cfg.styleOptions?.devise?.bold ? "bold" : "normal"};text-decoration:${cfg.styleOptions?.devise?.underline ? "underline" : "none"};color:${cfg.styleOptions?.devise?.color || "#222"};font-size:${cfg.styleOptions?.devise?.fontSize || 14}px;">${cfg.devise}</div>` : ""}
        </div>
      </div>
    `;
    const footerHtml = cfg.signataire
      ? `
        <div style="display:flex;justify-content:${cfg.signataireAlign || "right"};margin-top:24px;">
          <div style="text-align:${cfg.signataireAlign || "right"};margin-left:${cfg.signataireAlign === "left" ? cfg.signataireOffset || 0 : 0}px;margin-right:${cfg.signataireAlign === "right" ? cfg.signataireOffset || 0 : 0}px;margin-top:${cfg.signataireOffsetY || 0}px;">
            <div>${cfg.signataire}</div>
            ${cfg.grade ? `<div>${cfg.grade}</div>` : ""}
            ${cfg.titre ? `<div>${cfg.titre}</div>` : ""}
            ${cfg.signatureUrl ? `<img src="${cfg.signatureUrl}" alt="Signature" style="max-height:40px;object-fit:contain;" />` : ""}
          </div>
        </div>
      `
      : "";
    footerLines.push(
      cfg.signataire || "",
      cfg.grade || "",
      cfg.titre || ""
    );
    return { documentTitle, headerHtml, footerHtml, headerLines, footerLines };
  }, [headerFooterConfig, vdp]);

  const buildPrintHtml = useCallback(() => {
    if (!vdp) return "";
    const { documentTitle, headerHtml, footerHtml } = computeLayout();
    const palette = ["#cf142b", "#0b6b3c"];
    const fullName = [vdp?.nom, vdp?.prenom].filter(Boolean).join(" ").trim() || "N/C";
    const identityPairs = [
      { label: "Nom complet", value: fullName },
      { label: "Sexe", value: vdp?.sexe || "N/C" },
      { label: "Type VDP", value: vdp?.type_vdp || "N/C" },
      { label: "Statut", value: vdp?.statut_vdp || "N/C" },
      { label: "CNIB", value: vdp?.numero_cnib || "N/C" },
      { label: "Contact", value: vdp?.contacts || "N/C" },
      { label: "Entité", value: vdp?.entite_nom || "N/C" },
    ].filter((item) => item.value && item.value !== "N/C");
    const identityHtml = identityPairs
      .map(
        (item, idx) => `
        <div class="print-identity__item">
          <span class="print-identity__label" style="color:${palette[idx % palette.length]};">${item.label}</span>
          <span class="print-identity__value">${item.value}</span>
        </div>
      `
      )
      .join("");
    const [rawIdentity, rawDocuments, rawCoordonnees, rawLocalisation, ...otherSections] = detailSections;
    const renderRows = (rows, offset = 0) =>
      rows
        .map(
          (row, idx) => `
            <tr class="print-section__row">
              <th style="color:${palette[(idx + offset) % palette.length]};">${row.label}</th>
              <td>${row.value ?? "N/C"}</td>
            </tr>
          `
        )
        .join("");
    const signatureHtml = `
      <div class="print-signatures">
        ${signatureBlocks
          .map(
            (block, idx) => `
          <div class="print-signatures__slot">
            <div class="print-signatures__role" style="color:${palette[idx % palette.length]};">${block.label}</div>
            ${
              block.src
                ? `<img class="print-signatures__image" src="${block.src}" alt="${block.label}" />`
                : `<div class="print-signatures__image print-signatures__image--placeholder"></div>`
            }
            <div class="print-signatures__name">${block.name || ""}</div>
          </div>`
          )
          .join("")}
        <div class="print-signatures__qr-wrapper">
          ${
            qrSrc
              ? `<img class="print-signatures__qr" src="${qrSrc}" alt="QR Code" />`
              : `<div class="print-signatures__qr print-signatures__qr--placeholder">QR absent</div>`
          }
        </div>
      </div>
    `;
    const identityDocsHtml =
      identityRows.length || documentRows.length
        ? `
        <section class="print-section print-section--split">
          <div class="print-section__block">
            <div class="print-section__title-each">Identité</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${renderRows(identityRows)}</tbody>
            </table>
          </div>
          <div class="print-section__block">
            <div class="print-section__title-each">Documents</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${renderRows(documentRows, identityRows.length)}</tbody>
            </table>
          </div>
        </section>
      `
        : "";
    const coordLocHtml =
      coordRows.length || localisationRows.length
        ? `
        <section class="print-section print-section--split">
          <div class="print-section__block">
            <div class="print-section__title-each">Coordonnées</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${renderRows(coordRows)}</tbody>
            </table>
          </div>
          <div class="print-section__block">
            <div class="print-section__title-each">Localisation</div>
            <table class="print-section__table print-section__table--tight">
              <tbody>${renderRows(localisationRows, coordRows.length)}</tbody>
            </table>
          </div>
        </section>
      `
        : "";
    const sectionHtml = otherSections
      .map((section, sectionIndex) => {
        const rows = renderRows(section.rows, sectionIndex);
        return `
          <section class="print-section">
            <header class="print-section__header">
              <span class="print-section__badge" style="background:${palette[sectionIndex % palette.length]};"></span>
              <h3 class="print-section__title">${section.title}</h3>
            </header>
            <table class="print-section__table">
              <tbody>${rows}</tbody>
            </table>
          </section>
        `;
      })
      .join("");
    return `
      <html>
        <head>
          <title>${documentTitle}</title>
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
            ${headerHtml ? `<div class="print-header">${headerHtml}</div>` : ""}
            <h1 class="print-title">${documentTitle}</h1>
            <div class="print-identity">
              ${photoSrc
                ? `<img class="print-identity__photo" src="${photoSrc}" alt="Photo" />`
                : `<div class="print-identity__photo print-identity__photo--placeholder">Aucune photo</div>`}
              <div class="print-identity__details">
                ${identityHtml}
              </div>
            </div>
            <div class="print-sections">
              ${identityDocsHtml}
              ${coordLocHtml}
              ${sectionHtml}
            </div>
            ${signatureHtml}
            ${footerHtml ? `<div class="print-footer">${footerHtml}</div>` : ""}
          </div>
        </body>
      </html>
    `;
  }, [computeLayout, coordRows, detailSections, documentRows, identityRows, localisationRows, photoSrc, qrSrc, signatureBlocks, vdp?.contacts, vdp?.entite_nom, vdp?.numero_cnib, vdp?.sexe, vdp?.statut_vdp, vdp?.type_vdp]);

  const handlePrint = useCallback(() => {
    if (!vdp) return;
    const html = buildPrintHtml();
    const win = window.open("", "", "width=1200,height=800");
    if (!win) {
      message.error("Impossible d'ouvrir la fenêtre d'impression.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }, [vdp, buildPrintHtml]);

  const handleExportWord = useCallback(async () => {
    if (!vdp) return;
    const { documentTitle, headerLines, footerLines } = computeLayout();
    const sections = detailSections.flatMap((section) => {
      const header = new Paragraph({ text: section.title, heading: "Heading2" });
      const table = new DocxTable({
        rows: section.rows.map(
          (row) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: row.label || "", bold: true })] })],
                  shading: { fill: "E3F1E6" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: String(row.value ?? "N/C") })] })],
                }),
              ],
            })
        ),
      });
      return [header, table];
    });
    const signatureRows = signatureBlocks.map(
      (block) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: block.label, bold: true })] })],
              shading: { fill: "E3F1E6" },
            }),
            new TableCell({
              children: [
                block.src
                  ? new Paragraph({
                      children: [new TextRun({ text: "[Signature manuscrite]", italics: true })],
                    })
                  : new Paragraph({ children: [new TextRun({ text: "____________________" })] }),
              ],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: block.name || "" })] })],
            }),
          ],
        })
    );
    const doc = new Document({
      sections: [
        {
          children: [
            ...headerLines.map(
              (line) => new Paragraph({ text: line, alignment: "center", bold: true })
            ),
            new Paragraph({ text: documentTitle, heading: "Heading1", alignment: "center" }),
            new Paragraph({ text: "" }),
            ...sections,
            new Paragraph({ text: "" }),
            new DocxTable({ rows: signatureRows }),
            new Paragraph({ text: "" }),
            ...footerLines
              .filter(Boolean)
              .map((line) => new Paragraph({ text: line, alignment: "right" })),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    const safeName = [`VDP_${vdp?.nom || "Fiche"}`, vdp?.prenom].filter(Boolean).join("_").replace(/\s+/g, "_");
    saveAs(blob, `${safeName || "VDP_Fiche"}.docx`);
    message.success("Export Word généré.");
  }, [vdp, computeLayout, detailSections, signatureBlocks]);

  const handleNavigate = useCallback(
    (targetId) => {
      if (!targetId) return;
      navigate(`/dashboard/vdp/fiche/${targetId}`);
    },
    [navigate]
  );

  // 3. Affichage de la fiche
  if (loading) {
    return (
      <Spin
        size="large"
        style={{ display: "block", margin: "100px auto" }}
      />
    );
  }

  return (
    <Card
      title={
        <Row justify="space-between" align="middle">
          <Col>
            <h3 style={{ margin: 0 }}>Fiche VDP</h3>
          </Col>
          <Col>
            <Space>
              <Tag color={statusColor}>{vdp?.statut_vdp || "N/C"}</Tag>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Imprimer
              </Button>
              <Button icon={<FileWordOutlined />} onClick={handleExportWord}>
                Exporter
              </Button>
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
              >
                Retour
              </Button>
              <Button
                icon={<ArrowLeftOutlined />}
                disabled={!navState.prev}
                onClick={() => handleNavigate(navState.prev)}
              />
              <Button
                icon={<ArrowRightOutlined />}
                disabled={!navState.next}
                onClick={() => handleNavigate(navState.next)}
              />
            </Space>
          </Col>
        </Row>
      }
      style={{ margin: 24 }}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card style={sectionCardStyle} bordered={false}>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div style={{ textAlign: "center" }}>
                <Avatar
                  size={120}
                  src={photoSrc}
                  icon={!photoSrc && <UserOutlined />}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ fontWeight: 600, fontSize: 18 }}>
                  {vdp?.nom || "—"} {vdp?.prenom || ""}
                </div>
                <Tag color={sexeTagColor} style={{ marginTop: 6 }}>
                  {vdp?.sexe || "N/C"}
                </Tag>
                <div style={{ color: "#6c757d", marginTop: 6 }}>
                  {vdp?.type_vdp || "Type non défini"}
                </div>
              </div>
              <Row gutter={12} justify="center">
                <Col span={12}>
                  <Statistic
                    title="Âge"
                    value={age ?? "N/C"}
                    suffix={age !== null ? "ans" : ""}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Type"
                    value={vdp?.type_vdp || "N/C"}
                  />
                </Col>
              </Row>
              <Divider plain>Contacts</Divider>
              <Space direction="vertical" size={6}>
                <div><strong>Tél.</strong> : {vdp?.contacts || "N/C"}</div>
                <div><strong>Urgence 1</strong> : {vdp?.contact_urgence1 || "N/C"}</div>
                {vdp?.contact_urgence2 && (
                  <div><strong>Urgence 2</strong> : {vdp.contact_urgence2}</div>
                )}
                {vdp?.contact_urgence3 && (
                  <div><strong>Urgence 3</strong> : {vdp.contact_urgence3}</div>
                )}
                <div>
                  <strong>Personne à prévenir</strong> :{" "}
                  {vdp?.nom_personne_prevenir || "N/C"} ({vdp?.lien_personne_prevenir || "N/R"})
                </div>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card style={sectionCardStyle} title="Identité et documents">
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, fontWeight: 600 }}>
                    {identityRows.map((row) => (
                      <Descriptions.Item key={`identite-${row.label}`} label={row.label}>
                        {row.value ?? "N/C"}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Col>
                <Col xs={24} lg={12}>
                  <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, fontWeight: 600 }}>
                    {documentRows.map((row) => (
                      <Descriptions.Item key={`document-${row.label}`} label={row.label}>
                        {row.value ?? "N/C"}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Col>
              </Row>
            </Card>
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Card style={sectionCardStyle} title="Coordonnées">
                  <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, fontWeight: 600 }}>
                    {coordRows.map((row) => (
                      <Descriptions.Item key={`coord-${row.label}`} label={row.label}>
                        {row.value ?? "N/C"}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card style={sectionCardStyle} title="Localisation">
                  <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, fontWeight: 600 }}>
                    {localisationRows.map((row) => (
                      <Descriptions.Item key={`loc-${row.label}`} label={row.label}>
                        {row.value ?? "N/C"}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Card>
              </Col>
            </Row>
            <Card style={sectionCardStyle} title="Parcours opérationnel">
              <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, fontWeight: 600 }}>
                {parcoursRows.map((row) => (
                  <Descriptions.Item key={`parcours-${row.label}`} label={row.label}>
                    {row.value ?? "N/C"}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
            <Card style={sectionCardStyle} title="Observations">
              <div style={{ minHeight: 72, lineHeight: 1.6 }}>
                {observationText}
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
