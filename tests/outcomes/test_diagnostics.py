import copy
import json
import unittest
import numpy as np
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.outliers_influence import variance_inflation_factor
from services.outcomes_worker.engine import analyze
from test_engine import dataset


class OutcomeDiagnosticsTests(unittest.TestCase):
    def test_full_model_outputs_agree_with_direct_fit(self):
        data = dataset()
        result = analyze(data)['results'][0]
        details = result['model']['details']
        x = np.array([[1, r['controls']['tenure'], r['scores']['score']] for r in data['rows']])
        y = np.array([r['outcomes']['kpi'] for r in data['rows']])
        fit = sm.OLS(y, x).fit(cov_type='HC3', use_t=True)
        term = next(t for t in details['terms'] if t['predictorId'] == 'score')
        self.assertEqual(len(details['terms']), 3)
        self.assertEqual(details['residualDf'], 197)
        self.assertAlmostEqual(details['r2'], 1-np.sum(fit.resid**2)/np.sum((y-y.mean())**2))
        self.assertAlmostEqual(details['adjustedR2'], fit.rsquared_adj)
        self.assertAlmostEqual(term['standardError'], fit.bse[2])
        self.assertAlmostEqual(term['statistic'], fit.tvalues[2])
        self.assertAlmostEqual(term['standardizedBeta'], fit.params[2]*x[:,2].std(ddof=1)/y.std(ddof=1))
        self.assertAlmostEqual(term['vif'], variance_inflation_factor(x, 2))
        self.assertEqual(term['estimate'], result['findings'][0]['adjusted'])
        self.assertAlmostEqual(details['contributions'][0]['deltaR2'], details['addedR2'])
        self.assertGreater(details['maxCooksDistance'], 0)
        joint = fit.f_test(np.eye(3)[1:])
        self.assertAlmostEqual(details['jointTest']['value'], float(joint.fvalue))
        self.assertAlmostEqual(details['jointTest']['p'], float(joint.pvalue))
        self.assertEqual(details['jointTest']['numeratorDf'], joint.df_num)
        self.assertEqual(details['jointTest']['denominatorDf'], joint.df_denom)

    def test_singular_cluster_covariance_does_not_claim_a_full_joint_test(self):
        data = dataset(400)
        for i, row in enumerate(data['rows']):
            row['cohort'] = f'campaign-{i % 10}'
        result = analyze(data)['results'][0]
        self.assertIsNone(result['model']['unavailable'])
        self.assertIsNotNone(result['findings'][0]['adjusted'])
        self.assertIsNotNone(result['model']['details'])
        self.assertIsNone(result['model']['details']['jointTest'])
        self.assertTrue(any('joint F test is unavailable' in w for w in result['model']['warnings']))

    def test_reference_profile_and_diagnostics_use_complete_cases(self):
        data = dataset()
        data['rows'][0]['controls']['tenure'] = None
        data['rows'][0]['scores']['score'] = 999
        result = analyze(data)['results'][0]
        details = result['model']['details']
        term = next(t for t in details['terms'] if t['predictorId'] == 'score')
        self.assertEqual(result['findings'][0]['n'], 200)
        self.assertEqual(result['model']['n'], 199)
        self.assertLess(term['reference']['maximum'], 999)
        self.assertAlmostEqual(details['outcomeMean'], np.mean([r['outcomes']['kpi'] for r in data['rows'][1:]]))
        self.assertEqual(len(details['residuals']), 199)

    def test_collinearity_is_visible_and_perfect_redundancy_is_rejected(self):
        data = dataset()
        rng = np.random.default_rng(89)
        data['predictors'].append({'id':'overlap', 'label':'Overlapping score'})
        for row in data['rows']:
            row['scores']['overlap'] = row['scores']['score'] + float(rng.normal(scale=.08))
        result = analyze(data)['results'][0]
        terms = [t for t in result['model']['details']['terms'] if t['kind']=='capability']
        self.assertTrue(all(t['vif'] > 80 for t in terms))
        for row in data['rows']:
            row['scores']['overlap'] = row['scores']['score']
        result = analyze(data)['results'][0]
        self.assertIn('redundant', result['model']['unavailable'])
        self.assertIsNone(result['model']['details'])

    def test_non_linear_outputs_do_not_claim_linear_r_squared(self):
        result = analyze(dataset(400, binary=True))['results'][0]
        details = result['model']['details']
        self.assertEqual(details['kind'], 'logistic')
        self.assertIsNone(details['r2'])
        self.assertIsNone(details['adjustedR2'])
        self.assertEqual(details['contributions'], [])
        self.assertTrue(all(t['standardizedBeta'] is None for t in details['terms']))
        self.assertEqual(details['residualKind'], 'deviance')
        self.assertGreater(details['deviance'], 0)

    def test_rank_correlation_correction_covers_all_metrics(self):
        data = dataset()
        second = copy.deepcopy(data['config']['metrics'][0]); second['id']='second'
        data['config']['metrics'].append(second)
        rng = np.random.default_rng(31)
        for row in data['rows']:
            row['outcomes']['second'] = float(rng.normal())
        results = analyze(data)['results']
        estimates = [r['findings'][0]['spearmanTest'] for r in results]
        expected = multipletests([e['p'] for e in estimates], method='fdr_bh')[1]
        np.testing.assert_allclose([e['q'] for e in estimates], expected)

    def test_plots_are_bounded_deterministic_and_omit_identities(self):
        data = dataset(700)
        first, second = analyze(data), analyze(data)
        self.assertEqual(first, second)
        self.assertEqual(first['plots']['total'], 700)
        self.assertEqual(len(first['plots']['points']), 240)
        self.assertEqual(len(first['results'][0]['model']['details']['residuals']), 240)
        self.assertEqual(set(first['plots']['points'][0]), {'scores','outcomes'})
        self.assertEqual(set(first['results'][0]['model']['details']['residuals'][0]), {'x','y'})
        json.dumps(first, allow_nan=False)

    def test_count_plots_use_exposure_rates_and_diagnostics_use_counts(self):
        data = dataset(400)
        data['config']['metrics'][0].update(kind='count', exposureColumn='hours')
        rng = np.random.default_rng(66)
        for row in data['rows']:
            exposure = float(rng.uniform(5,15)); count = int(rng.poisson(exposure*np.exp(.2*row['scores']['score'])))
            row['exposures']['kpi']=exposure; row['outcomes']['kpi']=count
        output = analyze(data); details = output['results'][0]['model']['details']
        self.assertEqual(details['kind'], 'poisson')
        self.assertIsNone(details['r2'])
        self.assertGreater(details['dispersion'], 0)
        possible = {round(r['outcomes']['kpi']/r['exposures']['kpi'],8) for r in data['rows']}
        self.assertTrue(all(p['outcomes'][0] in possible for p in output['plots']['points']))


if __name__ == '__main__':
    unittest.main()
