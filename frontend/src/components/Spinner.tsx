export default function Spinner() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#E2E8F0] border-t-[#2563EB]" aria-label="Loading" />
    </div>
  );
}
