import { useState } from 'react';
import type { AppData } from '../types';
import { MasterDepartments } from './MasterDepartments';
import { MasterAccountCategories } from './MasterAccountCategories';
import { MasterVendors } from './MasterVendors';
import { MasterCompanySettings } from './MasterCompanySettings';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

type SubTab = 'vendors' | 'departments' | 'accounts' | 'company';

export function Masters({ data, updateData }: Props) {
  const [tab, setTab] = useState<SubTab>('vendors');

  return (
    <div>
      <div className="subtabs">
        <button className={tab === 'vendors' ? 'active' : ''} onClick={() => setTab('vendors')}>取引先</button>
        <button className={tab === 'departments' ? 'active' : ''} onClick={() => setTab('departments')}>部署</button>
        <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>勘定科目</button>
        <button className={tab === 'company' ? 'active' : ''} onClick={() => setTab('company')}>自社情報</button>
      </div>
      {tab === 'vendors' && <MasterVendors data={data} updateData={updateData} />}
      {tab === 'departments' && <MasterDepartments data={data} updateData={updateData} />}
      {tab === 'accounts' && <MasterAccountCategories data={data} updateData={updateData} />}
      {tab === 'company' && <MasterCompanySettings data={data} updateData={updateData} />}
    </div>
  );
}
