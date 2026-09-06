import copy
import unittest
import importlib.util
from pathlib import Path
import numpy as np
from services.outcomes_worker.engine import analyze


def dataset(n=200, binary=False):
    rng = np.random.default_rng(4)
    rows = []
    for i in range(n):
        x, context, noise = rng.normal(size=3)
        y = 50 + 4*x + 3*context + noise
        if binary:
            y = int(rng.random() < 1/(1+np.exp(-(.5*x+.4*context))))
        rows.append({'id': str(i), 'cohort': 'same', 'scores': {'score': x}, 'controls': {'tenure': context}, 'outcomes': {'kpi': y}, 'exposures': {}})
    return {'version': 1, 'predictors': [{'id': 'score'}], 'rows': rows,
            'config': {'controls': [{'column': 'tenure', 'kind': 'numeric'}], 'metrics': [{'id': 'kpi', 'kind': 'binary' if binary else 'continuous', 'exposureColumn': '', 'minimum': None, 'maximum': None}]}}


class OutcomeEngineTests(unittest.TestCase):
    def test_recovers_adjusted_relationship_and_improves_held_out_error(self):
        result = analyze(dataset())['results'][0]
        finding = result['findings'][0]
        self.assertAlmostEqual(finding['adjusted']['value'], 4, delta=.2)
        self.assertGreater(finding['adjusted']['lower'], 3.8)
        self.assertLess(finding['adjusted']['upper'], 4.4)
        self.assertEqual(finding['status'], 'supported')
        self.assertGreater(result['validation']['improvement'], 2)
        self.assertGreater(finding['groups']['difference'], 7)

    def test_binary_validation_uses_probabilities(self):
        result = analyze(dataset(400, True))['results'][0]
        self.assertIsNone(result['model']['unavailable'])
        self.assertEqual(result['validation']['metric'], 'Brier score')
        self.assertGreater(result['findings'][0]['adjusted']['value'], 0)

    def test_missing_outcomes_are_not_zero_and_samples_are_explicit(self):
        data = dataset()
        data['rows'][0]['outcomes']['kpi'] = None
        data['rows'][1]['controls']['tenure'] = None
        result = analyze(data)['results'][0]
        self.assertEqual(result['n'], 199)
        self.assertEqual(result['missing'], 1)
        self.assertEqual(result['model']['n'], 198)
        self.assertEqual(result['findings'][0]['n'], 199)

    def test_small_and_constant_samples_do_not_claim_effects(self):
        data = dataset(12)
        result = analyze(data)['results'][0]
        self.assertIsNone(result['findings'][0]['adjusted'])
        self.assertIsNone(result['findings'][0]['groups'])
        self.assertEqual(result['findings'][0]['status'], 'unavailable')
        data = dataset()
        for row in data['rows']:
            row['scores']['score'] = 5
        result = analyze(data)['results'][0]
        self.assertIn('constant', result['model']['unavailable'])
        self.assertIsNone(result['findings'][0]['correlation'])

    def test_rejects_repeated_people_and_invalid_outcome_values(self):
        data = dataset()
        data['rows'].append(copy.deepcopy(data['rows'][0]))
        with self.assertRaisesRegex(ValueError, 'only once'):
            analyze(data)
        data = dataset(binary=True)
        data['rows'][0]['outcomes']['kpi'] = 2
        with self.assertRaisesRegex(ValueError, '0 and 1'):
            analyze(data)

    def test_count_offset_estimates_rates(self):
        data = dataset(400)
        rng = np.random.default_rng(61)
        data['config']['metrics'][0].update(kind='count', exposureColumn='hours')
        for row in data['rows']:
            row['exposures']['kpi'] = float(rng.uniform(10, 30))
            row['outcomes']['kpi'] = int(rng.poisson(row['exposures']['kpi']*np.exp(.2*row['scores']['score'])))
        result = analyze(data)['results'][0]
        self.assertAlmostEqual(result['findings'][0]['adjusted']['value'], .2, delta=.05)
        self.assertIsNone(result['validation'])

    def test_study_wide_multiple_comparison_correction_and_reproducibility(self):
        data = dataset()
        one, two = analyze(data), analyze(data)
        self.assertEqual(one, two)
        estimate = one['results'][0]['findings'][0]['adjusted']
        self.assertGreaterEqual(estimate['q'], estimate['p'])

    def test_worker_rejects_unsigned_stale_or_modified_requests(self):
        import os, json, time, hmac, hashlib
        from unittest.mock import patch
        spec = importlib.util.spec_from_file_location('worker', Path('api/outcomes-worker.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        body, timestamp = json.dumps(dataset()).encode(), str(int(time.time()))
        with patch.dict(os.environ, {'CRON_SECRET': 'test-secret'}):
            signature = hmac.new(b'test-secret', b'outcomes-v1:'+timestamp.encode()+b':'+body, hashlib.sha256).hexdigest()
            self.assertTrue(module.verify(body, timestamp, signature))
            self.assertFalse(module.verify(body+b' ', timestamp, signature))
            self.assertFalse(module.verify(body, '0', signature))
            self.assertFalse(module.verify(body, timestamp, None))


if __name__ == '__main__':
    unittest.main()
