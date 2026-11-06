const block = "animate-pulse rounded-[20px] bg-soft";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className={`h-28 ${block}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`h-96 ${block}`} />
        <div className={`h-72 ${block}`} />
      </div>
    </div>
  );
}
