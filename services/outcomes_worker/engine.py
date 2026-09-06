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

ENGINE_VERSION = '1.1.0'
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


def sample_indices(n, maximum=240):
    return np.arange(n) if n <= maximum else np.sort(np.random.default_rng(SEED).choice(n, maximum, replace=False))


def plot_number(value):
    parsed = number(value)
    return round(parsed, 8) if parsed is not None else None


def observation_plot(payload):
    predictors, metrics, rows = payload['predictors'], payload['config']['metrics'], payload['rows']
    points = []
    for index in sample_indices(len(rows)):
        row = rows[int(index)]
        outcomes = []
        for metric in metrics:
            value = number(row['outcomes'].get(metric['id']))
            if value is not None and metric.get('exposureColumn'):
                value /= row['exposures'][metric['id']]
            outcomes.append(plot_number(value))
        points.append({'scores': [plot_number(row['scores'].get(p['id'])) for p in predictors], 'outcomes': outcomes})
    return {'predictorIds': [p['id'] for p in predictors], 'metricIds': [m['id'] for m in metrics],
            'total': len(rows), 'points': points}


def model_details(fitted, design, y, rows, predictors, controls, metric):
    """Diagnostics use the exact fitted design and complete-case sample.

    Plot samples omit identities and are bounded independently of estimation.
    Client-report projection must remove plots and individual residuals.
    """
    linear = metric['kind'] == 'continuous'
    ci = fitted.conf_int()
    terms, contributions = [], []
    score_keys = [f'score_{i}' for i in range(len(predictors))]
    context_design = design.drop(columns=score_keys)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        columns = [key for key in design.columns if key != 'const']
        correlation = np.atleast_2d(np.corrcoef(design[columns].to_numpy(), rowvar=False))
        precision = np.linalg.inv(correlation)
        vifs = {key: number(float(precision[i, i])) for i, key in enumerate(columns)}
    for key in design.columns:
        predictor = predictors[score_keys.index(key)] if key in score_keys else None
        reference = None
        if predictor:
            kind, label = 'capability', predictor.get('label', predictor['id'])
            reference = {'mean': float(design[key].mean()), 'minimum': float(design[key].min()), 'maximum': float(design[key].max())}
        elif key == 'const':
            kind, label = 'intercept', 'Intercept'
        elif key.startswith('cohort_'):
            kind, label = 'campaign', key.removeprefix('cohort_')
        else:
            kind = 'control'
            control_index = int(key.split('_')[1])
            base_key = f'control_{control_index}'
            suffix = key[len(base_key):].removeprefix('_')
            label = controls[control_index]['column'] + (f': {suffix}' if suffix else '')
        term = {'id': key, 'kind': kind, 'label': label, 'predictorId': predictor['id'] if predictor else None,
                'estimate': estimate(fitted.params[key], ci.loc[key, 0], ci.loc[key, 1], fitted.pvalues[key]),
                'standardError': number(float(fitted.bse[key])), 'statistic': number(float(fitted.tvalues[key])),
                'standardizedBeta': number(float(fitted.params[key]*design[key].std(ddof=1)/np.std(y, ddof=1))) if predictor and linear else None,
                'vif': vifs.get(key), 'reference': reference}
        terms.append(term)
        if predictor and linear:
            reduced = sm.OLS(y, design.drop(columns=[key])).fit()
            contributions.append({'predictorId': predictor['id'], 'deltaR2': max(0.0, float(fitted.rsquared-reduced.rsquared)),
                                  'partialR2': number(float((reduced.ssr-fitted.ssr)/reduced.ssr)) if reduced.ssr > 0 else None})
    context_fit = sm.OLS(y, context_design).fit() if linear else None
    residual = fitted.resid if linear else fitted.resid_deviance
    plotted = [{'x': plot_number(float(fitted.fittedvalues.iloc[int(i)])), 'y': plot_number(float(residual.iloc[int(i)]))}
               for i in sample_indices(len(rows))]
    plotted = [p for p in plotted if p['x'] is not None and p['y'] is not None]
    # Categorical effects are relative to the omitted first level.
    references = []
    if len({r['cohort'] for r in rows}) > 1:
        references.append({'label': 'Campaign', 'value': sorted({r['cohort'] for r in rows})[0]})
    for i, control in enumerate(controls):
        if control['kind'] == 'category':
            references.append({'label': control['column'], 'value': sorted({str(r['controls'][control['column']]) for r in rows})[0]})
    joint = None
    if linear:
        restriction = np.eye(len(design.columns))[[i for i, key in enumerate(design.columns) if key != 'const']]
        covariance = restriction @ fitted.cov_params().to_numpy() @ restriction.T
        # Cluster covariance can be singular even when the fitted design is full
        # rank. Do not present a pseudo-inverse test as a test of every slope.
        if np.linalg.matrix_rank(covariance) == len(restriction):
            test = fitted.f_test(restriction)
            if number(float(test.fvalue)) is not None and number(float(test.pvalue)) is not None:
                joint = {'value': float(test.fvalue), 'p': float(test.pvalue),
                         'numeratorDf': int(test.df_num), 'denominatorDf': int(test.df_denom)}
    return {'kind': 'linear' if linear else ('logistic' if metric['kind'] == 'binary' else 'poisson'),
            'terms': terms, 'references': references, 'residualDf': int(fitted.df_resid),
            'outcomeMean': float(np.mean(y)), 'r2': number(float(fitted.rsquared)) if linear else None,
            'adjustedR2': number(float(fitted.rsquared_adj)) if linear else None,
            'contextR2': number(float(context_fit.rsquared)) if linear else None,
            'addedR2': number(float(fitted.rsquared-context_fit.rsquared)) if linear else None,
            'rmse': number(float(np.sqrt(np.mean(fitted.resid**2)))) if linear else None,
            'maxCooksDistance': number(float(np.max(fitted.get_influence().cooks_distance[0]))) if linear else None,
            'deviance': number(float(fitted.deviance)) if not linear else None,
            'dispersion': number(float(fitted.pearson_chi2/fitted.df_resid)) if not linear and fitted.df_resid > 0 else None,
            'jointTest': joint, 'contributions': contributions,
            'residualKind': 'response' if linear else 'deviance', 'residuals': plotted}


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
        correlation, spearman, spearman_test, trend = None, None, None, None
        reason = 'At least 20 people with variation in both measures are required.'
        if len(pair) >= 20 and np.ptp(x) > 0 and np.ptp(y) > 0:
            pearson = stats.pearsonr(x, y)
            ci = pearson.confidence_interval(.95)
            correlation = estimate(pearson.statistic, ci.low, ci.high, pearson.pvalue)
            rank = stats.spearmanr(x, y)
            spearman = number(float(rank.statistic))
            spearman_test = {'p': float(rank.pvalue)} if number(float(rank.pvalue)) is not None else None
            slope = float(pearson.statistic * y.std(ddof=1) / x.std(ddof=1))
            trend = {'slope': slope, 'intercept': float(y.mean()-slope*x.mean())}
            reason = None
        findings.append({'predictorId': p['id'], 'n': len(pair), 'correlation': correlation, 'spearman': spearman, 'spearmanTest': spearman_test, 'trend': trend,
                         'groups': group_comparison(x, y) if len(pair) >= 40 else None, 'adjusted': None, 'adjustedPerSd': None,
                         'scoreMin': float(x.min()) if len(x) else None, 'scoreMax': float(x.max()) if len(x) else None,
                         'scoreMean': float(x.mean()) if len(x) else None, 'status': 'unavailable', 'reason': reason})
    complete = [r for r in observed if all(number(r['scores'].get(p['id'])) is not None for p in predictors)
                and all(r['controls'].get(c['column']) is not None for c in controls)]
    model = {'method': '', 'n': len(complete), 'parameters': 0, 'controls': [c['column'] for c in controls], 'warnings': [], 'unavailable': None, 'details': None}
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
        try:
            model['details'] = model_details(fitted, design, y, complete, predictors, controls, metric)
            if metric['kind'] == 'continuous' and model['details']['jointTest'] is None:
                model['warnings'].append('A robust joint F test is unavailable for this fit; inspect individual coefficients and held-out performance.')
        except (ValueError, np.linalg.LinAlgError, FloatingPointError, ZeroDivisionError):
            model['warnings'].append('Additional model diagnostics could not be calculated; the fitted association estimates remain available.')
        validation, validation_reason = predictive_validation(complete, metric, predictors, controls)
    except (ValueError, np.linalg.LinAlgError, PerfectSeparationWarning, FloatingPointError) as error:
        model['unavailable'] = str(error)
        model['details'] = None
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
    # Separate predeclared study-wide families for adjusted coefficients,
    # Pearson correlations and Spearman correlations. Never correct only winners.
    for field in ('adjusted', 'correlation', 'spearmanTest'):
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
            details = result['model']['details']
            if details:
                for term in details['terms']:
                    if term['predictorId'] == finding['predictorId'] and adjusted:
                        term['estimate']['q'] = adjusted['q']
            if not adjusted:
                finding['reason'] = result['model']['unavailable'] or finding['reason']
    output = {'engineVersion': ENGINE_VERSION, 'seed': SEED, 'libraryVersions': {'numpy': np.__version__, 'scipy': scipy.__version__, 'statsmodels': statsmodels.__version__, 'scikit-learn': sklearn.__version__},
              'results': results, 'plots': observation_plot(payload), 'warnings': ['Observational associations do not establish the effect of developing a competency.',
              'Adjusted models and validation use complete cases. Compare missingness and the inclusion ledger before generalising.',
              'High and low score groups are descriptive quartile contrasts; their intervals do not adjust for business context or campaign dependence.']}
    return output
