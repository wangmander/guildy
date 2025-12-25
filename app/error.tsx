"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{ padding: 24 }}>
          <h1>Recovered from error</h1>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {error?.message}
          </pre>
          <button
            style={{ marginTop: 16 }}
            onClick={() => reset()}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
