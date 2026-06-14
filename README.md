# ShortLink

基于 Node.js、SQLite、React 和 Ant Design 的短地址管理平台。

## 功能

- 管理员用户名密码登录，账号配置在环境变量中
- 登录 Session 持久化保存在 SQLite 中
- Mapping 创建、编辑、删除、搜索、筛选和分页
- Mapping 启用/停用、短地址复制
- 短地址跳转与访问次数统计
- SQLite 数据库文件路径可配置
- 桌面与移动端响应式管理界面

## 启动

```bash
cp .env.example .env
npm install
npm run dev
```

开发环境：

- 管理界面：<http://localhost:5173>
- API 与短地址服务：<http://localhost:9000>

请在 `.env` 中修改 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 和 `SESSION_SECRET`。

## 生产运行

```bash
npm install
npm run build
NODE_ENV=production npm start
```

生产环境由 Express 在 `PORT` 端口同时提供管理界面、API 和短地址跳转。

## Docker 部署

容器内应用根目录为 `/app/short-link`，SQLite 数据保存在
`/app/short-link/data/short-link.db`。Compose 将服务器上的
`/app/short-link/data` 挂载到容器同名目录。

服务器首次部署前：

```bash
sudo mkdir -p /app/short-link/data
sudo chown -R "$USER":"$USER" /app/short-link
```

`APP_UID` 和 `APP_GID` 应填写服务器上 `/app/short-link/data` 所有者的
UID/GID，可通过 `id -u` 和 `id -g` 获取。默认均为 `1000`。

### GitHub Actions

工作流位于 `.github/workflows/deploy.yml`。它会运行测试和构建 Docker
镜像验证，然后将部署压缩包通过 SCP 发送到服务器；不会上传镜像到
Docker Hub、GHCR 或其他镜像仓库。

需要配置以下 GitHub Actions Secrets：

| Secret | 说明 |
| --- | --- |
| `REMOTE_HOST` | 服务器地址 |
| `REMOTE_USER` | SSH 用户 |
| `REMOTE_PORT` | SSH 端口，可不填，默认 `22` |
| `SSH_PRIVATE_KEY` | SSH 私钥 |
| `PRODUCTION_ENV_FILE` | 完整的生产环境 `.env` 文件内容，多行 Secret |

`PRODUCTION_ENV_FILE` 可参考 `.env.example`，例如：

```dotenv
PORT=9000
HOST_PORT=9000
APP_UID=1000
APP_GID=1000
DB_PATH=/app/short-link/data/short-link.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-me
SESSION_SECRET=replace-with-a-long-random-string
PUBLIC_BASE_URL=https://short.example.com
```

远程部署会由 GitHub Actions 将该 Secret 写入 `/app/short-link/.env`，保留
`/app/short-link/data/`，替换其他应用文件，然后执行
`docker compose up -d --build --remove-orphans`。

## 环境变量

| 名称 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务端口 | `9000` |
| `HOST_PORT` | Docker 映射到宿主机的端口 | `9000` |
| `APP_UID` | 容器进程使用的宿主机 UID | `1000` |
| `APP_GID` | 容器进程使用的宿主机 GID | `1000` |
| `DB_PATH` | SQLite 数据库文件地址 | `/app/short-link/data/short-link.db` |
| `ADMIN_USERNAME` | 管理员用户名 | 必填 |
| `ADMIN_PASSWORD` | 管理员密码 | 必填 |
| `SESSION_SECRET` | Session 签名密钥 | 必填 |
| `PUBLIC_BASE_URL` | 生成短地址时使用的公开服务地址 | `http://localhost:$PORT` |

## 测试

```bash
npm test
```
