// Use the same hidden About/version route as a browser user.
export async function openGardenEasterEgg(page) {
  await page.locator('.config-button').click();
  await page.locator('[data-action="app-info"]').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="app-version"]').click();
  await page.waitForSelector('.garden-frame');
}
