import { createClient } from '@supabase/supabase-js';

// 複数拠点(複数パソコン)で同じデータを共有するための接続情報。
// anon/publishable キーはブラウザに組み込まれる前提の公開用キーであり、
// Row Level Security のポリシー(supabase/schema.sql)で許可された範囲でしか
// 操作できない(このプロジェクトでは「制限なし」の方針のため全操作を許可している)。
const SUPABASE_URL = 'https://odziotgevftllpyulgjg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_k4mQbojqj1PAFZ8CTHOsHw_jqpfz9w3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
