const BACEN_API_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const CDI_SERIES = '12';
const SELIC_META_SERIES = '432';
const IPCA_SERIES = '433';

const CACHE_TTL_MS = 60 * 60 * 1000;

const indicatorCache = {
  cdi: null,
  selic: null,
  ipca: null,
  updatedAt: null
};

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isCacheValid() {
  return indicatorCache.updatedAt && (Date.now() - indicatorCache.updatedAt.getTime()) < CACHE_TTL_MS;
}

function annualizeCdi(rateValue) {
  if (!Number.isFinite(rateValue)) return 11.65;

  if (rateValue < 1) {
    return (Math.pow(1 + (rateValue / 100), 252) - 1) * 100;
  }

  return rateValue;
}

async function fetchLastSeriesValue(series, daysBack = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const url = `${BACEN_API_URL}/${series}/dados?formato=json&dataInicial=${formatDate(startDate)}&dataFinal=${formatDate(endDate)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Erro ao buscar série ${series}`);
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    return null;
  }

  const lastValue = data[data.length - 1];
  return parseFloat(lastValue.valor);
}

async function refreshIndicators() {
  try {
    const [cdiRaw, selic, ipca] = await Promise.all([
      fetchLastSeriesValue(CDI_SERIES, 30),
      fetchLastSeriesValue(SELIC_META_SERIES, 90),
      fetchLastSeriesValue(IPCA_SERIES, 365)
    ]);

    indicatorCache.cdi = cdiRaw !== null ? annualizeCdi(cdiRaw) : 11.65;
    indicatorCache.selic = selic !== null ? selic : 11.75;
    indicatorCache.ipca = ipca !== null ? ipca : 4.5;
    indicatorCache.updatedAt = new Date();
  } catch (error) {
    console.error('Erro ao atualizar indicadores econômicos:', error);

    if (indicatorCache.cdi === null) indicatorCache.cdi = 11.65;
    if (indicatorCache.selic === null) indicatorCache.selic = 11.75;
    if (indicatorCache.ipca === null) indicatorCache.ipca = 4.5;
    if (!indicatorCache.updatedAt) indicatorCache.updatedAt = new Date();
  }
}

async function ensureIndicators() {
  if (!isCacheValid()) {
    await refreshIndicators();
  }
}

export async function getCDI() {
  await ensureIndicators();
  return indicatorCache.cdi;
}

export async function getSelic() {
  await ensureIndicators();
  return indicatorCache.selic;
}

export async function getIpca() {
  await ensureIndicators();
  return indicatorCache.ipca;
}

export async function updateIndicators() {
  await ensureIndicators();

  return {
    cdi: indicatorCache.cdi,
    selic: indicatorCache.selic,
    ipca: indicatorCache.ipca,
    lastUpdatedAt: indicatorCache.updatedAt ? indicatorCache.updatedAt.toISOString() : null
  };
}
