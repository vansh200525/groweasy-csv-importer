"use client";

interface Props {
  columns: string[];
  rows: Record<string, any>[];
  maxHeight?: string;
  emptyMessage?: string;
}

export default function DataTable({
  columns,
  rows,
  maxHeight = "420px",
  emptyMessage = "No data to display.",
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
      style={{ maxHeight }}
    >
      <table className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`${
                i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-800/40"
              } hover:bg-brand-50/50 dark:hover:bg-brand-900/20`}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="max-w-[260px] truncate whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-gray-700 dark:border-gray-800 dark:text-gray-300"
                  title={String(row[col] ?? "")}
                >
                  {String(row[col] ?? "") || (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
