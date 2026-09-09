// A fresh Android SharedPreferences instance has defaults before its XML exists.
export async function readGardenInputProfile(readPreferences) {
  let prefs;
  try {
    prefs = (await readPreferences()).toString();
  } catch (error) {
    // Only the known missing preferences file is a fresh-install default.
    // ADB disconnects, permission failures, and other read errors remain failures.
    if (error.code === 1 && /^cat: shared_prefs\/shine_aac_config\.xml: No such file or directory\s*$/.test(error.stderr?.toString() || '')) {
      return 'hardware-buttons';
    }
    throw error;
  }
  return prefs.match(/<string name="switchInputProfile">([^<]*)<\/string>/)?.[1] || 'hardware-buttons';
}
