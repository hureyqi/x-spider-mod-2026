import { Button, Card, Space, Typography, Alert, Divider, Tag, Tooltip } from 'antd';
import { UploadOutlined, CopyOutlined, ClearOutlined } from '@ant-design/icons';
import React, { useState } from 'react';

const { Text, Title } = Typography;

interface BatchImportProps {
  onImport: (accounts: string[]) => void;
}

export const BatchImport: React.FC<BatchImportProps> = ({ onImport }) => {
  const [inputValue, setInputValue] = useState('');
  const [previewAccounts, setPreviewAccounts] = useState<string[]>([]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const accounts = value
      .split(/[\n,;]/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a && !a.startsWith('@'));
    
    setPreviewAccounts(accounts);
  };

  const handleImport = () => {
    if (previewAccounts.length === 0) {
      return;
    }
    
    onImport(previewAccounts);
    setInputValue('');
    setPreviewAccounts([]);
  };

  const handleClear = () => {
    setInputValue('');
    setPreviewAccounts([]);
  };

  const handlePasteExample = () => {
    const example = `elonmusk
    cattress
    touhou_music
    shiratamacaron`;
    setInputValue(example);
    handleInputChange(example);
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500">
      <div className="mb-4">
        <Title level={5} className="!mb-2">
          📥 批量导入账户
        </Title>
        <Text type="secondary">
          支持多种格式：用换行、逗号或分号分隔账户名
        </Text>
      </div>

      <Alert
        message="格式说明"
        description={
          <div className="text-sm">
            <div>✓ 每行一个账户名</div>
            <div>✓ 或用逗号分隔：account1, account2, account3</div>
            <div>✓ 自动去除 @ 符号和多余空格</div>
          </div>
        }
        type="info"
        showIcon
        className="mb-4"
      />

      <textarea
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="粘贴账户名列表...

示例：
elonmusk
cattress
touhou_music
shiratamacaron"
        rows={6}
        className="w-full px-3 py-2 border rounded mb-4 font-mono"
      />

      {previewAccounts.length > 0 && (
        <>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <Text strong>
                预览 ({previewAccounts.length} 个账户)
              </Text>
              <Tooltip title="点击复制">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(previewAccounts.join('\n'));
                  }}
                />
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2 p-3 bg-white rounded border">
              {previewAccounts.map((account, index) => (
                <Tag
                  key={index}
                  color="blue"
                  className="text-sm"
                >
                  @{account}
                </Tag>
              ))}
            </div>
          </div>

          <Divider className="my-4" />
        </>
      )}

      <Space className="w-full justify-between">
        <Space>
          <Button
            icon={<ClearOutlined />}
            onClick={handleClear}
            disabled={!inputValue}
          >
            清空
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={handlePasteExample}
          >
            粘贴示例
          </Button>
        </Space>
        
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={handleImport}
          disabled={previewAccounts.length === 0}
          size="large"
          className="bg-gradient-to-r from-blue-500 to-purple-500 border-0"
        >
          导入 {previewAccounts.length > 0 && `(${previewAccounts.length})`}
        </Button>
      </Space>
    </Card>
  );
};
