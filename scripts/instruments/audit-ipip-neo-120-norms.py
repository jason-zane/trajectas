"""Audit Johnson IPIP120 fixed-width data without extracting respondent records.

Usage: python3 scripts/instruments/audit-ipip-neo-120-norms.py ARCHIVE.zip OUTPUT.json
Codebook DAT120.doc: positions 1–6 case; 7 sex; 8–9 age; 23–31 country;
32–151 effective (already reverse-keyed) responses, 0 missing, 1–5 valid.
Output contains aggregates only. Candidate distributions are not approved norms.
"""
import collections
import hashlib
import json
from pathlib import Path
import sys
import zipfile


def audit(archive_path):
    root = Path(__file__).resolve().parents[2]
    manifest = json.loads((root / 'src/lib/instrument/ipip-neo-120/source/manifest.json').read_text())
    facets = {f['code']: [i['itemNumber'] - 1 for i in manifest['items'] if i['facetCode'] == f['code']] for f in manifest['facets']}
    scales = {**facets, **{d['code']: [i['itemNumber'] - 1 for i in manifest['items'] if i['facetCode'][0] == d['code']] for d in manifest['dimensions']}}
    cohorts = {key: {'n': 0, 'sex': collections.Counter(), 'scores': {s: collections.Counter() for s in scales}} for key in ['complete', 'complete_age16plus', 'complete_age18plus', 'australia_age16plus', 'australia_age18plus']}
    counts = collections.Counter()
    countries, ages, sexes = collections.Counter(), collections.Counter(), collections.Counter()
    case_ids = set()
    member_digest = hashlib.sha256()
    with zipfile.ZipFile(archive_path) as archive:
        matches = [n for n in archive.namelist() if Path(n).name == 'IPIP120.dat']
        if len(matches) != 1:
            raise ValueError('Expected exactly one IPIP120.dat member')
        member = matches[0]
        with archive.open(member) as records:
            for line in records:
                member_digest.update(line)
                counts['records'] += 1
                row = line.rstrip(b'\r\n')
                if len(row) != 151:
                    counts['invalid_width'] += 1
                    continue
                case = row[:6].strip()
                if case in case_ids:
                    counts['duplicate_case_ids'] += 1
                case_ids.add(case)
                try:
                    age = int(row[7:9])
                    sex = int(row[6:7])
                    values = [int(chr(c)) for c in row[31:151]]
                except ValueError:
                    counts['invalid_numeric_fields'] += 1
                    continue
                country = row[22:31].decode('ascii').strip()
                countries[country] += 1
                ages[age] += 1
                sexes[sex] += 1
                if any(v < 0 or v > 5 for v in values):
                    counts['invalid_response_range'] += 1
                    continue
                missing = values.count(0)
                counts['missing_response_cells'] += missing
                if missing:
                    counts['incomplete_records'] += 1
                    continue
                keys = ['complete']
                if age >= 16:
                    keys.append('complete_age16plus')
                    if country == 'Australia':
                        keys.append('australia_age16plus')
                if age >= 18:
                    keys.append('complete_age18plus')
                    if country == 'Australia':
                        keys.append('australia_age18plus')
                # Values are effective scores in DAT120.doc. NEVER reverse-key again.
                totals = {s: sum(values[i] for i in indices) for s, indices in scales.items()}
                for key in keys:
                    cohort = cohorts[key]
                    cohort['n'] += 1
                    cohort['sex'][sex] += 1
                    for scale, total in totals.items():
                        cohort['scores'][scale][total] += 1
    with open(archive_path, 'rb') as original:
        archive_digest = hashlib.file_digest(original, 'sha256').hexdigest()
    return {
        'status': 'candidate-only; not installed or licensed for commercial norm reporting',
        'codebook': 'DAT120.doc supplied in the same archive',
        'responseEncoding': 'already reverse-keyed; 0 missing; complete-case sums only',
        'itemsetSha256': manifest['itemsetSha256'],
        'archiveName': Path(archive_path).name, 'archiveSha256': archive_digest,
        'member': member, 'memberSha256': member_digest.hexdigest(),
        'counts': dict(counts), 'uniqueCaseIds': len(case_ids),
        'countryCounts': dict(countries.most_common()), 'ageCounts': dict(sorted(ages.items())), 'sexCounts': dict(sexes),
        'cohorts': cohorts,
        'limitations': [
            'Self-selected internet respondents; not a probability sample of leaders or the general population.',
            'Case IDs do not establish unique people; repeat participation cannot be ruled out.',
            'Sex is the original binary archive field, not a contemporary gender measure.',
            'Age filters are literal recorded ages; further source screening must be reviewed.',
            'Published cNORM models are not supplied by these raw histograms.',
            'Dataset reuse terms and the intended reference population need approval before norm activation.'
        ],
    }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    result = audit(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'counts': result['counts'], 'uniqueCaseIds': result['uniqueCaseIds'], 'cohorts': {k: {'n': v['n'], 'sex': v['sex']} for k,v in result['cohorts'].items()}}, indent=2))
