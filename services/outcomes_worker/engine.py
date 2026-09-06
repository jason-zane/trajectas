"""Deterministic, bounded analysis of frozen individual-level outcome datasets.

Association estimates are observational. No result is an intervention effect.
No identities, file access, dynamic formulas, database access or network calls.
"""
import math
import warnings
import numpy as np
import scipy
from scipy import stats
import statsmodels
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests
from statsmodels.tools.sm_exceptions import PerfectSeparationWarning
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.dummy import DummyRegressor, DummyClassifier
from sklearn.model_selection import KFold, StratifiedKFold, GroupKFold
from sklearn.metrics import mean_absolute_error, brier_score_loss
import pandas as pd

ENGINE_VERSION = '1.0.0'
SEED = 71423


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)


def validate(payload):
    if payload.get('version') != 1 or not isinstance(payload.get('rows'), list):
        raise ValueError('Unsupported analysis input.')
    config = payload['config']
    if not 1 <= len(payload['rows']) <= 5000 or not 1 <= len(payload['predictors']) <= 10 or not 1 <= len(config['metrics']) <= 8:
        raise ValueError('Analysis size is outside the supported limits.')
    if len(config['controls']) > 5:
        raise ValueError('At most five business controls are supported.')
    ids = [row['id'] for row in payload['rows']]
    if len(set(ids)) != len(ids):
        raise ValueError('Each person may appear only once in the outcome window.')
    for metric in config['metrics']:
        if metric['kind'] not in ('continuous', 'binary', 'count'):
            raise ValueError('Unsupported outcome type.')
        for row in payload['rows']:
            raw = row['outcomes'].get(metric['id'])
            value = number(raw)
            if raw is not None and value is None:
                raise ValueError('Outcomes must be finite numeric values or missing.')
            if value is not None:
                if metric['kind'] == 'binary' and value not in (0, 1):
                    raise ValueError('Binary outcomes must use 0 and 1.')
                if metric['kind'] == 'count' and (value < 0 or value != int(value)):
                    raise ValueError('Counts must be non-negative whole numbers.')
                if metric.get('minimum') is not None and value < metric['minimum']:
                    raise ValueError('An outcome is below its declared minimum.')
                if metric.get('maximum') is not None and value > metric['maximum']:
                    raise ValueError('An outcome exceeds its declared maximum.')
                if metric.get('exposureColumn') and (number(row['exposures'].get(metric['id'])) or 0) <= 0:
                    raise ValueError('An observed count requires positive exposure.')


def estimate(value, lower, upper, p):
    values = [float(x) for x in (value, lower, upper, p)]
    return dict(zip(('value', 'lower', 'upper', 'p'), values)) if all(map(math.isfinite, values)) else None


def group_comparison(x, y):
    q1, q3 = np.quantile(x, [0.25, 0.75])
    if q1 >= q3:
        return None
    low, high = y[x <= q1], y[x >= q3]
    if min(len(low), len(high)) < 10:
        return None
    # Welch interval describes this unadjusted contrast, not a causal uplift.
    difference = high.mean() - low.mean()
    a, b = high.var(ddof=1) / len(high), low.var(ddof=1) / len(low)
    se = math.sqrt(a + b)
    df = (a + b) ** 2 / (a*a/(len(high)-1) + b*b/(len(low)-1)) if a+b > 0 else 1
    margin = stats.t.ppf(.975, df) * se
    return {'low': float(low.mean()), 'high': float(high.mean()), 'lowN': len(low), 'highN': len(high),
            'difference': float(difference), 'lower': float(difference-margin), 'upper': float(difference+margin)}


def context_matrix(rows, controls, include_cohort=True):
    data = {}
    categorical = []
    for index, control in enumerate(controls):
        key = f'control_{index}'
        data[key] = [r['controls'][control['column']] for r in rows]
        if control['kind'] == 'category':
            categorical.append(key)
    if include_cohort and len({r['cohort'] for r in rows}) > 1:
        data['cohort'] = [r['cohort'] for r in rows]
        categorical.append('cohort')
    frame = pd.DataFrame(data, index=range(len(rows)))
    for column in categorical:
        if frame[column].nunique() > 20:
            raise ValueError('A context field has more than 20 categories; simplify the study groups.')
    return frame, categorical


