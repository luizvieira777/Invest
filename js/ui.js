import { formatCurrency, formatPercentage } from './calc.js';

export function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('active');
}

export function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

export function showPage(pageName) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => {
    page.style.display = 'none';
  });

  const targetPage = document.getElementById(pageName);
  if (targetPage) {
    targetPage.style.display = 'block';
  }

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === pageName) {
      item.classList.add('active');
    }
  });
}

export function updateIndicators(cdi, selic, ipca, updatedAt = null) {
  const cdiElement = document.getElementById('cdiValue');
  const selicElement = document.getElementById('selicValue');
  const ipcaElement = document.getElementById('ipcaValue');
  const updatedAtElement = document.getElementById('indicatorsUpdatedAt');

  if (cdiElement) {
    cdiElement.textContent = formatPercentage(cdi);
    animateNumber(cdiElement, 0, cdi);
  }

  if (selicElement) {
    selicElement.textContent = formatPercentage(selic);
    animateNumber(selicElement, 0, selic);
  }

  if (ipcaElement) {
    ipcaElement.textContent = formatPercentage(ipca);
    animateNumber(ipcaElement, 0, ipca);
  }

  if (updatedAtElement) {
    updatedAtElement.textContent = formatUpdatedAt(updatedAt);
  }
}

function formatUpdatedAt(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function animateNumber(element, start, end, duration = 1000) {
  const startTime = performance.now();
  const isPercentage = element.textContent.includes('%');
  const isCurrency = element.textContent.includes('R$');

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const current = start + (end - start) * easeOutCubic(progress);

    if (isCurrency) {
      element.textContent = formatCurrency(current);
    } else if (isPercentage) {
      element.textContent = formatPercentage(current);
    } else {
      element.textContent = Math.floor(current);
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function updateDashboardStats(stats) {
  const totalInvestedEl = document.getElementById('totalInvested');
  const currentValueEl = document.getElementById('currentValue');
  const profitLossEl = document.getElementById('profitLoss');
  const totalYieldEl = document.getElementById('totalYield');

  if (totalInvestedEl) {
    totalInvestedEl.textContent = formatCurrency(stats.totalInvested);
  }

  if (currentValueEl) {
    currentValueEl.textContent = formatCurrency(stats.currentValue);
  }

  if (profitLossEl) {
    const profit = stats.currentValue - stats.totalInvested;
    profitLossEl.textContent = formatCurrency(profit);
    profitLossEl.style.color = profit >= 0 ? '#1d4ed8' : '#ef4444';
  }

  if (totalYieldEl) {
    const yieldValue = stats.totalInvested > 0
      ? ((stats.currentValue - stats.totalInvested) / stats.totalInvested) * 100
      : 0;
    totalYieldEl.textContent = formatPercentage(yieldValue);
    totalYieldEl.style.color = yieldValue >= 0 ? '#1d4ed8' : '#ef4444';
  }
}

export function renderInvestmentsTable(investments, onDelete) {
  const tbody = document.getElementById('investmentsTableBody');
  if (!tbody) return;

  if (investments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          Nenhum investimento cadastrado
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = investments.map(inv => {
    const investmentYield = inv.initial_value > 0
      ? ((inv.current_value - inv.initial_value) / inv.initial_value) * 100
      : 0;

    return `
      <tr>
        <td>${inv.name}</td>
        <td>${inv.investment_type}</td>
        <td>${formatCurrency(inv.initial_value)}</td>
        <td>${formatCurrency(inv.current_value)}</td>
        <td style="color: ${investmentYield >= 0 ? '#1d4ed8' : '#ef4444'}">
          ${formatPercentage(investmentYield)}
        </td>
        <td>${formatDate(inv.start_date)}</td>
        <td>${formatDate(inv.end_date)}</td>
        <td>
          <button class="action-btn action-btn-delete" data-id="${inv.id}">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.action-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Tem certeza que deseja excluir este investimento?')) {
        onDelete(id);
      }
    });
  });
}

export function renderRecentInvestments(investments) {
  const container = document.getElementById('recentInvestmentsList');
  if (!container) return;

  if (investments.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">Nenhum investimento recente</p>';
    return;
  }

  const recent = investments.slice(0, 5);

  container.innerHTML = recent.map(inv => {
    const profit = inv.current_value - inv.initial_value;
    return `
      <div style="padding: 1rem; background-color: var(--bg-color); border-radius: var(--radius-md); margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; color: var(--text-primary);">${inv.name}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
              ${inv.investment_type} - ${inv.cdi_percentage}% CDI
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600; color: var(--text-primary);">
              ${formatCurrency(inv.current_value)}
            </div>
            <div style="font-size: 0.875rem; color: ${profit >= 0 ? '#1d4ed8' : '#ef4444'};">
              ${formatCurrency(profit)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function showCalculationResult(result) {
  const resultContainer = document.getElementById('calculationResult');
  if (!resultContainer) return;

  document.getElementById('resultGrossValue').textContent = formatCurrency(result.grossValue);
  document.getElementById('resultTax').textContent = formatCurrency(result.tax);
  document.getElementById('resultNetValue').textContent = formatCurrency(result.netValue);
  document.getElementById('resultProfit').textContent = formatCurrency(result.profit);
  document.getElementById('resultYield').textContent = formatPercentage(result.yieldPercentage);
  document.getElementById('resultDays').textContent = result.days;

  resultContainer.style.display = 'block';
  resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function showPortfolioResult(allocation, totalValue) {
  const resultContainer = document.getElementById('portfolioResult');
  const tableContainer = document.getElementById('allocationTable');

  if (!resultContainer || !tableContainer) return;

  tableContainer.innerHTML = Object.entries(allocation).map(([category, data]) => `
    <div class="allocation-row">
      <div class="allocation-category">${category}</div>
      <div class="allocation-details">
        <div class="allocation-percentage">${data.percentage}%</div>
        <div class="allocation-value">${formatCurrency(data.value)}</div>
      </div>
    </div>
  `).join('');

  resultContainer.style.display = 'block';
  resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function showAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('active');
}

export function hideAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    background-color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#1d4ed8' : '#2563eb'};
    color: white;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    font-weight: 500;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
