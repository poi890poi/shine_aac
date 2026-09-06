const paths={
  play:'<path d="M9 5v22l18-11z" fill="currentColor"/>',
  replay:'<path d="M7 10a11 11 0 1 1-2 12M7 3v8h8"/>',
  pause:'<path d="M10 6v20M22 6v20" stroke-width="5"/>',
  exit:'<path d="M13 5H5v22h8M13 16h15m-6-6 6 6-6 6"/>',
  drop:'<path class="droplet-fill" d="M16 3C13 9 6 15 6 21a10 10 0 0 0 20 0c0-6-7-12-10-18Z"/>',
  settings:'<path d="M5 8h22M5 16h22M5 24h22"/><path d="M11 4v8M22 12v8M14 20v8" stroke-width="5"/>',
  sound:'<path d="M5 12h5l7-6v20l-7-6H5zM22 10q8 6 0 12"/>',
  muted:'<path d="M5 12h5l7-6v20l-7-6H5zM22 12l7 8m0-8-7 8"/>',
  slow:'<path d="m12 7 9 9-9 9"/>',
  normal:'<path d="m6 7 9 9-9 9m12-18 9 9-9 9"/>',
  fast:'<path d="m2 7 7 9-7 9m11-18 7 9-7 9m11-18 7 9-7 9"/>',
  flyby:'<path d="M3 11h23m-5-5 6 5-6 5M16 19v8m-4-4 4 4 4-4"/>',
  recharge:'<path d="M7 9a11 11 0 1 1-2 12M7 3v7h7"/><path d="M11 17v4m5-4v4m5-4v4"/>',
  error:'<path d="M16 3 2 28h28ZM16 11v8m0 4v1"/>'
};
export function gameIcon(name){return `<svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${paths[name]}</svg>`;}
