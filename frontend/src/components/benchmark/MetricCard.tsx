type MetricFormat = 'percent' | 'number' | 'ms';
type MetricSize = 'small' | 'default' | 'large';
type MetricColor = 'blue' | 'green' | 'yellow' | 'red' | 'gray';

interface MetricCardProps {
  title: string;
  value: number | null | undefined;
  format?: MetricFormat;
  change?: number | null;
  description?: string | null;
  size?: MetricSize;
  color?: MetricColor;
}

/**
 * MetricCard - Displays a single metric with value and optional comparison
 */
export default function MetricCard({
  title,
  value,
  format = 'percent',
  change = null,
  description = null,
  size = 'default',
  color = 'blue'
}: MetricCardProps): React.JSX.Element {
  const formatValue = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '-';
    switch (format) {
      case 'percent':
        return `${(val * 100).toFixed(1)}%`;
      case 'ms':
        return `${Math.round(val)}ms`;
      case 'number':
        return val.toFixed(2);
      default:
        return val.toFixed(2);
    }
  };

  const colorClasses: Record<MetricColor, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  const sizeClasses: Record<MetricSize, string> = {
    small: 'p-2',
    default: 'p-4',
    large: 'p-6',
  };

  const valueSizeClasses: Record<MetricSize, string> = {
    small: 'text-xl',
    default: 'text-2xl',
    large: 'text-4xl',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} ${sizeClasses[size]}`}>
      <div className="text-sm font-medium opacity-75 mb-1">{title}</div>
      <div className={`font-bold ${valueSizeClasses[size]}`}>
        {formatValue(value)}
      </div>
      {change !== null && (
        <div className={`text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      )}
      {description && (
        <div className="text-xs opacity-60 mt-2">{description}</div>
      )}
    </div>
  );
}
