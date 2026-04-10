-- 管理者（ログイン: 学籍番号 00admin / パスワード password）とサンプルバンド
-- password は bcrypt cost 10（bcryptjs と互換）
INSERT INTO `User` (`id`, `name`, `studentId`, `email`, `passwordHash`, `iconPath`, `isAdmin`, `instruments`)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '管理者',
  '00admin',
  'koiuzmi3751@gmail.com',
  '$2a$10$rf9IJ0iNw0suYJuYQxv6h.K4xFeQMf8jOQ9/IVcrHgp.lvltQDpg6',
  '/uploads/default-avatar.png',
  TRUE,
  '["Vo"]'
)
ON DUPLICATE KEY UPDATE `id` = `id`;

INSERT INTO `Band` (`id`, `name`)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'サンプルバンド'
)
ON DUPLICATE KEY UPDATE `id` = `id`;
