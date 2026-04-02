const BACEN_API_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const CORS_PROXY_URL = 'https://api.allorigins.win/raw?url=';

const CDI_SERIES = '12';
const SELIC_SERIES = '432';
const IPCA_SERIES = '433';

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_PREFIX = 'economic_indicator_cache_v1';

const DEFAULTS = {
  cdi: 11.65,
  selic: 11.75,
  ipca: 4.5
};

let memoryCache = {
  cdi: null,
  selic: null,
  ipca: null
};

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getCacheKey(indicator) {
  return `${CACHE_PREFIX}:${indicator}`;
}

function getCachedIndicator(indicator) {
  const inMemory = memoryCache[indicator];
  if (inMemory && Date.now() - inMemory.updatedAt < CACHE_TTL_MS) {
    return inMemory;
  }

  try {
    const raw = localStorage.getItem(getCacheKey(indicator));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt >= CACHE_TTL_MS) {
      return null;
    }

    memoryCache[indicator] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedIndicator(indicator, payload) {
  memoryCache[indicator] = payload;
  try {
    localStorage.setItem(getCacheKey(indicator), JSON.stringify(payload));
  } catch {
    // ignore storage quota / private mode issues
  }
}

async function fetchSeriesData(series, startDate, endDate) {
  const url = `${BACEN_API_URL}/${series}/dados?formato=json&dataInicial=${formatDate(startDate)}&dataFinal=${formatDate(endDate)}`;
  const proxiedUrl = `${CORS_PROXY_URL}${encodeURIComponent(url)}`;

  const response = await fetch(proxiedUrl, {
    method: 'GET',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar série ${series}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Formato inválido para série ${series}`);
  }

  return data;
}

function annualizeDailyRate(dailyPercent) {
  const dailyRate = dailyPercent / 100;
  return (Math.pow(1 + dailyRate, 252) - 1) * 100;
}

async function resolveIndicator({
  cacheKey,
  defaultValue,
  series,
  days,
  transformValue = value => value
}) {
  const cached = getCachedIndicator(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  try {
    const data = await fetchSeriesData(series, startDate, now);
    const lastValue = data[data.length - 1];

    if (!lastValue?.valor) {
      throw new Error('Série sem valor válido');
    }

    const rawValue = parseFloat(String(lastValue.valor).replace(',', '.'));
    const value = transformValue(rawValue);

    const payload = {
      value: Number.isFinite(value) ? value : defaultValue,
      referenceDate: lastValue.data || formatDate(now),
      updatedAt: Date.now(),
      source: 'api'
    };

    setCachedIndicator(cacheKey, payload);
    return payload;
  } catch {
    const payload = {
      value: defaultValue,
      referenceDate: formatDate(now),
      updatedAt: Date.now(),
      source: 'fallback'
    };

    setCachedIndicator(cacheKey, payload);
    return payload;
  }
}

export async function getCDI() {
  return resolveIndicator({
    cacheKey: 'cdi',
    defaultValue: DEFAULTS.cdi,
    series: CDI_SERIES,
    days: 30,
    transformValue: annualizeDailyRate
  });
}

export async function getSelic() {
  return resolveIndicator({
    cacheKey: 'selic',
    defaultValue: DEFAULTS.selic,
    series: SELIC_SERIES,
    days: 30
  });
}

export async function getIpca() {
  return resolveIndicator({
    cacheKey: 'ipca',
    defaultValue: DEFAULTS.ipca,
    series: IPCA_SERIES,
    days: 365
  });
}

export async function updateIndicators() {
  const [cdiData, selicData, ipcaData] = await Promise.all([
    getCDI(),
    getSelic(),
    getIpca()
  ]);

  return {
    cdi: cdiData.value,
    selic: selicData.value,
    ipca: ipcaData.value,
    updatedAt: new Date(
      Math.max(cdiData.updatedAt, selicData.updatedAt, ipcaData.updatedAt)
    ).toISOString(),
    sources: {
      cdi: cdiData.source,
      selic: selicData.source,
      ipca: ipcaData.source
    }
  };
}
