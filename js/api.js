const BACEN_API_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const CDI_SERIES = '12';
const SELIC_SERIES = '11';

let cachedCDI = null;
let cachedSelic = null;

export async function getCDI() {
  if (cachedCDI) return cachedCDI;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const url = `${BACEN_API_URL}/${CDI_SERIES}/dados?formato=json&dataInicial=${formatDate(startDate)}&dataFinal=${formatDate(endDate)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro ao buscar CDI');

    const data = await response.json();
    if (!data || data.length === 0) {
      cachedCDI = 11.65;
      return cachedCDI;
    }

    const lastValue = data[data.length - 1];
    cachedCDI = parseFloat(lastValue.valor);

    return cachedCDI;
  } catch (error) {
    console.error('Erro ao buscar CDI:', error);
    cachedCDI = 11.65;
    return cachedCDI;
  }
}

export async function getSelic() {
  if (cachedSelic) return cachedSelic;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const url = `${BACEN_API_URL}/${SELIC_SERIES}/dados?formato=json&dataInicial=${formatDate(startDate)}&dataFinal=${formatDate(endDate)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro ao buscar Selic');

    const data = await response.json();
    if (!data || data.length === 0) {
      cachedSelic = 11.75;
      return cachedSelic;
    }

    const lastValue = data[data.length - 1];
    cachedSelic = parseFloat(lastValue.valor);

    return cachedSelic;
  } catch (error) {
    console.error('Erro ao buscar Selic:', error);
    cachedSelic = 11.75;
    return cachedSelic;
  }
}

export async function updateIndicators() {
  try {
    const [cdi, selic] = await Promise.all([getCDI(), getSelic()]);
    return { cdi, selic };
  } catch (error) {
    console.error('Erro ao atualizar indicadores:', error);
    return { cdi: 11.65, selic: 11.75 };
  }
}
