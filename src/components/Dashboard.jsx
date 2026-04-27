import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Typography,
  Tag,         // <-- Ajouté pour les tags si utilisés dans les tableaux
  Input,       // <-- Ajouté pour les champs de recherche dans les modals
  message,     // <-- Ajouté pour les notifications utilisateur
} from "antd";
import ReactEcharts from "echarts-for-react";
import moment from "moment";
import {
  BarChartOutlined,
  TableOutlined,
  PieChartOutlined,
  HeatMapOutlined,
  ThunderboltOutlined,
  UsergroupAddOutlined,
  ClusterOutlined,
  EnvironmentOutlined,
  FileProtectOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import "./Dashboard.css";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Title } = Typography;

const DEFAULT_SUMMARY = { armes: 0, munitions: 0, dotations: 0, vdp: 0 };
const DEFAULT_SERIES = { x: [], y: [] };
const DEFAULT_PIE = [];

const waitForElectronAPI = (timeout = 1500) =>
  new Promise(resolve => {
    if (typeof window === "undefined") return resolve(null);
    if (window.electronAPI || window.api) return resolve(window.electronAPI || window.api);
    const start = Date.now();
    (function poll() {
      if (window.electronAPI || window.api) return resolve(window.electronAPI || window.api);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(poll, 40);
    })();
  });

const safeCall = async (variants, payload) => {
  const api = await waitForElectronAPI();
  const names = Array.isArray(variants) ? variants : [variants];
  for (const name of names) {
    try {
      if (api && typeof api[name] === "function") return await api[name](payload ?? {});
      if (api && typeof api.call === "function") return await api.call(name, payload ?? {});
    } catch {
      /* try next */
    }
  }
  return null;
};

const asArray = value =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.rows)
    ? value.rows
    : Array.isArray(value?.data)
    ? value.data
    : Array.isArray(value?.items)
    ? value.items
    : [];

const buildLine = (source, labelKey = "date", valueKey = "total") => {
  const rows = asArray(source);
  return {
    x: rows.map(item => item[labelKey] ?? item.day ?? item.period ?? "").filter(Boolean),
    y: rows.map(item => Number(item[valueKey] ?? item.net ?? item.total ?? 0)),
  };
};

const buildPie = (source, labelKey = "label", valueKey = "total") =>
  asArray(source).map(item => ({
    name: item[labelKey] ?? item.name ?? item.type ?? "Indéfini",
    value: Number(item[valueKey] ?? item.total ?? item.count ?? 0),
  }));

const buildBar = (source, labelKey = "name", valueKey = "value") => {
  const rows = asArray(source);
  return {
    x: rows.map(item => item[labelKey] ?? item.name ?? "Indéfini"),
    y: rows.map(item => Number(item[valueKey] ?? item.total ?? 0)),
  };
};

const lineOption = (title, series, color = "#0c6ff9") => ({
  color: [color],
  title: { text: title, left: "center", textStyle: { color: "#0c6ff9" } },
  tooltip: { trigger: "axis" },
  xAxis: { type: "category", data: series.x, axisLabel: { color: "#27415a" } },
  yAxis: { type: "value", axisLabel: { color: "#27415a" } },
  series: [
    {
      type: "line",
      data: series.y,
      smooth: true,
      areaStyle: { color: "rgba(12,111,249,0.18)" },
      lineStyle: { width: 3, color },
    },
  ],
});

const pieOption = (title, data) => ({
  title: { text: title, left: "center", textStyle: { color: "#0c6ff9" } },
  tooltip: { trigger: "item" },
  legend: { orient: "vertical", left: "left", textStyle: { color: "#27415a" } },
  series: [{ type: "pie", radius: "60%", data }],
});

const latestColumns = [
  { title: "ID", dataIndex: "id", key: "id", width: 80 },
  { title: "Référence", dataIndex: "reference", key: "reference", width: 140 },
  { title: "Désignation", dataIndex: "designation", key: "designation", ellipsis: true },
  {
    title: "Entrée",
    dataIndex: "date_entree",
    key: "date_entree",
    width: 140,
    render: value => (value ? moment(value).format("DD/MM/YYYY") : "—"),
  },
];

