import json,pathlib,importlib.util,statistics
root=pathlib.Path(__file__).resolve().parent.parent; base=root/'.tmp/face-sustained-research'
spec=importlib.util.spec_from_file_location('report',root/'scripts/report-face-sustained-benchmark.py')
report=importlib.util.module_from_spec(spec); spec.loader.exec_module(report)
devices={}
for device in ('phone','tablet'):
    runs=[]
    for directory in sorted(base.glob(device+'-foreground-[0-3]-*')):
        if not directory.is_dir(): continue
        path=directory/'prepared-66-serial-1.json'
        if not path.exists() or not (directory/'run-manifest.json').exists(): continue
        raw=json.loads(path.read_text(encoding='utf-8'))
        telemetry=[json.loads(line) for line in (directory/'prepared-66-serial-1-telemetry.jsonl').read_text(encoding='utf-8').splitlines()]
        value=report.foreground_control(raw,telemetry)
        value['directory']=directory.name
        value['manifest']=json.loads((directory/'run-manifest.json').read_text(encoding='utf-8'))
        value['cleanup']=json.loads((directory/'cleanup.json').read_text(encoding='utf-8'))
        value['foregroundWindowFocusAfterWarmup']=raw.get('foregroundWindowFocusAfterWarmup')
        value['screenStates']=[{k:r.get(k) for k in ('interactive','keyguardLocked','deviceLocked')} for r in telemetry]
        runs.append(value)
    if not runs: continue
    reasons=[]
    if [r['foregroundActivity'] for r in runs] != [True,False,False,True]: reasons.append('ABBA sequence incomplete or different')
    if not all(r['comparisonUsable'] for r in runs): reasons.append('One or more control runs failed their context/gesture gate')
    hashes={(r['manifest']['appApkSha256'],r['manifest']['frameManifestSha256'],
             r['manifest']['runs'][0]['testApkSha256'] if r['manifest'].get('runs') else None) for r in runs}
    if any(h[2] is None for h in hashes): reasons.append('A successful per-run manifest entry is missing')
    if len(hashes)!=1: reasons.append('Artifact identities differ between controls')
    def values(flag): return [r['overall']['ageMs']['p95'] for r in runs if r['foregroundActivity']==flag]
    a,b=values(True),values(False)
    devices[device]={'runs':runs,'pairedComparisonUsable':not reasons,'limitations':reasons,
                     'foregroundP95Ms':a,'backgroundP95Ms':b,
                     'backgroundForegroundMeanP95Ratio':statistics.mean(b)/statistics.mean(a) if a and b else None}
out=root/'docs/reports/pre-release/face-sustained-20260911/foreground-results.json'
out.write_text(json.dumps(devices,indent=2),encoding='utf-8')
print(json.dumps({k:{f:v[f] for f in ('pairedComparisonUsable','limitations','foregroundP95Ms','backgroundP95Ms','backgroundForegroundMeanP95Ratio')} for k,v in devices.items()},indent=2))
