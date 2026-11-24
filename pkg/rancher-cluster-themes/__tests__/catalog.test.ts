jest.mock('@shell/config/version', () => ({ isRancherPrime: () => false }));

test('catalog metadata is installable by the Rancher 2.15.2 dashboard', () => {
  const previous = process.env.UI_EXTENSIONS_API_VERSION;
  process.env.UI_EXTENSIONS_API_VERSION = '3.0.12-rc.7';
  jest.isolateModules(() => {
    const { isSupportedChartVersion } = require('@shell/config/uiplugins');
    const { rancher } = require('../package.json');
    const versionData = {
      version:        { annotations: rancher.annotations },
      rancherVersion: '2.15.2',
      kubeVersion:    '1.33.0',
    };

    expect(isSupportedChartVersion(versionData)).toBe(true);
    expect(isSupportedChartVersion({
      ...versionData,
      version: {
        annotations: {
          ...rancher.annotations,
          'catalog.cattle.io/ui-extensions-host': 'rancher-manager',
        },
      },
    })).toBe(false);
  });
  if (previous === undefined) {
    delete process.env.UI_EXTENSIONS_API_VERSION;
  } else {
    process.env.UI_EXTENSIONS_API_VERSION = previous;
  }
});