def predictive_validation(rows, metric, predictors, controls):
    n = len(rows)
    if metric['kind'] == 'count':
        return None, 'Predictive validation is available for continuous and binary outcomes.'
    if n < 60:
        return None, 'At least 60 complete people are required for held-out prediction.'
    y = np.array([r['outcomes'][metric['id']] for r in rows])
    if metric['kind'] == 'binary' and min(np.sum(y == 0), np.sum(y == 1)) < 20:
        return None, 'Prediction requires at least 20 people in each outcome class.'
    # Cohort identifiers are split groups, not transferable predictive features.
    frame, categorical = context_matrix(rows, controls, include_cohort=False)
    score_names = []
    for i, p in enumerate(predictors):
        name = f'score_{i}'
        frame[name] = [r['scores'][p['id']] for r in rows]
        score_names.append(name)
    groups = np.array([r['cohort'] for r in rows])
    unique_groups = len(set(groups))
    folds = min(5, unique_groups) if unique_groups >= 3 else 5
    if unique_groups >= 3:
        splitter = GroupKFold(n_splits=folds)
        splits = list(splitter.split(frame, y, groups))
        method = 'Campaign-held-out cross-validation'
    else:
        splitter = StratifiedKFold(folds, shuffle=True, random_state=SEED) if metric['kind'] == 'binary' else KFold(folds, shuffle=True, random_state=SEED)
        splits = list(splitter.split(frame, y))
        method = 'Person-held-out cross-validation (same campaign context)'
    base_predictions, full_predictions = np.empty(n), np.empty(n)
    for train, test in splits:
        if metric['kind'] == 'binary' and len(set(y[train])) < 2:
            return None, 'A training fold has only one outcome class; independent validation is unavailable.'
        for include_scores, predictions in ((False, base_predictions), (True, full_predictions)):
            columns = [c for c in frame.columns if include_scores or c not in score_names]
            if not columns:
                model = DummyClassifier(strategy='prior') if metric['kind'] == 'binary' else DummyRegressor(strategy='mean')
                model.fit(np.zeros((len(train), 1)), y[train])
                prediction = model.predict_proba(np.zeros((len(test), 1)))[:, 1] if metric['kind'] == 'binary' else model.predict(np.zeros((len(test), 1)))
            else:
                cats = [c for c in categorical if c in columns]
                numeric = [c for c in columns if c not in cats]
                transform = ColumnTransformer([('numeric', StandardScaler(), numeric), ('category', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cats)])
                estimator = LogisticRegression(C=1, max_iter=1500, random_state=SEED) if metric['kind'] == 'binary' else Ridge(alpha=1)
                model = make_pipeline(transform, estimator)
                model.fit(frame.iloc[train][columns], y[train])
                prediction = model.predict_proba(frame.iloc[test][columns])[:, 1] if metric['kind'] == 'binary' else model.predict(frame.iloc[test][columns])
            predictions[test] = prediction
    loss = brier_score_loss if metric['kind'] == 'binary' else mean_absolute_error
    baseline, assessment = float(loss(y, base_predictions)), float(loss(y, full_predictions))
    return {'method': method, 'n': n, 'folds': folds, 'metric': 'Brier score' if metric['kind'] == 'binary' else 'Mean absolute error',
            'baseline': baseline, 'assessment': assessment, 'improvement': baseline-assessment}, None


