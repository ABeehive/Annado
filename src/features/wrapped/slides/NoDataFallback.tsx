export function NoDataFallback({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="h-full flex items-center justify-center" style={{ color: 'var(--slide-accent)', opacity: 0.5 }}>
      {message}
    </div>
  );
}
