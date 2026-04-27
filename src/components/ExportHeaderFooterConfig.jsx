import React, { useState, useEffect, useCallback } from "react";
import { Card, Form, Input, Button, Upload, Row, Col, Typography, Divider, Select, Checkbox, message, Radio, Switch, Slider, InputNumber } from "antd";
import { PlusOutlined, DeleteOutlined, UploadOutlined, EyeOutlined, SaveOutlined, BgColorsOutlined } from "@ant-design/icons";
import "./ExportHeaderFooterConfig.css";

const { Text, Title } = Typography;
const { Option } = Select;
const SEPARATORS = [
  { label: "Aucun", value: "" },
  { label: "Tiret (—)", value: "—" },
  { label: "Astérisques (********)", value: "*" },
  { label: "Point (·)", value: "·" },
  { label: "Pipe (|)", value: "|" },
  { label: "Slash (/)", value: "/" }
];

const ALIGN_OPTIONS = [
  { label: "Gauche", value: "left" },
  { label: "Centre", value: "center" },
  { label: "Droite", value: "right" }
];

const SIGNATAIRE_ALIGN = [
  { label: "Gauche", value: "left" },
  { label: "Centre", value: "center" },
  { label: "Droite", value: "right" }
];

const DATE_ALIGN = [
  { label: "Gauche", value: "left" },
  { label: "Centre", value: "center" },
  { label: "Droite", value: "right" }
];

const FONT_SIZES = [
  { label: "Petit", value: 13 },
  { label: "Normal", value: 16 },
  { label: "Grand", value: 20 },
  { label: "Très grand", value: 26 }
];