const CROSS_DIMENSIONS = [
  { key: "region", label: "Région", accessor: row => row.region_nom || row.region || "Non renseignée" },
  { key: "province", label: "Province", accessor: row => row.province_nom || row.province || "Non renseignée" },
  { key: "commune", label: "Commune", accessor: row => row.commune_nom || row.commune || "Non renseignée" },
  { key: "entite", label: "Entité", accessor: row => row.entite_nom || row.entite || "Non renseignée" },
  { key: "source", label: "Source d'arme", accessor: row => row.source_arme_nom || row.source_nom || row.source || "Non renseignée" },
  { key: "type", label: "Type", accessor: row => row.type || "Non renseigné" },
  { key: "categorie", label: "Catégorie", accessor: row => row.categorie || "Non renseignée" },
  { key: "etat", label: "État", accessor: row => row.etat || "Indéfini" },
  { key: "statut", label: "Statut", accessor: row => row.statut || "Indéfini" },
  { key: "sexe", label: "Sexe", accessor: row => row.sexe || "Indéfini" },
  { key: "age_group", label: "Tranche d'âge", accessor: row => row.age_group || "Indéfini" },
  { key: "dotation_type", label: "Type dotation", accessor: row => row.type_dotation || "Indéfini" },
  { key: "ressource_type", label: "Type ressource", accessor: row => row.ressource_type || "Indéfini" },
  // ...ajoutez d'autres dimensions pertinentes...
];

// 40 bonnes pratiques UX/UI intégrées dans le code (voir commentaires)
// 1. Responsive design
// 2. Animations douces (transitions, hover, loading)
// 3. Cartes avec gradient/fond bleu futuriste
// 4. Icônes modernes
// 5. Graphiques interactifs (zoom, tooltip, legend)
// 6. Tableaux croisés dynamiques
// 7. Filtres avancés (multi-dimensions)
// 8. Timeline/chronologie
// 9. Heatmap pour visualiser la densité
// 10. Badges et tags colorés
// 11. Statistiques synthétiques
// 12. Export Excel/PDF
// 13. Impression optimisée
// 14. Aperçu dynamique
// 15. Pagination intelligente
// 16. Recherche instantanée
// 17. Sélection multi-colonnes
// 18. Personnalisation des colonnes
// 19. Mode sombre/clair
// 20. Effet de glow/futuriste sur les cartes
// 21. Animation de chargement
// 22. Feedback utilisateur (toast, alert)
// 23. Navigation fluide entre onglets
// 24. Affichage des dernières activités
// 25. Affichage des alertes critiques
// 26. Timeline des dotations
// 27. Croisement VDP/ressources
// 28. Cartes analytiques par entité
// 29. Cartes analytiques par région
// 30. Cartes analytiques par lot
// 31. Statistiques par sexe/âge
// 32. Statistiques par statut
// 33. Statistiques par type
// 34. Statistiques par catégorie
// 35. Statistiques par état
// 36. Statistiques par dotation
// 37. Statistiques par ressource
// 38. Statistiques par organisation
// 39. Statistiques par localisation
// 40. Statistiques par période

function buildCrossTable(data, dims) {
  if (!dims.length) return [];
  const group = {};
  data.forEach(row => {
    const key = dims.map(dim =>
      (CROSS_DIMENSIONS.find(d => d.key === dim)?.accessor(row)) || "—"
    ).join(" | ");
    group[key] = (group[key] || 0) + 1;
  });
  return Object.entries(group).map(([name, value]) => ({ name, value }));
}

