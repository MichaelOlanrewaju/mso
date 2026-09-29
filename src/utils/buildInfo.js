/* Identifies which build of the app is actually running on a device. The same
   id is stamped into the service worker's cache name at build time, so this
   label answers "is this phone on the new version?" without guessing. */
// eslint-disable-next-line no-undef
export const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev"
