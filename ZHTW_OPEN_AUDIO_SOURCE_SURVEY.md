# zh-TW open audio source survey

Survey date: 2026-07-23

## Decision

No surveyed public recording collection is suitable as the app's primary
Taiwan Mandarin AAC voice. The app therefore offers a consistent,
development-time synthesized core pack and a separate official-human
Bopomofo overlay. Wikimedia and Common Voice remain candidates for a broader
human-recording pack only if a future curation pass can provide one verified
Taiwan Mandarin speaker with adequate coverage.

## Ministry of Education Bopomofo recordings

The Ministry of Education publishes an exact set of 37 Bopomofo recordings
from the *Manual of the Phonetic Symbols of Mandarin Chinese*. The government
dataset explicitly lists all 37 audio files, is free, and permits reuse under
CC BY 4.0. This is a strong fit for the narrow gap where Android TTS voices
often handle raw Bopomofo poorly.

The app includes these recordings as the selectable `教育部人聲注音` overlay.
Only Bopomofo scanning and activation prompts use the human recordings;
ordinary words and composed messages continue through the selected Android
TTS engine.

Sources:

- https://data.nat.gov.tw/dataset/44640
- https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/html_ch/index.html

## Wikimedia Commons and Lingua Libre

- The Commons category for Taiwanese Mandarin contains only two direct media
  files. Its language-file subcategory reports seven files; it is not a
  word-level AAC collection.
- The Lingua Libre Mandarin category contains 4,122 pronunciation files, but
  labels them `cmn`, not `cmn-TW`. The files combine many speakers and do not
  provide a reliable Taiwan-region filter.
- A MediaWiki API inventory matched only 38 of the 104 short entries in the
  built-in pack by exact Traditional Chinese transcription.
- The Taiwan Wikimedia contributor `Shangkuanlc` has 240 files in the Mandarin
  category, but exact matching covers only two current targets: `冷` and `右`.
- Lingua Libre files can have excellent reuse terms (a checked recent example
  is CC0), but licensing must still be verified per file.

Sources:

- https://commons.wikimedia.org/wiki/Category:Taiwanese_Mandarin_Chinese
- https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn
- https://commons.wikimedia.org/wiki/Category:Mandarin_pronunciation
- https://commons.wikimedia.org/wiki/File:LL-Q9192_(cmn)-Levi_Highway_(列维劳德)-2024年寶林茶室食品中毒事件.wav

## Mozilla Common Voice

Common Voice has a current Chinese (Taiwan) `cmn-TW` dataset, so its locale
metadata is better than Lingua Libre's generic `cmn` category. It is an ASR
dataset of multi-speaker sentence recordings, however, not a set of isolated
AAC words. Reusing it would require forced alignment, clip extraction,
speaker selection, pronunciation review, and loudness normalization.

Source:

- https://mozilladatacollective.com/datasets/cmqinooq000x0nr07b4p4ct4q

## Other Taiwan corpora

- Taiwan Tongues provides a roughly one-hour `zh-tw` ASR test subset, but its
  repository lists the license as `other`, so redistribution is not clear.
- Academia Sinica and NCCU provide valuable conversational Taiwan Mandarin
  corpora, but these are research conversation recordings rather than
  redistributable, isolated AAC prompts.
- LDC Taiwan Mandarin corpora and ACLCLP resources require agreements and/or
  payment, so they do not meet the project's free, simple deployment rule.

Sources:

- https://huggingface.co/datasets/adi-gov-tw/Taiwan-Tongues-ASR-CE-dataset-test
- https://tmc.ling.sinica.edu.tw/corpus_list_en/
- https://spokentaiwanmandarin.nccu.edu.tw/corpus-data.html
- https://catalog.ldc.upenn.edu/LDC98S72
- https://www.aclclp.org.tw/use_mat.php
