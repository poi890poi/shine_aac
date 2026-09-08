// Complete reviewed-species roster. Cosmetic identity never changes game physics.
export const BIRD_SPECIES=Object.freeze([
  {
    "id": "taiwan_blue_magpie",
    "name": "臺灣藍鵲",
    "frameRate": 8,
    "featherColors": {
      "D": "#20243a",
      "B": "#477de0",
      "W": "#ffffff"
    }
  },
  {
    "id": "taiwan_barbet",
    "name": "五色鳥",
    "frameRate": 8,
    "featherColors": {
      "D": "#20243a",
      "B": "#619133",
      "W": "#d4dc81"
    }
  },
  {
    "id": "taiwan_whistling_thrush",
    "name": "臺灣紫嘯鶇",
    "frameRate": 8,
    "featherColors": {
      "D": "#20243a",
      "B": "#3c5b91",
      "W": "#81a8d1"
    }
  },
  {
    "id": "yellow_tit",
    "name": "黃山雀",
    "frameRate": 10,
    "featherColors": {
      "D": "#20243a",
      "B": "#8a942b",
      "W": "#fff0b9"
    }
  },
  {
    "id": "flamecrest",
    "name": "火冠戴菊鳥",
    "frameRate": 12,
    "featherColors": {
      "D": "#20243a",
      "B": "#8a942b",
      "W": "#fff0b9"
    }
  },
  {
    "id": "white_eared_sibia",
    "name": "白耳畫眉",
    "frameRate": 9,
    "featherColors": {
      "D": "#20243a",
      "B": "#995837",
      "W": "#eee5cc"
    }
  },
  {
    "id": "taiwan_yuhina",
    "name": "冠羽畫眉",
    "frameRate": 11,
    "featherColors": {
      "D": "#20243a",
      "B": "#a07b59",
      "W": "#e8d8bd"
    }
  },
  {
    "id": "taiwan_liocichla",
    "name": "黃胸藪眉",
    "frameRate": 9,
    "featherColors": {
      "D": "#20243a",
      "B": "#8c914a",
      "W": "#e3cb72"
    }
  },
  {
    "id": "collared_bush_robin",
    "name": "栗背林鴝",
    "frameRate": 10,
    "featherColors": {
      "D": "#20243a",
      "B": "#aa6738",
      "W": "#edbe7b"
    }
  },
  {
    "id": "taiwan_barwing",
    "name": "紋翼畫眉",
    "frameRate": 9,
    "featherColors": {
      "D": "#20243a",
      "B": "#916846",
      "W": "#e7c48e"
    }
  },
  {
    "id": "taiwan_rosefinch",
    "name": "臺灣朱雀",
    "frameRate": 10,
    "featherColors": {
      "D": "#20243a",
      "B": "#b24862",
      "W": "#ef99a2"
    }
  },
  {
    "id": "taiwan_scimitar_babbler",
    "name": "小彎嘴",
    "frameRate": 9,
    "featherColors": {
      "D": "#20243a",
      "B": "#956038",
      "W": "#ead8b0"
    }
  },
  {
    "id": "mikado_pheasant",
    "name": "黑長尾雉",
    "frameRate": 7,
    "featherColors": {
      "D": "#20243a",
      "B": "#34466f",
      "W": "#cbd0de"
    }
  },
  {
    "id": "swinhoes_pheasant",
    "name": "藍腹鷴",
    "frameRate": 7,
    "featherColors": {
      "D": "#20243a",
      "B": "#3b557c",
      "W": "#ece7d7"
    }
  },
  {
    "id": "rufous_crowned_laughingthrush",
    "name": "臺灣白喉噪眉",
    "frameRate": 9,
    "featherColors": {
      "D": "#20243a",
      "B": "#a77440",
      "W": "#e4c798"
    }
  },
  {
    "id": "taiwan_thrush",
    "name": "白頭鶇",
    "frameRate": 9,
    "featherColors": {
      "D": "#20243a",
      "B": "#825440",
      "W": "#f0e8d9"
    }
  }
].map(b=>Object.freeze({...b,featherColors:Object.freeze(b.featherColors)})));
export function birdSpecies(id='taiwan_blue_magpie'){
  const species=BIRD_SPECIES.find(b=>b.id===id);
  if(!species)throw new RangeError('Unknown bird species: '+id);
  return species;
}
// Host integration defaults to one uniformly random species per new round.
// The standalone POC explicitly opts into manual selection.
export function createSpeciesSelection({species,speciesSelection,random=Math.random}={}){
  const mode=speciesSelection??(species===undefined?'random':'manual');
  if(!['manual','random'].includes(mode))throw new RangeError('speciesSelection must be manual or random');
  if(typeof random!=='function')throw new TypeError('random must be a function');
  let selected=birdSpecies(species);
  return {mode,get:()=>selected,
    choose(id){if(mode!=='manual')throw new Error('Manual bird selection is disabled in random mode');selected=birdSpecies(id);return selected;},
    beginRound(){if(mode==='random'){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('random must return a number in [0,1)');selected=BIRD_SPECIES[Math.floor(value*BIRD_SPECIES.length)];}return selected;}
  };
}

