const BACEN_API_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const CORS_PROXY_URL = 'https://api.allorigins.win/raw?url=';

const SERIES = {
  cdi: '12',
  selic: '432',
  ipca: '433'
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CACHE_PREFIX = 'economic_indicator_cache_v2';

const DEFAULTS = {
  cdi: 11.65,
  selic: 14.75,
  ipca: 4.5
};

let memoryCache = {
  cdi: null,
  selic: null,
  ipca: null
};

function getCacheKey(indicator) {
  return `${CACHE_PREFIX}:${indicator}`;
}

function getCachedIndicator(indicator) {
  const mem = memoryCache[indicator];
  if (mem && Date.now() - mem.updatedAt < CACHE_TTL_MS && mem.source !== 'fallback') {
    return mem;
  }

  try {
    const raw = localStorage.getItem(getCacheKey(indicator));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      !parsed?.updatedAt ||
      parsed.source === 'fallback' ||
      Date.now() - parsed.updatedAt >= CACHE_TTL_MS
    ) {
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

  if (payload.source === 'fallback') return;

  try {
    localStorage.setItem(getCacheKey(indicator), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

function toProxyUrl(url) {
  return `${CORS_PROXY_URL}${encodeURIComponent(url)}`;
}

async function fetchSeriesLatest(series, count = 1) {
  const url = `${BACEN_API_URL}/${series}/dados/ultimos/${count}?formato=json`;
  const response = await fetch(toProxyUrl(url), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Falha ao buscar série ${series}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Série ${series} sem dados`);
  }

  return data;
}

function parsePercent(raw) {
  return parseFloat(String(raw).replace(',', '.'));
}

function annualizeDailyRate(dailyPercent) {
  const dailyRate = dailyPercent / 100;
  return (Math.pow(1 + dailyRate, 252) - 1) * 100;
}

function rollingTwelveMonths(monthlySeries) {
  return monthlySeries.reduce((acc, item) => {
    const monthRate = parsePercent(item.valor) / 100;
    return acc * (1 + monthRate);
  }, 1) - 1;
}

async function resolveIndicator(indicator) {
  const cached = getCachedIndicator(indicator);
  if (cached) return cached;

  try {
    let value;
    let referenceDate;

    if (indicator === 'cdi') {
      const [latest] = await fetchSeriesLatest(SERIES.cdi, 1);
      value = annualizeDailyRate(parsePercent(latest.valor));
      referenceDate = latest.data;
    } else if (indicator === 'selic') {
      const [latest] = await fetchSeriesLatest(SERIES.selic, 1);
      value = parsePercent(latest.valor);
      referenceDate = latest.data;
    } else {
      const latest12 = await fetchSeriesLatest(SERIES.ipca, 12);
      value = rollingTwelveMonths(latest12) * 100;
      referenceDate = latest12[latest12.length - 1].data;
    }

    const payload = {
      value: Number.isFinite(value) ? value : DEFAULTS[indicator],
      referenceDate,
      updatedAt: Date.now(),
      source: 'api'
    };

    setCachedIndicator(indicator, payload);
    return payload;
  } catch {
    const payload = {
      value: DEFAULTS[indicator],
      referenceDate: null,
      updatedAt: Date.now(),
      source: 'fallback'
    };

    setCachedIndicator(indicator, payload);
    return payload;
  }
}

export async function getCDI() {
  return resolveIndicator('cdi');
}

export async function getSelic() {
  return resolveIndicator('selic');
}

export async function getIpca() {
  return resolveIndicator('ipca');
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
    updatedAt: new Date(Math.max(cdiData.updatedAt, selicData.updatedAt, ipcaData.updatedAt)).toISOString(),
    sources: {
      cdi: cdiData.source,
      selic: selicData.source,
      ipca: ipcaData.source
    }
  };
}
