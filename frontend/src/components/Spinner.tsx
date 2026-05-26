export default function Spinner() {
  return (
    <div className="flex min-h-[220px] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
    </div>
  );
}