const PAYS_ALIGN_OPTIONS = [
  { label: "Gauche", value: "left" },
  { label: "Centre", value: "center" },
  { label: "Droite", value: "right" }
];
const FONT_FAMILIES = [
  { label: "Défaut", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Roboto", value: "'Roboto', sans-serif" }
];
const COLORS = [
  { label: "Noir", value: "#222" },
  { label: "Bleu", value: "#1d4f82" },
  { label: "Vert", value: "#2e7d32" },
  { label: "Rouge", value: "#d32f2f" },
  { label: "Gris", value: "#888" }
];

const STYLE_TARGETS = [
  { label: "Pays", value: "pays" },
  { label: "Devise", value: "devise" },
  { label: "Séparateur pays/devise", value: "paysSeparator" }
];
const FOOTER_OFFSET_RANGE = {
  x: { min: -400, max: 800 },
  y: { min: -120, max: 260 },
};

export const DEFAULT_CONFIG = {
  headerTitle: "Liste des armes",
  documentTitle: "Liste des armes",
  headerSubtitle: "",
  logoUrl: "",
  minInstitAlign: "left",
  institutions: [],
  separator: "",
  separatorLength: 12,
  separatorColor: "#222222",
  pays: "",
  devise: "",
  signataire: "",
  grade: "",
  titre: "",
  signataireAlign: "right",
  signataireOffset: 0,
  signataireOffsetY: 0,
  signatureUrl: "",
  styleOptions: {
    pays: {
      align: "right",
      bold: true,
      italic: false,
      underline: false,
      color: "#222222",
      fontSize: 14,
      fontFamily: "inherit",
    },
    paysSeparator: {
      char: "",
      count: 0,
      align: "right",
      bold: false,
      italic: false,
      underline: false,
      color: "#222222",
      fontSize: 12,
      fontFamily: "inherit",
    },
    devise: {
      align: "right",
      bold: false,
      italic: true,
      underline: false,
      color: "#222222",
      fontSize: 12,
      fontFamily: "inherit",
    },
  },
};

const resolveInputValue = (payload) => {
  if (payload && typeof payload === "object" && "target" in payload) {
    const { target } = payload;
    return target.type === "checkbox" ? target.checked : target.value;
  }
  return payload;
};

export default function ExportHeaderFooterConfig({
  value = {},
  onChange,
  preview = false,
  style = {},
  configs = [],
  onSelectConfig,
  onAddConfig,
  onDeleteConfig,
  selectedConfigKey,
}) {
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState(value.logoUrl || "");
  const [minInstitAlign, setMinInstitAlign] = useState(value.minInstitAlign || "left");
  const [separator, setSeparator] = useState(value.separator || "—");
  const [separatorColor, setSeparatorColor] = useState(value.separatorColor || "#222");
  const [institutions, setInstitutions] = useState(
    Array.isArray(value.institutions) && value.institutions.length > 0
      ? value.institutions.map(inst =>
          typeof inst === "string"
            ? { text: inst, bold: false, italic: false, underline: false, color: "#222" }
            : {
                text: inst.text || "",
                bold: !!inst.bold,
                italic: !!inst.italic,
                underline: !!inst.underline,
                color: inst.color || "#222"
              }
        )
      : [{ text: "", bold: false, italic: false, underline: false, color: "#222" }]
  );
  const [signatureUrl, setSignatureUrl] = useState(value.signatureUrl || "");
  const [signataireAlign, setSignataireAlign] = useState(value.signataireAlign || "right");
  const [signataireOffset, setSignataireOffset] = useState(value.signataireOffset || 0);
  const [signataireOffsetY, setSignataireOffsetY] = useState(value.signataireOffsetY || 0); // vertical
  const [showPreview, setShowPreview] = useState(false);
  const [configName, setConfigName] = useState(value.name || "");
  const [localConfig, setLocalConfig] = useState({ ...value });
  const [showDate, setShowDate] = useState(
    value.showDate !== undefined ? value.showDate : true
  );
  const [dateAlign, setDateAlign] = useState(value.dateAlign || "right");
  const [dateOffset, setDateOffset] = useState(value.dateOffset || 0);
  const [paysAlign, setPaysAlign] = useState(value.paysAlign || "right");
  const [paysFont, setPaysFont] = useState(value.paysFont || "inherit");
  const [paysColor, setPaysColor] = useState(value.paysColor || "#222");
  const [paysSeparator, setPaysSeparator] = useState(value.paysSeparator || "*");
  const [paysSepCount, setPaysSepCount] = useState(value.paysSepCount || 14);
  const [deviseFontSize, setDeviseFontSize] = useState(value.deviseFontSize || 13);
  const [ministereFontSize, setMinistereFontSize] = useState(value.ministereFontSize || 16);
  const [institFontSize, setInstitFontSize] = useState(value.institFontSize || 14);
  const [separatorLength, setSeparatorLength] = useState(value.separatorLength || 14);
  const [styleTarget, setStyleTarget] = useState("pays");
  const [styleOptions, setStyleOptions] = useState({
    pays:     { color: "#222", fontSize: 16, fontFamily: "inherit", bold: true, italic: false, underline: false, align: "right" },
    devise:   { color: "#4f7092", fontSize: 13, fontFamily: "inherit", bold: false, italic: true, underline: false, align: "right" },
    paysSeparator: { color: "#222", fontSize: 15, fontFamily: "inherit", bold: true, italic: false, underline: false, align: "right", char: "*", count: 14 }
  });
  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CONFIG,
    ...(value || {})
  }));
  const [logoPreview, setLogoPreview] = useState(() => value?.logoUrl || "");
  const [signaturePreview, setSignaturePreview] = useState(() => value?.signatureUrl || "");
  const [activeSection, setActiveSection] = useState("header");
  const [footerPosition, setFooterPosition] = useState(
    value.footerPosition || { x: 0, y: 0 }
  );
  const [footerAnchor, setFooterAnchor] = useState(value.footerAnchor || "left");

  const updateConfig = useCallback(updater => {
    setConfig(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  useEffect(() => {
    form.setFieldsValue({
      ministere: value.ministere || "",
      pays: value.pays || "",
      devise: value.devise || "",
      signataire: value.signataire || "",
      grade: value.grade || "",
      titre: value.titre || "",
      date: value.date || "",
      heure: value.heure || "",
    });
    setLogoUrl(value.logoUrl || "");
    setMinInstitAlign(value.minInstitAlign || "left");
    setSeparator(value.separator || "—");
    setSeparatorColor(value.separatorColor || "#222");
    setSignatureUrl(value.signatureUrl || "");
    setSignataireAlign(value.signataireAlign || "right");
    setSignataireOffset(value.signataireOffset || 0);
    setSignataireOffsetY(value.signataireOffsetY || 0);
    setDateAlign(value.dateAlign || "right");
    setDateOffset(value.dateOffset || 0);
    setPaysAlign(value.paysAlign || "right");
    setPaysFont(value.paysFont || "inherit");
    setPaysColor(value.paysColor || "#222");
    setPaysSeparator(value.paysSeparator || "*");
    setPaysSepCount(value.paysSepCount || 14);
    setDeviseFontSize(value.deviseFontSize || 13);
    setMinistereFontSize(value.ministereFontSize || 16);
    setInstitFontSize(value.institFontSize || 14);
    setSeparatorLength(value.separatorLength || 14);
    setFooterPosition(value.footerPosition || { x: 0, y: 0 });
    setFooterAnchor(value.footerAnchor || "left");
    setInstitutions(
      Array.isArray(value.institutions) && value.institutions.length > 0
        ? value.institutions.map(inst =>
            typeof inst === "string"
              ? { text: inst, bold: false, italic: false, underline: false, color: "#222" }
              : {
                  text: inst.text || "",
                  bold: !!inst.bold,
                  italic: !!inst.italic,
                  underline: !!inst.underline,
                  color: inst.color || "#222"
                }
          )
        : [{ text: "", bold: false, italic: false, underline: false, color: "#222" }]
    );
    setConfigName(value.name || "");
    setLocalConfig({ ...value });
    setShowDate(value.showDate !== undefined ? value.showDate : true);
    setDateAlign(value.dateAlign || "right");
    if (value.styleOptions) {
      setStyleOptions(prev => ({
        pays: { ...prev.pays, ...(value.styleOptions.pays || {}) },
        devise: { ...prev.devise, ...(value.styleOptions.devise || {}) },
        paysSeparator: { ...prev.paysSeparator, ...(value.styleOptions.paysSeparator || {}) },
      }));
    }
    setLocalConfig({ ...value });
  }, [value, form]);

  const buildConfigSnapshot = useCallback(
    (patch = {}) => {
      const formValues = form.getFieldsValue();
      const snapshot = {
        ...localConfig,
        ...formValues,
        ...patch,
        logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : logoUrl,
        signatureUrl: patch.signatureUrl !== undefined ? patch.signatureUrl : signatureUrl,
        minInstitAlign: patch.minInstitAlign !== undefined ? patch.minInstitAlign : minInstitAlign,
        separator: patch.separator !== undefined ? patch.separator : separator,
        separatorColor: patch.separatorColor !== undefined ? patch.separatorColor : separatorColor,
        institutions: patch.institutions !== undefined ? patch.institutions : institutions,
        signataireAlign: patch.signataireAlign !== undefined ? patch.signataireAlign : signataireAlign,
        signataireOffset: patch.signataireOffset !== undefined ? patch.signataireOffset : signataireOffset,
        signataireOffsetY: patch.signataireOffsetY !== undefined ? patch.signataireOffsetY : signataireOffsetY,
        showDate: patch.showDate !== undefined ? patch.showDate : showDate,
        dateAlign: patch.dateAlign !== undefined ? patch.dateAlign : dateAlign,
        dateOffset: patch.dateOffset !== undefined ? patch.dateOffset : dateOffset,
        paysAlign: patch.paysAlign !== undefined ? patch.paysAlign : paysAlign,
        paysFont: patch.paysFont !== undefined ? patch.paysFont : paysFont,
        paysColor: patch.paysColor !== undefined ? patch.paysColor : paysColor,
        paysSeparator: patch.paysSeparator !== undefined ? patch.paysSeparator : paysSeparator,
        paysSepCount: patch.paysSepCount !== undefined ? patch.paysSepCount : paysSepCount,
        deviseFontSize: patch.deviseFontSize !== undefined ? patch.deviseFontSize : deviseFontSize,
        ministereFontSize: patch.ministereFontSize !== undefined ? patch.ministereFontSize : ministereFontSize,
        institFontSize: patch.institFontSize !== undefined ? patch.institFontSize : institFontSize,
        separatorLength: patch.separatorLength !== undefined ? patch.separatorLength : separatorLength,
        footerPosition: patch.footerPosition !== undefined ? patch.footerPosition : footerPosition,
        footerAnchor: patch.footerAnchor !== undefined ? patch.footerAnchor : footerAnchor,
        styleOptions: patch.styleOptions || styleOptions,
        name: patch.name !== undefined ? patch.name : configName,
      };
      return snapshot;
    },
    [
      form,
      localConfig,
      logoUrl,
      signatureUrl,
      minInstitAlign,
      separator,
      separatorColor,
      institutions,
      signataireAlign,
      signataireOffset,
      signataireOffsetY,
      showDate,
      dateAlign,
      dateOffset,
      paysAlign,
      paysFont,
      paysColor,
      paysSeparator,
      paysSepCount,
      deviseFontSize,
      ministereFontSize,
      institFontSize,
      separatorLength,
      styleOptions,
      configName,
    ]
  );

  const syncConfig = useCallback(
    (patch = {}) => {
      const snapshot = buildConfigSnapshot(patch);
      setLocalConfig(snapshot);
      onChange?.(snapshot);
    },
    [buildConfigSnapshot, onChange]
  );

  const updateStyleOptions = useCallback(
    (updater, extraPatch = {}) => {
      setStyleOptions(prev => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        syncConfig({ styleOptions: next, ...extraPatch });
        return next;
      });
    },
    [syncConfig]
  );

  const triggerChange = useCallback(
    (changed = {}) => {
      syncConfig(changed);
    },
    [syncConfig]
  );

  const handleLogoChange = useCallback(event => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e =>
      updateConfig(prev => ({ ...prev, logoUrl: e.target?.result || "" }));
    reader.readAsDataURL(file);
  }, [updateConfig]);

  const handleSeparatorChange = useCallback((field, value) => {
    updateConfig(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      if (field === "char" || field === "character") {
        next.separator = value;
      } else if (field === "length") {
        next.separatorLength = Number(value) || 0;
      } else if (field === "color") {
        next.separatorColor = value;
      } else {
        next[field] = value;
      }
      return next;
    });
  }, [updateConfig]);

  const handleSignatureChange = (info) => {
    const file = info.file?.originFileObj || info.file;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const dataUrl = typeof event.target?.result === "string" ? event.target.result : "";
      if (!dataUrl) return;
      setSignatureUrl(dataUrl);
      syncConfig({ signatureUrl: dataUrl });
    };
    reader.onerror = () => {
      console.warn("[ExportHeaderFooterConfig] Impossible de lire la signature.");
    };
    reader.readAsDataURL(file);
  };

  const handleDeviseFontSize = (val) => {
    setDeviseFontSize(val);
    updateStyleOptions(prev => ({
      ...prev,
      devise: { ...prev.devise, fontSize: val },
    }), { deviseFontSize: val });
  };

  const handleMinistereFontSize = (val) => {
    setMinistereFontSize(val);
    syncConfig({ ministereFontSize: val });
  };

  const handleInstitFontSize = (val) => {
    setInstitFontSize(val);
    syncConfig({ institFontSize: val });
  };

  const handleSeparatorLength = (val) => {
    setSeparatorLength(val);
    syncConfig({ separatorLength: val });
  };

  const handleStyleChange = (field, value) => {
    updateStyleOptions(prev => ({
      ...prev,
      [styleTarget]: {
        ...prev[styleTarget],
        [field]: value,
      },
    }));
  };

  const handleStyleTarget = (val) => {
    setStyleTarget(val);
  };

  const handlePaysAlign = (val) => {
    setPaysAlign(val);
    updateStyleOptions(prev => ({
      ...prev,
      pays: { ...prev.pays, align: val },
    }), { paysAlign: val });
  };

  const handlePaysFont = (val) => {
    setPaysFont(val);
    updateStyleOptions(prev => ({
      ...prev,
      pays: { ...prev.pays, fontFamily: val },
    }), { paysFont: val });
  };

  const handlePaysColor = (val) => {
    setPaysColor(val);
    updateStyleOptions(prev => ({
      ...prev,
      pays: { ...prev.pays, color: val },
    }), { paysColor: val });
  };

  const handlePaysSeparator = (val) => {
    setPaysSeparator(val);
    updateStyleOptions(prev => ({
      ...prev,
      paysSeparator: { ...prev.paysSeparator, char: val },
    }), { paysSeparator: val });
  };

  const handlePaysSepCount = (val) => {
    setPaysSepCount(val);
    updateStyleOptions(prev => ({
      ...prev,
      paysSeparator: { ...prev.paysSeparator, count: val },
    }), { paysSepCount: val });
  };

  const addInstitution = useCallback(() => {
    setInstitutions(prev => {
      const next = [...prev, { text: "", bold: false, italic: false, underline: false, color: "#222" }];
      syncConfig({ institutions: next });
      return next;
    });
  }, [syncConfig]);

  const removeInstitution = useCallback((index) => {
    setInstitutions(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((_, idx) => idx !== index);
      syncConfig({ institutions: next });
      return next;
    });
  }, [syncConfig]);

  const handleInstitutionChange = useCallback((index, field, payload) => {
    const resolved = resolveInputValue(payload);
    setInstitutions(prev => {
      const next = prev.map((inst, idx) =>
        idx === index ? { ...inst, [field]: resolved } : inst
      );
      syncConfig({ institutions: next });
      return next;
    });
  }, [syncConfig]);

  const handleSignataireOffset = useCallback((value) => {
    setSignataireOffset(value);
    syncConfig({ signataireOffset: value });
  }, [syncConfig]);

  const handleSignataireOffsetY = useCallback((value) => {
    setSignataireOffsetY(value);
    syncConfig({ signataireOffsetY: value });
  }, [syncConfig]);

  const handleDateOffset = useCallback((value) => {
    setDateOffset(value);
    syncConfig({ dateOffset: value });
  }, [syncConfig]);

  const handleShowDate = useCallback((checked) => {
    setShowDate(checked);
    syncConfig({ showDate: checked });
  }, [syncConfig]);

  const handleFooterPosition = useCallback(
    (axis, value) => {
      setFooterPosition(prev => {
        const next = { ...prev, [axis]: value };
        syncConfig({ footerPosition: next });
        return next;
      });
    },
    [syncConfig]
  );

  const handleFooterAnchor = useCallback(
    (anchor) => {
      setFooterAnchor(anchor);
      syncConfig({ footerAnchor: anchor });
    },
    [syncConfig]
  );

  const handleAddConfig = useCallback(async () => {
    const snapshot = buildConfigSnapshot({ name: (configName || "").trim() });
    if (!snapshot.name) {
      message.warning("Veuillez renseigner un nom de configuration.");
      return;
    }
    if (onAddConfig) {
      await Promise.resolve(onAddConfig(snapshot));
    }
    syncConfig(snapshot);
  }, [buildConfigSnapshot, configName, onAddConfig, syncConfig]);

  const handleSelectConfig = useCallback((key) => {
    onSelectConfig?.(key);
  }, [onSelectConfig]);

  const handleDeleteConfig = useCallback((key) => {
    if (!key) return;
    onDeleteConfig?.(key);
  }, [onDeleteConfig]);

  const renderPreview = (cfgOverride = {}) => {
    const cfg = { ...buildConfigSnapshot(), ...cfgOverride };
    const effectiveStyles = {
      pays: { ...styleOptions.pays, ...(cfg.styleOptions?.pays || {}) },
      devise: { ...styleOptions.devise, ...(cfg.styleOptions?.devise || {}) },
      paysSeparator: { ...styleOptions.paysSeparator, ...(cfg.styleOptions?.paysSeparator || {}) },
    };

    const footerOffsetX = cfg.footerPosition?.x ?? 0;
    const footerOffsetY = cfg.footerPosition?.y ?? 0;
    const footerAnchor = cfg.footerAnchor || "left";

    const footerFrameStyle = {
      top: `${footerOffsetY}px`,
      border: "2px solid #9bb6a1",
      borderRadius: 12,
      padding: "16px 20px",
      minWidth: 220,
      maxWidth: 320,
      boxShadow: "0 6px 16px rgba(27, 64, 52, 0.12)",
      background: "#f5faf7",
    };

    if (footerAnchor === "center") {
      footerFrameStyle.left = "50%";
      footerFrameStyle.transform = `translateX(-50%) translateX(${footerOffsetX}px)`;
    } else if (footerAnchor === "right") {
      footerFrameStyle.right = `${footerOffsetX}px`;
    } else {
      footerFrameStyle.left = `${footerOffsetX}px`;
    }

    return (
      <div className="ehf-preview">
        <div className="ehf-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            className="ehf-header-left"
            style={{
              flex: 2,
              minWidth: 260,
              textAlign: cfg.minInstitAlign || "left"
            }}
          >
            <div
              className="ehf-ministere"
              style={{
                fontWeight: "bold",
                textAlign: cfg.minInstitAlign || "left",
                fontSize: cfg.ministereFontSize || 16
              }}
            >
              {cfg.ministere}
            </div>
            {cfg.separator && (
              <div
                className="ehf-institution-sep"
                style={{
                  textAlign: cfg.minInstitAlign || "left",
                  color: cfg.separatorColor || "#222",
                  fontWeight: "bold"
                }}
              >
                {cfg.separator.repeat(cfg.separatorLength || 14)}
              </div>
            )}
            <div className="ehf-institutions" style={{ marginTop: 2 }}>
              {Array.isArray(cfg.institutions) &&
                cfg.institutions
                  .filter(inst => inst.text)
                  .map((inst, idx, arr) => (
                    <React.Fragment key={idx}>
                      <div
                        className="ehf-institution"
                        style={{
                          fontWeight: inst.bold ? "bold" : "normal",
                          fontStyle: inst.italic ? "italic" : "normal",
                          textDecoration: inst.underline ? "underline" : "none",
                          color: inst.color || "#222",
                          textAlign: cfg.minInstitAlign || "left",
                          marginBottom: 0,
                          fontSize: cfg.institFontSize || 14
                        }}
                      >
                        {inst.text}
                      </div>
                      {cfg.separator &&
                        idx < arr.length - 1 && (
                          <div
                            className="ehf-institution-sep"
                            style={{
                              textAlign: cfg.minInstitAlign || "left",
                              color: cfg.separatorColor || "#222",
                              fontWeight: "bold"
                            }}
                          >
                            {cfg.separator.repeat(cfg.separatorLength || 14)}
                          </div>
                        )}
                    </React.Fragment>
                  ))}
            </div>
          </div>
          <div className="ehf-header-center" style={{ flex: 1, textAlign: "center" }}>
            {cfg.logoUrl && (
              <img src={cfg.logoUrl} alt="Logo" className="ehf-logo" style={{ maxHeight: 60, margin: "0 auto" }} />
            )}
          </div>
          <div
            className="ehf-header-right"
            style={{
              flex: 1,
              minWidth: 180,
              textAlign: effectiveStyles.pays.align,
              fontFamily: effectiveStyles.pays.fontFamily
            }}
          >
            <div
              className="ehf-pays"
              style={{
                fontWeight: effectiveStyles.pays.bold ? "bold" : "normal",
                fontStyle: effectiveStyles.pays.italic ? "italic" : "normal",
                textDecoration: effectiveStyles.pays.underline ? "underline" : "none",
                color: effectiveStyles.pays.color,
                fontSize: effectiveStyles.pays.fontSize,
                fontFamily: effectiveStyles.pays.fontFamily,
                textAlign: effectiveStyles.pays.align
              }}
            >
              {cfg.pays}
            </div>
            {effectiveStyles.paysSeparator.char && effectiveStyles.paysSeparator.count > 0 && (
              <div
                className="ehf-institution-sep"
                style={{
                  color: effectiveStyles.paysSeparator.color,
                  fontWeight: effectiveStyles.paysSeparator.bold ? "bold" : "normal",
                  fontStyle: effectiveStyles.paysSeparator.italic ? "italic" : "normal",
                  textDecoration: effectiveStyles.paysSeparator.underline ? "underline" : "none",
                  fontFamily: effectiveStyles.paysSeparator.fontFamily,
                  fontSize: effectiveStyles.paysSeparator.fontSize,
                  textAlign: effectiveStyles.paysSeparator.align
                }}
              >
                {effectiveStyles.paysSeparator.char.repeat(effectiveStyles.paysSeparator.count)}
              </div>
            )}
            {cfg.devise && (
              <div
                className="ehf-devise"
                style={{
                  fontWeight: effectiveStyles.devise.bold ? "bold" : "normal",
                  fontStyle: effectiveStyles.devise.italic ? "italic" : "normal",
                  textDecoration: effectiveStyles.devise.underline ? "underline" : "none",
                  color: effectiveStyles.devise.color,
                  fontSize: effectiveStyles.devise.fontSize,
                  fontFamily: effectiveStyles.devise.fontFamily,
                  textAlign: effectiveStyles.devise.align
                }}
              >
                {cfg.devise}
              </div>
            )}
          </div>
        </div>
        <Divider style={{ margin: "8px 0" }} />
        <div
          className="ehf-footer"
          style={{
            position: "relative",
            minHeight: 180,
            background: "transparent",
          }}
        >
          <div
            className="ehf-footer-frame"
            style={{
              position: "absolute",
              ...footerFrameStyle,
            }}
          >
            <div
              className="ehf-signature-block"
              style={{
                textAlign: cfg.signataireAlign,
              }}
            >
              <div className="ehf-signataire">{cfg.signataire}</div>
              <div className="ehf-grade">{cfg.grade}</div>
              <div className="ehf-titre">{cfg.titre}</div>
              {cfg.signatureUrl && (
                <div className="ehf-signature-img" style={{ marginTop: 8 }}>
                  <img src={cfg.signatureUrl} alt="Signature" style={{ maxHeight: 40 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ehf-config-root" style={style}>
      {/* --- ENTÊTE DE PAGE --- */}
      <Card
        className="ehf-config-card"
        bordered={false}
        title={<span style={{ fontWeight: 600, fontSize: 18 }}>Entête de page</span>}
        style={{ marginBottom: 24 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={value}
          onValuesChange={(_, all) => triggerChange(all)}
        >
          <Row gutter={16}>
            {/* Colonne ministère/institutions */}
            <Col xs={24} md={8}>
              <Form.Item label="Ministère" name="ministere">
                <Input
                  placeholder="Ex : Ministère de la Défense"
                  style={{ width: "100%", fontSize: ministereFontSize }}
                  onChange={(e) => triggerChange({ ministere: e.target.value })}
                />
              </Form.Item>
              <Form.Item label="Disposition ministère/institutions">
                <Radio.Group
                  value={minInstitAlign}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMinInstitAlign(next);
                    syncConfig({ minInstitAlign: next });
                  }}
                  optionType="button"
                  buttonStyle="solid"
                  style={{ marginBottom: 8 }}
                >
                  {ALIGN_OPTIONS.map(opt => (
                    <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>
              <Form.Item label="Taille du ministère">
                <Select
                  value={ministereFontSize}
                  onChange={handleMinistereFontSize}
                  style={{ width: 120 }}
                >
                  {FONT_SIZES.map(fs => (
                    <Option key={fs.value} value={fs.value}>{fs.label}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Séparateur ministère/institutions">
                <Select
                  value={separator}
                  onChange={handleSeparatorChange}
                  style={{ width: 120, marginRight: 8 }}
                >
                  {SEPARATORS.map(sep => (
                    <Option key={sep.value} value={sep.value}>{sep.label}</Option>
                  ))}
                </Select>
                <InputNumber
                  min={3}
                  max={40}
                  value={separatorLength}
                  onChange={handleSeparatorLength}
                  style={{ width: 60, marginLeft: 8 }}
                />
                <Select
                  value={separatorColor}
                  onChange={(val) => {
                    setSeparatorColor(val);
                    syncConfig({ separatorColor: val });
                  }}
                  style={{ width: 80, marginLeft: 8 }}
                  suffixIcon={<BgColorsOutlined />}
                >
                  {COLORS.map(c => (
                    <Option key={c.value} value={c.value}>
                      <span style={{ color: c.value }}>{c.label}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Institutions (une par ligne)">
                <div>
                  {institutions.map((inst, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 4, gap: 4 }}>
                      <Input
                        value={inst.text}
                        placeholder={`Institution ${idx + 1}`}
                        onChange={e => handleInstitutionChange(idx, "text", e)}
                        style={{ width: "60%", minWidth: 180, fontSize: institFontSize }}
                      />
                      <Checkbox
                        checked={inst.bold}
                        onChange={e => handleInstitutionChange(idx, "bold", e)}
                        style={{ marginLeft: 4 }}
                      >
                        Gras
                      </Checkbox>
                      <Checkbox
                        checked={inst.italic}
                        onChange={e => handleInstitutionChange(idx, "italic", e)}
                        style={{ marginLeft: 2 }}
                      >
                        Italique
                      </Checkbox>
                      <Checkbox
                        checked={inst.underline}
                        onChange={e => handleInstitutionChange(idx, "underline", e)}
                        style={{ marginLeft: 2 }}
                      >
                        Souligné
                      </Checkbox>
                      <Select
                        value={inst.color}
                        onChange={val => handleInstitutionChange(idx, "color", val)}
                        style={{ width: 48, marginLeft: 2 }}
                        dropdownMatchSelectWidth={false}
                        suffixIcon={<BgColorsOutlined />}
                      >
                        {COLORS.map(c => (
                          <Option key={c.value} value={c.value}>
                            <span style={{ color: c.value }}>■</span>
                          </Option>
                        ))}
                      </Select>
                      {institutions.length > 1 && (
                        <Button
                          icon={<DeleteOutlined />}
                          size="small"
                          danger
                          style={{ marginLeft: 4 }}
                          onClick={() => removeInstitution(idx)}
                        />
                      )}
                    </div>
                  ))}
                  <Button
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={addInstitution}
                    style={{ marginTop: 4 }}
                  >
                    Ajouter institution
                  </Button>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ marginRight: 8 }}>Taille des institutions :</span>
                    <Select
                      value={institFontSize}
                      onChange={handleInstitFontSize}
                      style={{ width: 120 }}
                    >
                      {FONT_SIZES.map(fs => (
                        <Option key={fs.value} value={fs.value}>{fs.label}</Option>
                      ))}
                    </Select>
                  </div>
                </div>
              </Form.Item>
            </Col>
            {/* Colonne centre/logo */}
            <Col xs={24} md={8} style={{ textAlign: "center" }}>
              <Form.Item label="Logo (centre)">
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={handleLogoChange}
                >
                  <Button icon={<UploadOutlined />}>Importer un logo</Button>
                </Upload>
                {logoUrl && (
                  <div style={{ marginTop: 8 }}>
                    <img src={logoUrl} alt="Logo" style={{ maxHeight: 60 }} />
                    <Button
                      size="small"
                      type="link"
                      danger
                      onClick={() => {
                        setLogoUrl("");
                        syncConfig({ logoUrl: "" });
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
              </Form.Item>
            </Col>
            {/* Colonne droite/pays/devise */}
            <Col xs={24} md={8}>
              <Form.Item label="Pays (droite)" name="pays">
                <Input
                  placeholder="Ex : Burkina Faso"
                  onChange={(e) => triggerChange({ pays: e.target.value })}
                />
              </Form.Item>
              <Form.Item label="Devise (sous le pays)" name="devise">
                <Input
                  placeholder="Ex : Unité - Progrès - Justice"
                  onChange={(e) => triggerChange({ devise: e.target.value })}
                />
              </Form.Item>
              {/* Bloc unique d'options de style */}
              <Card size="small" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Options de style texte</div>
                <Form.Item label="Appliquer à">
                  <Select
                    value={styleTarget}
                    options={STYLE_TARGETS}
                    onChange={handleStyleTarget}
                    style={{ width: 180 }}
                  />
                </Form.Item>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="Couleur">
                      <Select
                        value={styleOptions[styleTarget].color}
                        options={COLORS}
                        onChange={v => handleStyleChange("color", v)}
                        style={{ width: 100 }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Taille">
                      <InputNumber
                        min={10}
                        max={32}
                        value={styleOptions[styleTarget].fontSize}
                        onChange={v => handleStyleChange("fontSize", v)}
                        style={{ width: 70 }}
                      /> px
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Police">
                  <Select
                    value={styleOptions[styleTarget].fontFamily}
                    options={FONT_FAMILIES}
                    onChange={v => handleStyleChange("fontFamily", v)}
                    style={{ width: 180 }}
                  />
                </Form.Item>
                <Form.Item label="Effets">
                  <Checkbox
                    checked={styleOptions[styleTarget].bold}
                    onChange={e => handleStyleChange("bold", e.target.checked)}
                  >Gras</Checkbox>
                  <Checkbox
                    checked={styleOptions[styleTarget].italic}
                    onChange={e => handleStyleChange("italic", e.target.checked)}
                  >Italique</Checkbox>
                  <Checkbox
                    checked={styleOptions[styleTarget].underline}
                    onChange={e => handleStyleChange("underline", e.target.checked)}
                  >Souligné</Checkbox>
                </Form.Item>
                <Form.Item label="Alignement">
                  <Select
                    value={styleOptions[styleTarget].align}
                    options={[
                      { label: "Gauche", value: "left" },
                      { label: "Centre", value: "center" },
                      { label: "Droite", value: "right" }
                    ]}
                    onChange={v => handleStyleChange("align", v)}
                    style={{ width: 120 }}
                  />
                </Form.Item>
                {styleTarget === "paysSeparator" && (
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="Caractère">
                        <Input
                          value={styleOptions.paysSeparator.char}
                          maxLength={2}
                          style={{ width: 60 }}
                          onChange={e => handleStyleChange("char", e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Nb répétitions">
                        <InputNumber
                          min={1}
                          max={40}
                          value={styleOptions.paysSeparator.count}
                          style={{ width: 60 }}
                          onChange={v => handleStyleChange("count", v)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                )}
              </Card>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* --- PIED DE PAGE --- */}
      <Card
        className="ehf-config-card"
        bordered={false}
        title={<span style={{ fontWeight: 600, fontSize: 18 }}>Pied de page</span>}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={value}
          onValuesChange={(_, all) => triggerChange(all)}
        >
          <Row gutter={16}>
            {/* Colonne signataire */}
            <Col xs={24} md={8}>
              <div style={{ padding: 6, background: "#fafdff", borderRadius: 6, marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>Signataire</div>
                <Form.Item label="Nom">
                  <Input
                    value={form.getFieldValue("signataire")}
                    onChange={e => { form.setFieldsValue({ signataire: e.target.value }); triggerChange({ signataire: e.target.value }); }}
                    placeholder="Nom du signataire"
                  />
                </Form.Item>
                <Form.Item label="Grade">
                  <Input
                    value={form.getFieldValue("grade")}
                    onChange={e => { form.setFieldsValue({ grade: e.target.value }); triggerChange({ grade: e.target.value }); }}
                    placeholder="Grade du signataire"
                  />
                </Form.Item>
                <Form.Item label="Titre">
                  <Input
                    value={form.getFieldValue("titre")}
                    onChange={e => { form.setFieldsValue({ titre: e.target.value }); triggerChange({ titre: e.target.value }); }}
                    placeholder="Titre du signataire"
                  />
                </Form.Item>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>Alignement du signataire</div>
                <Radio.Group
                  value={signataireAlign}
                  onChange={e => { setSignataireAlign(e.target.value); triggerChange({ signataireAlign: e.target.value }); }}
                  optionType="button"
                  buttonStyle="solid"
                  style={{ marginBottom: 8 }}
                >
                  {SIGNATAIRE_ALIGN.map(opt => (
                    <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
                  ))}
                </Radio.Group>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ marginRight: 6 }}>Décalage horizontal (px) :</span>
                  <Slider
                    min={0}
                    max={120}
                    value={signataireOffset}
                    onChange={handleSignataireOffset}
                    style={{ width: 100, display: "inline-block" }}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ marginRight: 6 }}>Décalage vertical (px) :</span>
                  <Slider
                    min={0}
                    max={80}
                    value={signataireOffsetY}
                    onChange={handleSignataireOffsetY}
                    style={{ width: 100, display: "inline-block" }}
                  />
                </div>
              </div>
            </Col>
            {/* Colonne signature */}
            <Col xs={24} md={8} style={{ textAlign: "center" }}>
              <div style={{ padding: 6, background: "#fafdff", borderRadius: 6, marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>Signature</div>
                <Form.Item label="Signature (image)">
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleSignatureChange}
                  >
                    <Button icon={<UploadOutlined />}>Importer une signature</Button>
                  </Upload>
                  {signatureUrl && (
                    <div style={{ marginTop: 8 }}>
                      <img src={signatureUrl} alt="Signature" style={{ maxHeight: 40 }} />
                      <Button
                        size="small"
                        type="link"
                        danger
                        onClick={() => {
                          setSignatureUrl("");
                          syncConfig({ signatureUrl: "" });
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  )}
                </Form.Item>
              </div>
            </Col>
            {/* Colonne date */}
            <Col xs={24} md={8}>
              <div style={{ padding: 6, background: "#fafdff", borderRadius: 6, marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>Date</div>
                <Form.Item label="Afficher la date">
                  <Switch
                    checked={showDate}
                    onChange={handleShowDate}
                    checkedChildren="Oui"
                    unCheckedChildren="Non"
                  />
                </Form.Item>
                <Form.Item label="Alignement de la date">
                  <Radio.Group
                    value={dateAlign}
                    onChange={e => { setDateAlign(e.target.value); triggerChange({ dateAlign: e.target.value }); }}
                    optionType="button"
                    buttonStyle="solid"
                    style={{ marginBottom: 8 }}
                    disabled={!showDate}
                  >
                    {DATE_ALIGN.map(opt => (
                      <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
                    ))}
                  </Radio.Group>
                </Form.Item>
                <div style={{ marginTop: 4 }}>
                  <span style={{ marginRight: 6 }}>Décalage (px) :</span>
                  <Slider
                    min={0}
                    max={120}
                    value={dateOffset}
                    onChange={handleDateOffset}
                    style={{ width: 100, display: "inline-block" }}
                    disabled={!showDate}
                  />
                </div>
              </div>
              <Card size="small" style={{ background: "#f5faf7", borderColor: "#9bb6a1" }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>Position du cadre</div>
                <Form.Item label="Décalage X (px)" style={{ marginBottom: 8 }}>
                  <Slider
                    min={FOOTER_OFFSET_RANGE.x.min}
                    max={FOOTER_OFFSET_RANGE.x.max}
                    value={footerPosition.x}
                    onChange={(val) => handleFooterPosition("x", val)}
                  />
                  <InputNumber
                    min={FOOTER_OFFSET_RANGE.x.min}
                    max={FOOTER_OFFSET_RANGE.x.max}
                    value={footerPosition.x}
                    onChange={(val) => handleFooterPosition("x", val ?? 0)}
                    style={{ width: 80, marginTop: 4 }}
                  />
                </Form.Item>
                <Form.Item label="Décalage Y (px)" style={{ marginBottom: 0 }}>
                  <Slider
                    min={FOOTER_OFFSET_RANGE.y.min}
                    max={FOOTER_OFFSET_RANGE.y.max}
                    value={footerPosition.y}
                    onChange={(val) => handleFooterPosition("y", val)}
                  />
                  <InputNumber
                    min={FOOTER_OFFSET_RANGE.y.min}
                    max={FOOTER_OFFSET_RANGE.y.max}
                    value={footerPosition.y}
                    onChange={(val) => handleFooterPosition("y", val ?? 0)}
                    style={{ width: 80, marginTop: 4 }}
                  />
                </Form.Item>
              </Card>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="ehf-config-card" bordered={false} style={{ marginTop: 24 }}>
        <div className="ehf-config-header">
          <Title level={5} style={{ marginBottom: 0 }}>Nom de la configuration</Title>
        </div>
        <Input
          value={configName}
          onChange={(e) => {
            const next = e.target.value;
            setConfigName(next);
            syncConfig({ name: next });
          }}
          placeholder="Nom de la configuration (ex: Officiel, Export, etc.)"
          style={{ maxWidth: 320, margin: "12px 0" }}
        />
        {configs && configs.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text strong>Configurations enregistrées :</Text>
            <Select
              style={{ width: 320, marginLeft: 8 }}
              value={selectedConfigKey}
              onChange={handleSelectConfig}
              placeholder="Choisir une configuration"
            >
              {configs.map(cfg => (
                <Option key={cfg.key || cfg.name} value={cfg.key || cfg.name}>
                  {cfg.name}
                </Option>
              ))}
            </Select>
            <Button
              type="link"
              danger
              onClick={() => handleDeleteConfig(selectedConfigKey)}
              style={{ marginLeft: 8 }}
              disabled={!selectedConfigKey}
            >
              Supprimer
            </Button>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleAddConfig}
            style={{ marginRight: 12 }}
          >
            Enregistrer cette configuration
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => setShowPreview(p => !p)}
          >
            {showPreview ? "Masquer la prévisualisation" : "Prévisualiser"}
          </Button>
        </div>
      </Card>

      {showPreview && (
        <Card className="ehf-preview-card" bordered={false} style={{ marginTop: 24 }}>
          <Title level={5} style={{ marginBottom: 0 }}>Prévisualisation</Title>
          {renderPreview()}
        </Card>
      )}
    </div>
  );
}
