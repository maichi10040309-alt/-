import { useState } from 'react';
import { parseCSV } from '../utils/csv';
import {
  guessMapping,
  looksNumeric,
  parseNumberJP,
  parseTaxRate,
  type ImportFieldDef,
} from '../utils/importMapping';

export type MappedValue = string | number;

export default function CsvImportButton({
  label,
  fields,
  onImport,
}: {
  label: string;
  fields: ImportFieldDef[];
  onImport: (rows: Record<string, MappedValue>[]) => Promise<void>;
}) {
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [taxAssumption, setTaxAssumption] = useState<8 | 10>(10);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      alert('CSVを読み取れませんでした。');
      return;
    }
    setCsvRows(rows);
    setMapping(guessMapping(rows[0], fields));
  };

  const close = () => {
    setCsvRows(null);
    setMapping({});
  };

  if (!csvRows) {
    return (
      <label className="btn btn-secondary">
        {label}
        <input
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </label>
    );
  }

  const [headerRow, ...bodyRows] = csvRows;
  const dataRows = bodyRows.filter((r) => r.some((cell) => cell.trim() !== ''));

  const taxRateField = fields.find((f) => f.kind === 'taxRate');
  const taxRateColIdx = taxRateField ? mapping[taxRateField.key] : null;
  const taxRateColValues = taxRateColIdx != null ? dataRows.map((r) => r[taxRateColIdx] ?? '') : [];
  const taxRateIsText = taxRateColIdx != null && !looksNumeric(taxRateColValues);

  const buildRecord = (row: string[]): Record<string, MappedValue> => {
    const record: Record<string, MappedValue> = {};
    for (const field of fields) {
      const colIdx = mapping[field.key];
      const raw = colIdx != null ? (row[colIdx] ?? '') : '';
      if (field.kind === 'number') {
        record[field.key] = parseNumberJP(raw);
      } else if (field.kind === 'taxRate') {
        record[field.key] = parseTaxRate(raw, taxAssumption);
      } else {
        record[field.key] = raw.trim();
      }
    }
    return record;
  };

  const previewRows = dataRows.slice(0, 5).map(buildRecord);

  const handleConfirm = async () => {
    const requiredField = fields.find((f) => f.required);
    if (requiredField && mapping[requiredField.key] == null) {
      alert(`「${requiredField.label}」に対応する列を選択してください。`);
      return;
    }
    setImporting(true);
    try {
      const records = dataRows.map(buildRecord);
      await onImport(records);
      alert(`${records.length}件を取り込みました。`);
      close();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
        <div className="modal-box csv-import-box">
          <h2 className="section-title">CSV取り込み: 列の対応付け</h2>
          <p className="hint">
            CSVの各列が、どの項目に対応するか選んでください。自動で推測した対応を表示しています。
          </p>

          <table className="data-table compact csv-mapping-table">
            <thead>
              <tr>
                <th>取り込み先の項目</th>
                <th>CSVの列</th>
                <th>プレビュー(1件目)</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const colIdx = mapping[field.key];
                const sample = colIdx != null ? (dataRows[0]?.[colIdx] ?? '') : '';
                return (
                  <tr key={field.key}>
                    <td>
                      {field.label}
                      {field.required && ' *'}
                    </td>
                    <td>
                      <select
                        value={colIdx ?? ''}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [field.key]: e.target.value === '' ? null : Number(e.target.value),
                          }))
                        }
                      >
                        <option value="">(使用しない)</option>
                        {headerRow.map((h, idx) => (
                          <option key={idx} value={idx}>
                            {h || `(${idx + 1}列目)`}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="csv-preview-cell">{sample}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {taxRateField && taxRateColIdx != null && taxRateIsText && (
            <div className="tax-assumption-row">
              <label>
                「課税」を
                <select value={taxAssumption} onChange={(e) => setTaxAssumption(Number(e.target.value) as 8 | 10)}>
                  <option value={10}>10%</option>
                  <option value={8}>8%</option>
                </select>
                として取り込む(「非課税」は自動的に0%になります)
              </label>
            </div>
          )}

          <h3 className="section-title">取り込みプレビュー(先頭5件・全{dataRows.length}件中)</h3>
          <div className="csv-preview-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  {fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i}>
                    {fields.map((f) => (
                      <td key={f.key}>{String(r[f.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={close} disabled={importing}>
              キャンセル
            </button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={importing}>
              {importing ? '取り込み中...' : `この内容で${dataRows.length}件取り込む`}
            </button>
          </div>
        </div>
      </div>
  );
}
