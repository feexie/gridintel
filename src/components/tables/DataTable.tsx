type Column<T> = {
  header: string;
  accessorKey: keyof T;
};

type DataTableProps<T extends Record<string, string | number>> = {
  columns: Column<T>[];
  data: T[];
};

export default function DataTable<T extends Record<string, string | number>>({
  columns,
  data,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/6 bg-white/[0.03]">
      <table className="min-w-full divide-y divide-white/5 text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.2em] text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className="px-5 py-4 font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-white/5 text-slate-300">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-white/[0.02]">
              {columns.map((column) => (
                <td key={column.header} className="px-5 py-4">
                  {row[column.accessorKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
