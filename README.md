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
部署工作流会在启动容器前自动将数据目录及已有数据库文件的所有权修正为
该 UID/GID。

### GitHub Actions

工作流位于 `.github/workflows/deploy.yml`。它会在 GitHub Runner 构建
Docker 镜像，通过 `docker save` 导出，再将镜像文件、应用配置和 env
文件通过 SCP 发送到服务器。服务器只执行 `docker load`，不会访问或上传
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
NODE_IMAGE=node:22-alpine
IMAGE_TAG=latest
APP_UID=1000
APP_GID=1000
DB_PATH=/app/short-link/data/short-link.db
SQLITE_JOURNAL_MODE=DELETE
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-me
SESSION_SECRET=replace-with-a-long-random-string
SESSION_COOKIE_SECURE=true
PUBLIC_BASE_URL=https://l.cnhalo.com
```

远程部署会由 GitHub Actions 将该 Secret 写入 `/app/short-link/.env`，保留
`/app/short-link/data/`，加载 SCP 传输的镜像，然后执行
`docker compose up -d --no-build --remove-orphans`。

### Nginx HTTPS 反向代理

项目提供了域名 `l.cnhalo.com` 的配置：

```text
deploy/nginx/l.cnhalo.com.conf
```

安装到宿主机 Nginx：

```bash
sudo cp /app/short-link/deploy/nginx/l.cnhalo.com.conf \
  /etc/nginx/conf.d/l.cnhalo.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

配置包含 HTTP 到 HTTPS 跳转和 HTTPS 反向代理。默认证书路径为：

```text
/etc/letsencrypt/live/l.cnhalo.com/fullchain.pem
/etc/letsencrypt/live/l.cnhalo.com/privkey.pem
```

如果证书位于其他目录，请修改配置。将 `l.cnhalo.com` 的 DNS A/AAAA
记录指向服务器，并在 `PRODUCTION_ENV_FILE` 中配置：

```dotenv
SESSION_COOKIE_SECURE=true
PUBLIC_BASE_URL=https://l.cnhalo.com
```

Docker 端口仅绑定到 `127.0.0.1:9000`，外部请求统一通过 Nginx 的 80
和 443 端口访问。

访问行为：

- `https://l.cnhalo.com/` 跳转到 `https://cnhalo.com`
- `https://l.cnhalo.com/admin` 打开管理后台
- `https://l.cnhalo.com/r/{code}` 执行短链跳转

## 环境变量

| 名称 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务端口 | `9000` |
| `HOST_PORT` | Docker 映射到宿主机的端口 | `9000` |
| `NODE_IMAGE` | Docker 构建使用的 Node.js 22 Alpine 基础镜像 | `node:22-alpine` |
| `IMAGE_TAG` | 本地手动部署使用的镜像标签；CI 会覆盖为提交 SHA | `latest` |
| `APP_UID` | 容器进程使用的宿主机 UID | `1000` |
| `APP_GID` | 容器进程使用的宿主机 GID | `1000` |
| `DB_PATH` | SQLite 数据库文件地址 | `/app/short-link/data/short-link.db` |
| `SQLITE_JOURNAL_MODE` | SQLite journal 模式，可设为 `WAL`；默认 `DELETE` 避免部署挂载目录需要 `-shm` 文件 | `DELETE` |
| `ADMIN_USERNAME` | 管理员用户名 | 必填 |
| `ADMIN_PASSWORD` | 管理员密码 | 必填 |
| `SESSION_SECRET` | Session 签名密钥 | 必填 |
| `SESSION_COOKIE_SECURE` | 是否仅通过 HTTPS 发送 Session Cookie | HTTPS 部署为 `true` |
| `PUBLIC_BASE_URL` | 生成短地址时使用的公开服务地址 | `http://localhost:$PORT` |

默认 `SQLITE_JOURNAL_MODE=DELETE` 时，应用启动前会将同名
`*.db-wal` / `*.db-shm` 文件备份为 `.bak-*`，避免已有 WAL 辅助文件导致
挂载目录上的 SQLite shared-memory resize 错误。

## 测试

```bash
npm test
```