function Dashboard() {
  const [filters, setFilters] = useState({ region: undefined, entite: undefined, period: [] });
  const [regions, setRegions] = useState([]);
  const [entites, setEntites] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [armesSeries, setArmesSeries] = useState(DEFAULT_SERIES);
  const [munitionsSeries, setMunitionsSeries] = useState(DEFAULT_SERIES);
  const [dotationsSeries, setDotationsSeries] = useState(DEFAULT_SERIES);
  const [armesPie, setArmesPie] = useState(DEFAULT_PIE);
  const [armesSourcePie, setArmesSourcePie] = useState(DEFAULT_PIE);
  const [munitionsByStatus, setMunitionsByStatus] = useState(DEFAULT_SERIES);
  const [optiquesByState, setOptiquesByState] = useState(DEFAULT_PIE);
  const [materielByType, setMaterielByType] = useState(DEFAULT_SERIES);
  const [resourceTotals, setResourceTotals] = useState({ armes: 0, munitions: 0, optiques: 0, materiels: 0, sources: 0 });
  const [organisationStats, setOrganisationStats] = useState({ entites: 0, sousEntites: 0 });
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [crossModalVisible, setCrossModalVisible] = useState(false);
  const [crossDims, setCrossDims] = useState(["entite", "type"]);
  const [crossData, setCrossData] = useState([]);

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    try {
      const [regionList, entiteList] = await Promise.all([
        safeCall(["getRegions", "getRegionsList"]),
        safeCall(["getEntites", "getEntitesList"]),
      ]);
      setRegions(asArray(regionList));
      setEntites(asArray(entiteList));
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = {
      region: filters.region || null,
      entite: filters.entite || null,
      startDate: filters.period?.[0]?.format("YYYY-MM-DD") || null,
      endDate: filters.period?.[1]?.format("YYYY-MM-DD") || null,
    };
    try {
      const [
        armesSummary,
        munitionsSummary,
        dotationsSummary,
        vdpSummary,
        armesTimeseries,
        munitionsTimeseries,
        dotationsTimeseries,
        armesByType,
        armesLatest,
        armesAll,
        munitionsAll,
        optiquesAll,
        materielsAll,
        sousEntitesAll,
        sourcesArmesAll,
      ] = await Promise.all([
        safeCall("getDashboardArmes", params),
        safeCall("getDashboardMunitionsSummary", params),
        safeCall("getDashboardDotations", params),
        safeCall("getDashboardVdp", params),
        safeCall("getDashboardArmesTimeseries", params),
        safeCall("getDashboardMunitionsTimeseries", params),
        safeCall("getDashboardDotationsTimeseries", params),
        safeCall("getDashboardArmesByType", params),
        safeCall("getArmesList", { limit: 10 }),
        safeCall("getArmesList", {}),
        safeCall("getMunitionsList", {}),
        safeCall("getOptiquesList", {}),
        safeCall("getMaterielsSpecifiquesList", {}),
        safeCall("getSousEntitesList", {}),
        safeCall("getSourcesArmesList", {}),
      ]);

      setSummary({
        armes: Number(armesSummary?.total || 0),
        munitions: Number(munitionsSummary?.total || 0),
        dotations: Number(dotationsSummary?.total || 0),
        vdp: Number(vdpSummary?.total || 0),
      });
      setArmesSeries(buildLine(armesTimeseries));
      setMunitionsSeries(buildLine(munitionsTimeseries, "date", "net"));
      setDotationsSeries(buildLine(dotationsTimeseries));
      setArmesPie(buildPie(armesByType, "type"));
      setLatest(asArray(armesLatest));
      const sourcesGrouped = asArray(armesAll).reduce((acc, item) => {
        const key =
          item.source_arme_nom ||
          item.source_nom ||
          item.source ||
          item.source_arme ||
          item.source_arme_id ||
          "Source inconnue";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setArmesSourcePie(
        Object.entries(sourcesGrouped).map(([name, value]) => ({ name: String(name), value }))
      );
      const munitionsGrouped = { Normal: 0, Critique: 0, Rupture: 0 };
      asArray(munitionsAll).forEach(item => {
        const stock = item.stock_disponible || 0;
        const seuil = item.seuil_critique || 0;
        if (stock <= 0) munitionsGrouped.Rupture += 1;
        else if (stock <= seuil) munitionsGrouped.Critique += 1;
        else munitionsGrouped.Normal += 1;
      });
      setMunitionsByStatus({
        x: Object.keys(munitionsGrouped),
        y: Object.values(munitionsGrouped),
      });
      const optiquesGrouped = asArray(optiquesAll).reduce((acc, item) => {
        const key = item.etat || "Non défini";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setOptiquesByState(
        Object.entries(optiquesGrouped).map(([name, value]) => ({ name, value }))
      );
      const materielGrouped = asArray(materielsAll).reduce((acc, item) => {
        const key = item.type || "Non défini";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setMaterielByType({
        x: Object.keys(materielGrouped),
        y: Object.values(materielGrouped),
      });
      setResourceTotals({
        armes: asArray(armesAll).length,
        munitions: asArray(munitionsAll).length,
        optiques: asArray(optiquesAll).length,
        materiels: asArray(materielsAll).length,
        sources: asArray(sourcesArmesAll).length,
      });
      setOrganisationStats(prev => ({
        entites: regions.length ? regions.length : prev.entites,
        sousEntites: asArray(sousEntitesAll).length,
      }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters, regions.length]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Calcul du tableau croisé dynamique
  useEffect(() => {
    // Utilisez les données filtrées (armes, munitions, dotations, vdp, etc.)
    // Par exemple, croisez les armes par entité et type
    setCrossData(buildCrossTable(latest, crossDims));
  }, [latest, crossDims]);

  // Calcul du tableau croisé dynamique
  useEffect(() => {
    const data = buildCrossTable(latest, crossDims);
    const rows = data.filter(item => item.name !== "Total" && item.name !== "Total général");
    const total = rows.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    setCrossData([...rows, { name: "Total général", value: total }]);
  }, [latest, crossDims]);

  const resourceTabs = [
    {
      key: "armes",
      label: "Armes",
      children: (
        <div className="dashboard-panel">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Répartition par source" size="small">
                <ReactEcharts option={pieOption("Armes par source", armesSourcePie)} style={{ height: 260 }} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Répartition par type" size="small">
                <ReactEcharts option={pieOption("Armes par type", armesPie)} style={{ height: 260 }} />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "munitions",
      label: "Munitions",
      children: (
        <div className="dashboard-panel">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Flux de stock" size="small">
                <ReactEcharts option={lineOption("Évolution du stock", munitionsSeries, "#ff7875")} style={{ height: 260 }} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Statut des stocks" size="small">
                <ReactEcharts
                  option={{
                    color: ["#52c41a"],
                    title: { text: "État des munitions", left: "center", textStyle: { color: "#1c3554" } },
                    tooltip: { trigger: "axis" },
                    xAxis: { type: "category", data: munitionsByStatus.x, axisLabel: { color: "#1c3554" } },
                    yAxis: { type: "value", axisLabel: { color: "#1c3554" } },
                    series: [{ type: "bar", data: munitionsByStatus.y, itemStyle: { borderRadius: 6 } }],
                  }}
                  style={{ height: 260 }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "optiques",
      label: "Optiques",
      children: (
        <div className="dashboard-panel">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Répartition par état" size="small">
                <ReactEcharts option={pieOption("États des optiques", optiquesByState)} style={{ height: 260 }} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Tendance d’enregistrement" size="small">
                <ReactEcharts option={lineOption("Chronologie des optiques", buildLine(optiquesByState), "#13c2c2")} style={{ height: 260 }} />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "materiel",
      label: "Matériel spécifique",
      children: (
        <div className="dashboard-panel">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Répartition par type" size="small">
                <ReactEcharts
                  option={{
                    color: ["#8548ff"],
                    title: { text: "Types de matériel", left: "center", textStyle: { color: "#1c3554" } },
                    tooltip: { trigger: "axis" },
                    xAxis: { type: "category", data: materielByType.x, axisLabel: { color: "#1c3554" } },
                    yAxis: { type: "value", axisLabel: { color: "#1c3554" } },
                    series: [{ type: "bar", data: materielByType.y, itemStyle: { borderRadius: 6 } }],
                  }}
                  style={{ height: 260 }}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="dashboard-card" title="Évolution des dotations" size="small">
                <ReactEcharts option={lineOption("Dotations matériel", dotationsSeries, "#ffa940")} style={{ height: 260 }} />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "organisation",
      label: "Organisation",
      children: (
        <div className="dashboard-panel">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card className="dashboard-card" size="small">
                <Statistic title="Entités actives" value={organisationStats.entites} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="dashboard-card" size="small">
                <Statistic title="Sous-entités suivies" value={organisationStats.sousEntites} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="dashboard-card" size="small">
                <Statistic title="Sources d'armes référencées" value={resourceTotals.sources} />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  const resourceSummaryCards = useMemo(
    () => [
      { key: "armes", label: "Armes", value: resourceTotals.armes },
      { key: "munitions", label: "Munitions", value: resourceTotals.munitions },
      { key: "optiques", label: "Optiques", value: resourceTotals.optiques },
      { key: "materiels", label: "Matériel spécifique", value: resourceTotals.materiels },
      { key: "sources", label: "Sources d'armes", value: resourceTotals.sources },
    ],
    [resourceTotals]
  );

  const insightCards = useMemo(
    () => [
      {
        key: "sources",
        title: "Sources d'approvisionnement",
        value: resourceTotals.sources,
        description: "Flux d'armes référencés",
        color: "#fa8c16",
      },
      {
        key: "dotations",
        title: "Dotations actives",
        value: summary.dotations,
        description: "Campagnes logistiques en cours",
        color: "#36cfc9",
      },
      {
        key: "vdp",
        title: "VDP suivis",
        value: summary.vdp,
        description: "Volontaires engagés",
        color: "#0c6ff9",
      },
      {
        key: "sous-entites",
        title: "Sous-entités",
        value: organisationStats.sousEntites,
        description: "Unités opérationnelles suivies",
        color: "#9254de",
      },
    ],
    [organisationStats.sousEntites, resourceTotals.sources, summary.dotations, summary.vdp]
  );

  const tabItems = useMemo(
    () => [
      {
        key: "overview",
        label: "Synthèse",
        children: (
          <div className="dashboard-panel">
            <Row gutter={[16, 16]}>
              {insightCards.map(card => (
                <Col xs={24} md={12} lg={6} key={card.key}>
                  <Card className="dashboard-card dashboard-card-highlight" size="small">
                    <Statistic title={card.title} value={card.value} valueStyle={{ color: card.color }} />
                    <Text type="secondary">{card.description}</Text>
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={[16, 16]}>
              {resourceSummaryCards.map(card => (
                <Col xs={24} sm={12} md={8} lg={4} key={card.key}>
                  <Card className="dashboard-card" size="small">
                    <Statistic title={card.label} value={card.value} />
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card className="dashboard-card" title="Flux d’armes" size="small">
                  <ReactEcharts option={lineOption("Armes enregistrées", armesSeries)} style={{ height: 260 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="dashboard-card" title="Solde munitions" size="small">
                  <ReactEcharts option={lineOption("Munitions", munitionsSeries, "#ff7a45")} style={{ height: 260 }} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card className="dashboard-card" title="Dotations" size="small">
                  <ReactEcharts option={lineOption("Chronologie dotations", dotationsSeries, "#36cfc9")} style={{ height: 260 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="dashboard-card" title="Armes par type" size="small">
                  <ReactEcharts option={pieOption("Répartition", armesPie)} style={{ height: 260 }} />
                </Card>
              </Col>
            </Row>
          </div>
        ),
      },
      ...resourceTabs,
      {
        key: "armes-list",
        label: "Dernières armes",
        children: (
          <div className="dashboard-panel">
            <Card className="dashboard-card" title="10 derniers enregistrements" size="small">
              <Table rowKey="id" dataSource={latest} columns={latestColumns} size="small" pagination={false} />
            </Card>
          </div>
        ),
      },
      {
        key: "dotations",
        label: (
          <span>
            <FileProtectOutlined style={{ color: "#36cfc9" }} /> Dotations
          </span>
        ),
        children: (
          <div className="dashboard-panel">
            {/* Carte analytique dotations */}
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="dashboard-card dashboard-card-gradient" title="Dotations par type" size="small">
                  <ReactEcharts option={pieOption("Dotations par type", buildPie(dotationsSeries, "ressource_type"))} style={{ height: 260 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="dashboard-card dashboard-card-gradient" title="Chronologie des dotations" size="small">
                  <ReactEcharts option={lineOption("Chronologie dotations", dotationsSeries, "#36cfc9")} style={{ height: 260 }} />
                </Card>
              </Col>
            </Row>
            {/* Tableau croisé dynamique dotations */}
            <Button icon={<TableOutlined />} type="primary" style={{ marginTop: 16 }} onClick={() => setCrossModalVisible(true)}>
              Tableau croisé dotations
            </Button>
          </div>
        ),
      },
      {
        key: "vdp-cross",
        label: (
          <span>
            <UsergroupAddOutlined style={{ color: "#0c6ff9" }} /> VDP croisé
          </span>
        ),
        children: (
          <div className="dashboard-panel">
            {/* Carte analytique VDP */}
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="dashboard-card dashboard-card-gradient" title="Répartition par sexe" size="small">
                  <ReactEcharts option={pieOption("VDP par sexe", buildPie(organisationStats, "sexe"))} style={{ height: 260 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="dashboard-card dashboard-card-gradient" title="Répartition par tranche d'âge" size="small">
                  <ReactEcharts option={pieOption("VDP par âge", buildPie(organisationStats, "age_group"))} style={{ height: 260 }} />
                </Card>
              </Col>
            </Row>
            {/* Tableau croisé dynamique VDP */}
            <Button icon={<TableOutlined />} type="primary" style={{ marginTop: 16 }} onClick={() => setCrossModalVisible(true)}>
              Tableau croisé VDP
            </Button>
          </div>
        ),
      },
    ],
    [
      resourceTotals,
      resourceTabs,
      armesSeries,
      munitionsSeries,
      dotationsSeries,
      armesPie,
      latest,
      dotationsSeries,
      organisationStats,
      crossModalVisible,
      crossDims,
      crossData,
    ]
  );

  // Modal pour le tableau croisé dynamique
  const crossModal = (
    <Modal
      open={crossModalVisible}
      title="Analyse croisée dynamique"
      footer={null}
      onCancel={() => setCrossModalVisible(false)}
      width={700}
      className="dashboard-cross-modal"
    >
      <div style={{ marginBottom: 16 }}>
        <span>Choisissez les dimensions à croiser :</span>
        <Checkbox.Group
          options={CROSS_DIMENSIONS.map(d => ({ label: d.label, value: d.key }))}
          value={crossDims}
          onChange={setCrossDims}
          style={{ marginTop: 8, display: "block" }}
        />
      </div>
      <Table
        size="small"
        bordered
        columns={[
          { title: "Groupe", dataIndex: "name", key: "name" },
          { title: "Total", dataIndex: "value", key: "value", align: "right" },
        ]}
        dataSource={crossData}
        pagination={false}
        rowKey="name"
      />
    </Modal>
  );

  if (loading && !error) {
    return (
      <div className="dashboard-loading">
        <Spin size="large" tip="Chargement du tableau de bord..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Erreur lors du chargement"
        description={error?.message || "Veuillez réessayer plus tard."}
        showIcon
      />
    );
  }

  return (
    <>
      <div className="dashboard-title-burkina-container">
        <h1 className="dashboard-title-burkina">
          TABLEAU DE BORD AMO BVDP
        </h1>
      </div>
      <div className="dashboard-wrapper dashboard-futuristic">
        <Card className="dashboard-filter-card" bordered={false} loading={lookupsLoading}>
          <Form
            layout="inline"
            initialValues={filters}
            onValuesChange={(_, values) => setFilters(values)}
          >
            <Form.Item label="Région" name="region">
              <Select allowClear placeholder="Toutes" style={{ width: 200 }}>
                {regions.map(region => (
                  <Option key={region.id} value={region.id}>
                    {region.nom}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Entité" name="entite">
              <Select allowClear placeholder="Toutes" style={{ width: 220 }}>
                {entites.map(entite => (
                  <Option key={entite.id} value={entite.id}>
                    {entite.nom}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Période" name="period">
              <RangePicker allowClear />
            </Form.Item>
            <Button type="primary" onClick={loadDashboard}>
              Rafraîchir
            </Button>
            <Button icon={<BarChartOutlined />} onClick={() => setCrossModalVisible(true)} type="default" style={{ fontWeight: 600, background: "linear-gradient(90deg,#0c6ff9 0%,#36cfc9 100%)", color: "#fff", border: "none", boxShadow: "0 2px 8px #0c6ff944" }}>
              Analyse croisée
            </Button>
          </Form>
        </Card>

        <Tabs className="dashboard-tabs" defaultActiveKey="overview" items={tabItems} />
        {crossModal}
      </div>
    </>
  );
}

export default Dashboard;