def analyze_metric(payload, metric):
    rows, predictors, controls = payload['rows'], payload['predictors'], payload['config']['controls']
    observed = [r for r in rows if number(r['outcomes'].get(metric['id'])) is not None]
    def display_value(row):
        value = row['outcomes'][metric['id']]
        return value / row['exposures'][metric['id']] if metric.get('exposureColumn') else value
    y_observed = np.array([display_value(r) for r in observed], dtype=float)
    findings = []
    for p in predictors:
        pair = [r for r in observed if number(r['scores'].get(p['id'])) is not None]
        x = np.array([r['scores'][p['id']] for r in pair], dtype=float)
        y = np.array([display_value(r) for r in pair], dtype=float)
        correlation, spearman = None, None
        reason = 'At least 20 people with variation in both measures are required.'
        if len(pair) >= 20 and np.ptp(x) > 0 and np.ptp(y) > 0:
            pearson = stats.pearsonr(x, y)
            ci = pearson.confidence_interval(.95)
            correlation = estimate(pearson.statistic, ci.low, ci.high, pearson.pvalue)
            spearman = float(stats.spearmanr(x, y).statistic)
            reason = None
        findings.append({'predictorId': p['id'], 'n': len(pair), 'correlation': correlation, 'spearman': spearman,
                         'groups': group_comparison(x, y) if len(pair) >= 40 else None, 'adjusted': None, 'adjustedPerSd': None,
                         'scoreMin': float(x.min()) if len(x) else None, 'scoreMax': float(x.max()) if len(x) else None,
                         'scoreMean': float(x.mean()) if len(x) else None, 'status': 'unavailable', 'reason': reason})
    complete = [r for r in observed if all(number(r['scores'].get(p['id'])) is not None for p in predictors)
                and all(r['controls'].get(c['column']) is not None for c in controls)]
    model = {'method': '', 'n': len(complete), 'parameters': 0, 'controls': [c['column'] for c in controls], 'warnings': [], 'unavailable': None}
    validation, validation_reason = None, None
    try:
        if len(complete) < 30:
            raise ValueError('At least 30 complete people are required for an adjusted model.')
        frame, categorical = context_matrix(complete, controls)
        if 'cohort' in frame:
            model['controls'].append('Campaign context')
        encoded = pd.get_dummies(frame, columns=categorical, drop_first=True, dtype=float).astype(float)
        score_columns = []
        for i, p in enumerate(predictors):
            name = f'score_{i}'
            encoded[name] = [r['scores'][p['id']] for r in complete]
            score_columns.append(name)
        if any(encoded[c].nunique() < 2 for c in score_columns):
            raise ValueError('A selected assessment score is constant in the complete cases.')
        encoded = encoded.loc[:, encoded.nunique() > 1]
        design = sm.add_constant(encoded, has_constant='add')
        n, parameters = design.shape
        model['parameters'] = parameters
        if n < max(30, 10*parameters):
            raise ValueError(f'The adjusted model needs at least {max(30, 10*parameters)} complete people for {parameters} parameters.')
        if np.linalg.matrix_rank(design.to_numpy()) < parameters:
            raise ValueError('Selected scores or controls are redundant; remove overlapping variables.')
        z = encoded.to_numpy()
        z = (z - z.mean(axis=0)) / z.std(axis=0)
        if np.linalg.cond(z) > 30:
            model['warnings'].append('Strong overlap between predictors makes individual coefficients unstable.')
        y = np.array([r['outcomes'][metric['id']] for r in complete], dtype=float)
        if np.ptp(y) == 0:
            raise ValueError('The outcome is constant in the complete cases.')
        cohorts = [r['cohort'] for r in complete]
        cluster = len(set(cohorts)) >= 10
        covariance = {'cov_type': 'cluster', 'cov_kwds': {'groups': cohorts}} if cluster else {'cov_type': 'HC3'}
        if not cluster and len(set(cohorts)) > 1:
            model['warnings'].append('Campaign differences are adjusted, but fewer than 10 campaigns prevent reliable cluster-robust inference.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', PerfectSeparationWarning)
            if metric['kind'] == 'continuous':
                fitted = sm.OLS(y, design).fit(use_t=True, **covariance)
                model['method'] = 'Linear regression; ' + ('campaign-clustered' if cluster else 'HC3 robust') + ' uncertainty'
            else:
                if metric['kind'] == 'binary' and min(np.sum(y == 0), np.sum(y == 1)) < 10*parameters:
                    raise ValueError(f'Binary modelling requires at least {10*parameters} people in each outcome class.')
                offset = np.log([r['exposures'][metric['id']] for r in complete]) if metric.get('exposureColumn') else None
                family = sm.families.Binomial() if metric['kind'] == 'binary' else sm.families.Poisson()
                fitted = sm.GLM(y, design, family=family, offset=offset).fit(maxiter=100, **covariance)
                if not fitted.converged:
                    raise ValueError('The model did not converge.')
                model['method'] = ('Logistic regression; log-odds coefficients' if metric['kind'] == 'binary' else 'Poisson regression; log-rate coefficients') + '; robust uncertainty'
                if metric['kind'] == 'count' and fitted.pearson_chi2/fitted.df_resid > 2:
                    model['warnings'].append('Counts are overdispersed. Robust uncertainty is used; investigate the count-generating process before reporting.')
            ci = fitted.conf_int()
            for index, finding in enumerate(findings):
                key = score_columns[index]
                finding['adjusted'] = estimate(fitted.params[key], ci.loc[key, 0], ci.loc[key, 1], fitted.pvalues[key])
                sd = float(encoded[key].std(ddof=1))
                finding['adjustedPerSd'] = estimate(fitted.params[key]*sd, ci.loc[key, 0]*sd, ci.loc[key, 1]*sd, fitted.pvalues[key])
            if any(f['adjusted'] is None for f in findings):
                raise ValueError('The model returned non-finite uncertainty estimates.')
        validation, validation_reason = predictive_validation(complete, metric, predictors, controls)
    except (ValueError, np.linalg.LinAlgError, PerfectSeparationWarning, FloatingPointError) as error:
        model['unavailable'] = str(error)
        validation_reason = 'Resolve the model data checks before validating prediction.'
        for finding in findings:
            finding['adjusted'] = None
            finding['adjustedPerSd'] = None
    return {'metricId': metric['id'], 'n': len(observed), 'missing': len(rows)-len(observed),
            'mean': float(y_observed.mean()) if len(observed) else None, 'sd': float(y_observed.std(ddof=1)) if len(observed)>1 else None,
            'findings': findings, 'model': model, 'validation': validation, 'validationReason': validation_reason}


