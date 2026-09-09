"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card" style={{ margin: 24 }}>
      <h2>Something broke</h2>
      <p className="meta">{error.message}</p>
      <button type="button" onClick={reset}>
        Reload the atlas
      </button>
    </div>
  );
}
