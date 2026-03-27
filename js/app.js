import { getCDI, getSelic, updateIndicators } from './api.js';
import {
  calculateInvestment,
  calculateDays,
  generateEvolutionData,
  calculatePortfolioAllocation,
  calculateDetailedAllocation,
  formatCurrency
} from './calc.js';
import {
  supabase,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  saveInvestment,
  getInvestments,
  updateInvestment,
  deleteInvestment,
  savePortfolio,
  getPortfolios
} from './storage.js';
import {
  showLoading,
  hideLoading,
  showPage,
  updateIndicators as updateIndicatorsUI,
  updateDashboardStats,
  renderInvestmentsTable,
  renderRecentInvestments,
  showCalculationResult,
  showPortfolioResult,
  showAuthModal,
  hideAuthModal,
  showNotification
} from './ui.js';

let currentUser = null;
let currentCDI = 11.65;
let currentSelic = 11.75;
let investments = [];
let calculationResult = null;
let evolutionChart = null;
let allocationChart = null;
let comparisonChart = null;

async function init() {
  showLoading();

  supabase.auth.onAuthStateChange((event, session) => {
    (() => {
      if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        hideAuthModal();
        loadAppData();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        showAuthModal();
      }
    })();
  });

  const user = await getCurrentUser();
  if (user) {
    currentUser = user;
    await loadAppData();
    hideAuthModal();
  } else {
    showAuthModal();
  }

  setupEventListeners();
  hideLoading();
}

async function loadAppData() {
  showLoading();

  try {
    const indicators = await updateIndicators();
    currentCDI = indicators.cdi;
    currentSelic = indicators.selic;
    updateIndicatorsUI(currentCDI, currentSelic);

    investments = await getInvestments();

    updateDashboard();
    renderInvestmentsTable(investments, handleDeleteInvestment);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showNotification('Erro ao carregar dados', 'error');
  }

  hideLoading();
}

function updateDashboard() {
  const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.initial_value), 0);
  const currentValue = investments.reduce((sum, inv) => sum + parseFloat(inv.current_value), 0);

  updateDashboardStats({
    totalInvested,
    currentValue
  });

  renderRecentInvestments(investments);

  if (investments.length > 0) {
    renderEvolutionChart();
  }
}

function renderEvolutionChart() {
  const ctx = document.getElementById('evolutionChart');
  if (!ctx) return;

  if (evolutionChart) {
    evolutionChart.destroy();
  }

  const allEvolutions = investments.map(inv => {
    const data = generateEvolutionData({
      initialValue: parseFloat(inv.initial_value),
      cdiPercentage: parseFloat(inv.cdi_percentage),
      cdiRate: currentCDI,
      monthlyContribution: parseFloat(inv.monthly_contribution || 0)
    }, 12);

    return {
      label: inv.name,
      data: data.map(d => d.value),
      borderColor: getRandomColor(),
      backgroundColor: 'transparent',
      tension: 0.4
    };
  });

  evolutionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 13 }, (_, i) => `Mês ${i}`),
      datasets: allEvolutions
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
}

function setupEventListeners() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      showPage(page);
    });
  });

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }

  const authTabs = document.querySelectorAll('.auth-tab');
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.getElementById('loginForm').style.display = targetTab === 'login' ? 'block' : 'none';
      document.getElementById('signupForm').style.display = targetTab === 'signup' ? 'block' : 'none';
    });
  });

  const calculatorForm = document.getElementById('calculatorForm');
  if (calculatorForm) {
    calculatorForm.addEventListener('submit', handleCalculate);
  }

  const saveInvestmentBtn = document.getElementById('saveInvestmentBtn');
  if (saveInvestmentBtn) {
    saveInvestmentBtn.addEventListener('click', handleSaveInvestment);
  }

  const portfolioForm = document.getElementById('portfolioForm');
  if (portfolioForm) {
    portfolioForm.addEventListener('submit', handleGeneratePortfolio);
  }

  const savePortfolioBtn = document.getElementById('savePortfolioBtn');
  if (savePortfolioBtn) {
    savePortfolioBtn.addEventListener('click', handleSavePortfolio);
  }

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', handleExportCSV);
  }

  const importCsvBtn = document.getElementById('importCsvBtn');
  const csvFileInput = document.getElementById('csvFileInput');
  if (importCsvBtn && csvFileInput) {
    importCsvBtn.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', handleImportCSV);
  }

  const compareBtn = document.getElementById('compareBtn');
  if (compareBtn) {
    compareBtn.addEventListener('click', handleCompare);
  }

  const profileSimulatorBtns = document.querySelectorAll('[data-profile]');
  profileSimulatorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const profile = btn.getAttribute('data-profile');
      handleSimulateProfile(profile);
    });
  });

  const today = new Date().toISOString().split('T')[0];
  const startDateInput = document.getElementById('startDate');
  if (startDateInput) {
    startDateInput.value = today;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  showLoading();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    await signIn(email, password);
    showNotification('Login realizado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    showNotification(error.message || 'Erro ao fazer login', 'error');
  }

  hideLoading();
}

