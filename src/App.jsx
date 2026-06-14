import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Layout,
  Pagination,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  BarChartOutlined,
  CopyOutlined,
  LinkOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "请求失败");
    error.status = response.status;
    throw error;
  }
  return data;
}

function Login({ onSuccess }) {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);

  const submit = async (values) => {
    setLoading(true);
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("登录成功");
      onSuccess(result.user);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand brand-login">
          <span className="brand-icon"><LinkOutlined /></span>
          <span>ShortLink</span>
        </div>
        <Title level={2}>管理员登录</Title>
        <Paragraph type="secondary">登录后管理短地址 Mapping</Paragraph>
        <Form layout="vertical" size="large" onFinish={submit} requiredMark={false}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入管理员用户名" }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" placeholder="管理员用户名" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入管理员密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
              placeholder="管理员密码"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
        </Form>
      </section>
    </main>
  );
}

function MappingDrawer({ open, record, publicBaseUrl, onClose, onAfterClose, onSaved }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        code: record?.code || "",
        targetUrl: record?.targetUrl || "",
        enabled: record?.enabled ?? true,
      });
    }
  }, [form, open, record]);

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const saved = await api(record ? `/api/mappings/${record.id}` : "/api/mappings", {
        method: record ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      message.success(record ? "Mapping 已更新" : "Mapping 已创建");
      onSaved(saved);
    } catch (error) {
      if (error.status === 409) {
        form.setFields([{ name: "code", errors: [error.message] }]);
      } else {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={record ? "编辑 Mapping" : "创建 Mapping"}
      width="min(468px, 100vw)"
      open={open}
      mask={false}
      rootStyle={{ top: 68, height: "calc(100% - 68px)" }}
      onClose={onClose}
      afterOpenChange={(nextOpen) => {
        if (!nextOpen) onAfterClose();
      }}
      destroyOnHidden
      footer={
        <div className="drawer-footer">
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={save}>
            {record ? "保存修改" : "创建 Mapping"}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label="短码"
          name="code"
          extra="3–32 个字符，支持字母、数字、连字符（-）和下划线（_）"
          rules={[
            { required: true, message: "请输入短码" },
            { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/, message: "短码格式不正确" },
          ]}
        >
          <Input addonBefore={`${publicBaseUrl}/r/`} placeholder="例如 docs" />
        </Form.Item>
        <Form.Item
          label="目标地址"
          name="targetUrl"
          rules={[
            { required: true, message: "请输入目标地址" },
            { type: "url", message: "请输入有效的 http:// 或 https:// 地址" },
            {
              validator: (_, value) =>
                !value || /^https?:\/\//i.test(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error("仅支持 http:// 或 https:// 地址")),
            },
          ]}
        >
          <Input placeholder="https://www.example.com/landing" />
        </Form.Item>
        <Form.Item label="状态" name="enabled" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
        <Alert type="warning" showIcon message="启用后短链接可以正常访问；停用后访问会返回 404。" />
        {record && (
          <div className="record-meta">
            <Text type="secondary">创建时间：{record.createdAt}</Text>
            <Text type="secondary">最后更新：{record.updatedAt}</Text>
          </div>
        )}
      </Form>
    </Drawer>
  );
}

function Dashboard({ user, onLogout }) {
  const { message } = AntApp.useApp();
  const [activeTab, setActiveTab] = useState("mappings");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState({ open: false, record: null });
  const [config, setConfig] = useState({ publicBaseUrl: window.location.origin });
  const [stats, setStats] = useState({ total: 0, enabled: 0, disabled: 0, visits: 0 });
  const closeDrawer = () => setDrawer((current) => ({ ...current, open: false }));

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, pageSize, status, search: query });
      const [list, stat, appConfig] = await Promise.all([
        api(`/api/mappings?${params}`),
        api("/api/stats"),
        api("/api/config"),
      ]);
      setRows(list.items);
      setTotal(list.total);
      setStats(stat);
      setConfig(appConfig);
    } catch (error) {
      if (error.status === 401) onLogout();
      else message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize, status, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const remove = async (id) => {
    try {
      await api(`/api/mappings/${id}`, { method: "DELETE" });
      message.success("Mapping 已删除");
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (error) {
      message.error(error.message);
    }
  };

  const copy = async (url) => {
    await navigator.clipboard.writeText(url);
    message.success("短地址已复制");
  };

  const columns = useMemo(
    () => [
      {
        title: "短地址",
        dataIndex: "shortUrl",
        width: 205,
        render: (_, record) => (
          <div className="url-cell">
            <a href={record.shortUrl} target="_blank" rel="noreferrer">{record.shortUrl}</a>
            <Button
              aria-label={`复制 ${record.code}`}
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copy(record.shortUrl)}
            />
          </div>
        ),
      },
      {
        title: "目标地址",
        dataIndex: "targetUrl",
        ellipsis: true,
        render: (value) => (
          <a className="target-url" href={value} target="_blank" rel="noreferrer">{value}</a>
        ),
      },
      {
        title: "状态",
        dataIndex: "enabled",
        width: 76,
        render: (value) => <Tag color={value ? "success" : "default"}>{value ? "启用" : "停用"}</Tag>,
      },
      { title: "访问", dataIndex: "visits", width: 72, sorter: (a, b) => a.visits - b.visits },
      {
        title: "最后更新",
        dataIndex: "updatedAt",
        width: 168,
        render: (value) => <span className="timestamp">{value}</span>,
      },
      {
        title: "操作",
        width: 136,
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => setDrawer({ open: true, record })}
            >
              编辑
            </Button>
            <Popconfirm
              title="删除该 Mapping？"
              description="删除后对应短地址将立即失效。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(record.id)}
            >
              <Button type="link" danger size="small">删除</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [rows],
  );

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    onLogout();
  };

  const userMenu = {
    items: [
      { key: "username", label: user.username, disabled: true },
      { type: "divider" },
      { key: "logout", label: "退出登录", icon: <LogoutOutlined />, onClick: logout },
    ],
  };

  return (
    <Layout className="app-layout">
      <Header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-icon"><LinkOutlined /></span><span>ShortLink</span></div>
          <div className="nav-wrap">
            <Button
              type="text"
              className={activeTab === "mappings" ? "nav-button active" : "nav-button"}
              onClick={() => setActiveTab("mappings")}
            >
              链接管理
            </Button>
            <Button
              type="text"
              className={activeTab === "overview" ? "nav-button active" : "nav-button"}
              onClick={() => setActiveTab("overview")}
            >
              访问概览
            </Button>
          </div>
          <Dropdown menu={userMenu} trigger={["click"]}>
            <Button type="text" className="user-button">
              <Avatar size="small" icon={<UserOutlined />} /> {user.username}
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Content className={drawer.open ? "content drawer-open" : "content"}>
        {activeTab === "overview" ? (
          <section>
            <Title level={2}>访问概览</Title>
            <Paragraph type="secondary">查看短链接的整体使用情况</Paragraph>
            <Row gutter={[20, 20]} className="stats-grid">
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="Mapping 总数" value={stats.total} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="启用中" value={stats.enabled} valueStyle={{ color: "#389e0d" }} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="已停用" value={stats.disabled} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="累计访问" value={stats.visits} /></Card></Col>
            </Row>
          </section>
        ) : (
          <section>
            <div className="page-heading">
              <div>
                <Title level={2}>链接管理</Title>
                <Paragraph type="secondary">管理和维护您的短链接 Mapping</Paragraph>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setDrawer({ open: true, record: null })}
              >
                创建 Mapping
              </Button>
            </div>
            <div className="toolbar">
              <Segmented
                value={status}
                onChange={(value) => { setPage(1); setStatus(value); }}
                options={[
                  { label: "全部", value: "all" },
                  { label: "启用", value: "enabled" },
                  { label: "停用", value: "disabled" },
                ]}
              />
              <Input
                allowClear
                value={search}
                prefix={<SearchOutlined />}
                placeholder="搜索短码或目标地址"
                onChange={(event) => setSearch(event.target.value)}
                onPressEnter={(event) => {
                  setPage(1);
                  setQuery(event.target.value.trim());
                }}
                onClear={() => { setPage(1); setQuery(""); }}
                className="search-input"
              />
            </div>
            <div className="table-wrap">
              <Table
                rowKey="id"
                columns={columns}
                dataSource={rows}
                loading={loading}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无 Mapping" /> }}
                scroll={{ x: 880 }}
              />
              <div className="pagination-row">
                <Text type="secondary">共 {total} 条</Text>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  onChange={(nextPage, nextSize) => {
                    setPage(nextSize !== pageSize ? 1 : nextPage);
                    setPageSize(nextSize);
                  }}
                />
              </div>
            </div>
          </section>
        )}
      </Content>
      <MappingDrawer
        open={drawer.open}
        record={drawer.record}
        publicBaseUrl={config.publicBaseUrl}
        onClose={closeDrawer}
        onAfterClose={() => setDrawer({ open: false, record: null })}
        onSaved={() => {
          closeDrawer();
          load();
        }}
      />
    </Layout>
  );
}

export function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    api("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  return (
    <AntApp>
      {checking ? (
        <div className="center-spin"><Spin size="large" /></div>
      ) : user ? (
        <Dashboard user={user} onLogout={() => setUser(null)} />
      ) : (
        <Login onSuccess={setUser} />
      )}
    </AntApp>
  );
}
