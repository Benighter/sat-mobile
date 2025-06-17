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
  className = '',
  emptyMessage = 'No data available',
  loading = false,
  striped = true,
  hoverable = true,
}: TableProps<T>) {
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
    <table className={`w-full ${className}`}>
      <thead>
        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          {columns.map((column, index) => (
            <th
              key={index}
              className={`px-3 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider ${getAlignmentClass(column.align)}`}
              style={{ width: column.width, minWidth: column.width }}
            >
              {column.header}
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
              ${onRowClick ? 'cursor-pointer' : ''}
            `}
            onClick={() => onRowClick?.(item)}
          >
            {columns.map((column, colIndex) => {
              const value = getCellValue(item, column);
              return (
                <td
                  key={colIndex}
                  className={`px-3 py-3 text-sm text-gray-900 ${getAlignmentClass(column.align)}`}
                  style={{ width: column.width, minWidth: column.width }}
                >
                  {column.render ? column.render(item, value) : value || '-'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Table;