async function handleSignup(e) {
  e.preventDefault();
  showLoading();

  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

  if (password !== passwordConfirm) {
    showNotification('As senhas não coincidem', 'error');
    hideLoading();
    return;
  }

  try {
    await signUp(email, password);
    showNotification('Cadastro realizado! Faça login para continuar.', 'success');

    document.querySelector('[data-tab="login"]').click();
  } catch (error) {
    console.error('Erro ao cadastrar:', error);
    showNotification(error.message || 'Erro ao cadastrar', 'error');
  }

  hideLoading();
}

async function handleLogout() {
  showLoading();

  try {
    await signOut();
    investments = [];
    showNotification('Logout realizado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    showNotification('Erro ao fazer logout', 'error');
  }

  hideLoading();
}

async function handleCalculate(e) {
  e.preventDefault();

  const name = document.getElementById('investmentName').value;
  const type = document.getElementById('investmentType').value;
  const initialValue = parseFloat(document.getElementById('initialValue').value);
  const cdiPercentage = parseFloat(document.getElementById('cdiPercentage').value);
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const monthlyContribution = parseFloat(document.getElementById('monthlyContribution').value) || 0;
  const applyTax = document.getElementById('applyTax').checked;

  const result = calculateInvestment({
    initialValue,
    cdiPercentage,
    cdiRate: currentCDI,
    startDate,
    endDate,
    monthlyContribution,
    applyTax
  });

  calculationResult = {
    name,
    investment_type: type,
    initial_value: initialValue,
    current_value: result.netValue,
    cdi_percentage: cdiPercentage,
    start_date: startDate,
    end_date: endDate,
    monthly_contribution: monthlyContribution,
    apply_tax: applyTax
  };

  showCalculationResult(result);
}

async function handleSaveInvestment() {
  if (!calculationResult) {
    showNotification('Faça um cálculo primeiro', 'error');
    return;
  }

  showLoading();

  try {
    await saveInvestment(calculationResult);
    showNotification('Investimento salvo com sucesso!', 'success');

    investments = await getInvestments();
    updateDashboard();
    renderInvestmentsTable(investments, handleDeleteInvestment);

    showPage('investments');
  } catch (error) {
    console.error('Erro ao salvar investimento:', error);
    showNotification('Erro ao salvar investimento', 'error');
  }

  hideLoading();
}

async function handleDeleteInvestment(id) {
  showLoading();

  try {
    await deleteInvestment(id);
    showNotification('Investimento excluído com sucesso!', 'success');

    investments = await getInvestments();
    updateDashboard();
    renderInvestmentsTable(investments, handleDeleteInvestment);
  } catch (error) {
    console.error('Erro ao excluir investimento:', error);
    showNotification('Erro ao excluir investimento', 'error');
  }

  hideLoading();
}

async function handleGeneratePortfolio(e) {
  e.preventDefault();

  const name = document.getElementById('portfolioName').value;
  const totalValue = parseFloat(document.getElementById('portfolioValue').value);
  const profileType = document.getElementById('profileType').value;

  const allocation = calculatePortfolioAllocation(totalValue, profileType);

  showPortfolioResult(allocation, totalValue);

  renderAllocationChart(allocation);

  window.currentPortfolio = {
    name,
    profile_type: profileType,
    total_value: totalValue,
    allocation
  };
}

async function handleSavePortfolio() {
  if (!window.currentPortfolio) {
    showNotification('Gere uma carteira primeiro', 'error');
    return;
  }

  showLoading();

  try {
    await savePortfolio(window.currentPortfolio);
    showNotification('Carteira salva com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao salvar carteira:', error);
    showNotification('Erro ao salvar carteira', 'error');
  }

  hideLoading();
}

function renderAllocationChart(allocation) {
  const ctx = document.getElementById('allocationChart');
  if (!ctx) return;

  if (allocationChart) {
    allocationChart.destroy();
  }

  const labels = Object.keys(allocation);
  const data = Object.values(allocation).map(a => a.percentage);
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  allocationChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ${value}%`;
            }
          }
        }
      }
    }
  });
}

function handleSimulateProfile(profile) {
  const simulatorResult = document.getElementById('simulatorResult');
  const simulatorContent = document.getElementById('simulatorContent');

  if (!simulatorResult || !simulatorContent) return;

  const totalValue = 100000;
  const allocation = calculatePortfolioAllocation(totalValue, profile);

  let html = '<div style="margin-bottom: 2rem;">';
  html += `<h4 style="margin-bottom: 1rem; color: var(--text-primary);">Alocação sugerida para perfil ${profile === 'conservative' ? 'Conservador' : profile === 'moderate' ? 'Moderado' : 'Agressivo'}</h4>`;

  Object.entries(allocation).forEach(([category, data]) => {
    html += `
      <div style="margin-bottom: 1.5rem; padding: 1.5rem; background-color: var(--bg-color); border-radius: var(--radius-md);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
          <span style="font-weight: 600; color: var(--text-primary);">${category}</span>
          <span style="font-weight: 600; color: var(--primary-color);">${data.percentage}%</span>
        </div>
    `;

    const detailed = calculateDetailedAllocation(category, data.value);

    Object.entries(detailed).forEach(([subcategory, subdata]) => {
      html += `
        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-top: 1px solid var(--border-color);">
          <span style="color: var(--text-secondary); font-size: 0.875rem;">${subcategory}</span>
          <span style="color: var(--text-secondary); font-size: 0.875rem;">${subdata.percentage}%</span>
        </div>
      `;
    });

    html += '</div>';
  });

  html += '</div>';

  simulatorContent.innerHTML = html;
  simulatorResult.style.display = 'block';
  simulatorResult.scrollIntoView({ behavior: 'smooth' });
}

function handleExportCSV() {
  if (investments.length === 0) {
    showNotification('Nenhum investimento para exportar', 'error');
    return;
  }

  const headers = ['Nome', 'Tipo', 'Valor Inicial', 'Valor Atual', 'CDI %', 'Data Início', 'Data Fim', 'Aporte Mensal'];
  const rows = investments.map(inv => [
    inv.name,
    inv.investment_type,
    inv.initial_value,
    inv.current_value,
    inv.cdi_percentage,
    inv.start_date,
    inv.end_date,
    inv.monthly_contribution || 0
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'investimentos.csv';
  link.click();

  showNotification('CSV exportado com sucesso!', 'success');
}

function handleImportCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (event) => {
    const csv = event.target.result;
    const lines = csv.split('\n');
    const headers = lines[0].split(',');

    showLoading();

    try {
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',');
        const investment = {
          name: values[0],
          investment_type: values[1],
          initial_value: parseFloat(values[2]),
          current_value: parseFloat(values[3]),
          cdi_percentage: parseFloat(values[4]),
          start_date: values[5],
          end_date: values[6],
          monthly_contribution: parseFloat(values[7]) || 0,
          apply_tax: true
        };

        await saveInvestment(investment);
      }

      showNotification('Investimentos importados com sucesso!', 'success');

      investments = await getInvestments();
      updateDashboard();
      renderInvestmentsTable(investments, handleDeleteInvestment);
    } catch (error) {
      console.error('Erro ao importar CSV:', error);
      showNotification('Erro ao importar CSV', 'error');
    }

    hideLoading();
  };

  reader.readAsText(file);
}

function handleCompare() {
  const comparisonItems = document.querySelectorAll('.comparison-item');
  const comparisons = [];

  comparisonItems.forEach(item => {
    const name = item.querySelector('.comparison-name').value;
    const value = parseFloat(item.querySelector('.comparison-value').value);
    const cdi = parseFloat(item.querySelector('.comparison-cdi').value);
    const days = parseInt(item.querySelector('.comparison-days').value);

    if (name && value && cdi && days) {
      const dailyRate = (currentCDI / 100) * (cdi / 100) / 252;
      const finalValue = value * Math.pow(1 + dailyRate, days);

      comparisons.push({
        name,
        initialValue: value,
        finalValue,
        profit: finalValue - value,
        days,
        cdi
      });
    }
  });

  if (comparisons.length === 0) {
    showNotification('Preencha pelo menos um investimento', 'error');
    return;
  }

  renderComparisonChart(comparisons);

  const comparisonDetails = document.getElementById('comparisonDetails');
  if (comparisonDetails) {
    comparisonDetails.innerHTML = comparisons.map(comp => `
      <div class="comparison-card">
        <h4>${comp.name}</h4>
        <div style="margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-secondary);">Valor Inicial:</span>
            <span style="font-weight: 600;">${formatCurrency(comp.initialValue)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-secondary);">Valor Final:</span>
            <span style="font-weight: 600;">${formatCurrency(comp.finalValue)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-secondary);">Lucro:</span>
            <span style="font-weight: 600; color: #10b981;">${formatCurrency(comp.profit)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Rentabilidade:</span>
            <span style="font-weight: 600; color: #10b981;">${((comp.profit / comp.initialValue) * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  const comparisonResult = document.getElementById('comparisonResult');
  if (comparisonResult) {
    comparisonResult.style.display = 'block';
    comparisonResult.scrollIntoView({ behavior: 'smooth' });
  }
}

function renderComparisonChart(comparisons) {
  const ctx = document.getElementById('comparisonChart');
  if (!ctx) return;

  if (comparisonChart) {
    comparisonChart.destroy();
  }

  const labels = comparisons.map(c => c.name);
  const data = comparisons.map(c => c.finalValue);
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

  comparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Valor Final',
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Valor Final: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
}

function getRandomColor() {
  const colors = [
    '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

init();
