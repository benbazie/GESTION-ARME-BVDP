// src/components/GeolocalisationForm.js
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Spin,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./GeolocalisationForm.css";

export default function GeolocalisationForm() {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Chargement en édition
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      try {
        const data = await window.api.call("getGeolocById", { id });
        form.setFieldsValue({
          nom: data.nom,
          latitude: data.lat,
          longitude: data.lng,
          description: data.popupText,
        });
      } catch (err) {
        console.error("getGeolocById", err);
        message.error("Erreur lors du chargement de la localisation");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  // Soumission (création ou mise à jour)
  const onFinish = async (values) => {
    setLoading(true);
    const payload = {
      nom: values.nom,
      lat: values.latitude,
      lng: values.longitude,
      popupText: values.description,
    };

    try {
      if (id) {
        await window.api.call("updateGeoloc", { id, ...payload });
        message.success("Localisation mise à jour !");
      } else {
        await window.api.call("createGeoloc", payload);
        message.success("Localisation créée !");
      }
      navigate("/geolocalisation");
    } catch (err) {
      console.error("saveGeoloc", err);
      message.error(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="geolocalisation-form-container">
      <h1>
        {id ? "Modifier la Localisation" : "Ajouter une Localisation"}
      </h1>
      <Button
        type="default"
        onClick={() => navigate("/geolocalisation")}
        icon={<ArrowLeftOutlined />}
        className="back-button"
      >
        Retour à la liste
      </Button>
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="geolocalisation-form"
        >
          <Form.Item
            label="Nom"
            name="nom"
            rules={[
              {
                required: true,
                message: "Veuillez saisir le nom de la localisation",
              },
            ]}
          >
            <Input placeholder="Nom de la localisation" />
          </Form.Item>

          <Form.Item
            label="Latitude"
            name="latitude"
            rules={[
              { required: true, message: "Veuillez saisir la latitude" },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Latitude"
            />
          </Form.Item>

          <Form.Item
            label="Longitude"
            name="longitude"
            rules={[
              { required: true, message: "Veuillez saisir la longitude" },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Longitude"
            />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea
              rows={4}
              placeholder="Description de la localisation"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
            >
              Sauvegarder
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </div>
  );
}
