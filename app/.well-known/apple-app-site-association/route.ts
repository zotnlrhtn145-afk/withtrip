/** Public app-domain association; deliberately restricted to recipient links. */
export function GET() {
 return Response.json({ applinks: { apps: [], details: [{ appID: "TUBJVGHY42.app.withtrip.mobile", paths: ["/s/place/*"] }] } }, { headers: { "Cache-Control": "public, max-age=3600" } })
}