def analyze(payload):
    validate(payload)
    results = [analyze_metric(payload, m) for m in payload['config']['metrics']]
    # Two predeclared study-wide families: adjusted associations (report claims)
    # and exploratory unadjusted correlations. Never correct only the winners.
    for field in ('adjusted', 'correlation'):
        estimates = [f[field] for result in results for f in result['findings'] if f[field] is not None]
        if estimates:
            adjusted_p = multipletests([e['p'] for e in estimates], method='fdr_bh')[1]
            for e, q in zip(estimates, adjusted_p):
                e['q'] = float(q)
    for result in results:
        for finding in result['findings']:
            adjusted = finding['adjusted']
            if finding['adjustedPerSd'] and adjusted:
                finding['adjustedPerSd']['q'] = adjusted['q']
            finding['status'] = 'supported' if adjusted and adjusted['q'] < .05 else ('inconclusive' if adjusted or finding['correlation'] else 'unavailable')
            if not adjusted:
                finding['reason'] = result['model']['unavailable'] or finding['reason']
    output = {'engineVersion': ENGINE_VERSION, 'seed': SEED, 'libraryVersions': {'numpy': np.__version__, 'scipy': scipy.__version__, 'statsmodels': statsmodels.__version__, 'scikit-learn': sklearn.__version__},
              'results': results, 'warnings': ['Observational associations do not establish the effect of developing a competency.',
              'Adjusted models and validation use complete cases. Compare missingness and the inclusion ledger before generalising.',
              'High and low score groups are descriptive quartile contrasts; their intervals do not adjust for business context or campaign dependence.']}
    return output
