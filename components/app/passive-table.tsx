export function PassiveTable() {
  return (
    <section aria-label="Passive jobs" className="w-full">
      <div className="mb-3 px-4 md:px-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Passive
        </h2>
      </div>
      <div className="px-4 md:px-8">
        <div className="grid place-items-center rounded-xl border border-black/5 bg-white p-10 text-center">
          <div className="max-w-sm space-y-3">
            <p className="text-base text-[#1C1E21]">No passive jobs yet.</p>
            <p className="text-sm text-gray-500">
              Track applications you've sent. When a recruiter replies, activate the job to start
              prep.
            </p>
            <button
              type="button"
              disabled
              className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-full bg-[#482C4C] px-5 text-sm font-medium text-white opacity-60 transition-colors hover:bg-[#3a2440]"
            >
              Add your first application
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
