// No database needed.
// This route simply exists so you have a real endpoint,
// but signOut() in the client handles the actual disconnect.

export async function POST() {
  return new Response("OK", { status: 200 })
}
