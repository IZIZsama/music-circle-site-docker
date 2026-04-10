# バンド練習時間割・予約管理システム

学内バンドサークル向けの練習予約管理Webシステムです。  
月間カレンダーで予約を確認し、練習量を個人・バンド単位のスコアで可視化できます。

## 機能概要

- **認証**: 学籍番号 + パスワード、パスワード忘れ時はメールで認証コード送信
- **予約**: 月間カレンダー表示、日別一覧、30分刻みで予約（802前方は重複不可）
- **バンド**: 複数所属可、予約時にバンド選択可能（個人練習も可）
- **スコア**: 30分=1pt、今月・過去30日・累計、個人TOP3/全件（管理者）、バンドランキング
- **管理者**: バンド作成・削除、ユーザー退会（単体・学籍番号上2桁一括）、管理者付与、サークル費チェック

## 技術構成

- **フロント**: React 18 + TypeScript + Vite + Tailwind CSS
- **バックエンド**: Node.js + Express
- **DB**: MySQL 8.0（接続は [mysql2](https://github.com/sidorares/node-mysql2) のコネクションプール）

## セットアップ

### 必要環境

- Node.js 18+
- npm
- Docker 利用時: Docker Desktop

## Docker での起動

前提: Docker Desktop を起動しておく。

1. リポジトリのルートへ移動

```bash
cd m-docker
```

2. コンテナ起動

```bash
docker compose up -d --build
```

**初回のみ**（MySQL のデータボリュームが空のとき）、`server/sql/init/` 内の SQL が `docker-entrypoint-initdb.d` 経由で自動実行され、テーブル作成と初期データ（管理者・サンプルバンド）が投入されます。  
既に `mysql_data` ボリュームがある状態でスキーマを入れ直したい場合は、`docker compose down -v` でボリュームを削除してから再度起動するか、手動で SQL を流し込んでください（`-v` は **DB データも消えます**）。

3. アクセス先

- フロント: http://localhost:5173
- API: http://localhost:3001

4. 停止

```bash
docker compose down
```

### Docker 環境の DB 接続（参考）

`docker-compose.yml` の `server` サービスでは次の接続が使われます。

- ホスト名: `mysql`（コンテナ間）
- ユーザー: `root`
- パスワード: `bandpractice`
- データベース: `band_practice`
- 接続文字列例: `mysql://root:bandpractice@mysql:3306/band_practice`（`DATABASE_URL`）

## ローカル開発（Docker なし）

1. リポジトリのルートで依存関係をインストール

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

2. MySQL を起動し、スキーマとシードを流す

`server/.env` を作成し、`server/.env.example` を参考に `DATABASE_URL` を設定します（例: `mysql://root:bandpractice@localhost:3306/band_practice`）。

```bash
mysql -u root -p band_practice < server/sql/init/01_schema.sql
mysql -u root -p band_practice < server/sql/init/02_seed.sql
```

または、DB が空でなくても管理者・サンプルバンドだけ補いたい場合:

```bash
cd server
npm run db:seed
cd ..
```

3. 環境変数（任意）

`server/.env` に上記のほか、必要に応じて設定します。

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET=任意の秘密鍵
# DATABASE_URL の代わりに DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT でも指定可
# パスワード再設定メール用（未設定時はメールは送られず、認証コードがターミナルに表示されます）
# Gmailで送る場合: 二段階認証を有効 → アプリパスワードを発行
# SMTP_URL=smtp://user:pass@smtp.gmail.com:587
# MAIL_FROM=your@gmail.com
```

4. 開発サーバー起動

ルートで:

```bash
npm run dev
```

- フロント: http://localhost:5173
- API: http://localhost:3001

### 初回ログイン（シード後）

- 学籍番号: `00admin`
- パスワード: `password`
（管理者としてログインできます）

## 受け入れ条件の対応

- **802前方**: 重複予約は作成・更新時にサーバーでチェックし、重複時はエラー
- **メンバー**: 自分の未来の予約のみ編集・削除可能
- **アドミン**: 予約日が属する月の翌月末 23:59:59 まで編集・削除可能
- **ランキング**: メンバーは TOP3 のみ、アドミンは全件表示

## 追加機能（サークル費チェック）

- 管理者専用ページ `/admin/circle-fees` を追加
- 表形式で `名前 / {年度}年前期 / 後期` の納入状況を確認・更新
- ヘッダーの管理者メニューに `会費` 導線を追加（バンドとユーザーの間）
- 右上の年度プルダウンで対象年度を切り替え
- 絞り込み機能を追加
  - 全員
  - 前期未納
  - 後期未納
  - 前期 or 後期未納
  - 前後期とも納入済み

### データ構造（`CircleFeeStatus` テーブル）

- カラム: `userId`, `fiscalYear`, `springPaid`, `autumnPaid`
- 一意制約: `(userId, fiscalYear)` で同一年度の重複登録を防止

## ライセンス

MIT
