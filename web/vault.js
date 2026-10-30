import Vault from './bend/vault.mjs';

export function initVault() {
  const amount = document.querySelector('#vault-amount');
  const direction = document.querySelector('#vault-direction');
  const status = document.querySelector('#vault-status');
  const history = document.querySelector('#vault-history');
  let ledger;
  let attempts;

  function draw() {
    for (const side of ['left', 'right']) {
      document.querySelector(`#vault-${side}`).textContent = ledger[side];
      const tokens = document.querySelector(`#vault-${side}-tokens`);
      tokens.replaceChildren(...Array.from({ length: ledger[side] }, () => document.createElement('i')));
    }
    document.querySelector('#vault-total').textContent = Vault.total(ledger);
    document.querySelector('#vault-count').textContent = `${attempts} TRANSFER ATTEMPT${attempts === 1 ? '' : 'S'}`;
  }
  function transfer() {
    if (!amount.reportValidity()) return;
    const count = Number(amount.value);
    const toRight = direction.value === 'right';
    const result = Vault.transfer(ledger, count, toRight);
    ledger = result.ledger;
    attempts++;
    const accepted = result.$ === 'Accepted';
    const route = toRight ? 'Alice → Bob' : 'Bob → Alice';
    status.textContent = accepted ? `Transferred ${count}. Total remains ${Vault.total(ledger)}.` : 'Rejected: insufficient funds. Nothing moved.';
    const row = document.createElement('li');
    row.className = accepted ? 'accepted' : 'rejected';
    const label = document.createElement('span');
    label.textContent = `${route} · ${count}`;
    const outcome = document.createElement('span');
    outcome.textContent = accepted ? 'ACCEPTED' : 'REJECTED';
    row.append(label, outcome);
    history.prepend(row);
    while (history.children.length > 3) history.lastElementChild.remove();
    draw();
  }
  function reset() {
    ledger = { $: 'Wallets', left: 80, right: 20 };
    attempts = 0;
    history.replaceChildren();
    const row = document.createElement('li');
    row.textContent = 'The ledger starts here. Try a transfer.';
    history.append(row);
    status.textContent = 'Ready. No real money involved.';
    draw();
  }
  document.querySelector('#vault-form').addEventListener('submit', event => { event.preventDefault(); transfer(); });
  document.querySelector('#vault-overdraft').addEventListener('click', () => {
    amount.value = String((direction.value === 'right' ? ledger.left : ledger.right) + 1);
    transfer();
  });
  document.querySelector('#vault-reset').addEventListener('click', reset);
  reset();
}
