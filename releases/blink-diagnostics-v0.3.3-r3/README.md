# SHINE AAC Blink Diagnostics v0.3.3 R3

Trace-driven replacement for R2.

The R2 device report measured about 3.3 seconds to recognize reopened eyes, followed by another 2.4-second open-baseline delay. R3 changes re-arming without weakening closed-eye activation:

- Both-eye average remains the signal for detecting closed eyes.
- The more-open eye is used to confirm reopening, handling asymmetric ML Kit probabilities.
- Reopening requires two open frames (150 ms), while ambiguous frames are neutral and strong-closed frames cancel the candidate.
- Confirmed reopening preserves the open baseline, removing the second delay.

Install R3 over the previous diagnostic app. If Android refuses, uninstall **SHINE AAC Blink Diagnostics** and install R3. Reproduce several consecutive activations. If a delay remains, use **Copy blink debug** and paste the report into Codex.

The report contains no camera images, audio, AAC messages, or composed text.

APK SHA-256: `384685F1606995805D034969A74B9412E5303BD736DFB03AE21E5CED92ADDEEA`

ZIP SHA-256: `8F7A7C7085FA9D58FBE0A0C677373B87E0B4AD663C166AA0F81899FECF4519CA`
