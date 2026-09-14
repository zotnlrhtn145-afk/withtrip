/** Public signing-certificate fingerprint verified from EAS release APK 1.1.0(85).
 * Recheck when the APK signing certificate changes; Play signing may use another certificate.
 */
export function GET() {
 return Response.json([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "app.withtrip.mobile", sha256_cert_fingerprints: ["59:05:30:80:E5:3D:7F:12:B6:B2:7C:15:9E:BF:F1:6D:16:B3:2A:4B:91:99:25:40:B3:2F:44:8C:26:BD:42:DC"] } }], { headers: { "Cache-Control": "public, max-age=3600" } })
}
