import type { ReactNode } from 'react';

export default function SelectionToolbar({
  totalCount,
  selectedCount,
  onDeleteSelected,
  onDeleteAll,
  deleteAllLabel,
  extraActions,
}: {
  totalCount: number;
  selectedCount: number;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  deleteAllLabel?: string;
  extraActions?: ReactNode;
}) {
  if (totalCount === 0) return null;

  return (
    <div className="selection-toolbar">
      <div className="selection-info">{selectedCount > 0 ? `${selectedCount}件を選択中` : `全${totalCount}件`}</div>
      <div className="selection-actions">
        {extraActions}
        {selectedCount > 0 && (
          <button className="btn btn-danger" onClick={onDeleteSelected}>
            選択した{selectedCount}件を削除
          </button>
        )}
        <button className="btn btn-danger" onClick={onDeleteAll}>
          {deleteAllLabel ?? `すべて削除(${totalCount}件)`}
        </button>
      </div>
    </div>
  );
}
