-- 介護用品レンタル請求システム: Supabaseスキーマ
-- Supabaseダッシュボードの「SQL Editor」でこのファイルの中身をそのまま実行してください。
-- 「制限なし(URLを知っていれば誰でも見れる)」の運用方針に合わせて、
-- 匿名キー(anon key)からの読み書きを全テーブルで許可しています。

create table if not exists clients (
  id uuid primary key,
  name text not null default '',
  kana text not null default '',
  care_level text not null default '',
  copay_ratio text not null default '1',
  payment_method text not null default 'cycle',
  address text not null default '',
  phone text not null default '',
  care_office_name text not null default '',
  care_manager_name text not null default '',
  sales_rep_name text not null default '',
  status text not null default 'active',
  note text not null default ''
);

create table if not exists items (
  id uuid primary key,
  name text not null default '',
  category text not null default '',
  billing_type text not null default 'insurance',
  unit_price numeric not null default 0,
  note text not null default ''
);

create table if not exists usage_entries (
  id uuid primary key,
  client_id uuid not null,
  year_month text not null,
  item_id uuid not null,
  item_name text not null default '',
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  tax_category text not null default 'nontaxable',
  note text not null default '',
  entered_at text not null default ''
);

create table if not exists invoices (
  id uuid primary key,
  invoice_no text not null default '',
  client_id uuid not null,
  cycle_start_month text not null,
  cycle_end_month text not null,
  months jsonb not null default '[]',
  adjustments jsonb not null default '[]',
  total_amount numeric not null default 0,
  non_taxable_total numeric not null default 0,
  taxable_total numeric not null default 0,
  billing_category text not null default 'combined',
  status text not null default 'draft',
  issued_date text,
  paid_date text,
  created_at text not null default ''
);

create table if not exists client_events (
  id uuid primary key,
  client_id uuid not null,
  type text not null,
  date text not null,
  content text not null default '',
  note text not null default '',
  created_at text not null default ''
);

create table if not exists late_adjustments (
  id uuid primary key,
  client_id uuid not null,
  original_year_month text not null,
  billed_year_month text not null,
  reason text not null default '',
  billing_type text not null default 'insurance',
  item_name text not null default '',
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  tax_category text not null default 'nontaxable',
  note text not null default '',
  created_at text not null default ''
);

-- 会社設定は1行だけ持つ単一レコードテーブル
create table if not exists company_settings (
  id int primary key default 1,
  company_name text not null default '株式会社グッドライフ',
  address text not null default '和歌山市内原876-1',
  phone text not null default '',
  fax text not null default '',
  bank_info text not null default '',
  invoice_seq int not null default 1
);
insert into company_settings (id) values (1) on conflict (id) do nothing;

-- 全テーブルでRow Level Securityを有効化した上で、匿名キーからの
-- 全操作(select/insert/update/delete)を許可するポリシーを追加する。
-- (「URLを知っていれば誰でも見れる」運用のため。制限をかけたくなった場合は
--  ここのポリシーを見直してください)
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'clients', 'items', 'usage_entries', 'invoices',
    'client_events', 'late_adjustments', 'company_settings'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'drop policy if exists "public full access" on %I;', t
    );
    execute format(
      'create policy "public full access" on %I for all using (true) with check (true);', t
    );
  end loop;
end $$;
