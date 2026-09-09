import test from 'node:test';
import assert from 'node:assert/strict';
import { readGardenInputProfile } from './device-garden-profile.mjs';

test('fresh install without XML uses Android hardware default', async () => {
  const missing = Object.assign(new Error('cat failed'), { code: 1, stderr: Buffer.from('cat: shared_prefs/shine_aac_config.xml: No such file or directory\r\n') });
  assert.equal(await readGardenInputProfile(async () => { throw missing; }), 'hardware-buttons');
});
test('existing profiles and absent key retain their meanings', async () => {
  for (const profile of ['camera-long-blink', 'volume-buttons', 'hardware-buttons']) {
    assert.equal(await readGardenInputProfile(async () => Buffer.from(`<map><string name="switchInputProfile">${profile}</string></map>`)), profile);
  }
  assert.equal(await readGardenInputProfile(async () => '<map/>'), 'hardware-buttons');
});
test('device and permission errors never become a default profile', async () => {
  for (const stderr of ['error: device offline', 'cat: shared_prefs/shine_aac_config.xml: Permission denied', 'run-as: package not debuggable', 'cat: another.xml: No such file or directory']) {
    const failure = Object.assign(new Error(stderr), { code: 1, stderr: Buffer.from(stderr) });
    await assert.rejects(readGardenInputProfile(async () => { throw failure; }), error => error === failure);
  }
});
