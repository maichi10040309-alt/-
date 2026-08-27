-- 利用者の状態に「休止中」を追加するマイグレーション。
-- 既にSupabaseでsupabase/schema.sqlを実行済みの場合、こちらをSQL Editorで
-- 追加実行してください(新規に環境を作る場合は、最新のschema.sqlを実行するだけでOKです)。

alter table clients add column if not exists status text not null default 'active';
update clients set status = case when active then 'active' else 'ended' end where active is not null;
alter table clients drop column if exists active;
