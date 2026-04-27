import React, { useEffect } from "react";
import { Modal, Form, Input, Row, Col, Tooltip } from "antd";

const HINT = "Astuce : utilisez {{date}} et {{total}} pour insérer la date du jour et le total actuel.";

const PrintLayoutConfigModal = ({ open, initialValues, onCancel, onSave }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        headerTitle: initialValues?.headerTitle || "",
        headerSubtitle: initialValues?.headerSubtitle || "",
        footerLeft: initialValues?.footerLeft || "",
        footerRight: initialValues?.footerRight || "",
      });
    }
  }, [open, initialValues, form]);

  const handleOk = () => {
    form.validateFields().then((values) => onSave(values));
  };

  return (
    <Modal
      open={open}
      title="Mettre en page les impressions"
      okText="Enregistrer"
      cancelText="Annuler"
      onCancel={onCancel}
      onOk={handleOk}
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          label="Titre d'en-tête"
          name="headerTitle"
          rules={[{ required: true, message: "Titre obligatoire" }]}
        >
          <Input placeholder="Ex : Bilan des armes" />
        </Form.Item>
        <Form.Item label="Sous-titre" name="headerSubtitle">
          <Input placeholder="Ex : Direction des Opérations" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Pied gauche" name="footerLeft">
              <Tooltip title={HINT}>
                <Input placeholder="Ex : Édité le {{date}}" />
              </Tooltip>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Pied droit" name="footerRight">
              <Tooltip title={HINT}>
                <Input placeholder="Ex : Total : {{total}}" />
              </Tooltip>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default PrintLayoutConfigModal;
