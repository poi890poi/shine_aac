# Android settings UI review

## Baseline

Android's maintained standard solution is AndroidX Preference. It provides a single scrolling preference hierarchy, categories, summaries, standard switches and list preferences, consistent Material styling, persistence hooks, and RecyclerView-backed updates.

## Current gaps

| Current configuration UI | Android settings convention |
| --- | --- |
| Floating modal card over the app | Full-screen settings destination with a top app bar |
| Two-column form on wide screens | One preference list with grouped categories |
| Labels above large input boxes | Preference title with current value in its summary |
| Checkbox before its label | Trailing switch for binary settings |
| Save and Cancel transaction | Each preference persists when changed |
| Six-button sticky action grid | Related destinations grouped as preference rows |
| Reset beside ordinary navigation | Destructive reset isolated and confirmed |
| English configuration mixed with Chinese voice UI | One localized settings language |
| Timing values exposed as raw millisecond fields | Presets first; advanced values in a detail screen or dialog |
| Large dictionary and symbol text areas inline | Separate editor destinations |

## Recommended migration

Use a native `SettingsActivity` with `PreferenceFragmentCompat` and a `PreferenceDataStore` adapter to the app's existing configuration. Suggested categories:

1. Communication: language, board columns, vocabulary editors.
2. Scanning: preset, voice feedback, restart behavior, advanced timing.
3. Speech: Taiwan voice destination and speech feedback.
4. Input: switch source, camera setup, input test.
5. Data and support: offline resources, export text, app information, reset.

The dynamic voice catalog can use a RecyclerView-backed native subpage with standard radio buttons and trailing icon buttons. There is no maintained Android component that supplies a cross-engine voice catalog or download manager; those parts must continue to use the Android TTS contract and a small provider metadata adapter.

This should be treated as a separate migration rather than restyling the current WebView form to imitate AndroidX Preference.
