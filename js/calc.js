export function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function calculateInvestment(params) {
  const {
    initialValue,
    cdiPercentage,
    cdiRate,
    startDate,
    endDate,
    monthlyContribution = 0,
    applyTax = true,
    investmentType = ''
  } = params;

  const days = calculateDays(startDate, endDate);

  const dailyRate = (cdiRate / 100) * (cdiPercentage / 100) / 252;

  let currentValue = initialValue;
  const contributions = [];

  if (monthlyContribution > 0) {
    const months = Math.floor(days / 30);
    for (let i = 1; i <= months; i++) {
      const daysBeforeContribution = i * 30;
      const daysAfterContribution = days - daysBeforeContribution;

      const contributionValue = monthlyContribution * Math.pow(1 + dailyRate, daysAfterContribution);
      contributions.push(contributionValue);
    }
  }

  const principalValue = initialValue * Math.pow(1 + dailyRate, days);
  const contributionsTotal = contributions.reduce((sum, val) => sum + val, 0);
  const grossValue = principalValue + contributionsTotal;

  const totalInvested = initialValue + (monthlyContribution * Math.floor(days / 30));
  const profit = grossValue - totalInvested;

  let tax = 0;
  const isTaxExempt = ['LCI', 'LCA'].includes(investmentType);
  if (applyTax && !isTaxExempt) {
    tax = calculateIncomeTax(profit, days);
  }

  const netValue = grossValue - tax;
  const yieldPercentage = ((netValue - totalInvested) / totalInvested) * 100;

  return {
    grossValue,
    netValue,
    profit,
    tax,
    yieldPercentage,
    days,
    totalInvested
  };
}

export function calculateIncomeTax(profit, days) {
  if (profit <= 0) return 0;

  let taxRate = 0;

  if (days <= 180) {
    taxRate = 0.225;
  } else if (days <= 360) {
    taxRate = 0.20;
  } else if (days <= 720) {
    taxRate = 0.175;
  } else {
    taxRate = 0.15;
  }

  return profit * taxRate;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

export function generateEvolutionData(investment, months = 12) {
  const { initialValue, cdiPercentage, cdiRate, monthlyContribution = 0 } = investment;

  const dailyRate = (cdiRate / 100) * (cdiPercentage / 100) / 252;
  const data = [];

  data.push({
    month: 0,
    value: initialValue
  });

  for (let i = 1; i <= months; i++) {
    const days = i * 30;
    const principalValue = initialValue * Math.pow(1 + dailyRate, days);

    let contributionsTotal = 0;
    if (monthlyContribution > 0) {
      for (let j = 1; j <= i; j++) {
        const daysAfterContribution = (i - j) * 30;
        contributionsTotal += monthlyContribution * Math.pow(1 + dailyRate, daysAfterContribution);
      }
    }

    data.push({
      month: i,
      value: principalValue + contributionsTotal
    });
  }

  return data;
}

export function calculatePortfolioAllocation(totalValue, profileType) {
  const profiles = {
    conservative: {
      'Renda Fixa': { min: 70, max: 80 },
      'Fundos Imobiliários': { min: 10, max: 20 },
      'Internacional': { min: 0, max: 10 }
    },
    moderate: {
      'Renda Fixa': { min: 50, max: 60 },
      'Renda Variável': { min: 30, max: 40 },
      'Internacional': { min: 10, max: 15 }
    },
    aggressive: {
      'Renda Fixa': { min: 30, max: 40 },
      'Renda Variável': { min: 50, max: 60 },
      'Internacional': { min: 10, max: 20 }
    }
  };

  const profile = profiles[profileType];
  const allocation = {};
  let remainingPercentage = 100;
  const categories = Object.keys(profile);

  categories.forEach((category, index) => {
    let percentage;

    if (index === categories.length - 1) {
      percentage = remainingPercentage;
    } else {
      const { min, max } = profile[category];
      percentage = Math.floor(Math.random() * (max - min + 1)) + min;
      remainingPercentage -= percentage;
    }

    allocation[category] = {
      percentage,
      value: (totalValue * percentage) / 100
    };
  });

  return allocation;
}

export function calculateDetailedAllocation(category, value) {
  const allocations = {
    'Renda Fixa': {
      'Tesouro Selic': 30,
      'CDB': 35,
      'LCI/LCA': 20,
      'Tesouro IPCA+': 15
    },
    'Renda Variável': {
      'Ações': 60,
      'FIIs': 30,
      'Small Caps': 10
    },
    'Fundos Imobiliários': {
      'FIIs de Tijolo': 50,
      'FIIs de Papel': 30,
      'FIIs Híbridos': 20
    },
    'Internacional': {
      'ETFs': 70,
      'Ações Globais': 30
    }
  };

  const categoryAllocation = allocations[category] || {};
  const detailed = {};

  Object.entries(categoryAllocation).forEach(([subcategory, percentage]) => {
    detailed[subcategory] = {
      percentage,
      value: (value * percentage) / 100
    };
  });

  return detailed;
}

export function calculateMonthlyIncome(totalValue, averageYield) {
  const monthlyYield = averageYield / 12;
  return (totalValue * monthlyYield) / 100;
}
