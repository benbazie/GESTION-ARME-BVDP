// src/components/UtilisateurList.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Input,
  Table,
  Button,
  Spin,
  Modal,
  message,
  Space,
  Alert,
  Empty,
  Descriptions,
  Select,
  Tooltip,
  Dropdown,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  KeyOutlined,
  EyeOutlined,
  EditOutlined,
  PrinterOutlined,
  FilterOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./UtilisateurList.css";
import api from "../api";

const { Search } = Input;
const { confirm } = Modal;

const normaliseString = (value) => (value || "").toLowerCase();

export default function UtilisateurList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [offline, setOffline] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [entiteFilter, setEntiteFilter] = useState(null);
  const [coordFilter, setCoordFilter] = useState(null);
  const navigate = useNavigate();

  // Charger les utilisateurs via IPC
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const bridge =
        window.electronAPI?.getUtilisateursList ??
        window.safeElectronAPI?.getUtilisateursList ??
        window.api?.getUtilisateursList ??
        null;
      const response = bridge ? await bridge() : await api.getUtilisateursList();
      const rows = Array.isArray(response)
        ? response
        : Array.isArray(response?.rows)
        ? response.rows
        : [];
      setUsers(
        rows.map((user) => ({
          ...user,
          key: user.id,
        }))
      );
      if (offline) setOffline(false);
    } catch (err) {
      console.error("getUtilisateursList", err);
      if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
        if (!offline) {
          message.warning("API injoignable : affichage des données locales uniquement.");
        }
        setOffline(true);
      } else {
        Modal.error({
          title: "Erreur",
          content: "Impossible de charger la liste des utilisateurs.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [offline]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const bridge =
        window.electronAPI?.getUtilisateursStats ??
        window.safeElectronAPI?.getUtilisateursStats ??
        window.api?.getUtilisateursStats ??
        null;
      const payload = bridge ? await bridge() : await api.getUtilisateursStats();
      setStats(payload || null);
      if (offline) setOffline(false);
    } catch (err) {
      console.error("getUtilisateursStats", err);
      if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
        if (!offline) {
          message.warning("API injoignable : statistiques indisponibles.");
        }
        setOffline(true);
      }
    } finally {
      setStatsLoading(false);
    }
  }, [offline]);

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [loadUsers, loadStats]);

  const handleRefresh = useCallback(() => {
    loadUsers();
    loadStats();
  }, [loadUsers, loadStats]);

  const filterOptions = useMemo(() => {
    const roleSet = new Set();
    const gradeSet = new Set();
    const entiteSet = new Set();
    const coordSet = new Set();

    users.forEach((user) => {
      if (Array.isArray(user.role_labels) && user.role_labels.length) {
        user.role_labels.forEach((label) => label && roleSet.add(label));
      } else if (user.role_nom) {
        user.role_nom
          .split(',')
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .forEach((label) => roleSet.add(label));
      }
      if (user.grade) gradeSet.add(user.grade);
      if (user.entite_nom) entiteSet.add(user.entite_nom);
      const coordLabel =
        user.sous_entite_nom ||
        user.coordination_regionale_nom ||
        user.coordination_provinciale_nom ||
        user.coordination_communale_nom;
      if (coordLabel) coordSet.add(coordLabel);
    });

    const toOptions = (set) =>
      Array.from(set)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'fr'))
        .map((label) => ({ label, value: label }));

    return {
      roles: toOptions(roleSet),
      grades: toOptions(gradeSet),
      entites: toOptions(entiteSet),
      coordinations: toOptions(coordSet),
    };
  }, [users]);

  const resetFilters = useCallback(() => {
    setRoleFilter(null);
    setGradeFilter(null);
    setEntiteFilter(null);
    setCoordFilter(null);
  }, []);

  // Supprimer un utilisateur avec confirmation
  const deleteUser = (id) => {
    confirm({
      title: "Supprimer cet utilisateur ?",
      icon: <DeleteOutlined />,
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        setDeletingId(id);
        try {
          if (window.api?.deleteUtilisateur) {
            await window.api.deleteUtilisateur(id);
          } else {
            await api.deleteUtilisateurs(id);
          }
          message.success("Utilisateur supprimé");
          setUsers((prev) => prev.filter((u) => u.id !== id));
        } catch (err) {
          console.error("deleteUtilisateur", err);
          message.error("Erreur lors de la suppression");
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  // Réinitialiser le mot de passe d'un utilisateur
  const handleResetPassword = useCallback((record) => {
    let nextPassword = "";
    Modal.confirm({
      title: `Réinitialiser le mot de passe de ${record.username || record.nom || "cet utilisateur"} ?`,
      icon: <KeyOutlined />,
      content: (
        <Input.Password
          autoFocus
          placeholder="Nouveau mot de passe (≥ 6 caractères)"
          onChange={(event) => {
            nextPassword = event.target.value;
          }}
        />
      ),
      okText: "Réinitialiser",
      cancelText: "Annuler",
      onOk: async () => {
        if (!nextPassword || nextPassword.length < 6) {
          message.error("Mot de passe trop court.");
          return Promise.reject();
        }
        setResettingId(record.id);
        try {
          const bridge = window.electronAPI?.resetUserPassword
            ? window.electronAPI
            : window.api?.resetUserPassword
            ? window.api
            : api;
          await bridge.resetUserPassword(record.id, nextPassword);
          message.success("Mot de passe mis à jour.");
        } catch (error) {
          console.error("resetUserPassword", error);
          message.error("Impossible de réinitialiser le mot de passe.");
          return Promise.reject();
        } finally {
          setResettingId(null);
        }
        return true;
      },
    });
  }, []);

  // Filtrage en mémoire
  const filteredUsers = useMemo(() => {
    const q = normaliseString(searchText);
    return users.filter((user) => {
      const bucket = [
        user.nom_utilisateur,
        user.username,
        user.nom,
        user.prenom,
        user.grade,
        user.contact,
        user.email,
        user.role_nom,
        user.entite_nom,
      ]
        .map(normaliseString)
        .join(" ");

      if (q && !bucket.includes(q)) return false;

      if (roleFilter) {
        const labels = Array.isArray(user.role_labels) && user.role_labels.length
          ? user.role_labels
          : (user.role_nom || '')
              .split(',')
              .map((chunk) => chunk.trim())
              .filter(Boolean);
        if (!labels.includes(roleFilter)) return false;
      }

      if (gradeFilter && user.grade !== gradeFilter) return false;
      if (entiteFilter && user.entite_nom !== entiteFilter) return false;

      if (coordFilter) {
        const coordLabel =
          user.sous_entite_nom ||
          user.coordination_regionale_nom ||
          user.coordination_provinciale_nom ||
          user.coordination_communale_nom;
        if (coordLabel !== coordFilter) return false;
      }

      return true;
    });
  }, [users, searchText, roleFilter, gradeFilter, entiteFilter, coordFilter]);

  const resolveRoleLabel = useCallback((record) => {
    if (Array.isArray(record.role_labels) && record.role_labels.length) {
      return record.role_labels.join(", ");
    }
    if (record.role_nom) return record.role_nom;
    return null;
  }, []);

  const statGroups = useMemo(() => {
    if (!stats) return [];
    const groups = [
      { key: "role", title: "Rôle", items: stats.byRole || [] },
      { key: "entite", title: "Entité", items: stats.byEntite || [] },
      { key: "sousEntite", title: "Sous-entité", items: stats.bySousEntite || [] },
    ];

    const coordinationItems = [
      ...(stats.byCoordinationRegionale || []),
      ...(stats.byCoordinationProvinciale || []),
      ...(stats.byCoordinationCommunale || []),
    ].filter(Boolean);

    if (coordinationItems.length) {
      coordinationItems.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
      groups.push({ key: "coordination", title: "Coordination", items: coordinationItems });
    }

    return groups;
  }, [stats]);

  const statHighlights = useMemo(() => {
    if (!stats) return [];
    const totalUsers = stats.total ?? users.length ?? 0;
    const topRole = stats.byRole?.[0];
    const topEntite = stats.byEntite?.[0];
    const topGrade = stats.byGrade?.[0];
    return [
      {
        key: "total",
        label: "Utilisateurs actifs",
        value: totalUsers.toLocaleString("fr-FR"),
        subtitle: "comptes synchronisés",
      },
      {
        key: "role",
        label: "Rôle dominant",
        value: topRole?.label || "—",
        subtitle: topRole ? `${topRole.total} utilisateurs` : "aucune donnée",
      },
      {
        key: "entite",
        label: "Entité la plus représentée",
        value: topEntite?.label || "—",
        subtitle: topEntite ? `${topEntite.total} membres` : "aucune donnée",
      },
      {
        key: "grade",
        label: "Grade le plus fréquent",
        value: topGrade?.label || "—",
        subtitle: topGrade ? `${topGrade.total} profils` : "aucune donnée",
      },
    ];
  }, [stats, users.length]);

  const recapData = useMemo(() => {
    if (!stats || !statGroups.length) return [];
    const totalUsers = stats.total ?? users.length ?? 0;
    return statGroups
      .map(({ key, title, items }) => {
        if (!items?.length) return null;
        const top = items[0];
        const coverage = totalUsers
          ? `${Math.round((Number(top.total) / totalUsers) * 100)}%`
          : "—";
        return {
          key,
          dimension: title,
          topLabel: top.label,
          total: top.total,
          coverage,
        };
      })
      .filter(Boolean);
  }, [stats, statGroups, users.length]);

  const recapColumns = useMemo(
    () => [
      { title: "Dimension", dataIndex: "dimension", key: "dimension" },
      { title: "Segment dominant", dataIndex: "topLabel", key: "topLabel" },
      {
        title: "Utilisateurs",
        dataIndex: "total",
        key: "total",
        align: "right",
        render: (value) => (value != null ? value.toLocaleString("fr-FR") : "—"),
      },
      { title: "Couverture", dataIndex: "coverage", key: "coverage", align: "right" },
    ],
    []
  );

  const shouldShowStats = statsLoading || Boolean(stats);

  const formatDateTime = (value) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("fr-FR");
    } catch (err) {
      console.warn("formatDateTime", err);
      return value;
    }
  };

  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setDetailUser(null);
  }, []);

  const fetchUserDetails = useCallback(async (record) => {
    if (!record?.id) return;
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const getter =
        window.electronAPI?.getUtilisateurById ??
        window.safeElectronAPI?.getUtilisateurById ??
        window.api?.getUtilisateurById ??
        null;
      const details = getter
        ? await getter(record.id)
        : await api.getUtilisateursById(record.id);
      setDetailUser(details || record);
    } catch (error) {
      console.error("getUtilisateurById", error);
      message.error("Impossible de charger les détails de l'utilisateur.");
      closeDetailModal();
    } finally {
      setDetailLoading(false);
    }
  }, [closeDetailModal]);

  const handlePrintUser = useCallback((user) => {
    const target = user || detailUser;
    if (!target) return;
    try {
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
      if (!printWindow) {
        message.error("Fenêtre d'impression bloquée.");
        return;
      }
      const safe = (value) => (value === undefined || value === null || value === "" ? "—" : value);
      const roles = resolveRoleLabel(target) || "—";
      const fullName = [target.nom, target.prenom].filter(Boolean).join(" ") || target.username || "—";
      const rows = [
        { label: "Nom complet", value: fullName },
        { label: "Nom utilisateur", value: safe(target.username || target.nom_utilisateur) },
        { label: "Rôle(s)", value: roles },
        { label: "Grade", value: safe(target.grade) },
        { label: "Contact", value: safe(target.contact) },
        { label: "Email", value: safe(target.email) },
        { label: "Entité", value: safe(target.entite_nom) },
        { label: "Sous-entité", value: safe(target.sous_entite_nom) },
        { label: "Coord. régionale", value: safe(target.coordination_regionale_nom) },
        { label: "Coord. provinciale", value: safe(target.coordination_provinciale_nom) },
        { label: "Coord. communale", value: safe(target.coordination_communale_nom) },
        { label: "Créé le", value: formatDateTime(target.created_at) },
        { label: "Mis à jour le", value: formatDateTime(target.updated_at) },
      ];
      const tableRows = rows
        .map(
          (row) => `
            <tr>
              <th style="text-align:left;padding:8px 12px;width:35%;background:#f7f7f7;border:1px solid #ddd;">${row.label}</th>
              <td style="padding:8px 12px;border:1px solid #ddd;">${row.value}</td>
            </tr>
          `
        )
        .join("\n");

      printWindow.document.write(`
        <!doctype html>
        <html lang="fr">
          <head>
            <meta charset="utf-8" />
            <title>Fiche utilisateur - ${fullName}</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; margin: 32px; color: #111; }
              h1 { font-size: 20px; margin-bottom: 8px; }
              h2 { font-size: 16px; color: #666; margin-top: 0; }
              table { border-collapse: collapse; width: 100%; margin-top: 24px; }
              th { text-transform: uppercase; font-size: 12px; letter-spacing: 0.04em; }
              td { font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>Fiche utilisateur</h1>
            <h2>${fullName}</h2>
            <table>
              ${tableRows}
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 200);
    } catch (error) {
      console.error("printUtilisateur", error);
      message.error("Impossible d'imprimer la fiche.");
    }
  }, [detailUser, resolveRoleLabel, formatDateTime]);

  const handleRecordAction = useCallback(
    (action, record) => {
      if (!record) return;
      switch (action) {
        case "details":
          fetchUserDetails(record);
          break;
        case "edit":
          navigate(`edit/${record.id}`);
          break;
        case "reset":
          handleResetPassword(record);
          break;
        case "delete":
          deleteUser(record.id);
          break;
        case "print":
          handlePrintUser(record);
          break;
        default:
          break;
      }
    },
    [fetchUserDetails, navigate, handleResetPassword, deleteUser, handlePrintUser]
  );

  // Colonnes du tableau
  const columns = [
    { title: "ID", dataIndex: "id", key: "id", width: 70 },
    {
      title: "Nom complet",
      key: "fullname",
      render: (_, record) =>
        [record.nom, record.prenom].filter(Boolean).join(" ") ||
        record.username ||
        "—",
    },
    {
      title: "Grade",
      dataIndex: "grade",
      key: "grade",
      render: (value) => value || "—",
    },
    {
      title: "Contact",
      dataIndex: "contact",
      key: "contact",
      render: (value) => value || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (value) => value || "—",
    },
    {
      title: "Entité",
      dataIndex: "entite_nom",
      key: "entite_nom",
      render: (value) => value || "—",
    },
    {
      title: "Sous-entité / Coord.",
      key: "sous_entite_nom",
      render: (_, record) =>
        record.sous_entite_nom ||
        record.coordination_regionale_nom ||
        record.coordination_provinciale_nom ||
        record.coordination_communale_nom ||
        "—",
    },
    {
      title: "Rôle",
      dataIndex: "role_nom",
      key: "role_nom",
      sorter: (a, b) => {
        const left = resolveRoleLabel(a) || "";
        const right = resolveRoleLabel(b) || "";
        return left.localeCompare(right);
      },
      render: (_, record) => resolveRoleLabel(record) || "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, record) => {
        const isBusy = deletingId === record.id || resettingId === record.id;
        const dropdownMenu = {
          items: [
            {
              key: "reset",
              label: "Réinitialiser le mot de passe",
              icon: <KeyOutlined />,
            },
            {
              key: "print",
              label: "Imprimer la fiche",
              icon: <PrinterOutlined />,
            },
            {
              type: "divider",
            },
            {
              key: "delete",
              label: "Supprimer",
              icon: <DeleteOutlined />,
              danger: true,
            },
          ],
          onClick: ({ key }) => handleRecordAction(key, record),
        };
        return (
          <div className="user-actions-compact">
            <Tooltip title="Voir les détails">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleRecordAction("details", record)}
              />
            </Tooltip>
            <Tooltip title="Modifier">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleRecordAction("edit", record)}
              />
            </Tooltip>
            <Dropdown menu={dropdownMenu} trigger={["click"]} placement="bottomRight">
              <Button type="text" size="small" icon={<MoreOutlined />} loading={isBusy} />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card className="user-pulse-card" bodyStyle={{ padding: 24 }}>
        <div className="user-header">
          <div className="user-header-left">
            <div className="bf-flag" role="img" aria-label="Drapeau du Burkina Faso">
              <span className="bf-flag-star" aria-hidden="true">★</span>
            </div>
            <div>
              <p className="user-header-subtitle">Tableau de bord utilisateurs</p>
              <h2 className="user-header-title">{stats?.total ?? users.length ?? 0} comptes actifs</h2>
              <p className="user-header-hint">Gestion centralisée des accès, rôles et rattachements</p>
            </div>
          </div>
          <Space>
            <Tooltip title="Rafraîchir la vue">
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
            </Tooltip>
            <Tooltip title="Créer un compte">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("add")}>
                Ajouter
              </Button>
            </Tooltip>
          </Space>
        </div>

        {shouldShowStats && (
          <div className="user-dashboard" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              {statHighlights.map((tile) => (
                <Col xs={24} sm={12} lg={6} key={tile.key}>
                  <Card
                    size="small"
                    bordered={false}
                    className="user-highlight-card"
                    loading={statsLoading}
                  >
                    <span className="user-highlight-label">{tile.label}</span>
                    <strong className="user-highlight-value">{tile.value}</strong>
                    <span className="user-highlight-subtitle">{tile.subtitle}</span>
                  </Card>
                </Col>
              ))}
            </Row>
            <Card
              size="small"
              className="user-recap-card"
              loading={statsLoading}
              style={{ marginTop: 16 }}
              title="Tableau de répartition instantané"
              extra={
                <Space size={12}>
                  <Tooltip title="Actualiser les statistiques">
                    <Button
                      size="small"
                      type="text"
                      icon={<ReloadOutlined />}
                      onClick={loadStats}
                    />
                  </Tooltip>
                  <span className="user-recap-hint">Top segments par dimension</span>
                </Space>
              }
            >
              <Table
                columns={recapColumns}
                dataSource={recapData}
                pagination={false}
                size="small"
                rowKey="key"
              />
            </Card>
          </div>
        )}

        <Row gutter={[12, 12]} className="user-toolbar" style={{ marginBottom: 16 }}>
          <Col xs={24} md={6}>
            <Search
              placeholder="Rechercher un utilisateur…"
              enterButton={<SearchOutlined />}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(v) => setSearchText(v)}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              allowClear
              showSearch
              placeholder="Rôle"
              suffixIcon={<FilterOutlined />}
              options={filterOptions.roles}
              value={roleFilter}
              onChange={(value) => setRoleFilter(value || null)}
              className="user-filter-select"
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              allowClear
              showSearch
              placeholder="Grade"
              suffixIcon={<FilterOutlined />}
              options={filterOptions.grades}
              value={gradeFilter}
              onChange={(value) => setGradeFilter(value || null)}
              className="user-filter-select"
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              allowClear
              showSearch
              placeholder="Entité"
              suffixIcon={<FilterOutlined />}
              options={filterOptions.entites}
              value={entiteFilter}
              onChange={(value) => setEntiteFilter(value || null)}
              className="user-filter-select"
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              allowClear
              showSearch
              placeholder="Coordination / Sous-entité"
              suffixIcon={<FilterOutlined />}
              options={filterOptions.coordinations}
              value={coordFilter}
              onChange={(value) => setCoordFilter(value || null)}
              className="user-filter-select"
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} md={2}>
            <Button block onClick={resetFilters}>
              Effacer
            </Button>
          </Col>
        </Row>

        {offline && (
          <Alert
            type="warning"
            showIcon
            closable
            onClose={() => setOffline(false)}
            message="Serveur API inaccessible"
            description="Les opérations nécessitant l’API seront indisponibles tant que la connexion n’est pas rétablie."
            style={{ marginBottom: 16 }}
          />
        )}

        {shouldShowStats && (
          <div className="user-dashboard" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              {statHighlights.map((tile) => (
                <Col xs={24} sm={12} lg={6} key={tile.key}>
                  <Card
                    size="small"
                    bordered={false}
                    className="user-highlight-card"
                    loading={statsLoading}
                  >
                    <span className="user-highlight-label">{tile.label}</span>
                    <strong className="user-highlight-value">{tile.value}</strong>
                    <span className="user-highlight-subtitle">{tile.subtitle}</span>
                  </Card>
                </Col>
              ))}
            </Row>
            <Card
              size="small"
              className="user-recap-card"
              loading={statsLoading}
              style={{ marginTop: 16 }}
              title="Tableau de répartition instantané"
              extra={
                <Space size={12}>
                  <Tooltip title="Actualiser les statistiques">
                    <Button
                      size="small"
                      type="text"
                      icon={<ReloadOutlined />}
                      onClick={loadStats}
                    />
                  </Tooltip>
                  <span className="user-recap-hint">Top segments par dimension</span>
                </Space>
              }
            >
              <Table
                columns={recapColumns}
                dataSource={recapData}
                pagination={false}
                size="small"
                rowKey="key"
              />
            </Card>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          bordered
        />

        <Modal
          open={detailModalOpen}
          title="Détails de l'utilisateur"
          onCancel={closeDetailModal}
          footer={[
            <Button
              key="print"
              icon={<PrinterOutlined />}
              onClick={() => handlePrintUser(detailUser)}
              disabled={!detailUser || detailLoading}
            >
              Imprimer
            </Button>,
            <Button key="close" type="primary" onClick={closeDetailModal}>
              Fermer
            </Button>,
          ]}
        >
          {detailLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
              <Spin />
            </div>
          ) : detailUser ? (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{detailUser.id}</Descriptions.Item>
              <Descriptions.Item label="Nom complet">
                {[detailUser.nom, detailUser.prenom].filter(Boolean).join(" ") || detailUser.username || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Nom utilisateur">
                {detailUser.username || detailUser.nom_utilisateur || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Rôle(s)">
                {resolveRoleLabel(detailUser) || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Grade">{detailUser.grade || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailUser.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Contact">{detailUser.contact || "—"}</Descriptions.Item>
              <Descriptions.Item label="Entité">{detailUser.entite_nom || "—"}</Descriptions.Item>
              <Descriptions.Item label="Sous-entité">{detailUser.sous_entite_nom || "—"}</Descriptions.Item>
              <Descriptions.Item label="Coord. régionale">
                {detailUser.coordination_regionale_nom || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Coord. provinciale">
                {detailUser.coordination_provinciale_nom || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Coord. communale">
                {detailUser.coordination_communale_nom || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Créé le">
                {formatDateTime(detailUser.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Mis à jour le">
                {formatDateTime(detailUser.updated_at)}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Alert type="warning" message="Sélection introuvable" showIcon />
          )}
        </Modal>
      </Card>
    </Spin>
  );
}
