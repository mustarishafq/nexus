export const APPLICATION_ENVIRONMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'beta', label: 'Beta' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'development', label: 'Development' },
];

export const environmentConfig = {
  production: null,
  staging: { label: 'Staging', ribbonClassName: 'bg-gradient-to-r from-amber-600 to-amber-500' },
  beta: { label: 'Beta', ribbonClassName: 'bg-gradient-to-r from-violet-600 to-violet-500' },
  alpha: { label: 'Alpha', ribbonClassName: 'bg-gradient-to-r from-orange-600 to-orange-500' },
  development: { label: 'Dev', ribbonClassName: 'bg-gradient-to-r from-sky-600 to-sky-500' },
};

export function getEnvironmentBadge(environment) {
  if (!environment || environment === 'production') {
    return null;
  }

  return environmentConfig[environment] ?? {
    label: environment,
    ribbonClassName: 'bg-gradient-to-r from-slate-600 to-slate-500',
  };
}
