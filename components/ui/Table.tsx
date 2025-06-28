import React from 'react';

interface TableColumn<T> {
  key: keyof T | string;
  header: string | React.ReactNode;
  render?: (item: T, value: any) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  onRowClick?: (item: T) => void;
  onRowLongPress?: (item: T, event: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

function Table<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  onRowLongPress,
  className = '',
  emptyMessage = 'No data available',
  loading = false,
  striped = true,
  hoverable = true,
}: TableProps<T>) {
  const [longPressTimer, setLongPressTimer] = React.useState<NodeJS.Timeout | null>(null);
  const [longPressItem, setLongPressItem] = React.useState<T | null>(null);
  const getCellValue = (item: T, column: TableColumn<T>) => {
    if (typeof column.key === 'string' && column.key.includes('.')) {
      // Handle nested properties like 'user.name'
      return column.key.split('.').reduce((obj, key) => obj?.[key], item);
    }
    return item[column.key as keyof T];
  };

  const getAlignmentClass = (align?: string) => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const handleTouchStart = (item: T, e: React.TouchEvent) => {
    if (!onRowLongPress) return;

    const timer = setTimeout(() => {
      onRowLongPress(item, e);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);

    setLongPressTimer(timer);
    setLongPressItem(item);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      setLongPressItem(null);
    }
  };

  const handleMouseDown = (item: T, e: React.MouseEvent) => {
    if (!onRowLongPress) return;

    const timer = setTimeout(() => {
      onRowLongPress(item, e);
    }, 500);

    setLongPressTimer(timer);
    setLongPressItem(item);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      setLongPressItem(null);
    }
  };

  const handleRowClick = (item: T) => {
    if (!longPressTimer && onRowClick) {
      onRowClick(item);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-gray-500 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-full ${className}`}>
        <thead>
          <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            {columns.map((column, index) => (
              <th
                key={index}
                className={`px-2 sm:px-3 py-2 sm:py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider ${getAlignmentClass(column.align)}`}
                style={{ width: column.width, minWidth: column.width || '80px' }}
              >
                <div className="truncate">{column.header}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((item, rowIndex) => (
            <tr
              key={rowIndex}
              className={`
                ${striped && rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                ${hoverable ? 'hover:bg-blue-50/50 transition-colors duration-200' : ''}
                ${onRowClick || onRowLongPress ? 'cursor-pointer' : ''}
                ${longPressItem === item ? 'bg-blue-100' : ''}
                select-none
              `}
              onClick={() => handleRowClick(item)}
              onTouchStart={(e) => handleTouchStart(item, e)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={(e) => handleMouseDown(item, e)}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {columns.map((column, colIndex) => {
                const value = getCellValue(item, column);
                return (
                  <td
                    key={colIndex}
                    className={`px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 ${getAlignmentClass(column.align)}`}
                    style={{ width: column.width, minWidth: column.width || '80px' }}
                  >
                    <div className="truncate">
                      {column.render ? column.render(item, value) : value || '-'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
