import React, { useState } from 'react';
import CommitManager from '../utils/CommitManager';

const { TextArea } = Input;

function CommitDialog({ visible, onCancel, onOk }) {
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCommit = async () => {
    try {
      setLoading(true);
      CommitManager.setCommitMessage(commitMessage);
      await CommitManager.commit();
      onOk();
    } catch (error) {
      console.error('Erreur de commit:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Nouveau Commit"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Annuler
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleCommit}
          disabled={!commitMessage.trim()}
        >
          Commit
        </Button>
      ]}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <h4>Message du commit :</h4>
          <TextArea
            rows={4}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Décrivez vos modifications..."
          />
        </div>
        
        <div>
          <h4>Modifications en attente :</h4>
          <List
            size="small"
            bordered
            dataSource={CommitManager.changes}
            renderItem={item => (
              <List.Item>
                <Space>
                  <Tag color={item.type === 'add' ? 'green' : item.type === 'modify' ? 'blue' : 'red'}>
                    {item.type}
                  </Tag>
                  {item.file}
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Modal>
  );
}

export default CommitDialog;
