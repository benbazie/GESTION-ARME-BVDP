import React from "react";
import { Modal } from "antd";
import ArmeList from "./ArmeList";

// Props : visible, onClose
export default function AnalyseCroiseeModal({ visible, onClose }) {
  return (
    <Modal
      open={visible}
      title="Analyse croisée dynamique"
      footer={null}
      width="90vw"
      style={{ top: 24 }}
      onCancel={onClose}
      destroyOnClose
      bodyStyle={{ minHeight: 480, padding: 0 }}
      maskClosable
    >
      {/* Utilise seulement la partie analyse croisée */}
      <div style={{ padding: 24 }}>
        <ArmeList showOnlyCrossTab={true} />
      </div>
    </Modal>
  );
}
