interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'red' | 'yellow' | 'blue' | 'green';
  subtitle?: string;
}

const colorMap = {
  red: 'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
};

export default function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-6 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
        </div>
        <div className="text-3xl opacity-50">{icon}</div>
      </div>
    </div>
  );
}
