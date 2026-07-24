/**
 * Captures the device's current GPS coordinates for on-site verification.
 * Used by dip, pump, and cash-up submissions per CEO policy: this work
 * happens physically at the station, and the backend checks that too — this
 * is just how the coordinates get there.
 *
 * Resolves { lat, lng } on success, or null if location can't be obtained
 * (permission denied, unsupported browser, timeout). The backend treats a
 * missing location as "not verified" and rejects the submission with a clear
 * message — this function itself doesn't block anything, it just tries.
 */
export function getCurrentCoords({ timeoutMs = 8000 } = {}) {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    )
  })
}
